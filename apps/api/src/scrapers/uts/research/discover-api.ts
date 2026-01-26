import { chromium } from 'playwright';
import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Research script to discover CourseLoop API endpoints by intercepting network
 * requests from the UTS handbook website. This script loads a sample subject
 * page and captures all API calls to document the actual endpoints and
 * response structure.
 */
async function discoverCourseLoopAPI() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const apiCalls: Array<{
    url: string;
    method: string;
    headers: Record<string, string>;
    postData?: string;
    response?: {
      status: number;
      headers: Record<string, string>;
      body: unknown;
    };
  }> = [];

  // Intercept all requests to capture API calls.
  page.on('request', (request) => {
    const url = request.url();

    // Look for CourseLoop API calls or any API-like requests.
    if (
      url.includes('courseloop.com') ||
      url.includes('api') ||
      url.includes('/subject/') ||
      url.includes('handbook')
    ) {
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers())) {
        headers[key] = value;
      }

      apiCalls.push({
        url,
        method: request.method(),
        headers,
        postData: request.postData() || undefined,
      });
    }
  });

  // Intercept responses to capture response data.
  page.on('response', async (response) => {
    const url = response.url();

    if (
      url.includes('courseloop.com') ||
      url.includes('api') ||
      url.includes('/subject/')
    ) {
      try {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(response.headers())) {
          headers[key] = value;
        }

        let body: unknown = null;
        const contentType = headers['content-type'] || '';

        if (contentType.includes('application/json')) {
          body = await response.json();
        } else if (contentType.includes('text/')) {
          body = await response.text();
        }

        // Find the matching request and add response data.
        const matchingCall = apiCalls.find((call) => call.url === url);
        if (matchingCall && !matchingCall.response) {
          matchingCall.response = {
            status: response.status(),
            headers,
            body,
          };
        }
      } catch (error) {
        // Response might not be JSON or text, or already consumed.
        console.error(`Error processing response from ${url}:`, error);
      }
    }
  });

  // Navigate to a sample subject page.
  const testSubjectCode = '31251';
  const url = `https://coursehandbook.uts.edu.au/subject/current/${testSubjectCode}`;

  console.log(`Loading ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle' });

  // Wait a bit more to ensure all lazy-loaded content is fetched.
  await page.waitForTimeout(3000);

  // Close the browser.
  await browser.close();

  // Save the captured API calls to a file for analysis.
  const outputPath = join(
    process.cwd(),
    'apps',
    'api',
    'src',
    'scrapers',
    'uts',
    'research',
    'api-calls.json'
  );

  writeFileSync(outputPath, JSON.stringify(apiCalls, null, 2));

  console.log(`\nCaptured ${apiCalls.length} API calls`);
  console.log(`Results saved to: ${outputPath}`);

  // Print summary of discovered endpoints.
  console.log('\n=== DISCOVERED ENDPOINTS ===');
  const uniqueEndpoints = new Set(
    apiCalls.map((call) => {
      const url = new URL(call.url);
      return `${call.method} ${url.origin}${url.pathname}`;
    })
  );

  uniqueEndpoints.forEach((endpoint) => console.log(endpoint));

  // Print CourseLoop specific calls.
  const courseLoopCalls = apiCalls.filter((call) =>
    call.url.includes('courseloop.com')
  );

  if (courseLoopCalls.length > 0) {
    console.log('\n=== COURSELOOP API CALLS ===');
    courseLoopCalls.forEach((call) => {
      console.log(`\n${call.method} ${call.url}`);
      if (call.response) {
        console.log(`Status: ${call.response.status}`);
        console.log(
          `Response preview: ${JSON.stringify(call.response.body).substring(0, 200)}...`
        );
      }
    });
  }
}

// Run the discovery script.
discoverCourseLoopAPI().catch(console.error);
