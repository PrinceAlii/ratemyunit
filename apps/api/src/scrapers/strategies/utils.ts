import type { Page } from 'playwright';

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font']);
const BLOCKED_URL_PATTERNS = [
  'google-analytics',
  'googletagmanager',
  'doubleclick',
  'facebook.net',
  'hotjar',
  'segment',
  'sentry',
];

export async function configurePage(page: Page) {
  await page.route('**/*', (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    const url = request.url();

    if (BLOCKED_RESOURCE_TYPES.has(resourceType)) {
      return route.abort();
    }

    if (BLOCKED_URL_PATTERNS.some((pattern) => url.includes(pattern))) {
      return route.abort();
    }

    return route.continue();
  });
}
