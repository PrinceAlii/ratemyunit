import { describe, it, expect, beforeEach } from 'vitest';
import { SubjectTemplateService } from './template';

describe('SubjectTemplateService', () => {
  let service: SubjectTemplateService;

  beforeEach(() => {
    service = new SubjectTemplateService();
  });

  describe('generateCodesFromTemplateData', () => {
    describe('range templates', () => {
      it('should generate numeric range codes', () => {
        const template = {
          id: '1',
          templateType: 'range' as const,
          startCode: '31001',
          endCode: '31005',
          codeList: null,
          pattern: null,
        };

        const codes = service.generateCodesFromTemplateData(template);

        expect(codes).toEqual(['31001', '31002', '31003', '31004', '31005']);
      });

      it('should preserve padding in numeric codes', () => {
        const template = {
          id: '1',
          templateType: 'range' as const,
          startCode: '00001',
          endCode: '00003',
          codeList: null,
          pattern: null,
        };

        const codes = service.generateCodesFromTemplateData(template);

        expect(codes).toEqual(['00001', '00002', '00003']);
      });

      it('should generate alphanumeric range codes', () => {
        const template = {
          id: '1',
          templateType: 'range' as const,
          startCode: 'CS101',
          endCode: 'CS105',
          codeList: null,
          pattern: null,
        };

        const codes = service.generateCodesFromTemplateData(template);

        expect(codes).toEqual(['CS101', 'CS102', 'CS103', 'CS104', 'CS105']);
      });

      it('should preserve padding in alphanumeric codes', () => {
        const template = {
          id: '1',
          templateType: 'range' as const,
          startCode: 'ENG001',
          endCode: 'ENG003',
          codeList: null,
          pattern: null,
        };

        const codes = service.generateCodesFromTemplateData(template);

        expect(codes).toEqual(['ENG001', 'ENG002', 'ENG003']);
      });

      it('should throw error for mismatched prefixes', () => {
        const template = {
          id: '1',
          templateType: 'range' as const,
          startCode: 'CS101',
          endCode: 'ENG105',
          codeList: null,
          pattern: null,
        };

        expect(() => service.generateCodesFromTemplateData(template)).toThrow(
          'Start and end codes must have the same prefix'
        );
      });

      it('should throw error when start > end', () => {
        const template = {
          id: '1',
          templateType: 'range' as const,
          startCode: '31005',
          endCode: '31001',
          codeList: null,
          pattern: null,
        };

        expect(() => service.generateCodesFromTemplateData(template)).toThrow(
          'Start code must be less than or equal to end code'
        );
      });

      it('should throw error when range exceeds limit', () => {
        const template = {
          id: '1',
          templateType: 'range' as const,
          startCode: '1',
          endCode: '150000',
          codeList: null,
          pattern: null,
        };

        expect(() => service.generateCodesFromTemplateData(template)).toThrow(
          'exceeds maximum of 100000'
        );
      });
    });

    describe('list templates', () => {
      it('should generate codes from list', () => {
        const template = {
          id: '1',
          templateType: 'list' as const,
          startCode: null,
          endCode: null,
          codeList: ['CS101', 'ENG202', 'MATH303'],
          pattern: null,
        };

        const codes = service.generateCodesFromTemplateData(template);

        expect(codes).toEqual(['CS101', 'ENG202', 'MATH303']);
      });

      it('should deduplicate codes in list', () => {
        const template = {
          id: '1',
          templateType: 'list' as const,
          startCode: null,
          endCode: null,
          codeList: ['CS101', 'CS101', 'ENG202', 'CS101'],
          pattern: null,
        };

        const codes = service.generateCodesFromTemplateData(template);

        expect(codes).toEqual(['CS101', 'ENG202']);
      });

      it('should filter empty strings from list', () => {
        const template = {
          id: '1',
          templateType: 'list' as const,
          startCode: null,
          endCode: null,
          codeList: ['CS101', '', '  ', 'ENG202'],
          pattern: null,
        };

        const codes = service.generateCodesFromTemplateData(template);

        expect(codes).toEqual(['CS101', 'ENG202']);
      });

      it('should throw error for empty list', () => {
        const template = {
          id: '1',
          templateType: 'list' as const,
          startCode: null,
          endCode: null,
          codeList: [],
          pattern: null,
        };

        expect(() => service.generateCodesFromTemplateData(template)).toThrow(
          'Invalid template'
        );
      });
    });

    describe('pattern templates', () => {
      it('should generate codes matching pattern', () => {
        const template = {
          id: '1',
          templateType: 'pattern' as const,
          startCode: 'CS100',
          endCode: 'CS105',
          codeList: null,
          pattern: '^CS10[0-2]$',
        };

        const codes = service.generateCodesFromTemplateData(template);

        expect(codes).toEqual(['CS100', 'CS101', 'CS102']);
      });

      it('should filter codes based on pattern', () => {
        const template = {
          id: '1',
          templateType: 'pattern' as const,
          startCode: '31000',
          endCode: '31010',
          codeList: null,
          pattern: '^3100[02468]$',
        };

        const codes = service.generateCodesFromTemplateData(template);

        expect(codes).toEqual(['31000', '31002', '31004', '31006', '31008']);
      });

      it('should throw error for invalid regex pattern', () => {
        const template = {
          id: '1',
          templateType: 'pattern' as const,
          startCode: 'CS100',
          endCode: 'CS105',
          codeList: null,
          pattern: '[invalid(',
        };

        expect(() => service.generateCodesFromTemplateData(template)).toThrow(
          /regex pattern/
        );
      });

      it('should require range bounds for security', () => {
        const template = {
          id: '1',
          templateType: 'pattern' as const,
          startCode: null,
          endCode: null,
          codeList: null,
          pattern: '^CS\\d+$',
        };

        expect(() => service.generateCodesFromTemplateData(template)).toThrow(
          'Invalid template'
        );
      });
    });
  });

  describe('validateTemplate', () => {
    it('should validate correct range template', () => {
      const template = {
        id: '1',
        templateType: 'range' as const,
        startCode: '31001',
        endCode: '31999',
        codeList: null,
        pattern: null,
      };

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate correct list template', () => {
      const template = {
        id: '1',
        templateType: 'list' as const,
        startCode: null,
        endCode: null,
        codeList: ['CS101', 'ENG202'],
        pattern: null,
      };

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should validate correct pattern template', () => {
      const template = {
        id: '1',
        templateType: 'pattern' as const,
        startCode: 'CS100',
        endCode: 'CS199',
        codeList: null,
        pattern: '^CS1\\d{2}$',
      };

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should report missing start code for range template', () => {
      const template = {
        id: '1',
        templateType: 'range' as const,
        startCode: null,
        endCode: '31999',
        codeList: null,
        pattern: null,
      };

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report empty list for list template', () => {
      const template = {
        id: '1',
        templateType: 'list' as const,
        startCode: null,
        endCode: null,
        codeList: [],
        pattern: null,
      };

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report missing pattern for pattern template', () => {
      const template = {
        id: '1',
        templateType: 'pattern' as const,
        startCode: 'CS100',
        endCode: 'CS199',
        codeList: null,
        pattern: null,
      };

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should report invalid regex in pattern template', () => {
      const template = {
        id: '1',
        templateType: 'pattern' as const,
        startCode: 'CS100',
        endCode: 'CS199',
        codeList: null,
        pattern: '[invalid(',
      };

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => /regex pattern/i.test(e))).toBe(true);
    });

    it('should report range overflow', () => {
      const template = {
        id: '1',
        templateType: 'range' as const,
        startCode: '1',
        endCode: '200000',
        codeList: null,
        pattern: null,
      };

      const result = service.validateTemplate(template);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
    });
  });

  describe('immutability', () => {
    it('should not mutate input codeList', () => {
      const originalList = ['CS101', 'ENG202', 'CS101'];
      const template = {
        id: '1',
        templateType: 'list' as const,
        startCode: null,
        endCode: null,
        codeList: originalList,
        pattern: null,
      };

      service.generateCodesFromTemplateData(template);

      expect(originalList).toEqual(['CS101', 'ENG202', 'CS101']);
    });

    it('should return new array for each call', () => {
      const template = {
        id: '1',
        templateType: 'range' as const,
        startCode: '31001',
        endCode: '31003',
        codeList: null,
        pattern: null,
      };

      const codes1 = service.generateCodesFromTemplateData(template);
      const codes2 = service.generateCodesFromTemplateData(template);

      expect(codes1).toEqual(codes2);
      expect(codes1).not.toBe(codes2);
    });
  });

  describe('edge cases', () => {
    it('should handle single code range', () => {
      const template = {
        id: '1',
        templateType: 'range' as const,
        startCode: '31001',
        endCode: '31001',
        codeList: null,
        pattern: null,
      };

      const codes = service.generateCodesFromTemplateData(template);

      expect(codes).toEqual(['31001']);
    });

    it('should handle large valid range', () => {
      const template = {
        id: '1',
        templateType: 'range' as const,
        startCode: '1',
        endCode: '1000',
        codeList: null,
        pattern: null,
      };

      const codes = service.generateCodesFromTemplateData(template);

      expect(codes.length).toBe(1000);
      expect(codes[0]).toBe('1');
      expect(codes[999]).toBe('1000');
    });

    it('should handle mixed case alphanumeric codes', () => {
      const template = {
        id: '1',
        templateType: 'range' as const,
        startCode: 'AbC100',
        endCode: 'AbC103',
        codeList: null,
        pattern: null,
      };

      const codes = service.generateCodesFromTemplateData(template);

      expect(codes).toEqual(['AbC100', 'AbC101', 'AbC102', 'AbC103']);
    });

    it('should handle pattern that matches no codes', () => {
      const template = {
        id: '1',
        templateType: 'pattern' as const,
        startCode: 'CS100',
        endCode: 'CS105',
        codeList: null,
        pattern: '^ENG',
      };

      const codes = service.generateCodesFromTemplateData(template);

      expect(codes).toEqual([]);
    });
  });
});
