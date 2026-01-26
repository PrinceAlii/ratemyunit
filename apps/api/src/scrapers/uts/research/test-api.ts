/**
 * Simple test script to probe the CourseLoop API and discover endpoints.
 * We'll try common API patterns based on the discovered domain.
 */

const API_BASE = 'https://api-ap-southeast-2.prod.courseloop.com';

interface TestResult {
  endpoint: string;
  status: number;
  success: boolean;
  data?: unknown;
  error?: string;
}

async function testEndpoint(endpoint: string): Promise<TestResult> {
  const url = `${API_BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://coursehandbook.uts.edu.au',
        'Referer': 'https://coursehandbook.uts.edu.au/',
      },
    });

    const success = response.ok;
    let data: unknown = null;

    if (success) {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }
    }

    return {
      endpoint,
      status: response.status,
      success,
      data,
    };
  } catch (error) {
    return {
      endpoint,
      status: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function discoverAPI() {
  console.log('Testing CourseLoop API endpoints...\n');

  // Common API patterns to test.
  const endpointsToTest = [
    '/api/subjects',
    '/api/subjects/31251',
    '/api/subject/31251',
    '/subjects',
    '/subjects/31251',
    '/subject/31251',
    '/v1/subjects',
    '/v1/subjects/31251',
    '/api/v1/subjects',
    '/api/v1/subjects/31251',
    '/api/content/subject/31251',
    '/api/content/subjects/31251',
    '/content/subject/31251',
    '/api/courseloop/subjects/31251',
    // UTS specific patterns.
    '/api/uts/subjects',
    '/api/uts/subjects/31251',
    '/api/institutions/uts/subjects',
    '/api/institutions/uts/subjects/31251',
  ];

  const results: TestResult[] = [];

  for (const endpoint of endpointsToTest) {
    const result = await testEndpoint(endpoint);
    results.push(result);

    const statusEmoji = result.success ? '✓' : '✗';
    console.log(`${statusEmoji} ${result.status} ${endpoint}`);

    if (result.success && result.data) {
      console.log(`  → Response preview: ${JSON.stringify(result.data).substring(0, 150)}...\n`);
    }

    // Rate limit: wait 500ms between requests.
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Print summary.
  console.log('\n=== SUMMARY ===');
  const successful = results.filter((r) => r.success);
  console.log(`Successful endpoints: ${successful.length}/${results.length}`);

  if (successful.length > 0) {
    console.log('\nWorking endpoints:');
    successful.forEach((r) => {
      console.log(`  - ${r.endpoint}`);
    });
  }

  return results;
}

// Run the discovery.
discoverAPI().catch(console.error);
