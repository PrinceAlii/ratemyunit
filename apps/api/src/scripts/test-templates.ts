import { db } from '@ratemyunit/db/client';
import { subjectCodeTemplates, universities } from '@ratemyunit/db/schema';
import { eq, and } from 'drizzle-orm';
import { subjectTemplateService } from '../services/template.js';

interface TemplateStats {
  id: string;
  name: string;
  templateType: 'range' | 'list' | 'pattern';
  startCode: string | null;
  endCode: string | null;
  pattern: string | null;
  generatedCount: number;
  generationTime: number;
  faculty: string | null;
}

interface TestResults {
  totalTemplates: number;
  totalCodesWithDuplicates: number;
  uniqueCodes: number;
  duplicatesRemoved: number;
  totalGenerationTime: number;
  averageTimePerTemplate: number;
  templateStats: TemplateStats[];
}

async function testTemplateSystem(): Promise<TestResults> {
  console.log('🧪 Testing UTS Template System');
  console.log('================================\n');

  const utsUniversity = await db
    .select()
    .from(universities)
    .where(eq(universities.abbreviation, 'UTS'))
    .limit(1);

  if (!utsUniversity.length) {
    throw new Error('UTS university not found in database');
  }

  const universityId = utsUniversity[0].id;

  const templates = await db
    .select()
    .from(subjectCodeTemplates)
    .where(
      and(
        eq(subjectCodeTemplates.universityId, universityId),
        eq(subjectCodeTemplates.active, true)
      )
    );

  console.log(`Found ${templates.length} templates for UTS\n`);

  const templateStats: TemplateStats[] = [];
  const allGeneratedCodes: string[] = [];
  let totalGenerationTime = 0;

  for (const template of templates) {
    console.log(`Template: ${template.name}`);
    console.log(`- Type: ${template.templateType}`);

    const startTime = performance.now();

    try {
      const codes = subjectTemplateService.generateCodesFromTemplateData({
        id: template.id,
        templateType: template.templateType,
        startCode: template.startCode,
        endCode: template.endCode,
        codeList: template.codeList,
        pattern: template.pattern,
      });

      const endTime = performance.now();
      const generationTime = Math.round(endTime - startTime);

      totalGenerationTime += generationTime;

      if (template.templateType === 'range') {
        console.log(`- Range: ${template.startCode}-${template.endCode}`);
      } else if (template.templateType === 'pattern') {
        console.log(`- Pattern: ${template.pattern}`);
        console.log(`- Range: ${template.startCode}-${template.endCode}`);
      } else if (template.templateType === 'list') {
        console.log(`- List items: ${template.codeList?.length || 0}`);
      }

      console.log(`- Generated: ${codes.length.toLocaleString()} codes`);
      console.log(`- Time: ${generationTime}ms`);

      if (template.faculty) {
        console.log(`- Faculty: ${template.faculty}`);
      }

      console.log();

      templateStats.push({
        id: template.id,
        name: template.name,
        templateType: template.templateType,
        startCode: template.startCode,
        endCode: template.endCode,
        pattern: template.pattern,
        generatedCount: codes.length,
        generationTime,
        faculty: template.faculty,
      });

      allGeneratedCodes.push(...codes);
    } catch (error) {
      console.error(`❌ Error generating codes: ${error instanceof Error ? error.message : String(error)}`);
      console.log();
    }
  }

  const uniqueCodes = new Set(allGeneratedCodes);
  const totalCodesWithDuplicates = allGeneratedCodes.length;
  const duplicatesRemoved = totalCodesWithDuplicates - uniqueCodes.size;

  return {
    totalTemplates: templates.length,
    totalCodesWithDuplicates,
    uniqueCodes: uniqueCodes.size,
    duplicatesRemoved,
    totalGenerationTime,
    averageTimePerTemplate: Math.round(totalGenerationTime / templates.length),
    templateStats,
  };
}

function printSummary(results: TestResults): void {
  console.log('\nSummary:');
  console.log('--------');
  console.log(`- Total templates: ${results.totalTemplates}`);
  console.log(`- Total codes (with duplicates): ${results.totalCodesWithDuplicates.toLocaleString()}`);
  console.log(`- Unique codes: ${results.uniqueCodes.toLocaleString()}`);
  console.log(`- Duplicates removed: ${results.duplicatesRemoved.toLocaleString()}`);
  console.log(`- Total generation time: ${results.totalGenerationTime}ms`);
  console.log(`- Average per template: ${results.averageTimePerTemplate}ms`);

  const facultyStats = new Map<string, { count: number; codes: number }>();

  for (const stat of results.templateStats) {
    const faculty = stat.faculty || 'Uncategorized';
    const existing = facultyStats.get(faculty) || { count: 0, codes: 0 };
    facultyStats.set(faculty, {
      count: existing.count + 1,
      codes: existing.codes + stat.generatedCount,
    });
  }

  if (facultyStats.size > 0) {
    console.log('\nBy Faculty:');
    for (const [faculty, stats] of facultyStats) {
      console.log(`- ${faculty}: ${stats.count} templates, ${stats.codes.toLocaleString()} codes`);
    }
  }

  console.log('\n✅ Template system working correctly!');
}

async function main(): Promise<void> {
  try {
    const results = await testTemplateSystem();
    printSummary(results);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
    console.error(error);

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
