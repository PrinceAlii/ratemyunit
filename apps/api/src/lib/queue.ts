import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { chromium, Browser } from 'playwright';
import { config } from '../config.js';
import { scraperService } from '../services/scraper.js';
import { createPool, Pool } from 'generic-pool';
import { createLogger } from './logger.js';
import { db } from '@ratemyunit/db/client';
import { units } from '@ratemyunit/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { isBrowserCrashErrorMessage } from '../scrapers/strategies/utils.js';
import {
  recordBrowserCrashLikeError,
  recordBrowserRecoveryAttempt,
  recordBrowserRecoveryOutcome,
  recordEnqueueBatchError,
  recordEnqueueBatchResult,
  recordQueueInputNormalization,
} from './scraper-diagnostics.js';

const logger = createLogger('queue');

const redisUrl = new URL(config.REDIS_URL);
const redisDb =
  redisUrl.pathname && redisUrl.pathname !== '/'
    ? Number(redisUrl.pathname.slice(1))
    : undefined;

const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: redisUrl.port ? Number(redisUrl.port) : 6379,
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  db: Number.isNaN(redisDb) ? undefined : redisDb,
  maxRetriesPerRequest: null, // Required by BullMQ
  ...(redisUrl.protocol === 'rediss:' ? { tls: {} } : {}),
};

export const QUEUE_NAME = 'scraper-queue';

const normalizeUnitCode = (code: string) => code.trim().toUpperCase();
const buildJobId = (universityId: string, unitCode: string) =>
  `scrape-${universityId}-${normalizeUnitCode(unitCode)}`;

// Queue for producers
export const scraperQueue = new Queue(QUEUE_NAME, {
  connection,
});

export interface ScrapeJobData {
  type: 'scrape' | 'discovery';
  unitCode?: string;
  universityId: string;
}
interface UniversityThrottleState {
  consecutiveBlockingErrors: number;
  nextAllowedAt: number;
}

const MAX_UNIVERSITY_COOLDOWN_MS = 5 * 60 * 1000;
const throttleStateByUniversity = new Map<string, UniversityThrottleState>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomJitter = (maxMs: number) => {
  if (maxMs <= 0) return 0;
  return Math.floor(Math.random() * (maxMs + 1));
};

const isRateLimitedError = (message?: string) => {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('blocking error') ||
    lower.includes('429') ||
    lower.includes('403') ||
    lower.includes('timeout') ||
    lower.includes('navigation failed') ||
    lower.includes('net::err')
  );
};

const isRetryableScrapeError = (message?: string) =>
  isRateLimitedError(message) || isBrowserCrashErrorMessage(message);

const getThrottleState = (universityId: string) => {
  const existing = throttleStateByUniversity.get(universityId);

  if (existing) {
    return existing;
  }

  const initialState: UniversityThrottleState = {
    consecutiveBlockingErrors: 0,
    nextAllowedAt: Date.now(),
  };

  throttleStateByUniversity.set(universityId, initialState);
  return initialState;
};

const waitForUniversitySlot = async (universityId: string, context: string) => {
  const state = getThrottleState(universityId);
  const now = Date.now();
  const cooldownDelayMs = Math.max(0, state.nextAllowedAt - now);
  const spacingDelayMs =
    config.SCRAPER_REQUEST_DELAY_MS + randomJitter(config.SCRAPER_REQUEST_JITTER_MS);
  const totalDelayMs = cooldownDelayMs + spacingDelayMs;

  state.nextAllowedAt = now + totalDelayMs;

  if (totalDelayMs > 0) {
    logger.info(
      { universityId, context, delayMs: totalDelayMs, cooldownDelayMs, spacingDelayMs },
      'Applying scraper pacing delay'
    );
    await sleep(totalDelayMs);
  }
};

const registerBlockingError = (universityId: string, message?: string) => {
  if (!isRateLimitedError(message)) {
    return;
  }

  const state = getThrottleState(universityId);
  state.consecutiveBlockingErrors += 1;

  if (state.consecutiveBlockingErrors < config.SCRAPER_BLOCKING_THRESHOLD) {
    logger.warn(
      {
        universityId,
        consecutiveBlockingErrors: state.consecutiveBlockingErrors,
        blockingThreshold: config.SCRAPER_BLOCKING_THRESHOLD,
      },
      'Detected blocking-like error; threshold not yet reached'
    );
    return;
  }

  const exponent = state.consecutiveBlockingErrors - config.SCRAPER_BLOCKING_THRESHOLD;
  const cooldownMs = Math.min(
    config.SCRAPER_BLOCK_COOLDOWN_MS * Math.pow(2, exponent),
    MAX_UNIVERSITY_COOLDOWN_MS
  );

  state.nextAllowedAt = Math.max(state.nextAllowedAt, Date.now() + cooldownMs);

  logger.warn(
    {
      universityId,
      cooldownMs,
      consecutiveBlockingErrors: state.consecutiveBlockingErrors,
      nextAllowedAt: new Date(state.nextAllowedAt).toISOString(),
    },
    'Escalating scraper cooldown after repeated blocking-like errors'
  );
};

const resetThrottleState = (universityId: string) => {
  const state = getThrottleState(universityId);
  state.consecutiveBlockingErrors = 0;
};

// Browser Pool Factory
const browserFactory = {
  create: async (): Promise<Browser> => {
    logger.info('🌐 Launching Worker Browser...');
    try {
        return await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-default-apps',
                '--disable-sync',
                '--password-store=basic',
                '--use-mock-keychain',
            ],
            timeout: 60000,
        });
    } catch (error) {
        logger.error({ err: error }, '❌ Failed to launch browser');
        throw error;
    }
  },
  destroy: async (browser: Browser): Promise<void> => {
    logger.info('♻️ Destroying Worker Browser...');
    try {
      await browser.close();
      logger.info('✅ Browser closed successfully');
    } catch (error) {
      logger.error({ err: error }, '❌ Failed to close browser - may have already crashed');
    }
  },
  validate: async (browser: Browser): Promise<boolean> => {
    try {
      // Check if browser is still alive by getting its version
      await browser.version();
      return true;
    } catch (error) {
      logger.warn({ err: error }, '⚠️ Browser health check failed - marking for destruction');
      return false;
    }
  },
};

export const browserPool: Pool<Browser> = createPool(browserFactory, {
  min: 1,
  max: config.SCRAPER_CONCURRENCY,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 30000,
  evictionRunIntervalMillis: 1000,
  testOnBorrow: true,
});

// Worker setup
export function setupWorker() {
  logger.info('👷 Setting up Scraper Worker...');

  const worker = new Worker<ScrapeJobData>(
    QUEUE_NAME,
    async (job) => {
      const { type, unitCode, universityId } = job.data;
      await waitForUniversitySlot(universityId, `job:${job.id ?? 'unknown'}`);
      
      if (type === 'discovery') {
          logger.info(`🔍 Processing Discovery Job ${job.id} for Uni: ${universityId}`);
          let browser: Browser | null = null;
          try {
              browser = await browserPool.acquire();
              logger.info(`📡 Calling scraperService.discoverUnits(${universityId})...`);
              const codes = await scraperService.discoverUnits(universityId, browser);
              
              logger.info(`✅ Discovery completed. Received ${codes.length} unit codes`);

              const preview = codes.slice(0, 10).join(', ');
              logger.info(`🔎 Discovery found ${codes.length} units${codes.length > 0 ? `: ${preview}${codes.length > 10 ? '...' : ''}` : ''}`);

              const normalizedCodes = Array.from(
                new Set(codes.map(normalizeUnitCode))
              );

              const existingUnitCodes = new Set<string>();

              if (normalizedCodes.length > 0) {
                const existingUnits = await db
                  .select({ unitCode: units.unitCode })
                  .from(units)
                  .where(
                    and(
                      eq(units.universityId, universityId),
                      inArray(units.unitCode, normalizedCodes)
                    )
                  );

                existingUnits.forEach((unit: { unitCode: string }) => {
                  existingUnitCodes.add(normalizeUnitCode(unit.unitCode));
                });
              }

              recordQueueInputNormalization(
                'discovery',
                codes.length,
                normalizedCodes.length,
                existingUnitCodes.size
              );

              const pendingCodes = normalizedCodes.filter(
                (code) => !existingUnitCodes.has(code)
              );
              logger.info(
                {
                  universityId,
                  pendingCodes: pendingCodes.length,
                  alreadyIndexed: existingUnitCodes.size,
                },
                'Discovery queue summary before enqueue (BullMQ jobId deduplication enabled)'
              );

              // Bulk add scrape jobs
              const jobs = pendingCodes.map(code => ({
                  name: `scrape-${code}`,
                  data: {
                      type: 'scrape' as const,
                      unitCode: code,
                      universityId
                  },
                  opts: { 
                      jobId: buildJobId(universityId, code), // Deduplication
                      backoff: {
                          type: 'exponential',
                          delay: 5000, // Start with 5s delay
                      },
                      attempts: 5, // Retry up to 5 times
                  } 
              }));

              logger.info(`📦 Prepared ${jobs.length} scrape jobs for queueing`);

              if (jobs.length > 0) {
                  logger.info(`🚀 Adding ${jobs.length} jobs to queue...`);
                  const batchStartedAtMs = Date.now();
                  try {
                    const addedJobs = await scraperQueue.addBulk(jobs);
                    recordEnqueueBatchResult('discovery', jobs.length, addedJobs, batchStartedAtMs);
                  } catch (error) {
                    recordEnqueueBatchError();
                    throw error;
                  }
                  logger.info(
                    {
                      universityId,
                      requested: jobs.length,
                    },
                    'Discovery enqueue completed (duplicates resolved by BullMQ jobId)'
                  );
              } else {
                  logger.warn(`⚠️ No jobs to queue (codes array was empty)`);
              }

              resetThrottleState(universityId);
          } catch (e) {
              logger.error({ err: e }, `❌ Discovery failed for ${universityId}`);
              if (e instanceof Error) {
                registerBlockingError(universityId, e.message);
              }
              throw e;
          } finally {
              if (browser) await browserPool.release(browser);
          }
      } else {
          // Default scrape
          if (!unitCode) throw new Error('Unit code required for scrape job');
          logger.info(`Processing Scrape Job ${job.id}: ${unitCode} (Uni: ${universityId})`);
          
          let browser: Browser | null = null;
          let browserRecycled = false;
          let recoveryOutcomeRecorded = false;
          const startedAt = Date.now();
          try {
            browser = await browserPool.acquire();
            let result = await scraperService.scrapeUnit(unitCode, universityId, browser);

            if (!result.success && isBrowserCrashErrorMessage(result.error)) {
              recordBrowserCrashLikeError();
              recordBrowserRecoveryAttempt();
              logger.warn(
                { unitCode, universityId, error: result.error },
                'Detected browser crash-like error from scraper result; recycling browser and retrying once'
              );

              await browserPool.destroy(browser);
              browser = null;
              browserRecycled = true;

              browser = await browserPool.acquire();
              result = await scraperService.scrapeUnit(unitCode, universityId, browser);

              const recoveryWorked = !isBrowserCrashErrorMessage(result.error);
              recordBrowserRecoveryOutcome(recoveryWorked);
              recoveryOutcomeRecorded = true;
            }
            
            if (!result.success) {
                logger.warn(
                  {
                    unitCode,
                    universityId,
                    error: result.error,
                    browserRecycled,
                    durationMs: Date.now() - startedAt,
                  },
                  'Scrape failed'
                );
                
                // Check if we should retry (Blocking errors or Timeouts)
                const errorMessage = result.error || 'Unknown scraping error';
                const isRetryable = isRetryableScrapeError(result.error);

                if (isRetryable) {
                    if (isRateLimitedError(result.error)) {
                      registerBlockingError(universityId, result.error);
                    }

                    const state = getThrottleState(universityId);
                    logger.warn(
                      {
                        jobId: job.id,
                        unitCode,
                        universityId,
                        error: result.error,
                        browserRecycled,
                        consecutiveBlockingErrors: state.consecutiveBlockingErrors,
                        durationMs: Date.now() - startedAt,
                      },
                      'Retrying job due to retryable scraper failure'
                    );
                    throw new Error(result.error); // Throwing triggers BullMQ retry with backoff
                }

                // Non-retryable failure (e.g. unit not found) - mark failed without retry
                await job.discard();
                throw new Error(errorMessage);
            } else {
                resetThrottleState(universityId);
                await job.updateProgress({
                  status: 'indexed',
                  unitCode,
                  universityId,
                  durationMs: Date.now() - startedAt,
                  browserRecycled,
                });
            }
          } catch (e) {
              logger.error(
                {
                  err: e,
                  unitCode,
                  universityId,
                  browserRecycled,
                  durationMs: Date.now() - startedAt,
                },
                `Scrape failed for ${unitCode}`
              );

              // Check if this is a browser crash and destroy the resource if so
              if (browser && e instanceof Error) {
                if (isBrowserCrashErrorMessage(e.message)) {
                  recordBrowserCrashLikeError();

                  if (browserRecycled && !recoveryOutcomeRecorded) {
                    recordBrowserRecoveryOutcome(false);
                    recoveryOutcomeRecorded = true;
                  }

                  logger.warn('🔥 Browser crash detected - destroying browser instance');
                  await browserPool.destroy(browser);
                  browser = null; // Prevent release in finally block
                }
              }

              throw e;
          } finally {
             if (browser) await browserPool.release(browser);
          }
      }
    },
    {
      connection,
      concurrency: config.SCRAPER_CONCURRENCY,
      limiter: {
        max: config.SCRAPER_RATE_LIMIT_MAX_JOBS,
        duration: config.SCRAPER_RATE_LIMIT_WINDOW_MS,
      },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    logger.error({ err }, `Job ${job?.id} failed`);
  });
  
  logger.info('✅ Scraper Worker ready');
  return worker;
}
