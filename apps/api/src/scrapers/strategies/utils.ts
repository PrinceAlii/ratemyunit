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

const BROWSER_CRASH_ERROR_PATTERNS = [
  'target page, context or browser has been closed',
  'target closed',
  'browser closed',
  'protocol error',
  'browser has disconnected',
];

const OBJECT_STRING_KEYS = ['name', 'title', 'label', 'value', 'text', 'description'];

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

export function isBrowserCrashErrorMessage(message?: string): boolean {
  if (!message) return false;
  const lowerMessage = message.toLowerCase();
  return BROWSER_CRASH_ERROR_PATTERNS.some((pattern) => lowerMessage.includes(pattern));
}

export function coerceToOptionalString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    const values = value
      .map((item) => coerceToOptionalString(item))
      .filter((item): item is string => !!item);

    if (values.length === 0) {
      return undefined;
    }

    return values.join(', ');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    for (const key of OBJECT_STRING_KEYS) {
      const candidate = coerceToOptionalString(record[key]);
      if (candidate) {
        return candidate;
      }
    }
  }

  return undefined;
}

export async function waitForDiscoveryReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => undefined);
  await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => undefined);
  await page.waitForSelector('a', { state: 'attached', timeout: 2000 }).catch(() => undefined);
}
