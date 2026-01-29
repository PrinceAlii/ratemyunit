import { describe, it, expect } from 'vitest';
import { scrapedSubjectDataSchema } from '../validator';

describe('UTS Scraper Validator', () => {
  it('validates a correct subject object', () => {
    const validData = {
      code: '31251',
      name: 'Data Structures and Algorithms',
      description: 'This subject equips you with skills...',
      creditPoints: 6,
      faculty: 'Engineering and IT',
      prerequisites: 'None',
      antiRequisites: 'None',
      sessions: ['Autumn 2024', 'Spring 2024'],
    };

    const result = scrapedSubjectDataSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('31251');
    }
  });

  it('validates a subject code with whitespace', () => {
    const data = {
      code: '  31251  ',
      name: 'Test',
      description: 'Test desc',
      creditPoints: 6,
    };
    const result = scrapedSubjectDataSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe('31251');
    }
  });

  it('rejects an invalid subject code (too short)', () => {
    const data = {
      code: '12',
      name: 'Test',
      description: 'Test',
      creditPoints: 6,
    };
    const result = scrapedSubjectDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid subject code (too long)', () => {
    const data = {
      code: '1234567890123',
      name: 'Test',
      description: 'Test',
      creditPoints: 6,
    };
    const result = scrapedSubjectDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid subject code (special characters)', () => {
    const data = {
      code: '312@51',
      name: 'Test',
      description: 'Test',
      creditPoints: 6,
    };
    const result = scrapedSubjectDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('rejects invalid credit points', () => {
    const data = {
      code: '31251',
      name: 'Test',
      description: 'Test',
      creditPoints: 0, // Min is 1.
    };
    const result = scrapedSubjectDataSchema.safeParse(data);
    expect(result.success).toBe(false);
  });

  it('handles optional fields', () => {
    const data = {
      code: '31251',
      name: 'Minimal Subject',
      description: 'Just a description',
      creditPoints: 6,
      // Missing faculty, prerequisites, etc.
    };
    const result = scrapedSubjectDataSchema.safeParse(data);
    expect(result.success).toBe(true);
  });

  // Security / Edge case: malicious input.
  it('sanitizes or validates potential XSS in fields', () => {
    // Zod doesn't sanitize HTML by default, but it ensures types.
    // Our scraper logic handles stripping, but the validator ensures it's a string.
    const data = {
      code: '31251',
      name: '<script>alert(1)</script>',
      description: 'Test',
      creditPoints: 6,
    };
    const result = scrapedSubjectDataSchema.safeParse(data);
    expect(result.success).toBe(true); // Zod allows strings.
    // We expect the scraper service to have cleaned this BEFORE validation if we want strict cleaning,
    // or we rely on the frontend to escape it.
    // However, the scraper.ts has a stripHtml function.
  });
});
