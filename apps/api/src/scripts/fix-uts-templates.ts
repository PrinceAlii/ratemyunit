import 'dotenv/config';
import { db } from '@ratemyunit/db/client';
import { universities, subjectCodeTemplates, users } from '@ratemyunit/db/schema';
import { eq, and } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Valid codes from uts_codes.txt (condensed for script usage)
// I will read the file dynamically since it's large.
const UTS_CODES_PATH = path.resolve(__dirname, '../../../../uts_codes.txt');

async function fixUtsTemplates() {
  console.log('🔧 Fixing UTS Templates...');

  // 1. Get UTS University ID
  const [uts] = await db
    .select()
    .from(universities)
    .where(eq(universities.abbreviation, 'UTS'))
    .limit(1);

  if (!uts) {
    console.error('❌ UTS not found in database');
    process.exit(1);
  }

  // 2. Get Admin User (for createdBy)
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.role, 'admin'))
    .limit(1);

  // 3. Read valid codes
  console.log(`📖 Reading valid codes from ${UTS_CODES_PATH}...`);
  let validCodes: string[] = [];
  try {
    const content = fs.readFileSync(UTS_CODES_PATH, 'utf-8');
    validCodes = content.split('\n').map(c => c.trim()).filter(c => c.length > 0);
    console.log(`✅ Loaded ${validCodes.length} valid codes`);
  } catch (e) {
    console.error(`❌ Failed to read uts_codes.txt: ${e}`);
    process.exit(1);
  }

  // 4. Delete existing Range templates for UTS
  console.log('🗑️ Deleting existing broad Range templates for UTS...');
  await db
    .delete(subjectCodeTemplates)
    .where(
        and(
            eq(subjectCodeTemplates.universityId, uts.id),
            eq(subjectCodeTemplates.templateType, 'range')
        )
    );
  console.log('✅ Deleted old range templates');

  // 5. Group codes by prefix/faculty logic
  const groups: Record<string, string[]> = {
    'IT Subjects (31XXX)': [],
    'Engineering Subjects (4XXXX)': [],
    'Business Subjects (2XXXX)': [],
    'Health Subjects (9XXXX, 09XXX)': [],
    'Law Subjects (7XXXX)': [],
    'Communication Subjects (5XXXX)': [],
    'Design/Architecture (1XXXX, 8XXXX)': [],
    'Science Subjects (33XXX, 6XXXX)': [],
    'Education Subjects (01XXX, 02XXX)': [],
    'International/Other (9XXXX, etc)': []
  };

  const miscCodes: string[] = [];

  for (const code of validCodes) {
      if (code.startsWith('31') || code.startsWith('32')) groups['IT Subjects (31XXX)'].push(code);
      else if (code.startsWith('4')) groups['Engineering Subjects (4XXXX)'].push(code);
      else if (code.startsWith('2')) groups['Business Subjects (2XXXX)'].push(code);
      else if (code.startsWith('09') || code.startsWith('90') || code.startsWith('91') || code.startsWith('92') || code.startsWith('93') || code.startsWith('96')) groups['Health Subjects (9XXXX, 09XXX)'].push(code);
      else if (code.startsWith('7')) groups['Law Subjects (7XXXX)'].push(code);
      else if (code.startsWith('5')) groups['Communication Subjects (5XXXX)'].push(code);
      else if (code.startsWith('1') || code.startsWith('8')) groups['Design/Architecture (1XXXX, 8XXXX)'].push(code);
      else if (code.startsWith('33') || code.startsWith('34') || code.startsWith('35') || code.startsWith('36') || code.startsWith('37') || code.startsWith('6')) groups['Science Subjects (33XXX, 6XXXX)'].push(code);
      else if (code.startsWith('01') || code.startsWith('02')) groups['Education Subjects (01XXX, 02XXX)'].push(code);
      else miscCodes.push(code);
  }

  if (miscCodes.length > 0) {
      groups['Other Subjects'] = miscCodes;
  }

  // 6. Create new List templates
  console.log('✨ Creating new List templates...');
  
  let priority = 10;
  for (const [name, codes] of Object.entries(groups)) {
      if (codes.length === 0) continue;

      // Split into chunks if > 10000 (just in case, though 3500 total won't exceed)
      // UTS total is 3567, so it fits in one 10k list easily, but per group is even safer.
      
      console.log(`   ➡️ ${name}: ${codes.length} codes`);
      
      await db.insert(subjectCodeTemplates).values({
          universityId: uts.id,
          name: `${name} (List)`,
          templateType: 'list',
          codeList: codes,
          description: `Exact list of ${codes.length} valid subjects from official list`,
          priority: priority--,
          active: true,
          createdBy: admin?.id || null
      });
  }

  console.log('\n✅ UTS Templates successfully replaced with precise lists!');
}

fixUtsTemplates().catch(console.error);
