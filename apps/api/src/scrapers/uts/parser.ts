import type { ScrapedSubjectData } from './types';

/**
 * Data parser that transforms scraped subject data from the UTS handbook into
 * the format required for database insertion. This includes data cleaning,
 * normalization, and format conversion.
 */

/**
 * Represents the unit data structure expected by the database. This matches
 * the schema defined in packages/db/src/schema.ts.
 */
export interface ParsedUnitData {
  unitCode: string;
  unitName: string;
  description: string;
  creditPoints: number;
  prerequisites?: string;
  antiRequisites?: string;
  sessions: string;
  faculty?: string;
  scrapedAt: Date;
  active: boolean;
}

/**
 * Parses scraped subject data into the format required for database insertion.
 * This function performs data cleaning, normalization, and format conversions.
 *
 * @param scrapedData - Raw scraped subject data
 * @returns Parsed unit data ready for database insertion
 */
export function parseSubjectToUnit(
  scrapedData: ScrapedSubjectData
): ParsedUnitData {
  return {
    unitCode: normalizeUnitCode(scrapedData.code),
    unitName: cleanText(scrapedData.name),
    description: truncateText(cleanText(scrapedData.description), 1000),
    creditPoints: scrapedData.creditPoints,
    prerequisites: scrapedData.prerequisites
      ? truncateText(cleanText(scrapedData.prerequisites), 1000)
      : undefined,
    antiRequisites: scrapedData.antiRequisites
      ? truncateText(cleanText(scrapedData.antiRequisites), 1000)
      : undefined,
    sessions: serializeSessions(scrapedData.sessions),
    faculty: scrapedData.faculty
      ? truncateText(cleanText(scrapedData.faculty), 255)
      : undefined,
    scrapedAt: new Date(),
    active: true,
  };
}

/**
 * Normalizes a unit code by trimming whitespace and converting to uppercase.
 * UTS codes are numeric, but we normalize to uppercase for consistency.
 *
 * @param code - Raw unit code
 * @returns Normalized unit code
 */
function normalizeUnitCode(code: string): string {
  return code.trim().toUpperCase();
}

/**
 * Cleans text by trimming whitespace and removing excessive whitespace within
 * the text.
 *
 * @param text - Raw text to clean
 * @returns Cleaned text
 */
function cleanText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space.
    .replace(/\n\s*\n/g, '\n'); // Remove excessive newlines.
}

/**
 * Truncates text to a maximum length while preserving word boundaries when
 * possible.
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to truncate at word boundary.
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Serializes sessions array to JSON string for database storage. The database
 * stores sessions as text (JSONB), so we convert the array to a JSON string.
 *
 * @param sessions - Array of session strings
 * @returns JSON string representation of sessions
 */
function serializeSessions(sessions: string[]): string {
  return JSON.stringify(sessions);
}

/**
 * Parses a sessions JSON string back into an array. This is the inverse of
 * serializeSessions and is used when reading from the database.
 *
 * @param sessionsJson - JSON string from database
 * @returns Array of session strings
 */
export function deserializeSessions(sessionsJson: string): string[] {
  try {
    const parsed = JSON.parse(sessionsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Extracts prerequisite subject codes from prerequisite text. This attempts to
 * parse codes from text like "31250 Introduction to Data Analytics" or "48024
 * and 48434".
 *
 * @param prerequisitesText - Raw prerequisites text
 * @returns Array of extracted subject codes
 */
export function extractPrerequisiteCodes(
  prerequisitesText: string
): string[] {
  const codes: string[] = [];
  const codeRegex = /\b(\d{5})\b/g;
  let match;

  while ((match = codeRegex.exec(prerequisitesText)) !== null) {
    codes.push(match[1]);
  }

  return [...new Set(codes)]; // Remove duplicates.
}

/**
 * Parses prerequisite text to identify logical structure (AND/OR relationships).
 * Returns a simplified representation of prerequisites.
 *
 * @param prerequisitesText - Raw prerequisites text
 * @returns Structured prerequisite information
 */
export function parsePrerequisiteStructure(prerequisitesText: string): {
  codes: string[];
  hasAndLogic: boolean;
  hasOrLogic: boolean;
  raw: string;
} {
  const codes = extractPrerequisiteCodes(prerequisitesText);
  const lowerText = prerequisitesText.toLowerCase();

  return {
    codes,
    hasAndLogic: lowerText.includes(' and '),
    hasOrLogic: lowerText.includes(' or '),
    raw: prerequisitesText,
  };
}
