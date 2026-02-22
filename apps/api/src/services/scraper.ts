import { db } from '@ratemyunit/db/client';
import { units, universities } from '@ratemyunit/db/schema';
import { eq, sql } from 'drizzle-orm';
import { chromium, Browser } from 'playwright';
import { ScraperFactory, type ScraperType } from '../scrapers/factory.js';
import { ScraperConfigSchema } from '../scrapers/strategies/base.js';
import type { ScraperResult } from '../scrapers/uts/types.js';
import { createLogger } from '../lib/logger.js';
import { config } from '../config.js';

const logger = createLogger('scraper');
const MAX_SCRAPE_UNITS_CONCURRENCY = 20;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const randomJitter = (maxMs: number) => {
  if (maxMs <= 0) return 0;
  return Math.floor(Math.random() * (maxMs + 1));
};

const isRetryableScrapeError = (error?: string) => {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('blocking error') ||
    lower.includes('429') ||
    lower.includes('403') ||
    lower.includes('timeout') ||
    lower.includes('navigation failed') ||
    lower.includes('net::err') ||
    lower.includes('econnreset')
  );
};

const normalizeUnitCode = (code: string) => code.trim().toUpperCase();

export class ScraperService {
  
  private async getUniversityScraper(uniId?: string) {
    let uni;
    if (!uniId) {
      const [uts] = await db.select().from(universities).where(eq(universities.abbreviation, 'UTS')).limit(1);
      if (!uts) throw new Error('UTS university not found for default scraping');
      uni = uts;
    } else {
      const [found] = await db.select().from(universities).where(eq(universities.id, uniId)).limit(1);
      if (!found) throw new Error(`University not found: ${uniId}`);
      uni = found;
    }

    let scraperRoutes = uni.scraperRoutes;
    if (typeof scraperRoutes === 'string') {
      try {
        scraperRoutes = JSON.parse(scraperRoutes);
      } catch (error) {
        logger.error({ error, universityId: uni.id }, 'Failed to parse scraperRoutes, using empty object');
        scraperRoutes = {};
      }
    }

    let scraperSelectors = uni.scraperSelectors;
    if (typeof scraperSelectors === 'string') {
      try {
        scraperSelectors = JSON.parse(scraperSelectors);
      } catch (error) {
        logger.error({ error, universityId: uni.id }, 'Failed to parse scraperSelectors, using empty object');
        scraperSelectors = {};
      }
    }

    const selectorsObj = (scraperSelectors as Record<string, unknown>) || {};
    const searchConfig = selectorsObj.search as Record<string, string> | undefined;
    
    // Filter out nested configurations to ensure compatibility with string-based selector records
    const cleanSelectors = Object.entries(selectorsObj).reduce((acc, [key, value]) => {
        if (key !== 'search' && typeof value === 'string') {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, string>);

    const routesObj = (scraperRoutes as Record<string, unknown>) || {};
    const baseUrl = (routesObj.base as string) || uni.handbookUrl || '';
    
    const configToValidate = {
      baseUrl,
      routes: scraperRoutes as Record<string, string>,
      selectors: cleanSelectors,
      search: searchConfig
    };

    const parseResult = ScraperConfigSchema.safeParse(configToValidate);

    if (!parseResult.success) {
      throw new Error(`Invalid scraper configuration for ${uni.name}: ${parseResult.error.message}`);
    }

    return { uni, scraper: ScraperFactory.createScraper(uni.scraperType as ScraperType, uni.name, parseResult.data) };
  }

  private async upsertUnit(uniId: string, data: NonNullable<ScraperResult['data']>) {
    return db
      .insert(units)
      .values({
        universityId: uniId,
        unitCode: data.code,
        unitName: data.name,
        description: data.description,
        creditPoints: data.creditPoints,
        faculty: data.faculty,
        sessions: sql`${JSON.stringify(data.sessions)}::jsonb`,
        scrapedAt: new Date(),
        active: true,
      })
      .onConflictDoUpdate({
        target: [units.universityId, units.unitCode],
        set: {
          unitName: data.name,
          description: data.description,
          creditPoints: data.creditPoints,
          faculty: data.faculty,
          sessions: sql`${JSON.stringify(data.sessions)}::jsonb`,
          scrapedAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  async discoverUnits(universityId: string, existingBrowser?: Browser): Promise<string[]> {
    logger.info(`ScraperService.discoverUnits called for uni: ${universityId}`);
    const { scraper } = await this.getUniversityScraper(universityId);
    
    let browser = existingBrowser;
    let shouldClose = false;

    if (!browser) {
        browser = await chromium.launch({ headless: true });
        shouldClose = true;
    }

    try {
        return await scraper.discoverSubjects(browser);
    } finally {
        if (shouldClose && browser) await browser.close();
    }
  }

  async scrapeUnit(unitCode: string, universityId?: string, existingBrowser?: Browser): Promise<{
    success: boolean;
    unitCode: string;
    unitName?: string;
    error?: string;
  }> {
    const { uni, scraper } = await this.getUniversityScraper(universityId);
    
    let browser = existingBrowser;
    let shouldClose = false;

    if (!browser) {
        browser = await chromium.launch({ headless: true });
        shouldClose = true;
    }

    try {
      const result = await scraper.scrapeSubject(browser, unitCode);

      if (!result.success || !result.data) {
        return { success: false, unitCode, error: result.error };
      }

      await this.upsertUnit(uni.id, result.data);

      return {
        success: true,
        unitCode: unitCode,
        unitName: result.data.name,
      };
    } catch (error) {
      logger.error({ error, unitCode }, 'Failed to scrape unit');
      return {
        success: false,
        unitCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      if (shouldClose && browser) await browser.close();
    }
  }

  async scrapeUnits(
    unitCodes: string[],
    options?: {
      delayMs?: number;
      jitterMs?: number;
      maxRetries?: number;
      maxConcurrency?: number;
      continueOnError?: boolean;
      universityId?: string;
    }
  ): Promise<ScraperResult[]> {
    const {
      delayMs = config.SCRAPER_REQUEST_DELAY_MS,
      jitterMs = config.SCRAPER_REQUEST_JITTER_MS,
      maxRetries = config.SCRAPER_MAX_RETRIES,
      maxConcurrency = config.SCRAPER_CONCURRENCY,
      continueOnError = true,
      universityId
    } = options || {};

    const sanitizedCodes = Array.from(
      new Set(unitCodes.map(normalizeUnitCode).filter(Boolean))
    );

    if (sanitizedCodes.length === 0) {
      return [];
    }

    const boundedConcurrency = Math.min(
      sanitizedCodes.length,
      Math.max(1, maxConcurrency),
      MAX_SCRAPE_UNITS_CONCURRENCY
    );

    const boundedRetries = Math.max(0, maxRetries);
    const baseDelayMs = Math.max(0, delayMs);
    const maxBackoffMs = Math.max(baseDelayMs, config.SCRAPER_RETRY_MAX_DELAY_MS);

    const { uni, scraper } = await this.getUniversityScraper(universityId);
    
    const browser = await chromium.launch({ headless: true });

    try {
      const results: ScraperResult[] = new Array(sanitizedCodes.length);
      let nextIndex = 0;
      let stopRequested = false;

      const scrapeWithRetries = async (code: string): Promise<ScraperResult> => {
        for (let attempt = 0; attempt <= boundedRetries; attempt++) {
          const staggerDelay =
            attempt === 0
              ? baseDelayMs + randomJitter(jitterMs)
              : Math.min(
                  config.SCRAPER_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + randomJitter(jitterMs),
                  maxBackoffMs
                );

          if (staggerDelay > 0) {
            await sleep(staggerDelay);
          }

          const res = await scraper.scrapeSubject(browser, code);

          if (res.success && res.data) {
            await this.upsertUnit(uni.id, res.data);
            return res;
          }

          if (!isRetryableScrapeError(res.error) || attempt === boundedRetries) {
            return res;
          }

          logger.warn(
            { code, attempt: attempt + 1, maxAttempts: boundedRetries + 1, error: res.error },
            'Retrying scrape due to transient/rate-limit-like failure'
          );
        }

        return {
          success: false,
          subjectCode: code,
          error: 'Retry loop exhausted unexpectedly',
          scrapedAt: new Date(),
        };
      };

      const worker = async () => {
        while (!stopRequested) {
          const currentIndex = nextIndex;
          nextIndex += 1;

          if (currentIndex >= sanitizedCodes.length) {
            return;
          }

          const code = sanitizedCodes[currentIndex];
          const result = await scrapeWithRetries(code);
          results[currentIndex] = result;

          if (!result.success && !continueOnError) {
            stopRequested = true;
            return;
          }
        }
      };

      await Promise.all(
        Array.from({ length: boundedConcurrency }, () => worker())
      );

      return results.filter((result): result is ScraperResult => !!result);
    } finally {
      await browser.close();
    }
  }
}

export const scraperService = new ScraperService();
