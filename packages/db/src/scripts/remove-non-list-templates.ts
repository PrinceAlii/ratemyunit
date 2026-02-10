import 'dotenv/config';
import { db } from '../client.js';
import { subjectCodeTemplates } from '../schema.js';
import { ne, or } from 'drizzle-orm';

/**
 * Script to remove templates that are not 'list' type.
 * This removes 'range' and 'pattern' templates that scan units without specific targeting.
 * Keeps only 'list' templates that have defined, specific unit codes.
 */
async function removeNonListTemplates() {
  console.log('🗑️  Removing non-list templates (range and pattern types)...\n');

  try {
    // Find all templates that are NOT 'list' type
    const templatesToRemove = await db
      .select()
      .from(subjectCodeTemplates)
      .where(
        or(
          ne(subjectCodeTemplates.templateType, 'list'),
        )
      );

    if (templatesToRemove.length === 0) {
      console.log('✅ No non-list templates found. All templates are already list-based.');
      return;
    }

    console.log(`Found ${templatesToRemove.length} non-list template(s) to remove:\n`);

    for (const template of templatesToRemove) {
      console.log(`  - ${template.name} (${template.templateType})`);
    }

    console.log('\n🗑️  Deleting templates...\n');

    // Delete the templates
    const result = await db
      .delete(subjectCodeTemplates)
      .where(
        or(
          ne(subjectCodeTemplates.templateType, 'list'),
        )
      )
      .returning();

    console.log(`✅ Successfully deleted ${result.length} template(s)!\n`);

    // Show remaining templates
    const remainingTemplates = await db
      .select()
      .from(subjectCodeTemplates);

    console.log(`📊 Remaining templates: ${remainingTemplates.length}`);
    for (const template of remainingTemplates) {
      console.log(`  ✓ ${template.name} (${template.templateType})`);
    }

  } catch (error) {
    console.error('❌ Failed to remove templates:', error);
    throw error;
  }
}

removeNonListTemplates()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
