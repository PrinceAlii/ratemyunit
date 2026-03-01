import { z } from 'zod';
import pino from 'pino';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : process.env.NODE_ENV === 'test' ? 'silent' : 'debug',
});

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SCRAPER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(3),
  SCRAPER_RATE_LIMIT_MAX_JOBS: z.coerce.number().int().min(1).max(500).default(8),
  SCRAPER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(250).max(600000).default(10000),
  SCRAPER_REQUEST_DELAY_MS: z.coerce.number().int().min(0).max(30000).default(250),
  SCRAPER_REQUEST_JITTER_MS: z.coerce.number().int().min(0).max(30000).default(750),
  SCRAPER_BLOCKING_THRESHOLD: z.coerce.number().int().min(1).max(20).default(3),
  SCRAPER_BLOCK_COOLDOWN_MS: z.coerce.number().int().min(1000).max(900000).default(20000),
  SCRAPER_MAX_RETRIES: z.coerce.number().int().min(0).max(10).default(3),
  SCRAPER_RETRY_BASE_DELAY_MS: z.coerce.number().int().min(250).max(120000).default(2000),
  SCRAPER_RETRY_MAX_DELAY_MS: z.coerce.number().int().min(1000).max(600000).default(45000),
  RESEND_API_KEY: z.string().startsWith('re_').or(z.literal('')).optional(),
  RESEND_FROM_NAME: z.string().trim().min(1).max(100).default('RateMyUnit'),
  RESEND_FROM_EMAIL: z.string().email().default('verify@send.ratemyunit.dev'),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);

  if (!result.success) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error('❌ Configuration validation failed. Please check your environment variables.');
      logger.error('Validation errors:');
      result.error.issues.forEach(issue => {
        logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
      });
    }
    throw new Error('Invalid environment variables');
  }

  const data = result.data;
  const isTestEnv = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';

  if (data.NODE_ENV === 'production' && !data.RESEND_API_KEY) {
    if (!isTestEnv) {
      logger.error('❌ RESEND_API_KEY is required in production to send transactional emails.');
    }
    throw new Error('Missing RESEND_API_KEY in production');
  }

  return data;
}

export const config = loadConfig();
