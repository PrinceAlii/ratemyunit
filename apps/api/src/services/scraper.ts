import { db } from '@ratemyunit/db/client';
import { units, universities } from '@ratemyunit/db/schema';
import { eq } from 'drizzle-orm';
import { chromium, Browser } from 'playwright';
import { ScraperFactory, type ScraperType } from '../scrapers/factory.js';
import { ScraperConfigSchema } from '../scrapers/strategies/base.js';
import type { ScraperResult } from '../scrapers/uts/types.js';
import pino from 'pino';
import { config } from '../config.js';

const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

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
      try { scraperRoutes = JSON.parse(scraperRoutes); } catch { scraperRoutes = {}; }
    }

    let scraperSelectors = uni.scraperSelectors;
    if (typeof scraperSelectors === 'string') {
      try { scraperSelectors = JSON.parse(scraperSelectors); } catch { scraperSelectors = {}; }
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

  async discoverUnits(universityId: string, existingBrowser?: Browser): Promise<string[]> {
    logger.info(`🔧 ScraperService.discoverUnits called with universityId: ${universityId}`);
    const { uni, scraper } = await this.getUniversityScraper(universityId);
    logger.info(`🎓 Running discovery for ${uni.name} using ${uni.scraperType} scraper`);
    
    let browser = existingBrowser;
    let shouldClose = false;

    if (!browser) {
        logger.info(`🌐 Launching browser for discovery...`);
        browser = await chromium.launch({ headless: true });
        shouldClose = true;
    }

    try {
        logger.info(`📞 Calling scraper.discoverSubjects()...`);
        const result = await scraper.discoverSubjects(browser);
        logger.info(`✅ scraper.discoverSubjects() returned ${result.length} codes`);
        return result;
    } finally {
        if (shouldClose && browser) {
            logger.info(`🔒 Closing browser...`);
            await browser.close();
        }
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
        return {
          success: false,
          unitCode,
          error: result.error,
        };
      }

      await db
        .insert(units)
        .values({
          universityId: uni.id,
          unitCode: result.data.code,
          unitName: result.data.name,
          description: result.data.description,
          creditPoints: result.data.creditPoints,
          faculty: result.data.faculty,
          sessions: JSON.stringify(result.data.sessions),
          scrapedAt: new Date(),
          active: true,
        })
        .onConflictDoUpdate({
          target: [units.universityId, units.unitCode],
          set: {
            unitName: result.data.name,
            description: result.data.description,
            creditPoints: result.data.creditPoints,
            faculty: result.data.faculty,
            sessions: JSON.stringify(result.data.sessions),
            scrapedAt: new Date(),
            updatedAt: new Date(),
          },
        });

      return {
        success: true,
        unitCode: result.subjectCode,
        unitName: result.data.name,
      };
    } catch (error) {
      return {
        success: false,
        unitCode,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      if (shouldClose && browser) {
        await browser.close();
      }
    }
  }

  async scrapeUnits(
    unitCodes: string[],
    options?: {
      delayMs?: number;
      continueOnError?: boolean;
      universityId?: string;
    }
  ): Promise<ScraperResult[]> {
    const { delayMs = 2000, universityId } = options || {};
    const { uni, scraper } = await this.getUniversityScraper(universityId);
    
    const browser = await chromium.launch({ headless: true });
    
    try {
      // Use reduce for sequential async execution and accumulating results immutably
      const results = await unitCodes.reduce(async (accPromise, code, i) => {
        const acc = await accPromise;
        if (i > 0) await new Promise(r => setTimeout(r, delayMs));

        const res = await scraper.scrapeSubject(browser, code);
        
        if (res.success && res.data) {
           await db
            .insert(units)
            .values({
                universityId: uni.id,
                unitCode: res.data.code,
                unitName: res.data.name,
                description: res.data.description,
                creditPoints: res.data.creditPoints,
                faculty: res.data.faculty,
                sessions: JSON.stringify(res.data.sessions),
                scrapedAt: new Date(),
                active: true,
            })
            .onConflictDoUpdate({
                target: [units.universityId, units.unitCode],
                set: {
                unitName: res.data.name,
                description: res.data.description,
                creditPoints: res.data.creditPoints,
                faculty: res.data.faculty,
                sessions: JSON.stringify(res.data.sessions),
                scrapedAt: new Date(),
                updatedAt: new Date(),
                },
            });
        }
        return [...acc, res];
      }, Promise.resolve([] as ScraperResult[]));

      return results;
    } finally {
      await browser.close();
    }
  }
}

export const scraperService = new ScraperService();
