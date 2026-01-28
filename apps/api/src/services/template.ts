import { db } from '@ratemyunit/db/client';
import { subjectCodeTemplates } from '@ratemyunit/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import safeRegex from 'safe-regex';

// Constants
const MAX_CODES_PER_TEMPLATE = 100_000;
const MAX_LIST_CODES = 10_000;
const PREVIEW_DEFAULT_LIMIT = 50;

// Validation schemas
const RangeTemplateSchema = z.object({
  templateType: z.literal('range'),
  startCode: z.string().min(1, 'Start code is required'),
  endCode: z.string().min(1, 'End code is required'),
  pattern: z.string().nullable().optional(),
});

const ListTemplateSchema = z.object({
  templateType: z.literal('list'),
  codeList: z.array(z.string().min(1)).min(1).max(MAX_LIST_CODES),
  startCode: z.string().nullable().optional(),
  endCode: z.string().nullable().optional(),
  pattern: z.string().nullable().optional(),
});

const PatternTemplateSchema = z.object({
  templateType: z.literal('pattern'),
  pattern: z.string().min(1, 'Pattern is required for pattern templates'),
  startCode: z.string().min(1, 'Start code is required for pattern templates'),
  endCode: z.string().min(1, 'End code is required for pattern templates'),
});

const TemplateSchema = z.discriminatedUnion('templateType', [
  RangeTemplateSchema,
  ListTemplateSchema,
  PatternTemplateSchema,
]);

// Types
type SubjectCodeTemplate = {
  id: string;
  templateType: 'range' | 'list' | 'pattern';
  startCode: string | null;
  endCode: string | null;
  codeList: string[] | null;
  pattern: string | null;
};

type ValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Service for generating subject codes from templates.
 * Handles three template types: range, list, and pattern.
 * Enforces safety limits to prevent resource exhaustion.
 */
export class SubjectTemplateService {
  /**
   * Main entry point for generating codes from a template.
   * Fetches template from database and generates all codes.
   */
  async generateCodesFromTemplate(templateId: string): Promise<string[]> {
    const template = await this.fetchTemplate(templateId);
    return this.generateCodesFromTemplateData(template);
  }

  /**
   * Pure function for generating codes from template data.
   * Useful for testing and validation without database access.
   */
  generateCodesFromTemplateData(template: SubjectCodeTemplate): string[] {
    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    const { templateType } = template;

    let codes: string[] = [];

    if (templateType === 'range') {
      codes = this.generateFromRange(template.startCode!, template.endCode!);
    } else if (templateType === 'list') {
      codes = this.generateFromList(template.codeList!);
    } else if (templateType === 'pattern') {
      codes = this.generateFromPattern(
        template.pattern!,
        template.startCode!,
        template.endCode!
      );
    } else {
      throw new Error(`Unsupported template type: ${templateType}`);
    }

    if (codes.length === 0) {
        throw new Error(`Template generated 0 codes. Please check your configuration.`);
    }

    return codes;
  }

  /**
   * Preview first N codes from a template without generating all.
   */
  async previewCodes(
    templateId: string,
    limit: number = PREVIEW_DEFAULT_LIMIT
  ): Promise<string[]> {
    const template = await this.fetchTemplate(templateId);
    const allCodes = this.generateCodesFromTemplateData(template);
    return allCodes.slice(0, limit);
  }

  /**
   * Validate template configuration without generating codes.
   */
  validateTemplate(template: SubjectCodeTemplate): ValidationResult {
    let errors: string[] = [];

    try {
      const parsed = TemplateSchema.parse({
        templateType: template.templateType,
        startCode: template.startCode,
        endCode: template.endCode,
        codeList: template.codeList,
        pattern: template.pattern,
      });

      if (parsed.templateType === 'range') {
        const rangeErrors = this.validateRangeTemplate(
          parsed.startCode,
          parsed.endCode
        );
        errors = errors.concat(rangeErrors);
      }

      if (parsed.templateType === 'list') {
        const listErrors = this.validateListTemplate(parsed.codeList);
        errors = errors.concat(listErrors);
      }

      if (parsed.templateType === 'pattern') {
        const patternErrors = this.validatePatternTemplate(
          parsed.pattern,
          parsed.startCode,
          parsed.endCode
        );
        errors = errors.concat(patternErrors);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zodErrors = (error as any).errors.map((e: any) => `${e.path.join('.')}: ${e.message}`);
        errors = errors.concat(zodErrors);
      } else {
        errors = [...errors, 'Unknown validation error'];
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate sequential codes from a range.
   * Supports both numeric (31001-31999) and alphanumeric (CS101-CS199).
   */
  private generateFromRange(startCode: string, endCode: string): string[] {
    const isNumeric = /^\d+$/.test(startCode) && /^\d+$/.test(endCode);

    if (isNumeric) {
      return this.generateNumericRange(startCode, endCode);
    }

    return this.generateAlphanumericRange(startCode, endCode);
  }

  /**
   * Generate codes from a list with deduplication.
   */
  private generateFromList(codeList: string[]): string[] {
    const uniqueCodes = [...new Set(codeList)];
    const filteredCodes = uniqueCodes.filter((code) => code.trim().length > 0);

    if (filteredCodes.length > MAX_CODES_PER_TEMPLATE) {
      throw new Error(
        `List template exceeds maximum of ${MAX_CODES_PER_TEMPLATE} codes`
      );
    }

    return filteredCodes;
  }

  /**
   * Generate codes matching a pattern within a range.
   * Pattern must be a valid regex. Range bounds are required for security.
   */
  private generateFromPattern(
    pattern: string,
    startCode: string,
    endCode: string
  ): string[] {
    let regex: RegExp;
    
    // Check for ReDoS vulnerability
    if (!safeRegex(pattern)) {
      throw new Error(`Potentially unsafe regex pattern: ${pattern}`);
    }

    try {
      regex = new RegExp(pattern);
    } catch {
      throw new Error(`Invalid regex pattern: ${pattern}`);
    }

    const allCodes = this.generateFromRange(startCode, endCode);
    const matchedCodes = allCodes.filter((code) => regex.test(code));

    if (matchedCodes.length > MAX_CODES_PER_TEMPLATE) {
      throw new Error(
        `Pattern template exceeds maximum of ${MAX_CODES_PER_TEMPLATE} codes`
      );
    }

    return matchedCodes;
  }

  /**
   * Fetch template from database by ID.
   */
  private async fetchTemplate(templateId: string): Promise<SubjectCodeTemplate> {
    const [template] = await db
      .select()
      .from(subjectCodeTemplates)
      .where(eq(subjectCodeTemplates.id, templateId))
      .limit(1);

    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    return {
      id: template.id,
      templateType: template.templateType,
      startCode: template.startCode,
      endCode: template.endCode,
      codeList: template.codeList,
      pattern: template.pattern,
    };
  }

  /**
   * Generate numeric range codes (e.g., 31001-31999).
   */
  private generateNumericRange(startCode: string, endCode: string): string[] {
    const start = parseInt(startCode, 10);
    const end = parseInt(endCode, 10);

    // Integer Overflow Protection
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        throw new Error('Code range exceeds safe integer limits');
    }

    if (isNaN(start) || isNaN(end)) {
      throw new Error('Invalid numeric range codes');
    }

    if (start > end) {
      throw new Error('Start code must be less than or equal to end code');
    }

    const count = end - start + 1;

    if (count > MAX_CODES_PER_TEMPLATE) {
      throw new Error(
        `Range generates ${count} codes, exceeds maximum of ${MAX_CODES_PER_TEMPLATE}`
      );
    }

    // Use Array.from for immutability and conciseness
    const padding = startCode.length;
    return Array.from({ length: count }, (_, i) => 
        (start + i).toString().padStart(padding, '0')
    );
  }

  /**
   * Generate alphanumeric range codes (e.g., CS101-CS199).
   * Extracts prefix and numeric suffix, then generates range.
   */
  private generateAlphanumericRange(
    startCode: string,
    endCode: string
  ): string[] {
    const startMatch = startCode.match(/^([A-Za-z]+)(\d+)$/);
    const endMatch = endCode.match(/^([A-Za-z]+)(\d+)$/);

    if (!startMatch || !endMatch) {
      throw new Error(
        'Alphanumeric codes must follow format: PREFIX123 (letters followed by numbers)'
      );
    }

    const [, startPrefix, startNum] = startMatch;
    const [, endPrefix, endNum] = endMatch;

    if (startPrefix !== endPrefix) {
      throw new Error('Start and end codes must have the same prefix');
    }

    const start = parseInt(startNum, 10);
    const end = parseInt(endNum, 10);

    // Integer Overflow Protection
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        throw new Error('Code range exceeds safe integer limits');
    }

    if (start > end) {
      throw new Error('Start code must be less than or equal to end code');
    }

    const count = end - start + 1;

    if (count > MAX_CODES_PER_TEMPLATE) {
      throw new Error(
        `Range generates ${count} codes, exceeds maximum of ${MAX_CODES_PER_TEMPLATE}`
      );
    }

    // Use Array.from for immutability and conciseness
    const padding = startNum.length;
    return Array.from({ length: count }, (_, i) => 
        `${startPrefix}${(start + i).toString().padStart(padding, '0')}`
    );
  }

  /**
   * Validate range template configuration.
   */
  private validateRangeTemplate(startCode: string, endCode: string): string[] {
    const errors: string[] = [];

    if (!startCode || !endCode) {
      errors.push('Range template requires both start and end codes');
      return errors;
    }

    const isNumeric = /^\d+$/.test(startCode) && /^\d+$/.test(endCode);
    const isAlphanumeric =
      /^[A-Za-z]+\d+$/.test(startCode) && /^[A-Za-z]+\d+$/.test(endCode);

    if (!isNumeric && !isAlphanumeric) {
      errors.push(
        'Codes must be either purely numeric (31001) or alphanumeric (CS101)'
      );
      return errors;
    }

    if (isNumeric) {
      const start = parseInt(startCode, 10);
      const end = parseInt(endCode, 10);
      
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        errors.push('Code range exceeds safe integer limits');
        return errors;
      }

      if (start > end) {
        errors.push('Start code must be less than or equal to end code');
      }

      const count = end - start + 1;
      if (count > MAX_CODES_PER_TEMPLATE) {
        errors.push(
          `Range would generate ${count} codes, exceeds limit of ${MAX_CODES_PER_TEMPLATE}`
        );
      }
    }

    if (isAlphanumeric) {
      const startMatch = startCode.match(/^([A-Za-z]+)(\d+)$/);
      const endMatch = endCode.match(/^([A-Za-z]+)(\d+)$/);

      if (startMatch && endMatch) {
        const [, startPrefix, startNum] = startMatch;
        const [, endPrefix, endNum] = endMatch;
        
        const start = parseInt(startNum, 10);
        const end = parseInt(endNum, 10);

        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
             errors.push('Code range exceeds safe integer limits');
             return errors;
        }

        if (startPrefix !== endPrefix) {
          errors.push('Start and end codes must have the same prefix');
        }
      }
    }

    return errors;
  }

  /**
   * Validate list template configuration.
   */
  private validateListTemplate(codeList: string[]): string[] {
    const errors: string[] = [];

    if (!codeList || codeList.length === 0) {
      errors.push('List template requires at least one code');
      return errors;
    }

    if (codeList.length > MAX_LIST_CODES) {
      errors.push(`List exceeds maximum of ${MAX_LIST_CODES} codes`);
    }

    const uniqueCodes = new Set(codeList);
    if (uniqueCodes.size !== codeList.length) {
      errors.push('List contains duplicate codes');
    }

    return errors;
  }

  /**
   * Validate pattern template configuration.
   */
  private validatePatternTemplate(
    pattern: string,
    startCode: string,
    endCode: string
  ): string[] {
    let errors: string[] = [];

    if (!pattern) {
      errors.push('Pattern template requires a pattern');
    }

    if (!startCode || !endCode) {
      errors.push('Pattern template requires start and end codes for security');
    }

    try {
      if (!safeRegex(pattern)) {
        errors.push(`Potentially unsafe regex pattern: ${pattern}`);
      } else {
        new RegExp(pattern);
      }
    } catch {
      errors.push(`Invalid regex pattern: ${pattern}`);
    }

    const rangeErrors = this.validateRangeTemplate(startCode, endCode);
    errors = errors.concat(rangeErrors);

    return errors;
  }
}

export const subjectTemplateService = new SubjectTemplateService();
