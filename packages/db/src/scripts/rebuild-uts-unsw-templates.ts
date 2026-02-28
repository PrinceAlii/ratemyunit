import 'dotenv/config';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@ratemyunit/db/client';
import { subjectCodeTemplates, universities, users } from '@ratemyunit/db/schema';
import {
  extractUnswCodesFromSearchResponse,
  extractUnswSearchSummary,
  extractUtsCodesFromAlphaHtml,
  normalizeAndUniqueCodes,
} from './rebuild-uts-unsw-templates.helpers.js';

const MAX_CODES_PER_TEMPLATE = 10000;
const UNSW_PAGE_SIZE = 500;
const UNSW_YEARS = [2025, 2026] as const;
const UTS_ALPHA_URL = 'https://www.handbook.uts.edu.au/subjects/alpha';
const UNSW_SEARCH_URL = 'https://courseoutlines.unsw.edu.au/v1/publicsitecourseoutlines/search';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: 'text/html,application/xhtml+xml' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.json();
}

function buildUnswSearchUrl(year: number, pageNumber: number, top: number): string {
  const params = new URLSearchParams({
    searchText: '',
    pageNumber: String(pageNumber),
    top: String(top),
    orderBy: 'coursename desc',
    year: String(year),
  });

  return `${UNSW_SEARCH_URL}?${params.toString()}`;
}

async function fetchUnswYearCodes(year: number): Promise<string[]> {
  const allCodes: string[] = [];
  let currentPage = 1;
  let totalRecordCount = Number.POSITIVE_INFINITY;
  let seenRecords = 0;

  while (seenRecords < totalRecordCount) {
    const url = buildUnswSearchUrl(year, currentPage, UNSW_PAGE_SIZE);
    const payload = await fetchJson(url);
    const pageCodes = extractUnswCodesFromSearchResponse(payload);
    const summary = extractUnswSearchSummary(payload);

    allCodes.push(...pageCodes);
    seenRecords += summary.pageRecordCount;
    totalRecordCount = summary.totalRecordCount;

    if (summary.pageRecordCount === 0) {
      break;
    }

    currentPage += 1;
  }

  const deduped = normalizeAndUniqueCodes(allCodes);
  console.log(
    `UNSW ${year}: fetched ${deduped.length} unique codes across ${currentPage - 1} page(s)`
  );
  return deduped;
}

function assertTemplateSize(university: string, codes: string[]): void {
  if (codes.length === 0) {
    throw new Error(`${university}: extracted 0 subject codes`);
  }

  if (codes.length > MAX_CODES_PER_TEMPLATE) {
    throw new Error(
      `${university}: extracted ${codes.length} codes, exceeds max ${MAX_CODES_PER_TEMPLATE}`
    );
  }
}

async function rebuildTemplates() {
  console.log('Rebuilding UTS and UNSW templates...');

  const [universityRows, adminRows] = await Promise.all([
    db
      .select({
        id: universities.id,
        abbreviation: universities.abbreviation,
      })
      .from(universities)
      .where(inArray(universities.abbreviation, ['UTS', 'UNSW'])),
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1),
  ]);

  const uts = universityRows.find((uni) => uni.abbreviation === 'UTS');
  const unsw = universityRows.find((uni) => uni.abbreviation === 'UNSW');

  if (!uts || !unsw) {
    throw new Error('Missing UTS or UNSW university rows in database');
  }

  const createdBy = adminRows[0]?.id ?? null;

  console.log(`Fetching UTS codes from ${UTS_ALPHA_URL}`);
  const utsHtml = await fetchText(UTS_ALPHA_URL);
  const utsCodes = extractUtsCodesFromAlphaHtml(utsHtml);
  assertTemplateSize('UTS', utsCodes);
  console.log(`UTS: extracted ${utsCodes.length} unique codes`);

  console.log(`Fetching UNSW codes from ${UNSW_SEARCH_URL}`);
  const unswCodesByYear = await Promise.all(UNSW_YEARS.map((year) => fetchUnswYearCodes(year)));
  const unswCodes = normalizeAndUniqueCodes(unswCodesByYear.flat());
  assertTemplateSize('UNSW', unswCodes);
  console.log(
    `UNSW: extracted ${unswCodes.length} unique codes after ${UNSW_YEARS.join('+')} union`
  );

  await db.transaction(async (tx) => {
    const deletedRows = await tx
      .delete(subjectCodeTemplates)
      .where(
        and(
          inArray(subjectCodeTemplates.universityId, [uts.id, unsw.id])
        )
      )
      .returning({
        id: subjectCodeTemplates.id,
        universityId: subjectCodeTemplates.universityId,
      });

    const deletedUts = deletedRows.filter((row) => row.universityId === uts.id).length;
    const deletedUnsw = deletedRows.filter((row) => row.universityId === unsw.id).length;
    console.log(`Deleted templates: UTS=${deletedUts}, UNSW=${deletedUnsw}`);

    await tx.insert(subjectCodeTemplates).values([
      {
        universityId: uts.id,
        name: 'UTS All Subjects (Alpha List)',
        templateType: 'list',
        codeList: utsCodes,
        description: `Source: ${UTS_ALPHA_URL}`,
        faculty: null,
        active: true,
        priority: 100,
        createdBy,
      },
      {
        universityId: unsw.id,
        name: 'UNSW All Subjects (Course Outlines 2025+2026)',
        templateType: 'list',
        codeList: unswCodes,
        description: `Source: ${UNSW_SEARCH_URL}; years=${UNSW_YEARS.join(',')}`,
        faculty: null,
        active: true,
        priority: 90,
        createdBy,
      },
    ]);
  });

  console.log(`Created UTS template with ${utsCodes.length} codes`);
  console.log(`Created UNSW template with ${unswCodes.length} codes`);
  console.log(`UTS sample: ${utsCodes.slice(0, 10).join(', ')}`);
  console.log(`UNSW sample: ${unswCodes.slice(0, 10).join(', ')}`);
  console.log('Template rebuild complete.');
}

rebuildTemplates()
  .catch((error) => {
    console.error('Template rebuild failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
