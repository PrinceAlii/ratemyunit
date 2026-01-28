import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { chromium, Browser } from 'playwright';
import { config } from '../config.js';
import { scraperService } from '../services/scraper.js';
import { createPool, Pool } from 'generic-pool';
import pino from 'pino';

const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

export const QUEUE_NAME = 'scraper-queue';

// Queue for producers
export const scraperQueue = new Queue(QUEUE_NAME, {
  connection,
});

export interface ScrapeJobData {
  type: 'scrape' | 'discovery';
  unitCode?: string;
  universityId: string;
}

// Browser Pool Factory
const browserFactory = {
  create: async (): Promise<Browser> => {
    logger.info('🌐 Launching Worker Browser...');
    return chromium.launch({ 
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-default-apps',
            '--disable-sync',
            '--password-store=basic',
            '--use-mock-keychain',
        ],
        timeout: 60000,
    });
  },
  destroy: async (browser: Browser): Promise<void> => {
    logger.info('♻️ Destroying Worker Browser...');
    await browser.close().catch(() => {});
  },
};

const browserPool: Pool<Browser> = createPool(browserFactory, {
  min: 1,
  max: config.SCRAPER_CONCURRENCY,
  acquireTimeoutMillis: 60000,
  idleTimeoutMillis: 30000,
  evictionRunIntervalMillis: 1000,
});

// Worker setup
export function setupWorker() {
  logger.info('👷 Setting up Scraper Worker...');

  // Adaptive Throttling State
  let consecutiveBlockingErrors = 0;
  const BLOCKING_THRESHOLD = 5;
  const BACKOFF_DELAY_MS = 10000;
  const MAX_BACKOFF = 300000; // 5 minutes
  let backoffMultiplier = 1;

  const worker = new Worker<ScrapeJobData>(
    QUEUE_NAME,
    async (job) => {
      // Adaptive Throttling Check
      if (consecutiveBlockingErrors >= BLOCKING_THRESHOLD) {
          const delay = BACKOFF_DELAY_MS * Math.pow(2, backoffMultiplier - 1);
          const actualDelay = Math.min(delay, MAX_BACKOFF);
          logger.warn(`🛑 High blocking error rate detected (${consecutiveBlockingErrors}). Pausing worker for ${actualDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, actualDelay));
          
          // Probe with reduced rate
          backoffMultiplier++;
      }

      const { type, unitCode, universityId } = job.data;
      
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

              // Bulk add scrape jobs
              const jobs = codes.map(code => ({
                  name: `scrape-${code}`,
                  data: {
                      type: 'scrape' as const,
                      unitCode: code,
                      universityId
                  },
                  opts: { 
                      jobId: `scrape-${universityId}-${code}`, // Deduplication
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
                  await scraperQueue.addBulk(jobs);
                  logger.info(`✅ Successfully queued ${jobs.length} scrape jobs!`);
              } else {
                  logger.warn(`⚠️ No jobs to queue (codes array was empty)`);
              }
          } catch (e) {
              logger.error({ err: e }, `❌ Discovery failed for ${universityId}`);
              throw e;
          } finally {
              if (browser) await browserPool.release(browser);
          }
      } else {
          // Default scrape
          if (!unitCode) throw new Error('Unit code required for scrape job');
          logger.info(`Processing Scrape Job ${job.id}: ${unitCode} (Uni: ${universityId})`);
          
          let browser: Browser | null = null;
          try {
            browser = await browserPool.acquire();
            const result = await scraperService.scrapeUnit(unitCode, universityId, browser);
            
            if (!result.success) {
                logger.warn(`⚠️ Scrape failed for ${unitCode}: ${result.error}`);
                
                // Check if we should retry (Blocking errors or Timeouts)
                if (result.error && (
                    result.error.includes('Blocking error') || 
                    result.error.includes('429') || 
                    result.error.includes('403') || 
                    result.error.includes('Timeout') ||
                    result.error.includes('Navigation failed')
                )) {
                    consecutiveBlockingErrors++; 
                    logger.warn(`🔄 Retrying job ${job.id} due to transient error: ${result.error}. Consecutive errors: ${consecutiveBlockingErrors}`);
                    throw new Error(result.error); // Throwing triggers BullMQ retry with backoff
                }
            } else {
                // Success - reset blocking counter
                consecutiveBlockingErrors = 0;
                backoffMultiplier = 1;
            }
          } catch (e) {
              logger.error({ err: e }, `Scrape failed for ${unitCode}`);
              // If it's a critical browser error, we might want to destroy the resource
              // but generic-pool handles health checks if configured. 
              // For now we just release it, but in a real crash scenario playright might have closed it.
              // If we wanted to be safer, we could pool.destroy(browser) here if e is a browser crash.
              throw e;
          } finally {
             if (browser) await browserPool.release(browser);
          }
      }
    },
    {
      connection,
      concurrency: config.SCRAPER_CONCURRENCY,
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    logger.error({ err }, `Job ${job?.id} failed`);
  });
  
  // Cleanup on exit
  process.on('SIGTERM', async () => {
      await browserPool.drain().then(() => browserPool.clear());
      await worker.close();
  });

  logger.info('✅ Scraper Worker ready');
  return worker;
}