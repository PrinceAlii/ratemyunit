/**
 * Example usage of SubjectTemplateService
 *
 * This file demonstrates how to use the template service for generating
 * subject codes from different template types.
 */

import { subjectTemplateService } from './template';

// Example 1: Generate codes from a database template
async function exampleGenerateFromTemplate() {
  try {
    const templateId = '123e4567-e89b-12d3-a456-426614174000';
    const codes = await subjectTemplateService.generateCodesFromTemplate(templateId);

    console.log(`Generated ${codes.length} codes:`);
    console.log(codes.slice(0, 10)); // Show first 10
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error generating codes:', error.message);
    }
  }
}

// Example 2: Preview codes before generating all
async function examplePreviewCodes() {
  try {
    const templateId = '123e4567-e89b-12d3-a456-426614174000';
    const preview = await subjectTemplateService.previewCodes(templateId, 20);

    console.log('Preview (first 20 codes):', preview);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error previewing codes:', error.message);
    }
  }
}

// Example 3: Validate template before using
async function exampleValidateTemplate() {
  const template = {
    id: '1',
    templateType: 'range' as const,
    startCode: '31001',
    endCode: '31999',
    codeList: null,
    pattern: null,
  };

  const validation = subjectTemplateService.validateTemplate(template);

  if (validation.valid) {
    console.log('Template is valid');
  } else {
    console.log('Template has errors:', validation.errors);
  }
}

// Example 4: Generate codes from template data directly (without database)
function exampleGenerateFromData() {
  // Range template: numeric codes
  const rangeTemplate = {
    id: '1',
    templateType: 'range' as const,
    startCode: '31001',
    endCode: '31010',
    codeList: null,
    pattern: null,
  };

  const rangeCodes = subjectTemplateService.generateCodesFromTemplateData(rangeTemplate);
  console.log('Range codes:', rangeCodes);
  // Output: ['31001', '31002', '31003', ..., '31010']

  // List template: specific codes
  const listTemplate = {
    id: '2',
    templateType: 'list' as const,
    startCode: null,
    endCode: null,
    codeList: ['CS101', 'CS102', 'ENG201', 'MATH301'],
    pattern: null,
  };

  const listCodes = subjectTemplateService.generateCodesFromTemplateData(listTemplate);
  console.log('List codes:', listCodes);
  // Output: ['CS101', 'CS102', 'ENG201', 'MATH301']

  // Pattern template: filtered codes
  const patternTemplate = {
    id: '3',
    templateType: 'pattern' as const,
    startCode: '31000',
    endCode: '31020',
    codeList: null,
    pattern: '^3101[0-9]$', // Only codes matching pattern
  };

  const patternCodes = subjectTemplateService.generateCodesFromTemplateData(patternTemplate);
  console.log('Pattern codes:', patternCodes);
  // Output: ['31010', '31011', '31012', ..., '31019']
}

// Example 5: Handle errors gracefully
function exampleErrorHandling() {
  try {
    // Invalid template: start > end
    const invalidTemplate = {
      id: '1',
      templateType: 'range' as const,
      startCode: '31999',
      endCode: '31001',
      codeList: null,
      pattern: null,
    };

    subjectTemplateService.generateCodesFromTemplateData(invalidTemplate);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Expected error:', error.message);
      // Output: "Invalid template: Start code must be less than or equal to end code"
    }
  }

  try {
    // Invalid template: too many codes
    const overflowTemplate = {
      id: '2',
      templateType: 'range' as const,
      startCode: '1',
      endCode: '200000',
      codeList: null,
      pattern: null,
    };

    subjectTemplateService.generateCodesFromTemplateData(overflowTemplate);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Expected error:', error.message);
      // Output: "Invalid template: Range generates 200000 codes, exceeds maximum of 100000"
    }
  }
}

// Example 6: Alphanumeric codes
function exampleAlphanumericCodes() {
  const template = {
    id: '1',
    templateType: 'range' as const,
    startCode: 'CS101',
    endCode: 'CS110',
    codeList: null,
    pattern: null,
  };

  const codes = subjectTemplateService.generateCodesFromTemplateData(template);
  console.log('Alphanumeric codes:', codes);
  // Output: ['CS101', 'CS102', 'CS103', ..., 'CS110']
}

// Export examples for documentation
export {
  exampleGenerateFromTemplate,
  examplePreviewCodes,
  exampleValidateTemplate,
  exampleGenerateFromData,
  exampleErrorHandling,
  exampleAlphanumericCodes,
};
