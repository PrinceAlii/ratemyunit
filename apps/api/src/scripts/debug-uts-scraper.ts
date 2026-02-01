import { CourseLoopScraper } from '../scrapers/strategies/courseloop.js';
import { chromium } from 'playwright';

async function debugUtsScraper() {
  console.log('🐞 Debugging UTS Scraper...');

  // Mock Config
  const utsConfig = {
    baseUrl: 'https://handbook.uts.edu.au',
    routes: {
      base: 'https://handbook.uts.edu.au',
      subject: '/subject/current/:code',
      discovery: '/subjects/numerical.html'
    }
  };

  const scraper = new CourseLoopScraper('UTS', utsConfig);
  const browser = await chromium.launch({ headless: true });

  console.log(`\n🔍 Testing Discovery...`);
  try {
    const codes = await scraper.discoverSubjects(browser);
    console.log(`Found ${codes.length} codes.`);
    if (codes.length > 0) {
        console.log(`Examples: ${codes.slice(0, 10).join(', ')}`);
    } else {
        console.log('No codes found.');
    }
  } catch (e) { console.error(e); }

  await browser.close();
}

debugUtsScraper().catch(console.error);
