import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '@ratemyunit/db/client';
import { subjectCodeTemplates, universities, users } from '@ratemyunit/db/schema';
import {
  extractUsydCodesFromSeoHtml,
  extractUsydSeoPageUrls,
  normalizeAndUniqueCodes,
} from './rebuild-uts-unsw-templates.helpers.js';

const MAX_CODES_PER_TEMPLATE = 20000;
const USYD_SEO_INDEX_URL = 'https://www.sydney.edu.au/students/units/seo.html';
const TEMPLATE_NAME = 'USYD All Units (SEO Pages)';

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: 'text/html,application/xhtml+xml' },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

function assertTemplateSize(codes: string[]): void {
  if (codes.length === 0) {
    throw new Error('USYD: extracted 0 subject codes');
  }

  if (codes.length > MAX_CODES_PER_TEMPLATE) {
    throw new Error(
      `USYD: extracted ${codes.length} codes, exceeds max ${MAX_CODES_PER_TEMPLATE}`
    );
  }
}

async function rebuildUsydTemplate() {
  console.log('Rebuilding USYD template...');
  console.log(`Fetching USYD SEO index from ${USYD_SEO_INDEX_URL}`);

  const seoIndexHtml = await fetchText(USYD_SEO_INDEX_URL);
  const seoPageUrls = extractUsydSeoPageUrls(seoIndexHtml, USYD_SEO_INDEX_URL);
  console.log(`Discovered ${seoPageUrls.length} SEO page(s)`);

  const pageResponses = await Promise.all(
    seoPageUrls.map(async (url) => {
      const html = await fetchText(url);
      return { url, codes: extractUsydCodesFromSeoHtml(html) };
    })
  );

  const allCodes = normalizeAndUniqueCodes(pageResponses.flatMap((page) => page.codes));
  assertTemplateSize(allCodes);

  const pagesWithoutCodes = pageResponses.filter((page) => page.codes.length === 0).map((p) => p.url);
  if (pagesWithoutCodes.length > 0) {
    console.warn(`Warning: ${pagesWithoutCodes.length} SEO pages returned no codes`);
  }

  const [universityRows, adminRows] = await Promise.all([
    db
      .select({
        id: universities.id,
        abbreviation: universities.abbreviation,
      })
      .from(universities)
      .where(eq(universities.abbreviation, 'USYD'))
      .limit(1),
    db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, 'admin'))
      .limit(1),
  ]);

  const usyd = universityRows[0];
  if (!usyd) {
    throw new Error('Missing USYD university row in database');
  }

  const createdBy = adminRows[0]?.id ?? null;

  await db.transaction(async (tx) => {
    const deletedRows = await tx
      .delete(subjectCodeTemplates)
      .where(eq(subjectCodeTemplates.universityId, usyd.id))
      .returning({ id: subjectCodeTemplates.id });

    console.log(`Deleted ${deletedRows.length} existing USYD template(s)`);

    await tx.insert(subjectCodeTemplates).values({
      universityId: usyd.id,
      name: TEMPLATE_NAME,
      templateType: 'list',
      codeList: allCodes,
      description: `Source: ${USYD_SEO_INDEX_URL}; pages=${seoPageUrls.length}`,
      faculty: null,
      active: true,
      priority: 80,
      createdBy,
    });
  });

  console.log(`Created USYD template with ${allCodes.length} codes`);
  console.log(`USYD sample: ${allCodes.slice(0, 10).join(', ')}`);
  console.log('USYD template rebuild complete.');
}

rebuildUsydTemplate()
  .catch((error) => {
    console.error('USYD template rebuild failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit();
  });
