import { Browser } from 'playwright';
import { ScraperResult } from '../uts/types';
import { z } from 'zod';

export const ScraperConfigSchema = z.object({
  baseUrl: z.string().url(),
  routes: z.object({
    subject: z.string().min(1).optional(),
    search: z.string().optional(),
    discovery: z.string().optional(),
  }).optional(),
  selectors: z.record(z.string(), z.string()).optional(),
  search: z.object({
    input: z.string(),
    btn: z.string().optional(),
    result: z.string(),
  }).optional()
});

export type ScraperConfig = z.infer<typeof ScraperConfigSchema>;

export abstract class BaseScraper {
  constructor(
    protected readonly universityName: string,
    protected readonly config: ScraperConfig
  ) {}

  /**
   * Scrapes a single subject by its code.
   */
  abstract scrapeSubject(browser: Browser, subjectCode: string): Promise<ScraperResult>;

  /**
   * Discovers available subject codes.
   * Default implementation returns empty list (opt-in).
   */
  async discoverSubjects(_browser: Browser): Promise<string[]> {
    return [];
  }
}