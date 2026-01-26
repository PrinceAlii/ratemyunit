import { scrapeUTSSubject, scrapeUTSSubjects } from '../scrapers/uts';
import type { ScraperResult } from '../scrapers/uts/types';

/**
 * Legacy ScraperService maintained for backward compatibility. This now
 * delegates to the new modular UTS scraper implementation which provides
 * better structure, validation, and error handling.
 */
export class ScraperService {
  /**
   * Scrapes a single unit by its code. This method now uses the new UTS
   * scraper implementation.
   *
   * @param unitCode - The unit code to scrape (e.g., "31251")
   * @returns Scraper result with success status
   * @throws Error if scraping fails
   */
  async scrapeUnit(unitCode: string): Promise<{
    success: boolean;
    unitCode: string;
    unitName?: string;
  }> {
    const result = await scrapeUTSSubject(unitCode);

    if (!result.success) {
      throw new Error(result.error || 'Scraping failed');
    }

    return {
      success: true,
      unitCode: result.subjectCode,
      unitName: result.data?.name,
    };
  }

  /**
   * Scrapes multiple units in bulk. This is a new method that leverages the
   * bulk scraping capabilities of the new UTS scraper.
   *
   * @param unitCodes - Array of unit codes to scrape
   * @param options - Scraping options
   * @returns Array of scraper results
   */
  async scrapeUnits(
    unitCodes: string[],
    options?: {
      delayMs?: number;
      continueOnError?: boolean;
    }
  ): Promise<ScraperResult[]> {
    const result = await scrapeUTSSubjects(unitCodes, options);
    return result.results;
  }
}

export const scraperService = new ScraperService();
