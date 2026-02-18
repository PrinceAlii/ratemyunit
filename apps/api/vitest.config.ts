import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/__tests__/**',
        '**/node_modules/**',
        '**/dist/**',
        '**/*.config.*',
        '**/scrapers/strategies/**',
        '**/scrapers/uts/**',
        '**/scripts/**',
        '**/services/scraper.ts',
        '**/lib/queue.ts',
        '**/lib/logger.ts',
        '**/lib/auth.ts',
        '**/index.ts',
        '**/app.ts',
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
    environment: 'node',
    globals: true,
  },
});
