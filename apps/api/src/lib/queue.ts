import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { chromium } from 'playwright';
import { config } from '../config.js';
import { scraperService } from '../services/scraper.js';

const connection = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
});

export const QUEUE_NAME = 'scraper-queue';

// Queue for producers
export const scraperQueue = new Queue(QUEUE_NAME, {
  connection,
});

export interface ScrapeJobData {
  type: 'scrape' | 'discovery';
  unitCode?: string;
  universityId: string;
}

// Worker setup
export function setupWorker() {
  console.log('👷 Setting up Scraper Worker...');
  
  // Persistent browser instance management
  let browser: any = null;
  let jobCount = 0;
  const MAX_JOBS_PER_BROWSER = 100;

  const getBrowser = async () => {
      if (!browser) {
          console.log('🌐 Launching Worker Browser...');
          browser = await chromium.launch({ headless: true });
      }
      return browser;
  };

  const recycleBrowser = async () => {
      if (browser) {
          console.log('♻️ Recycling Worker Browser...');
          await browser.close();
          browser = null;
          jobCount = 0;
      }
  };
  
  const worker = new Worker<ScrapeJobData>(
    QUEUE_NAME,
    async (job) => {
      const { type, unitCode, universityId } = job.data;
      
      if (type === 'discovery') {
          console.log(`Processing Discovery Job ${job.id} for Uni: ${universityId}`);
          try {
              const codes = await scraperService.discoverUnits(universityId);
              console.log(`🔎 Discovery found ${codes.length} units.`);
              
              // Bulk add scrape jobs
              const jobs = codes.map(code => ({
                  name: `scrape-${code}`,
                  data: {
                      type: 'scrape' as const,
                      unitCode: code,
                      universityId
                  },
                  opts: { jobId: `scrape-${universityId}-${code}` } // Deduplication
              }));
              
              if (jobs.length > 0) {
                  await scraperQueue.addBulk(jobs);
                  console.log(`🚀 Queued ${jobs.length} scrape jobs.`);
              }
          } catch (e) {
              console.error(`Discovery failed for ${universityId}:`, e);
              throw e;
          }
      } else {
          // Default scrape
          if (!unitCode) throw new Error('Unit code required for scrape job');
          console.log(`Processing Scrape Job ${job.id}: ${unitCode} (Uni: ${universityId})`);
          
          try {
            const browserInstance = await getBrowser();
            await scraperService.scrapeUnit(unitCode, universityId, browserInstance);
            
            jobCount++;
            if (jobCount >= MAX_JOBS_PER_BROWSER) {
                await recycleBrowser();
            }
          } catch (e) {
              // If scraping fails, maybe browser is dead. Recycle.
              console.error(`Scrape failed for ${unitCode}, recycling browser...`);
              await recycleBrowser();
              throw e;
          }
      }
    },
    {
      connection,
      concurrency: 5, // Increased from 1
      limiter: {
        max: 5,
        duration: 1000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });
  
  // Cleanup on exit
  process.on('SIGTERM', async () => {
      await recycleBrowser();
      await worker.close();
  });

  console.log('✅ Scraper Worker ready');
  return worker;
}