import dotenv from 'dotenv';
import path from 'path';

// Load env before imports
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { scraperQueue, setupWorker } from '../src/lib/queue';
import { QueueEvents } from 'bullmq';
import { db } from '../../../packages/db/src/client';
import { universities } from '../../../packages/db/src/schema';
import { eq } from 'drizzle-orm';

async function setupTestUni() {
    const uniId = 'benchmark-uni';
    
    // Check if exists
    const [existing] = await db.select().from(universities).where(eq(universities.id, uniId));
    if (existing) return existing;

    // Create mock uni
    const [uni] = await db.insert(universities).values({
        id: uniId,
        name: 'Benchmark University',
        abbreviation: 'BENCH',
        country: 'Australia',
        state: 'NSW',
        websiteUrl: 'http://example.com',
        handbookUrl: 'http://example.com',
        scraperType: 'generic', // Use generic or custom mock scraper if needed
        scraperRoutes: JSON.stringify({ base: 'http://example.com' }),
        scraperSelectors: JSON.stringify({ search: { url: '', item: '' } }),
    }).returning();
    
    return uni;
}

async function runBenchmark() {
  console.log('🚀 Starting Benchmark...');

  await setupTestUni();

  const JOB_COUNT = 10; // Keep it small for now
  const queueEvents = new QueueEvents('scraper-queue', { connection: scraperQueue.opts.connection });

  // Clear existing queue
  await scraperQueue.drain();

  // Setup worker
  const worker = setupWorker();

  const start = Date.now();
  let completed = 0;
  let failed = 0;

  queueEvents.on('completed', ({ jobId }) => {
    completed++;
    checkDone();
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    failed++;
    // console.log(`Job ${jobId} failed: ${failedReason}`);
    checkDone();
  });

  function checkDone() {
      process.stdout.write(`\r✅ Completed: ${completed} | ❌ Failed: ${failed} | Total: ${JOB_COUNT}`);
      if (completed + failed === JOB_COUNT) {
        const end = Date.now();
        const duration = (end - start) / 1000;
        console.log(`\n\n🎉 Benchmark Finished!`);
        console.log(`Time: ${duration.toFixed(2)}s`);
        console.log(`Throughput: ${(JOB_COUNT / (duration / 60)).toFixed(2)} units/min`);
        process.exit(0);
      }
  }

  const jobs = Array.from({ length: JOB_COUNT }).map((_, i) => ({
    name: `benchmark-${i}`,
    data: {
      type: 'scrape',
      unitCode: `TEST-${i}`,
      universityId: 'benchmark-uni'
    }
  }));

  await scraperQueue.addBulk(jobs);
  console.log(`\n📥 Queued ${JOB_COUNT} jobs...`);
}

runBenchmark().catch((e) => {
    console.error(e);
    process.exit(1);
});