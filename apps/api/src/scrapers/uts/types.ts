/**
 * Type definitions for UTS subject data scraped from the CourseLoop-powered
 * handbook. These types represent the data structure after scraping and before
 * database insertion.
 */

/**
 * Raw subject data extracted from the UTS handbook page.
 */
export interface ScrapedSubjectData {
  /**
   * Subject code (e.g., "31251").
   */
  code: string;

  /**
   * Full subject name (e.g., "Data Structures and Algorithms").
   */
  name: string;

  /**
   * Subject description text.
   */
  description: string;

  /**
   * Credit points for the subject (typically 6 or 12 for UTS).
   */
  creditPoints: number;

  /**
   * Faculty or school offering the subject.
   */
  faculty?: string;

  /**
   * Prerequisite subjects or requirements.
   */
  prerequisites?: string;

  /**
   * Anti-requisite subjects (subjects that cannot be taken together).
   */
  antiRequisites?: string;

  /**
   * Available sessions (e.g., "Autumn 2026", "Spring 2026").
   */
  sessions: string[];

  /**
   * Additional metadata that might be useful.
   */
  metadata?: {
    /**
     * When this subject was last offered.
     */
    lastOffered?: string;

    /**
     * Subject level (undergraduate, postgraduate).
     */
    level?: string;

    /**
     * Typical year in program.
     */
    typicalYear?: string;
  };
}

/**
 * Result of a scraping operation for a single subject.
 */
export interface ScraperResult {
  /**
   * Whether the scrape was successful.
   */
  success: boolean;

  /**
   * Subject code that was scraped.
   */
  subjectCode: string;

  /**
   * Scraped data if successful.
   */
  data?: ScrapedSubjectData;

  /**
   * Error message if unsuccessful.
   */
  error?: string;

  /**
   * Timestamp of when the scrape occurred.
   */
  scrapedAt: Date;
}

/**
 * Result of a bulk scraping operation.
 */
export interface BulkScraperResult {
  /**
   * Total number of subjects attempted.
   */
  total: number;

  /**
   * Number of successful scrapes.
   */
  successful: number;

  /**
   * Number of failed scrapes.
   */
  failed: number;

  /**
   * Individual results for each subject.
   */
  results: ScraperResult[];

  /**
   * List of errors encountered.
   */
  errors: Array<{
    subjectCode: string;
    error: string;
  }>;

  /**
   * Timestamp of when the bulk scrape started.
   */
  startedAt: Date;

  /**
   * Timestamp of when the bulk scrape completed.
   */
  completedAt: Date;
}
