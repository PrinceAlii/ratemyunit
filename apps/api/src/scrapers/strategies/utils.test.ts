import { describe, expect, it } from 'vitest';
import { coerceToOptionalString, isBrowserCrashErrorMessage } from './utils.js';

describe('scraper strategy utils', () => {
  describe('isBrowserCrashErrorMessage', () => {
    it('detects closed browser messages', () => {
      expect(
        isBrowserCrashErrorMessage('browser.newPage: Target page, context or browser has been closed')
      ).toBe(true);
      expect(isBrowserCrashErrorMessage('Protocol error (Target.createTarget): Target closed')).toBe(true);
    });

    it('ignores non-crash messages', () => {
      expect(isBrowserCrashErrorMessage('Validation failed: title selector missing')).toBe(false);
      expect(isBrowserCrashErrorMessage(undefined)).toBe(false);
    });
  });

  describe('coerceToOptionalString', () => {
    it('returns trimmed strings', () => {
      expect(coerceToOptionalString('  Engineering  ')).toBe('Engineering');
    });

    it('extracts name-like values from objects', () => {
      expect(coerceToOptionalString({ name: 'Engineering' })).toBe('Engineering');
      expect(coerceToOptionalString({ title: 'Computer Science' })).toBe('Computer Science');
    });

    it('joins arrays into a comma separated value', () => {
      expect(coerceToOptionalString([{ name: 'A' }, 'B'])).toBe('A, B');
    });

    it('returns undefined for unsupported objects', () => {
      expect(coerceToOptionalString({ unknown: { nested: true } })).toBeUndefined();
    });
  });
});
