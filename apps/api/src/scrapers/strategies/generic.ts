import { Browser, Page } from 'playwright';
import { BaseScraper } from './base';
import { ScraperResult } from '../uts/types';
import { safeValidateScrapedSubject } from '../uts/validator';
import he from 'he';

export class GenericDomScraper extends BaseScraper {

  async scrapeSubject(browser: Browser, subjectCode: string): Promise<ScraperResult> {
    const scrapedAt = new Date();
    const cleanCode = subjectCode.trim();
    
    // Config must provide selectors
    const selectors = this.config.selectors;
    if (!selectors) {
      return {
        success: false,
        subjectCode: cleanCode,
        error: `No selectors configured for ${this.universityName}`,
        scrapedAt
      };
    }

    const routePattern = this.config.routes?.subject || '/:code';
    const url = `${this.config.baseUrl}${routePattern.replace(':code', cleanCode)}`;

    const page = await browser.newPage();

    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      if (response?.status() === 404) {
        return { success: false, subjectCode: cleanCode, error: '404 Not Found', scrapedAt };
      }

      // Extract using selectors from config. Fail loudly for Title.
      // We assume 'title' is critical.
      const name = await this.getText(page, selectors.title, true); // <--- Required
      
      const description = selectors.description 
        ? await this.getText(page, selectors.description) 
        : 'No description.';
        
      const faculty = selectors.faculty 
        ? await this.getText(page, selectors.faculty) 
        : undefined;
        
      const creditPointsText = selectors.creditPoints 
        ? await this.getText(page, selectors.creditPoints) 
        : '6';
      
      const creditPoints = parseInt(creditPointsText.replace(/\D/g, ''), 10) || 6;

      const data = {
        code: cleanCode,
        name: name || 'Unknown Subject', // Should not happen with required=true but typescript safety
        description: this.cleanText(description),
        creditPoints,
        faculty: faculty ? this.cleanText(faculty) : undefined,
        sessions: [] // TODO: Add selector for sessions list
      };

      const validation = safeValidateScrapedSubject(data);

      return {
        success: true,
        subjectCode: cleanCode,
        data: validation.success ? validation.data : undefined,
        error: validation.success ? undefined : `Validation failed: ${validation.error}`,
        scrapedAt
      };

    } catch (error) {
       return { success: false, subjectCode: cleanCode, error: String(error), scrapedAt };
    } finally {
      await page.close();
    }
  }

  private async getText(page: Page, selector: string, required = false): Promise<string> {
    try {
      // Use waitFor for required elements to ensure they load
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

  private cleanText(text: string): string {
    return he.decode(text).replace(/\s+/g, ' ').trim();
  }
}