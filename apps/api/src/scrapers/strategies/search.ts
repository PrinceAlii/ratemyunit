import { Browser } from 'playwright';
import { GenericDomScraper } from './generic.js';
import { ScraperResult } from '../uts/types.js';

export class SearchDomScraper extends GenericDomScraper {

  async scrapeSubject(browser: Browser, subjectCode: string): Promise<ScraperResult> {
    const scrapedAt = new Date();
    const cleanCode = subjectCode.trim();
    
    // Check search config
    const searchConfig = this.config.search;
    const searchUrl = this.config.routes?.search;

    if (!searchConfig || !searchUrl) {
      return { 
        success: false, 
        subjectCode: cleanCode, 
        error: 'Search configuration missing (routes.search or search object)', 
        scrapedAt 
      };
    }

    const fullSearchUrl = `${this.config.baseUrl}${searchUrl}`;
    const page = await browser.newPage();

    try {
      await page.goto(fullSearchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      await page.fill(searchConfig.input, cleanCode);
      
      if (searchConfig.btn) {
        await page.click(searchConfig.btn);
      } else {
        await page.press(searchConfig.input, 'Enter');
      }

      const resultSelector = searchConfig.result;
      await page.waitForSelector(resultSelector, { timeout: 10000 });

      await Promise.all([
        page.waitForLoadState('domcontentloaded'),
        page.click(resultSelector)
      ]);

      return await this.extractFromPage(page, cleanCode);

    } catch (error) {
      return { 
        success: false, 
        subjectCode: cleanCode, 
        error: `Search/Scrape failed: ${error instanceof Error ? error.message : String(error)}`, 
        scrapedAt 
      };
    } finally {
      await page.close();
    }
  }
}
