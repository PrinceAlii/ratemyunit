import 'dotenv/config';
import { db } from '@ratemyunit/db/client';
import { subjectCodeTemplates, universities } from '@ratemyunit/db/schema';
import { eq, inArray } from 'drizzle-orm';

const ENGINEERING_NAME_MATCH = 'engineering subjects';
const IT_OLD_NAME = 'IT Subjects (31XXX) (List)';
const IT_NEW_NAME = 'IT Subjects (31XXX-32XXX) (List)';

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

  const templateIdsToDelete = templates
    .filter((template) => {
      const name = template.name.toLowerCase();
      return (
        template.templateType !== 'list' ||
        name.includes(ENGINEERING_NAME_MATCH)
      );
    })
    .map((template) => template.id);

  if (templateIdsToDelete.length > 0) {
    await db
      .delete(subjectCodeTemplates)
      .where(inArray(subjectCodeTemplates.id, templateIdsToDelete));

    console.log(`✅ Deleted ${templateIdsToDelete.length} template(s).`);
  } else {
    console.log('✅ No templates matched cleanup criteria.');
  }

  const itTemplate = templates.find((template) => template.name === IT_OLD_NAME);
  if (itTemplate) {
    await db
      .update(subjectCodeTemplates)
      .set({ name: IT_NEW_NAME, updatedAt: new Date() })
      .where(eq(subjectCodeTemplates.id, itTemplate.id));

    console.log(`✅ Renamed "${IT_OLD_NAME}" to "${IT_NEW_NAME}".`);
  }

  console.log('✅ UTS template cleanup complete.');
}

cleanupUtsTemplates().catch((err) => {
  console.error(err);
  process.exit(1);
});
