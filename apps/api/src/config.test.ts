import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('config', () => {
  const validEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'a'.repeat(32),
    FRONTEND_URL: 'http://localhost:5173',
    SCRAPER_CONCURRENCY: '2',
    SCRAPER_RATE_LIMIT_MAX_JOBS: '8',
    SCRAPER_RATE_LIMIT_WINDOW_MS: '10000',
    SCRAPER_REQUEST_DELAY_MS: '250',
    SCRAPER_REQUEST_JITTER_MS: '750',
    SCRAPER_BLOCKING_THRESHOLD: '3',
    SCRAPER_BLOCK_COOLDOWN_MS: '20000',
    SCRAPER_MAX_RETRIES: '3',
    SCRAPER_RETRY_BASE_DELAY_MS: '2000',
    SCRAPER_RETRY_MAX_DELAY_MS: '45000',
  };

  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('loads valid configuration', async () => {
    process.env = { ...process.env, ...validEnv };
    const { config } = await import('./config');
    expect(config.NODE_ENV).toBe('test');
    expect(config.PORT).toBe('3000');
  });

  it('applies default values', async () => {
    process.env = {
      DATABASE_URL: validEnv.DATABASE_URL,
      JWT_SECRET: validEnv.JWT_SECRET,
    };
    const { config } = await import('./config');
    expect(config.PORT).toBe('3000');
    expect(config.NODE_ENV).toBe('development');
    expect(config.SCRAPER_CONCURRENCY).toBe(5);
    expect(config.SCRAPER_RATE_LIMIT_MAX_JOBS).toBe(8);
    expect(config.SCRAPER_REQUEST_DELAY_MS).toBe(250);
  });

  it('throws on missing DATABASE_URL', async () => {
    process.env = { ...process.env, ...validEnv };
    delete process.env.DATABASE_URL;
    await expect(import('./config')).rejects.toThrow('Invalid environment variables');
  });

  it('throws on invalid DATABASE_URL', async () => {
    process.env = { ...process.env, ...validEnv, DATABASE_URL: 'not-a-url' };
    await expect(import('./config')).rejects.toThrow('Invalid environment variables');
  });

  it('throws on JWT_SECRET too short', async () => {
    process.env = { ...process.env, ...validEnv, JWT_SECRET: 'short' };
    await expect(import('./config')).rejects.toThrow('Invalid environment variables');
  });

  it('coerces SCRAPER_CONCURRENCY to number', async () => {
    process.env = { ...process.env, ...validEnv, SCRAPER_CONCURRENCY: '5' };
    const { config } = await import('./config');
    expect(config.SCRAPER_CONCURRENCY).toBe(5);
  });

  it('accepts empty RESEND_API_KEY', async () => {
    process.env = { ...process.env, ...validEnv, RESEND_API_KEY: '' };
    const { config } = await import('./config');
    expect(config.RESEND_API_KEY).toBe('');
  });

  it('accepts valid RESEND_API_KEY starting with re_', async () => {
    process.env = { ...process.env, ...validEnv, RESEND_API_KEY: 're_abc123' };
    const { config } = await import('./config');
    expect(config.RESEND_API_KEY).toBe('re_abc123');
  });

  it('requires RESEND_API_KEY in production', async () => {
    process.env = { ...process.env, ...validEnv, NODE_ENV: 'production' };
    delete process.env.RESEND_API_KEY;
    await expect(import('./config')).rejects.toThrow('Missing RESEND_API_KEY in production');
  });

  it('accepts RESEND_API_KEY in production', async () => {
    process.env = { ...process.env, ...validEnv, NODE_ENV: 'production', RESEND_API_KEY: 're_abc123' };
    const { config } = await import('./config');
    expect(config.RESEND_API_KEY).toBe('re_abc123');
  });

  it('rejects RESEND_API_KEY not starting with re_', async () => {
    process.env = { ...process.env, ...validEnv, RESEND_API_KEY: 'invalid_key' };
    await expect(import('./config')).rejects.toThrow('Invalid environment variables');
  });
});
