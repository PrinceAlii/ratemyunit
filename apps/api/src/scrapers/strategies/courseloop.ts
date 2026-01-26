import { Browser, Page } from 'playwright';
import { BaseScraper } from './base';
import { ScraperResult, ScrapedSubjectData } from '../uts/types';
import { safeValidateScrapedSubject } from '../uts/validator';
import he from 'he';

export class CourseLoopScraper extends BaseScraper {
  
  async scrapeSubject(browser: Browser, subjectCode: string): Promise<ScraperResult> {
    const scrapedAt = new Date();
    const cleanCode = subjectCode.trim();
    
    // Construct URL. Default pattern is common for CourseLoop.
    // e.g. https://handbook.monash.edu/current/units/:code or similar
    // The config.routes.subject should be like "/subject/current/:code" or similar relative to base
    const routePattern = this.config.routes?.subject || '/subject/current/:code';
    const relativePath = routePattern.replace(':code', cleanCode);
    const url = `${this.config.baseUrl}${relativePath}`;

    const page = await browser.newPage();

    try {
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      if (response?.status() === 404) {
        return {
          success: false,
          subjectCode: cleanCode,
          error: `Subject ${cleanCode} not found (404) at ${url}`,
          scrapedAt,
        };
      }

      // 1. Try __NEXT_DATA__ (Standard CourseLoop / Next.js app)
      const nextData = await page.evaluate(() => {
        const script = document.getElementById('__NEXT_DATA__');
        if (script) {
          try { return JSON.parse(script.innerText); } catch { return null; }
        }
        return null;
      });

      let data: Partial<ScrapedSubjectData>;

      if (nextData?.props?.pageProps?.pageContent) {
        const content = nextData.props.pageProps.pageContent;
        data = this.extractFromNextData(content, cleanCode);
      } else {
        // 2. Fallback to DOM Scraping
        data = await this.extractFromDom(page, cleanCode);
      }

      const validation = safeValidateScrapedSubject(data);

      if (!validation.success) {
        return {
          success: false,
          subjectCode: cleanCode,
          error: `Validation failed: ${validation.error}`,
          scrapedAt,
        };
      }

      return {
        success: true,
        subjectCode: cleanCode,
        data: validation.data,
        scrapedAt,
      };

    } catch (error) {
      return {
        success: false,
        subjectCode: cleanCode,
        error: error instanceof Error ? error.message : 'Unknown error',
        scrapedAt,
      };
    } finally {
      await page.close();
    }
  }

  private extractFromNextData(content: any, code: string): Partial<ScrapedSubjectData> {
    // CourseLoop JSON structure is fairly consistent
    return {
      code: content.code || code,
      name: content.title || 'Unknown Subject',
      creditPoints: parseInt(content.credit_points, 10) || 6,
      description: this.stripHtml(content.description) || 'No description available.',
      faculty: content.parent_academic_org,
      prerequisites: this.extractPrereqsFromAssociations(content.associations),
      sessions: this.parseOfferings(content.offering),
    };
  }

  private async extractFromDom(page: Page, code: string): Promise<Partial<ScrapedSubjectData>> {
    // Generic CourseLoop DOM fallback
    // Titles are usually H1 or H2
    const titleText = await this.getText(page, 'h1, h2');
    const { name } = this.parseTitle(titleText, code);
    
    return {
      code,
      name,
      creditPoints: await this.extractCreditPoints(page),
      description: await this.getText(page, '.readmore-content, #overview, .description') || 'No description.',
      faculty: await this.getText(page, 'h3:has-text("Faculty") + *, .faculty'),
      sessions: await this.extractSessions(page),
    };
  }

  // --- Helpers (Reused from UTS scraper logic but generalized) ---

  private async getText(page: Page, selector: string): Promise<string> {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible()) return (await el.innerText()).trim();
    } catch {}
    return '';
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    const decoded = he.decode(html);
    return decoded.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private extractPrereqsFromAssociations(associations: any[]): string | undefined {
    if (!associations || !Array.isArray(associations)) return undefined;
    const prereqAssoc = associations.find(a => 
      a.association_type === 'Prerequisites' || a.association_type === 'Recommended studies'
    );
    if (prereqAssoc?.associated_items) {
      return prereqAssoc.associated_items
        .map((item: any) => `${item.assoc_code} ${item.assoc_title}`)
        .join(', ');
    }
    return undefined;
  }

  private parseOfferings(offerings: any[]): string[] {
    if (!offerings || !Array.isArray(offerings)) return [];
    return offerings.map(o => o.teaching_period).filter(tp => !!tp);
  }

  private parseTitle(title: string, fallbackCode: string): { name: string } {
    // Logic to strip code from title if present
    const cleanTitle = title.replace(fallbackCode, '').replace(/^-+\s*/, '').trim();
    return { name: cleanTitle || title };
  }

  private async extractCreditPoints(page: Page): Promise<number> {
    try {
      const text = await page.getByText(/credit points?/i).first().innerText();
      const match = text.match(/(\d+)\s*cp/i);
      if (match) return parseInt(match[1], 10);
    } catch {}
    return 6;
  }

  private async extractSessions(page: Page): Promise<string[]> {
    try {
       // Generic session extraction
       const text = await page.textContent('body');
       const matches = text?.match(/(autumn|spring|summer|winter)\s+(session|20\d{2})/gi);
       if (matches) return [...new Set(matches.map(m => m.trim()))];
    } catch {}
    return [];
  }
}
