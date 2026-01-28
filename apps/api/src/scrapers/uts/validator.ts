import { z } from 'zod';

/**
 * Zod schemas for validating scraped subject data. These ensure that data
 * extracted from the UTS handbook conforms to expected formats before being
 * processed or stored in the database.
 */

/**
 * Schema for subject code validation. UTS subject codes are typically 5
 * digits.
 */
export const subjectCodeSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '').trim() : val),
  z.string()
    .regex(/^[A-Za-z0-9\-_]{3,12}$/, 'Subject code must be 3-12 alphanumeric characters')
    .transform((code) => code.toUpperCase())
);

/**
 * Schema for credit points. UTS subjects are typically 6 or 12 credit points.
 */
export const creditPointsSchema = z
  .number()
  .int()
  .min(1, 'Credit points must be at least 1')
  .max(24, 'Credit points cannot exceed 24');

/**
 * Schema for session strings (e.g., "Autumn 2026", "Spring 2026").
 */
export const sessionSchema = z
  .string()
  .trim()
  .min(1, 'Session cannot be empty');

/**
 * Schema for scraped subject metadata.
 */
export const scrapedSubjectMetadataSchema = z
  .object({
    lastOffered: z.string().optional(),
    level: z.enum(['undergraduate', 'postgraduate', 'other']).optional(),
    typicalYear: z.string().optional(),
  })
  .optional();

/**
 * Schema for scraped subject data. This validates the complete structure of
 * data extracted from a subject page.
 */
export const scrapedSubjectDataSchema = z.object({
  code: subjectCodeSchema,
  name: z
    .string()
    .trim()
    .min(1, 'Subject name is required')
    .max(255, 'Subject name cannot exceed 255 characters'),
  description: z
    .string()
    .trim()
    .min(1, 'Description is required')
    .max(5000, 'Description cannot exceed 5000 characters'),
  creditPoints: creditPointsSchema,
  faculty: z
    .string()
    .trim()
    .max(255, 'Faculty name cannot exceed 255 characters')
    .optional(),
  prerequisites: z
    .string()
    .trim()
    .max(1000, 'Prerequisites cannot exceed 1000 characters')
    .optional(),
  antiRequisites: z
    .string()
    .trim()
    .max(1000, 'Anti-requisites cannot exceed 1000 characters')
    .optional(),
  sessions: z.array(sessionSchema).default([]),
  metadata: scrapedSubjectMetadataSchema,
});

/**
 * Schema for a single scraper result.
 */
export const scraperResultSchema = z.object({
  success: z.boolean(),
  subjectCode: z.string(),
  data: scrapedSubjectDataSchema.optional(),
  error: z.string().optional(),
  scrapedAt: z.date(),
});

/**
 * Schema for bulk scraper results.
 */
export const bulkScraperResultSchema = z.object({
  total: z.number().int().min(0),
  successful: z.number().int().min(0),
  failed: z.number().int().min(0),
  results: z.array(scraperResultSchema),
  errors: z.array(
    z.object({
      subjectCode: z.string(),
      error: z.string(),
    })
  ),
  startedAt: z.date(),
  completedAt: z.date(),
});

/**
 * Type exports derived from Zod schemas.
 */
export type ScrapedSubjectData = z.infer<typeof scrapedSubjectDataSchema>;
export type ScraperResult = z.infer<typeof scraperResultSchema>;
export type BulkScraperResult = z.infer<typeof bulkScraperResultSchema>;

/**
 * Validates scraped subject data and returns typed result.
 *
 * @param data - Raw data to validate
 * @returns Validated and typed subject data
 * @throws ZodError if validation fails
 */
export function validateScrapedSubject(data: unknown): ScrapedSubjectData {
  return scrapedSubjectDataSchema.parse(data);
}

/**
 * Safely validates scraped subject data and returns result or error.
 *
 * @param data - Raw data to validate
 * @returns Validation result with success status
 */
export function safeValidateScrapedSubject(data: unknown): {
  success: boolean;
  data?: ScrapedSubjectData;
  error?: string;
} {
  const result = scrapedSubjectDataSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: result.error.message,
  };
}
