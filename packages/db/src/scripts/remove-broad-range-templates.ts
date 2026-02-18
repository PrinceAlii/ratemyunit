
import { drizzle } from 'drizzle-orm/postgres-js';
import { subjectCodeTemplates, universities } from '../schema.js';
import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import 'dotenv/config';

async function cleanupTemplates() {
  console.log('Starting template cleanup...');

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set.');
  }

  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql);

  try {
    const [uts] = await db.select().from(universities).where(eq(universities.abbreviation, 'UTS')).limit(1);

    if (!uts) {
      console.error('UTS university not found. Aborting.');
      return;
    }

    console.log(`Found UTS with ID: ${uts.id}`);

    const templates = await db.select().from(subjectCodeTemplates).where(eq(subjectCodeTemplates.universityId, uts.id));

    const templatesToDelete = [];
    const namesToDelete = [
      'IT Subjects (31XXX) (List)',
      'Science Subjects (33XXX, 6XXXX) (List)',
      'Education Subjects (01XXX, 02XXX) (List)'
    ];

    for (const template of templates) {
      if (namesToDelete.includes(template.name)) {
        templatesToDelete.push(template.id);
      }
    }

    if (templatesToDelete.length > 0) {
      console.log(`Found ${templatesToDelete.length} templates to delete...`);
      for (const templateId of templatesToDelete) {
        console.log(`Deleting template ${templateId}`);
        await db.delete(subjectCodeTemplates).where(eq(subjectCodeTemplates.id, templateId));
      }
      console.log('Finished deleting templates.');
    } else {
      console.log('No templates to delete.');
    }


  } finally {
    await sql.end();
    console.log('Cleanup complete.');
  }
}

cleanupTemplates().catch(console.error);
