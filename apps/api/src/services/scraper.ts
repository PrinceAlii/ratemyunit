import { db } from '@ratemyunit/db/client';
import { units, universities } from '@ratemyunit/db/schema';
import { eq } from 'drizzle-orm';
import { chromium } from 'playwright';
import { ScraperFactory } from '../scrapers/factory';
import { ScraperConfigSchema } from '../scrapers/strategies/base';
import type { ScraperResult } from '../scrapers/uts/types';

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

    const selectorsObj = (scraperSelectors as any) || {};
    const searchConfig = selectorsObj.search;
    
    // Filter out nested configurations to ensure compatibility with string-based selector records
    const cleanSelectors: Record<string, string> = {};
    for (const [key, value] of Object.entries(selectorsObj)) {
        if (key !== 'search' && typeof value === 'string') {
            cleanSelectors[key] = value;
        }
    }

    const routesObj = (scraperRoutes as any) || {};
    const baseUrl = routesObj.base || uni.handbookUrl || '';
    
    const configToValidate = {
      baseUrl,
      routes: scraperRoutes,
      selectors: cleanSelectors,
      search: searchConfig
    };

    const parseResult = ScraperConfigSchema.safeParse(configToValidate);

    if (!parseResult.success) {
      throw new Error(`Invalid scraper configuration for ${uni.name}: ${parseResult.error.message}`);
    }

    return { uni, scraper: ScraperFactory.createScraper(uni.scraperType as any, uni.name, parseResult.data) };
  }

  async discoverUnits(universityId: string): Promise<string[]> {
    const { scraper } = await this.getUniversityScraper(universityId);
    const browser = await chromium.launch({ headless: true });
    try {
        return await scraper.discoverSubjects(browser);
    } finally {
        await browser.close();
    }
  }

  async scrapeUnit(unitCode: string, universityId?: string, existingBrowser?: any): Promise<{
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
    const results: ScraperResult[] = [];

    try {
      for (let i = 0; i < unitCodes.length; i++) {
        const code = unitCodes[i];
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
        results.push(res);
      }
    } finally {
      await browser.close();
    }
    
    return results;
  }
}

export const scraperService = new ScraperService();
