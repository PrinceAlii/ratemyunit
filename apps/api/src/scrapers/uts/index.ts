import { db } from '@ratemyunit/db/client';
import { units, universities } from '@ratemyunit/db/schema';
import { eq } from 'drizzle-orm';
import { UTSSubjectScraper } from './scraper';
import { parseSubjectToUnit } from './parser';
import type { BulkScraperResult, ScraperResult } from './types';

/**
 * Main orchestrator for the UTS subject scraper. This module provides high-
 * level functions for scraping single subjects or bulk scraping multiple
 * subjects. It handles browser lifecycle, data validation, parsing, and
 * database persistence.
 */

/**
 * Logger interface for structured logging. In production, this should be
 * replaced with a proper logging service.
 */
const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta) : '');
  },
};

/**
 * Gets the UTS university record from the database. Throws an error if UTS is
 * not found in the database.
 *
 * @returns UTS university record
 * @throws Error if UTS university is not found
 */
async function getUTSUniversity() {
  const [uts] = await db
    .select()
    .from(universities)
    .where(eq(universities.abbreviation, 'UTS'))
    .limit(1);

  if (!uts) {
    throw new Error(
      'UTS university not found in database. Please ensure universities are seeded.'
    );
  }

  return uts;
}

/**
 * Scrapes a single UTS subject by code and saves it to the database. This
 * function handles the complete workflow: scraping, validation, parsing, and
 * database persistence.
 *
 * @param subjectCode - The 5-digit subject code (e.g., "31251")
 * @returns Scraper result with success status and any errors
 */
export async function scrapeUTSSubject(
  subjectCode: string
): Promise<ScraperResult> {
  const scraper = new UTSSubjectScraper();

  try {
    logger.info('Starting subject scrape', { subjectCode });

    await scraper.initialize();
    const result = await scraper.scrapeSubject(subjectCode);

    if (!result.success || !result.data) {
      logger.warn('Subject scrape failed', {
        subjectCode,
        error: result.error,
      });
      return result;
    }

    // Parse scraped data to database format.
    const unitData = parseSubjectToUnit(result.data);

    // Get UTS university ID.
    const uts = await getUTSUniversity();

    // Insert or update unit in database.
    await db
      .insert(units)
      .values({
        ...unitData,
        universityId: uts.id,
      })
      .onConflictDoUpdate({
        target: [units.universityId, units.unitCode],
        set: {
          unitName: unitData.unitName,
          description: unitData.description,
          creditPoints: unitData.creditPoints,
          prerequisites: unitData.prerequisites,
          antiRequisites: unitData.antiRequisites,
          sessions: unitData.sessions,
          faculty: unitData.faculty,
          scrapedAt: unitData.scrapedAt,
          active: unitData.active,
        },
      });

    logger.info('Subject scraped and saved successfully', {
      subjectCode,
      unitName: unitData.unitName,
    });

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    logger.error('Error during subject scrape', {
      subjectCode,
      error: errorMessage,
    });

    return {
      success: false,
      subjectCode,
      error: errorMessage,
      scrapedAt: new Date(),
    };
  } finally {
    await scraper.close();
  }
}

/**
 * Scrapes multiple UTS subjects in sequence. This function includes rate
 * limiting to avoid overwhelming the target server.
 *
 * @param subjectCodes - Array of subject codes to scrape
 * @param options - Scraping options
 * @returns Bulk scraper result with summary and individual results
 */
export async function scrapeUTSSubjects(
  subjectCodes: string[],
  options: {
    /**
     * Delay in milliseconds between scraping each subject. Default is 2000ms
     * (2 seconds) to be respectful of server resources.
     */
    delayMs?: number;

    /**
     * Whether to continue scraping if one subject fails. Default is true.
     */
    continueOnError?: boolean;
  } = {}
): Promise<BulkScraperResult> {
  const { delayMs = 2000, continueOnError = true } = options;
  const startedAt = new Date();

  const results: ScraperResult[] = [];
  const errors: Array<{ subjectCode: string; error: string }> = [];

  logger.info('Starting bulk subject scrape', {
    total: subjectCodes.length,
    delayMs,
  });

  const scraper = new UTSSubjectScraper();

  try {
    await scraper.initialize();

    for (let i = 0; i < subjectCodes.length; i++) {
      const subjectCode = subjectCodes[i];

      try {
        logger.info('Scraping subject', {
          current: i + 1,
          total: subjectCodes.length,
          subjectCode,
        });

        const result = await scraper.scrapeSubject(subjectCode);
        results.push(result);

        if (result.success && result.data) {
          // Parse and save to database.
          const unitData = parseSubjectToUnit(result.data);
          const uts = await getUTSUniversity();

          await db
            .insert(units)
            .values({
              ...unitData,
              universityId: uts.id,
            })
            .onConflictDoUpdate({
              target: [units.universityId, units.unitCode],
              set: {
                unitName: unitData.unitName,
                description: unitData.description,
                creditPoints: unitData.creditPoints,
                prerequisites: unitData.prerequisites,
                antiRequisites: unitData.antiRequisites,
                sessions: unitData.sessions,
                faculty: unitData.faculty,
                scrapedAt: unitData.scrapedAt,
                active: unitData.active,
              },
            });

          logger.info('Subject saved successfully', {
            subjectCode,
            unitName: unitData.unitName,
          });
        } else {
          errors.push({
            subjectCode,
            error: result.error || 'Unknown error',
          });

          if (!continueOnError) {
            logger.error('Stopping bulk scrape due to error', {
              subjectCode,
              error: result.error,
            });
            break;
          }
        }

        // Rate limiting: wait before next request (except for last item).
        if (i < subjectCodes.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        logger.error('Error scraping subject', {
          subjectCode,
          error: errorMessage,
        });

        errors.push({
          subjectCode,
          error: errorMessage,
        });

        results.push({
          success: false,
          subjectCode,
          error: errorMessage,
          scrapedAt: new Date(),
        });

        if (!continueOnError) {
          logger.error('Stopping bulk scrape due to error');
          break;
        }
      }
    }
  } finally {
    await scraper.close();
  }

  const completedAt = new Date();
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  logger.info('Bulk scrape completed', {
    total: subjectCodes.length,
    successful,
    failed,
    durationMs: completedAt.getTime() - startedAt.getTime(),
  });

  return {
    total: subjectCodes.length,
    successful,
    failed,
    results,
    errors,
    startedAt,
    completedAt,
  };
}

/**
 * Scrapes all UTS subjects for a given year. This function generates subject
 * codes systematically and scrapes them.
 *
 * @param options - Scraping options
 * @returns Bulk scraper result
 */
export async function scrapeAllUTSSubjects(options: {
  /**
   * Starting subject code. Default is "10001".
   */
  startCode?: string;

  /**
   * Ending subject code. Default is "99999".
   */
  endCode?: string;

  /**
   * Maximum number of subjects to scrape. Default is unlimited.
   */
  limit?: number;

  /**
   * Delay in milliseconds between requests. Default is 2000ms.
   */
  delayMs?: number;
} = {}): Promise<BulkScraperResult> {
  const {
    startCode = '10001',
    endCode = '99999',
    limit,
    delayMs = 2000,
  } = options;

  // Generate subject codes in range.
  const subjectCodes: string[] = [];
  const start = parseInt(startCode, 10);
  const end = parseInt(endCode, 10);

  for (let code = start; code <= end; code++) {
    subjectCodes.push(code.toString().padStart(5, '0'));

    if (limit && subjectCodes.length >= limit) {
      break;
    }
  }

  logger.info('Generated subject codes for bulk scrape', {
    total: subjectCodes.length,
    range: `${startCode}-${endCode}`,
  });

  return scrapeUTSSubjects(subjectCodes, { delayMs });
}
