import { Browser, Page } from 'playwright';
import { BaseScraper } from './base';
import { ScraperResult } from '../uts/types';
import { safeValidateScrapedSubject } from '../uts/validator';
import he from 'he';
import pino from 'pino';
import { config } from '../../config.js';

const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export class GenericDomScraper extends BaseScraper {

  async scrapeSubject(browser: Browser, subjectCode: string): Promise<ScraperResult> {
    const scrapedAt = new Date();
    const cleanCode = subjectCode.trim();
    
    const routePattern = this.config.routes?.subject;
    if (!routePattern) {
        return { success: false, subjectCode: cleanCode, error: 'No subject route configured', scrapedAt };
    }

    const url = `${this.config.baseUrl}${routePattern.replace(':code', cleanCode)}`;
    const page = await browser.newPage();

    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      if (response?.status() === 404) {
        return { success: false, subjectCode: cleanCode, error: '404 Not Found', scrapedAt };
      }

      return await this.extractFromPage(page, cleanCode);

    } catch (error) {
       return { success: false, subjectCode: cleanCode, error: String(error), scrapedAt };
    } finally {
      await page.close();
    }
  }

  async discoverSubjects(browser: Browser): Promise<string[]> {
    const routePattern = this.config.routes?.subject;
    if (!routePattern) return [];

    // Construct regex from route pattern
    const escapedPattern = routePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexString = escapedPattern.replace(':code', '([a-zA-Z0-9\\-_]{3,10})');
    const regex = new RegExp(regexString);

    const startUrl = this.config.routes?.discovery 
        ? `${this.config.baseUrl}${this.config.routes.discovery}` 
        : this.config.baseUrl;

    const page = await browser.newPage();
    const discoveredCodes = new Set<string>();

    try {
        logger.info(`🔎 Discovering from: ${startUrl}`);
        await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        await page.waitForTimeout(2000);

        const hrefs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a'))
                .map(a => a.getAttribute('href'))
                .filter((href): href is string => typeof href === 'string');
        });

        for (const href of hrefs) {
            const match = href.match(regex);
            if (match && match[1]) {
                discoveredCodes.add(match[1]);
            }
        }
        
        logger.info(`✅ Discovered ${discoveredCodes.size} units on shallow scan.`);

    } catch (e) {
        logger.error({ err: e }, `Discovery failed`);
    } finally {
        await page.close();
    }

    return Array.from(discoveredCodes);
  }

  protected async extractFromPage(page: Page, subjectCode: string): Promise<ScraperResult> {
    const scrapedAt = new Date();
    const selectors = this.config.selectors;
    
    if (!selectors) {
        return { success: false, subjectCode, error: 'No selectors configured', scrapedAt };
    }

    try {
        const titleSelector = selectors['title'];
        if (!titleSelector) throw new Error('Title selector missing');

        const name = await this.getText(page, titleSelector, true);
        const description = selectors['description'] ? await this.getText(page, selectors['description']) : 'No description.';
        const faculty = selectors['faculty'] ? await this.getText(page, selectors['faculty']) : undefined;
        const creditPointsText = selectors['creditPoints'] ? await this.getText(page, selectors['creditPoints']) : '6';
        const creditPoints = parseInt(creditPointsText.replace(/\D/g, ''), 10) || 6;

        const data = {
            code: subjectCode,
            name: name || 'Unknown Subject',
            description: this.cleanText(description),
            creditPoints,
            faculty: faculty ? this.cleanText(faculty) : undefined,
            sessions: [] 
        };

        const validation = safeValidateScrapedSubject(data);

        return {
            success: true,
            subjectCode,
            data: validation.success ? validation.data : undefined,
            error: validation.success ? undefined : `Validation failed: ${validation.error}`,
            scrapedAt
        };
    } catch (e) {
        return { success: false, subjectCode, error: String(e), scrapedAt };
    }
  }

  protected async getText(page: Page, selector: string, required = false): Promise<string> {
    try {
      if (required) {
        await page.locator(selector).first().waitFor({ state: 'visible', timeout: 5000 });
      }
      const el = page.locator(selector).first();
      if (await el.isVisible()) {
        return (await el.innerText()).trim();
      }
      if (required) throw new Error(`Required selector '${selector}' visible check failed`);
      return '';
    } catch (e) {
      if (required) {
        throw new Error(`Critical selector not found: ${selector}. Error: ${e instanceof Error ? e.message : String(e)}`);
      }
      return '';
    }
  }

  protected cleanText(text: string): string {
    return he.decode(text).replace(/\s+/g, ' ').trim();
  }
}