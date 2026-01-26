import { Browser } from 'playwright';
import { ScraperResult } from '../uts/types';
import { z } from 'zod';

export const ScraperConfigSchema = z.object({
  baseUrl: z.string().url(),
  routes: z.object({
    subject: z.string().min(1),
    list: z.string().optional(),
  }).optional(),
  selectors: z.record(z.string()).optional(),
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
}