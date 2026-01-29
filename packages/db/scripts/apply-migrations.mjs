import postgres from 'postgres';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'drizzle');

async function applyMigrations() {
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  
  try {
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of files) {
      console.log(`Applying ${file}...`);
      const content = readFileSync(join(migrationsDir, file), 'utf-8');
      
      try {
        await sql.unsafe(content);
        console.log(`✓ ${file} applied successfully`);
      } catch (err) {
        console.error(`✗ ${file} failed:`, err.message);
      }
    }
  } finally {
    await sql.end();
  }
}

applyMigrations().catch(console.error);
