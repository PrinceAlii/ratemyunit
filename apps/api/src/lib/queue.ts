import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
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
  unitCode: string;
}

// Worker setup
export function setupWorker() {
  console.log('👷 Setting up Scraper Worker...');
  
  const worker = new Worker<ScrapeJobData>(
    QUEUE_NAME,
    async (job) => {
      console.log(`Processing job ${job.id}: Scrape ${job.data.unitCode}`);
      await scraperService.scrapeUnit(job.data.unitCode);
    },
    {
      connection,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 5000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed!`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });
  
  console.log('✅ Scraper Worker ready');
  return worker;
}
