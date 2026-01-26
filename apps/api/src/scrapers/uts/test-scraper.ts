/**
 * Test script to verify the UTS scraper works correctly. This script tests
 * scraping a known subject and validates the extracted data.
 */

import { scrapeUTSSubject } from './index';

async function testScraper() {
  console.log('=== UTS Scraper Test ===\n');

  // Test with a known subject code.
  const testCode = '31251'; // Data Structures and Algorithms

  console.log(`Testing scraper with subject code: ${testCode}\n`);

  try {
    const result = await scrapeUTSSubject(testCode);

    console.log('Scraper Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      console.log('\n✓ Scraping successful!');
      console.log(`\nExtracted Data:`);
      console.log(`  Code: ${result.data.code}`);
      console.log(`  Name: ${result.data.name}`);
      console.log(`  Credit Points: ${result.data.creditPoints}`);
      console.log(
        `  Description: ${result.data.description.substring(0, 100)}...`
      );
      console.log(`  Faculty: ${result.data.faculty || 'Not found'}`);
      console.log(
        `  Prerequisites: ${result.data.prerequisites || 'None'}`
      );
      console.log(`  Sessions: ${result.data.sessions.join(', ') || 'None'}`);
    } else {
      console.log('\n✗ Scraping failed!');
      console.log(`Error: ${result.error}`);
      process.exit(1);
    }
  } catch (error) {
    console.error('\n✗ Test failed with exception:');
    console.error(error);
    process.exit(1);
  }

  console.log('\n=== Test Complete ===');
  process.exit(0);
}

testScraper().catch((err) => {
  console.error(err);
  process.exit(1);
});
