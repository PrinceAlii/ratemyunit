import 'dotenv/config';
import { db } from '@ratemyunit/db/client';
import { subjectCodeTemplates, universities } from '@ratemyunit/db/schema';
import { eq, inArray } from 'drizzle-orm';

const DRY_RUN = process.env.DRY_RUN === 'true';

const LARGE_SPAN_THRESHOLD = 300;
const MIN_LIST_SIZE = 200;
const MIN_DENSITY = 0.95;
const MAX_MISSING_RATIO = 0.05;
const MAX_MISSING_ABS = 10;

const numericCode = /^\d+$/;

type TemplateStats = {
  count: number;
  span: number;
  min: number;
  max: number;
  density: number;
  missing: number;
};

function normalizeCodes(codeList: string[] | null) {
  if (!codeList) return [];
  return Array.from(
    new Set(codeList.map((code) => code.trim()).filter((code) => code.length > 0))
  );
}

function getNumericStats(codeList: string[]): TemplateStats | null {
  if (codeList.length === 0) return null;
  if (!codeList.every((code) => numericCode.test(code))) return null;

  const numbers = codeList
    .map((code) => Number.parseInt(code, 10))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (numbers.length === 0) return null;

  const min = numbers[0];
  const max = numbers[numbers.length - 1];
  const span = max - min + 1;
  const count = codeList.length;
  const missing = Math.max(0, span - count);
  const density = span > 0 ? count / span : 0;

  return { count, span, min, max, density, missing };
}

function isRangeLikeList(codeList: string[] | null) {
  if (!codeList || codeList.length === 0) return true;

  const normalized = normalizeCodes(codeList);
  if (normalized.length < MIN_LIST_SIZE) return false;

  const stats = getNumericStats(normalized);
  if (!stats) return false;

  if (stats.span < LARGE_SPAN_THRESHOLD) return false;

  const maxMissing = Math.max(MAX_MISSING_ABS, Math.floor(stats.span * MAX_MISSING_RATIO));

  return (
    stats.density >= MIN_DENSITY &&
    stats.missing <= maxMissing
  );
}

function formatStats(stats: TemplateStats | null) {
  if (!stats) return 'non-numeric';
  return `count=${stats.count}, span=${stats.span}, missing=${stats.missing}, density=${stats.density.toFixed(3)} (${stats.min}-${stats.max})`;
}

async function cleanupUtsTemplates() {
  console.log('🧹 Cleaning up UTS templates...');

  const [uts] = await db
    .select()
    .from(universities)
    .where(eq(universities.abbreviation, 'UTS'))
    .limit(1);

  if (!uts) {
    console.error('❌ UTS not found in database');
    process.exit(1);
  }

  const templates = await db
    .select()
    .from(subjectCodeTemplates)
    .where(eq(subjectCodeTemplates.universityId, uts.id));

  const removalCandidates = templates.filter((template) => {
    if (template.templateType !== 'list') return true;
    return isRangeLikeList(template.codeList);
  });

  const keepTemplates = templates.filter(
    (template) => !removalCandidates.find((candidate) => candidate.id === template.id)
  );

  console.log(`Found ${templates.length} UTS templates.`);
  console.log(`Keeping ${keepTemplates.length} template(s).`);

  keepTemplates.forEach((template) => {
    const stats = template.templateType === 'list'
      ? formatStats(getNumericStats(normalizeCodes(template.codeList)))
      : 'non-list';
    console.log(`  ✓ ${template.name} (${template.templateType}) -> ${stats}`);
  });

  if (removalCandidates.length === 0) {
    console.log('✅ No templates matched cleanup criteria.');
    return;
  }

  console.log(`\nRemoving ${removalCandidates.length} template(s):`);
  removalCandidates.forEach((template) => {
    const stats = template.templateType === 'list'
      ? formatStats(getNumericStats(normalizeCodes(template.codeList)))
      : 'non-list';
    console.log(`  - ${template.name} (${template.templateType}) -> ${stats}`);
  });

  if (DRY_RUN) {
    console.log('\nDRY_RUN=true: no changes applied.');
    return;
  }

  await db
    .delete(subjectCodeTemplates)
    .where(inArray(subjectCodeTemplates.id, removalCandidates.map((template) => template.id)));

  console.log(`✅ Deleted ${removalCandidates.length} template(s).`);
  console.log('✅ UTS template cleanup complete.');
}

cleanupUtsTemplates().catch((err) => {
  console.error(err);
  process.exit(1);
});
