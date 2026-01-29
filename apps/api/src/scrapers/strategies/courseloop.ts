import { Browser, Page } from 'playwright';
import { BaseScraper } from './base';
import { ScraperResult, ScrapedSubjectData } from '../uts/types';
import { safeValidateScrapedSubject } from '../uts/validator';
import he from 'he';
import { db } from '@ratemyunit/db/client';
import { universities, subjectCodeTemplates } from '@ratemyunit/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { subjectTemplateService } from '../../services/template';
import pino from 'pino';
import { config } from '../../config.js';
import { XMLParser } from 'fast-xml-parser';

const logger = pino({
  level: config.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
    },
  },
});

export class CourseLoopScraper extends BaseScraper {
  
  async scrapeSubject(browser: Browser, subjectCode: string): Promise<ScraperResult> {
    const scrapedAt = new Date();
    const cleanCode = subjectCode.trim();
    
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

      if (response?.status() === 429 || response?.status() === 403) {
        throw new Error(`Blocking error: ${response.status()} at ${url}`);
      }

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

  async discoverSubjects(browser: Browser): Promise<string[]> {
    const routePattern = this.config.routes?.subject || '/subject/current/:code';
    const discoveryUrl = this.config.routes?.discovery
      ? `${this.config.baseUrl}${this.config.routes.discovery}`
      : this.config.baseUrl;

    const page = await browser.newPage();
    const discoveredCodes = new Set<string>();

    try {
      logger.info(`🔎 CourseLoop discovering from: ${discoveryUrl}`);

      // Strategy 0: Check if discovery URL is a sitemap.xml
      if (discoveryUrl.endsWith('.xml') || discoveryUrl.includes('sitemap')) {
        const sitemapCodes = await this.discoverFromSitemap(page, discoveryUrl, routePattern);
        sitemapCodes.forEach(code => discoveredCodes.add(code));
        
        // If sitemap yielded nothing, try templates
        if (discoveredCodes.size === 0) {
            await this.attemptTemplateDiscovery(discoveredCodes);
        }

        logger.info(`✅ CourseLoop discovered ${discoveredCodes.size} subjects from sitemap.`);
        return Array.from(discoveredCodes);
      }

      await page.goto(discoveryUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Strategy 1: Try extracting from __NEXT_DATA__
      await this.discoverFromNextData(page, discoveredCodes);

      // Strategy 2: Fall back to link crawling
      if (discoveredCodes.size === 0) {
        await this.discoverFromLinks(page, routePattern, discoveredCodes);
      }
      
      // Strategy 3: Check templates if still 0
      if (discoveredCodes.size === 0) {
          logger.info('📋 Link crawling found 0 codes, attempting template-based discovery as last resort');
          await this.attemptTemplateDiscovery(discoveredCodes);
      }

      logger.info(`✅ CourseLoop discovered ${discoveredCodes.size} subjects.`);
    } catch (e) {
      logger.error({ err: e }, `CourseLoop discovery failed`);
    } finally {
      await page.close();
    }

    return Array.from(discoveredCodes);
  }

  private async discoverFromSitemap(page: Page, url: string, routePattern: string, depth: number = 0): Promise<string[]> {
    if (depth > 3) return []; // Prevent infinite recursion

    logger.info(`📑 Detected sitemap, parsing XML: ${url} (depth ${depth})`);
    try {
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      if (!response?.ok()) {
        logger.warn(`⚠️ Sitemap fetch failed: ${url} (${response?.status()})`);
        return [];
      }

      const xmlContent = await page.content();
      
      // Extract codes from this sitemap
      const codes = new Set(this.extractCodesFromSitemap(xmlContent, routePattern));
      
      // Use fast-xml-parser to find nested sitemaps safely
      const parser = new XMLParser({
        ignoreAttributes: false,
        processEntities: false, // Disable entity expansion to prevent XML bomb
      });
      const jsonObj = parser.parse(xmlContent);
      
      const nestedUrls: string[] = [];
      
      // Handle sitemap index
      if (jsonObj.sitemapindex?.sitemap) {
        const sitemaps = Array.isArray(jsonObj.sitemapindex.sitemap) ? jsonObj.sitemapindex.sitemap : [jsonObj.sitemapindex.sitemap];
        nestedUrls.push(...sitemaps.map((s: { loc?: string }) => s.loc).filter((loc: unknown): loc is string => !!loc));
      } 
      
      // Standard sitemap might also point to other sitemaps in loc
      if (jsonObj.urlset?.url) {
        const locs = Array.isArray(jsonObj.urlset.url) ? jsonObj.urlset.url : [jsonObj.urlset.url];
        const possibleSitemaps = locs.map((u: { loc?: string }) => u.loc).filter((l: unknown): l is string => typeof l === 'string' && l.endsWith('.xml'));
        nestedUrls.push(...possibleSitemaps);
      }

      for (const nestedUrl of nestedUrls) {
        if (nestedUrl !== url) {
          const nestedCodes = await this.discoverFromSitemap(page, nestedUrl, routePattern, depth + 1);
          nestedCodes.forEach(c => codes.add(c));
        }
      }

      return Array.from(codes);
    } catch (err) {
      logger.error({ err }, `Sitemap processing failed: ${url}`);
      return [];
    }
  }

  private async attemptTemplateDiscovery(discoveredCodes: Set<string>): Promise<void> {
      logger.info('📋 Attempting template-based discovery');
      const templateCodes = await this.getCodesFromTemplates();

      if (templateCodes.length > 0) {
        logger.info(`📝 Generated ${templateCodes.length} codes from templates`);
        templateCodes.forEach(code => discoveredCodes.add(code));
      } else {
        logger.warn('⚠️ No templates found, using hardcoded fallback if applicable');
        if (this.config.baseUrl.includes('coursehandbook.uts.edu.au')) {
          logger.info('📋 Using hardcoded UTS range 31001-39999 as final fallback');
          for (let code = 31001; code <= 39999; code++) {
            discoveredCodes.add(code.toString());
          }
        }
      }
  }

  private async discoverFromNextData(page: Page, discoveredCodes: Set<string>): Promise<void> {
      const nextData = await page.evaluate(() => {
        const script = document.getElementById('__NEXT_DATA__');
        if (script) {
          try { return JSON.parse(script.innerText); } catch { return null; }
        }
        return null;
      });

      if (nextData?.props?.pageProps) {
        const pageProps = nextData.props.pageProps;
        const possibleArrays = [
          pageProps.subjects,
          pageProps.units,
          pageProps.courses,
          pageProps.data?.subjects,
          pageProps.data?.units,
        ];

        for (const arr of possibleArrays) {
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item?.code) discoveredCodes.add(item.code);
              if (item?.subject_code) discoveredCodes.add(item.subject_code);
            }
          }
        }
      }
  }

  private async discoverFromLinks(page: Page, routePattern: string, discoveredCodes: Set<string>): Promise<void> {
      logger.info('📋 __NEXT_DATA__ extraction found 0 codes, falling back to link crawling');

      const escapedPattern = routePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexString = escapedPattern.replace(':code', '([a-zA-Z0-9]{3,10})');
      const regex = new RegExp(regexString);

      const hrefs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a'))
          .map(a => a.getAttribute('href'))
          .filter(Boolean) as string[];
      });

      for (const href of hrefs) {
        const match = href.match(regex);
        if (match && match[1]) {
          discoveredCodes.add(match[1]);
        }
      }
  }

  private async getCodesFromTemplates(): Promise<string[]> {
    try {
      const universityId = await this.getUniversityId();
      if (!universityId) {
        return [];
      }

      const templates = await db
        .select()
        .from(subjectCodeTemplates)
        .where(
          and(
            eq(subjectCodeTemplates.universityId, universityId),
            eq(subjectCodeTemplates.active, true)
          )
        )
        .orderBy(desc(subjectCodeTemplates.priority));

      if (templates.length === 0) {
        return [];
      }

      const allCodes = new Set<string>();

      for (const template of templates) {
        try {
          const templateData = {
            id: template.id,
            templateType: template.templateType,
            startCode: template.startCode,
            endCode: template.endCode,
            codeList: template.codeList,
            pattern: template.pattern,
          };

          const codes = subjectTemplateService.generateCodesFromTemplateData(templateData);
          codes.forEach(code => allCodes.add(code));
        } catch (error) {
          logger.error({ err: error }, `Failed to generate codes from template ${template.id}`);
        }
      }

      return Array.from(allCodes);
    } catch (error) {
      logger.error({ err: error }, 'Failed to get codes from templates');
      return [];
    }
  }

  private async getUniversityId(): Promise<string | null> {
    try {
      const [university] = await db
        .select()
        .from(universities)
        .where(eq(universities.name, this.universityName))
        .limit(1);

      return university?.id || null;
    } catch (error) {
      logger.error({ err: error }, `Failed to get university ID for ${this.universityName}`);
      return null;
    }
  }

  private extractCodesFromSitemap(xmlContent: string, routePattern: string): string[] {
    const codes = new Set<string>();
    
    try {
      const parser = new XMLParser({
        ignoreAttributes: false,
        processEntities: false, // Disable entity expansion
      });
      const jsonObj = parser.parse(xmlContent);
      
      if (!jsonObj.urlset?.url) return [];
      
      const urls = Array.isArray(jsonObj.urlset.url) ? jsonObj.urlset.url : [jsonObj.urlset.url];
      const locs: string[] = urls.map((u: { loc?: string }) => u.loc).filter((loc: unknown): loc is string => !!loc);

      const escapedPattern = routePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regexString = escapedPattern.replace(':code', '([a-zA-Z0-9]{3,10})');
      const regex = new RegExp(regexString, 'i');

      for (const url of locs) {
        const match = url.match(regex);
        if (match && match[1]) {
          codes.add(match[1].toUpperCase());
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to parse sitemap XML');
    }

    return Array.from(codes);
  }

  private extractFromNextData(content: Record<string, unknown>, code: string): Partial<ScrapedSubjectData> {
    // CourseLoop JSON structure is fairly consistent
    return {
      code: (content.code as string) || code,
      name: (content.title as string) || 'Unknown Subject',
      creditPoints: parseInt(content.credit_points as string, 10) || 6,
      description: this.stripHtml(content.description as string) || 'No description available.',
      faculty: content.parent_academic_org as string,
      prerequisites: this.extractPrereqsFromAssociations(content.associations as unknown[]),
      sessions: this.parseOfferings(content.offering as unknown[]),
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
    } catch {
      // Intentionally empty
    }
    return '';
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    const decoded = he.decode(html);
    return decoded.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private extractPrereqsFromAssociations(associations: unknown[]): string | undefined {
    if (!associations || !Array.isArray(associations)) return undefined;
    const prereqAssoc = (associations as Array<{ association_type?: string; associated_items?: unknown[] }>).find(a => 
      a.association_type === 'Prerequisites' || a.association_type === 'Recommended studies'
    );
    if (prereqAssoc?.associated_items) {
      return (prereqAssoc.associated_items as Array<{ assoc_code?: string; assoc_title?: string }>)
        .map((item) => `${item.assoc_code} ${item.assoc_title}`)
        .join(', ');
    }
    return undefined;
  }

  private parseOfferings(offerings: unknown[]): string[] {
    if (!offerings || !Array.isArray(offerings)) return [];
    return (offerings as Array<{ teaching_period?: string }>).map(o => o.teaching_period).filter((tp): tp is string => !!tp);
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
    } catch {
      // Intentionally empty
    }
    return 6;
  }

  private async extractSessions(page: Page): Promise<string[]> {
    try {
       // Generic session extraction
       const text = await page.textContent('body');
       const matches = text?.match(/(autumn|spring|summer|winter)\s+(session|20\d{2})/gi);
       if (matches) return [...new Set(matches.map(m => m.trim()))];
    } catch {
      // Intentionally empty
    }
    return [];
  }
}
