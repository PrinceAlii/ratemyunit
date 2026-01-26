import { chromium, Browser, Page } from 'playwright';
import type { ScrapedSubjectData, ScraperResult } from './types';
import { safeValidateScrapedSubject } from './validator';

/**
 * UTS Subject Scraper using Playwright to extract data from the CourseLoop-
 * powered UTS handbook. This scraper navigates to subject pages and extracts
 * structured data from the rendered HTML.
 */
export class UTSSubjectScraper {
  private static readonly BASE_URL =
    'https://coursehandbook.uts.edu.au/subject/current';
  private static readonly DEFAULT_TIMEOUT = 30000;

  private browser: Browser | null = null;

  /**
   * Initializes the browser instance. Call this before scraping.
   */
  async initialize(): Promise<void> {
    if (this.browser) {
      return;
    }

    this.browser = await chromium.launch({
      headless: true,
      timeout: UTSSubjectScraper.DEFAULT_TIMEOUT,
    });
  }

  /**
   * Closes the browser instance. Call this when done scraping.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrapes data for a single subject by its code.
   *
   * @param subjectCode - The 5-digit subject code (e.g., "31251")
   * @returns Scraper result with success status and data or error
   */
  async scrapeSubject(subjectCode: string): Promise<ScraperResult> {
    const scrapedAt = new Date();

    try {
      if (!this.browser) {
        throw new Error('Browser not initialized. Call initialize() first.');
      }

      const cleanCode = subjectCode.trim();
      const url = `${UTSSubjectScraper.BASE_URL}/${cleanCode}`;

      const page = await this.browser.newPage();

      try {
        // Navigate to the subject page.
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: UTSSubjectScraper.DEFAULT_TIMEOUT,
        });

        // Check if page was found.
        if (response?.status() === 404) {
          return {
            success: false,
            subjectCode: cleanCode,
            error: `Subject ${cleanCode} not found (404)`,
            scrapedAt,
          };
        }

        // Try to extract data from __NEXT_DATA__ JSON first (much more robust)
        const nextData = await page.evaluate(() => {
          const script = document.getElementById('__NEXT_DATA__');
          if (script) {
            try {
              return JSON.parse(script.innerText);
            } catch {
              return null;
            }
          }
          return null;
        });

        let data: Partial<ScrapedSubjectData>;

        if (nextData?.props?.pageProps?.pageContent) {
          const content = nextData.props.pageProps.pageContent;

          data = {
            code: content.code || cleanCode,
            name: content.title || 'Unknown Subject',
            creditPoints: parseInt(content.credit_points, 10) || 6,
            description: this.stripHtml(content.description) || 'No description available.',
            faculty: content.parent_academic_org,
            prerequisites: this.extractPrereqsFromAssociations(content.associations),
            sessions: this.parseOfferings(content.offering),
          };
        } else {
          // Extract subject data via DOM fallback.
          data = await this.extractSubjectData(page, cleanCode);
        }

        // Validate the extracted data.
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
      } finally {
        await page.close();
      }
    } catch (error) {
      return {
        success: false,
        subjectCode: subjectCode.trim(),
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during scraping',
        scrapedAt,
      };
    }
  }

  private stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<[^>]*>?/gm, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#43;/g, '+')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }

  private extractPrereqsFromAssociations(associations: any[]): string | undefined {
    if (!associations || !Array.isArray(associations)) return undefined;
    
    const prereqAssoc = associations.find(a => a.association_type === 'Prerequisites' || a.association_type === 'Recommended studies');
    if (prereqAssoc?.associated_items) {
      return prereqAssoc.associated_items
        .map((item: any) => `${item.assoc_code} ${item.assoc_title}`)
        .join(', ');
    }
    return undefined;
  }

  private parseOfferings(offerings: any[]): string[] {
    if (!offerings || !Array.isArray(offerings)) return [];
    
    return offerings
      .map(o => o.teaching_period)
      .filter(tp => !!tp);
  }

  /**
   * Extracts subject data from the page. This method contains the core logic
   * for locating and extracting data from the HTML structure.
   *
   * @param page - Playwright page instance
   * @param subjectCode - Subject code being scraped
   * @returns Raw scraped subject data
   */
  private async extractSubjectData(
    page: Page,
    subjectCode: string
  ): Promise<Partial<ScrapedSubjectData>> {
    // Extract title (contains both code and name).
    const title = await this.extractTitle(page);
    const { code, name } = this.parseTitleForCodeAndName(title, subjectCode);

    // Extract credit points.
    const creditPoints = await this.extractCreditPoints(page);

    // Extract description.
    const description = await this.extractDescription(page);

    // Extract faculty.
    const faculty = await this.extractFaculty(page);

    // Extract prerequisites.
    const prerequisites = await this.extractPrerequisites(page);

    // Extract anti-requisites.
    const antiRequisites = await this.extractAntiRequisites(page);

    // Extract sessions.
    const sessions = await this.extractSessions(page);

    return {
      code,
      name,
      creditPoints,
      description,
      faculty,
      prerequisites,
      antiRequisites,
      sessions,
    };
  }

  private async extractTitle(page: Page): Promise<string> {
    try {
      // The actual subject title is in an H2 in the format "31251 - Name"
      const h2 = await page.locator('h2').first();
      if (await h2.isVisible()) {
        const text = (await h2.innerText()).trim();
        return text;
      }
      
      // Fallback to H1
      const h1 = await page.locator('h1').first();
      if (await h1.isVisible()) {
        return (await h1.innerText()).trim();
      }
    } catch (error) {
      console.error('Error extracting title:', error);
    }
    return '';
  }

  /**
   * Parses title to extract code and name. Titles are typically in the format
   * "31251 - Data Structures and Algorithms" or 
   * "31251 Data Structures and Algorithms" or just the name.
   */
  private parseTitleForCodeAndName(
    title: string,
    fallbackCode: string
  ): { code: string; name: string } {
    // Handle "31251 - Name" format
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      const codePart = parts[0].trim();
      if (/^\d{5}$/.test(codePart)) {
        return {
          code: codePart,
          name: parts.slice(1).join(' - ').trim(),
        };
      }
    }

    const parts = title.split(' ');
    const firstPart = parts[0];

    // Check if first part is a code (5 digits).
    if (/^\d{5}$/.test(firstPart)) {
      return {
        code: firstPart,
        name: parts.slice(1).join(' ').trim(),
      };
    }

    return {
      code: fallbackCode,
      name: title.trim(),
    };
  }

  /**
   * Extracts credit points from the page. Looks for text like "6 cp" or
   * "Credit points: 6".
   */
  private async extractCreditPoints(page: Page): Promise<number> {
    try {
      const cpElement = page.getByText(/credit points?/i).first();
      if (await cpElement.isVisible()) {
        const cpText = await cpElement.innerText();
        const match = cpText.match(/(\d+)\s*cp/i);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    } catch {
      // Ignore errors.
    }

    return 6; // Default credit points for UTS.
  }

  /**
   * Extracts the subject description. This is typically found in a specific
   * section or as the first substantial paragraph.
   */
  private async extractDescription(page: Page): Promise<string> {
    try {
      // Try to find by H3 "Subject description"
      const descHeading = page.locator('h3:has-text("Subject description")');
      if (await descHeading.isVisible()) {
        const descContent = await descHeading.locator('xpath=following-sibling::*[1]').first();
        if (await descContent.isVisible()) {
          return (await descContent.innerText()).trim();
        }
      }

      // Fallback: Get the first substantial paragraph.
      const paragraphs = await page.locator('p').allInnerTexts();
      const likelyDesc = paragraphs.find(
        (p) => p.length > 50 && !p.toLowerCase().includes('credit points')
      );

      if (likelyDesc) {
        return likelyDesc.trim();
      }
    } catch {
      // Ignore errors.
    }

    return 'No description available.';
  }

  /**
   * Extracts faculty information. Looks for text like "Faculty of Engineering
   * and IT".
   */
  private async extractFaculty(page: Page): Promise<string | undefined> {
    try {
      // Try to find by H3 "Faculty"
      const facultyHeading = page.locator('h3:has-text("Faculty")');
      if (await facultyHeading.isVisible()) {
        const facultyContent = await facultyHeading.locator('xpath=following-sibling::*[1]').first();
        if (await facultyContent.isVisible()) {
          return (await facultyContent.innerText()).trim();
        }
      }

      const facultyElement = page.getByText(/faculty of/i).first();
      if (await facultyElement.isVisible()) {
        return (await facultyElement.innerText()).trim();
      }
    } catch {
      // Ignore errors.
    }

    return undefined;
  }

  /**
   * Extracts prerequisites. Looks for a section labeled "Prerequisites" or
   * similar.
   */
  private async extractPrerequisites(page: Page): Promise<string | undefined> {
    try {
      // Requisites in CourseLoop are often in a section
      const reqHeading = page.locator('h3:has-text("Requisites")');
      if (await reqHeading.isVisible()) {
        const reqContent = await reqHeading.locator('xpath=following-sibling::*[1]').first();
        if (await reqContent.isVisible()) {
          return (await reqContent.innerText()).trim();
        }
      }

      const prereqHeading = page.getByText(/prerequisites?/i).first();
      if (await prereqHeading.isVisible()) {
        // Try to get content from the same section or next element.
        const prereqSection = prereqHeading.locator('..').first();
        if (await prereqSection.isVisible()) {
          const text = await prereqSection.innerText();
          return text.replace(/prerequisites?:?/i, '').trim();
        }
      }
    } catch {
      // Ignore errors.
    }

    return undefined;
  }

  /**
   * Extracts anti-requisites. Looks for text about subjects that cannot be
   * taken together.
   */
  private async extractAntiRequisites(
    page: Page
  ): Promise<string | undefined> {
    try {
      // Anti-requisites are often mixed in Requisites or have their own H3 if we are lucky
      const antiReqHeading = page.getByText(/anti[- ]?requisites?/i).first();
      if (await antiReqHeading.isVisible()) {
        const antiReqSection = antiReqHeading.locator('..').first();
        if (await antiReqSection.isVisible()) {
          const text = await antiReqSection.innerText();
          return text.replace(/anti[- ]?requisites?:?/i, '').trim();
        }
      }
    } catch {
      // Ignore errors.
    }

    return undefined;
  }

  /**
   * Extracts available sessions. Looks for session information like "Autumn
   * 2026", "Spring 2026".
   */
  private async extractSessions(page: Page): Promise<string[]> {
    try {
      // Availabilities section
      const availHeading = page.locator('h3:has-text("Availabilities")');
      if (await availHeading.isVisible()) {
        const availContent = await availHeading.locator('xpath=following-sibling::*[1]').first();
        if (await availContent.isVisible()) {
          const text = await availContent.innerText();
          // Extract things like "Autumn session", "Spring session" etc.
          const matches = text.match(/(autumn|spring|summer|winter)\s+(session|20\d{2})/gi);
          if (matches) {
            return [...new Set(matches.map(m => m.trim()))];
          }
        }
      }

      // Look for session-related text.
      const sessionElements = await page
        .getByText(/(autumn|spring|summer)\s+\d{4}/i)
        .all();

      const sessions: string[] = [];

      for (const element of sessionElements) {
        if (await element.isVisible()) {
          const text = await element.innerText();
          const match = text.match(/(autumn|spring|summer)\s+\d{4}/i);
          if (match) {
            sessions.push(match[0].trim());
          }
        }
      }

      return [...new Set(sessions)]; // Remove duplicates.
    } catch {
      // Ignore errors.
    }

    return [];
  }
}
