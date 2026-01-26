import { describe, it, expect } from 'vitest';
import { 
  parseSubjectToUnit, 
  extractPrerequisiteCodes, 
  parsePrerequisiteStructure,
  deserializeSessions
} from '../parser';

describe('UTS Scraper Parser', () => {
  describe('parseSubjectToUnit', () => {
    it('transforms scraped data to DB format', () => {
      const scrapedData = {
        code: '31251',
        name: '  Data Structures  ',
        description: '  Description with   spaces  ',
        creditPoints: 6,
        sessions: ['Autumn', 'Spring'],
        faculty: '  Engineering  ',
      };

      const result = parseSubjectToUnit(scrapedData as any);

      expect(result.unitCode).toBe('31251');
      expect(result.unitName).toBe('Data Structures');
      expect(result.description).toBe('Description with spaces');
      expect(result.creditPoints).toBe(6);
      expect(result.faculty).toBe('Engineering');
      expect(JSON.parse(result.sessions)).toEqual(['Autumn', 'Spring']);
      expect(result.active).toBe(true);
    });

    it('truncates long descriptions', () => {
      const longDesc = 'a'.repeat(2000);
      const scrapedData = {
        code: '31251',
        name: 'Test',
        description: longDesc,
        creditPoints: 6,
        sessions: [],
      };

      const result = parseSubjectToUnit(scrapedData as any);
      expect(result.description.length).toBeLessThanOrEqual(1003); // 1000 + '...'
      expect(result.description.endsWith('...')).toBe(true);
    });
  });

  describe('extractPrerequisiteCodes', () => {
    it('extracts single code', () => {
      const text = 'Prerequisite: 31250 Introduction to Data Analytics';
      expect(extractPrerequisiteCodes(text)).toEqual(['31250']);
    });

    it('extracts multiple codes', () => {
      const text = 'Prerequisites: 48023 Programming Fundamentals and 48024 Applications Programming';
      expect(extractPrerequisiteCodes(text)).toEqual(['48023', '48024']);
    });

    it('deduplicates codes', () => {
      const text = '31251 and 31251';
      expect(extractPrerequisiteCodes(text)).toEqual(['31251']);
    });

    it('ignores invalid codes', () => {
      const text = '1234 is not a code, but 12345 is';
      expect(extractPrerequisiteCodes(text)).toEqual(['12345']);
    });
  });

  describe('parsePrerequisiteStructure', () => {
    it('detects AND logic', () => {
      const text = '31250 and 31251';
      const result = parsePrerequisiteStructure(text);
      expect(result.hasAndLogic).toBe(true);
      expect(result.hasOrLogic).toBe(false);
      expect(result.codes).toEqual(['31250', '31251']);
    });

    it('detects OR logic', () => {
      const text = '31250 or 31251';
      const result = parsePrerequisiteStructure(text);
      expect(result.hasOrLogic).toBe(true);
    });
  });

  describe('deserializeSessions', () => {
    it('parses valid JSON', () => {
      expect(deserializeSessions('["Autumn"]')).toEqual(['Autumn']);
    });

    it('handles invalid JSON gracefully', () => {
      expect(deserializeSessions('invalid')).toEqual([]);
    });
  });
});
