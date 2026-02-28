import { describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = 'https://example.com';
  process.env.JWT_SECRET = '12345678901234567890123456789012';
});
import { CourseLoopScraper } from './courseloop.js';

const baseConfig = {
  baseUrl: 'https://example.edu',
  routes: {
    subject: '/subject/current/:code',
  },
};

describe('CourseLoopScraper', () => {
  it('normalizes faculty when parent_academic_org is an object', () => {
    const scraper = new CourseLoopScraper('UNSW', baseConfig);

    const data = (scraper as unknown as { extractFromNextData: (content: Record<string, unknown>, code: string) => Record<string, unknown> })
      .extractFromNextData(
        {
          code: 'COMP1511',
          title: 'Programming Fundamentals',
          description: '<p>Intro to programming</p>',
          credit_points: '6',
          parent_academic_org: { name: 'Engineering' },
        },
        'COMP1511'
      );

    expect(data.faculty).toBe('Engineering');
  });

  it('drops faculty when parent_academic_org cannot be coerced', () => {
    const scraper = new CourseLoopScraper('UNSW', baseConfig);

    const data = (scraper as unknown as { extractFromNextData: (content: Record<string, unknown>, code: string) => Record<string, unknown> })
      .extractFromNextData(
        {
          code: 'COMP1511',
          title: 'Programming Fundamentals',
          description: '<p>Intro to programming</p>',
          credit_points: '6',
          parent_academic_org: { unsupported: { nested: true } },
        },
        'COMP1511'
      );

    expect(data.faculty).toBeUndefined();
  });
});
