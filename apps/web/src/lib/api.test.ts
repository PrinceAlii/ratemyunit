import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Global fetch mock -------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper to create mock Response objects
function jsonResponse(
  body: unknown,
  status = 200,
  contentType = 'application/json',
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (h: string) => (h === 'Content-Type' ? contentType : null) },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    clone: () => jsonResponse(body, status, contentType),
  } as unknown as Response;
}

// --- Tests -------------------------------------------------------------------

describe('ApiClient', () => {
  let api: typeof import('./api').api;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn> | null = null;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Re-import to get a fresh ApiClient instance (resets csrfToken)
    const mod = await import('./api');
    api = mod.api;
  });

  afterEach(() => {
    consoleWarnSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ---- GET -----------------------------------------------------------------

  describe('get', () => {
    it('makes a GET request and returns data', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { items: [1, 2, 3] } }),
      );

      const result = await api.get('/api/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
      expect(result).toEqual({ items: [1, 2, 3] });
    });

    it('appends query params to URL', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: [] }),
      );

      await api.get('/api/units', { q: 'data', limit: 10 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=data');
      expect(calledUrl).toContain('limit=10');
    });

    it('skips undefined and empty query params', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: [] }),
      );

      await api.get('/api/units', { q: 'data', empty: '', undef: undefined });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('q=data');
      expect(calledUrl).not.toContain('empty');
      expect(calledUrl).not.toContain('undef');
    });

    it('retries on 503 for GET requests', async () => {
      vi.useFakeTimers();

      mockFetch
        .mockResolvedValueOnce(jsonResponse({}, 503))
        .mockResolvedValueOnce(
          jsonResponse({ success: true, data: 'ok' }),
        );

      const promise = api.get('/api/test');
      await vi.advanceTimersByTimeAsync(5000);
      const result = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toBe('ok');
    });
  });

  // ---- POST ----------------------------------------------------------------

  describe('post', () => {
    it('makes a POST request with body and CSRF token', async () => {
      // CSRF fetch
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: 'csrf-123' } }),
      );
      // Actual request
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { id: 1 } }),
      );

      const result = await api.post('/api/reviews', { text: 'Great' });

      expect(result).toEqual({ id: 1 });
      // Check the actual request (second call) has CSRF header
      const [, opts] = mockFetch.mock.calls[1];
      expect(opts.headers['x-csrf-token']).toBe('csrf-123');
      expect(opts.headers['Content-Type']).toBe('application/json');
    });

    it('does not retry 4xx errors', async () => {
      // CSRF fetch
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: 'csrf-123' } }),
      );
      // 400 response
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: false, error: 'Bad request' }, 400),
      );

      await expect(api.post('/api/test', {})).rejects.toThrow('Bad request');
      // Only 2 calls: CSRF + the one failed attempt (no retries)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ---- Error handling ------------------------------------------------------

  describe('error handling', () => {
    it('throws HttpError for server errors', async () => {
      vi.useFakeTimers();

      mockFetch.mockResolvedValue(
        jsonResponse({ success: false, error: 'Server exploded' }, 500),
      );

      const promise = api.get('/api/test');
      const assertion = expect(promise).rejects.toThrow('Server exploded');
      await vi.advanceTimersByTimeAsync(10000);
      await assertion;
    });

    it('throws on non-JSON response', async () => {
      vi.useFakeTimers();

      const nonJsonResponse = {
        ok: true,
        status: 200,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve('<html>Error</html>'),
        clone: vi.fn(),
      } as unknown as Response;

      mockFetch.mockResolvedValue(nonJsonResponse);

      const promise = api.get('/api/test');
      const assertion = expect(promise).rejects.toThrow('non-JSON response');
      await vi.advanceTimersByTimeAsync(10000);
      await assertion;
    });

    it('refreshes CSRF token on 403 with csrf message', async () => {
      // First CSRF fetch
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: 'old-csrf' } }),
      );
      // POST returns 403 with CSRF error
      mockFetch.mockResolvedValueOnce(
        jsonResponse(
          { success: false, error: 'Invalid CSRF token' },
          403,
        ),
      );
      // CSRF refresh
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: 'new-csrf' } }),
      );
      // Retry with new CSRF
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: 'retried' }),
      );

      const result = await api.post('/api/test', {});

      expect(result).toBe('retried');
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });
  });

  // ---- Other methods -------------------------------------------------------

  describe('put', () => {
    it('makes a PUT request', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: 'csrf' } }),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { updated: true } }),
      );

      const result = await api.put('/api/reviews/1', { text: 'Updated' });

      expect(result).toEqual({ updated: true });
      const [, opts] = mockFetch.mock.calls[1];
      expect(opts.method).toBe('PUT');
    });
  });

  describe('delete', () => {
    it('makes a DELETE request', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: 'csrf' } }),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: null }),
      );

      await api.delete('/api/reviews/1');

      const [, opts] = mockFetch.mock.calls[1];
      expect(opts.method).toBe('DELETE');
    });

    it('makes a DELETE request with body', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: 'csrf' } }),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: null }),
      );

      await api.delete('/api/reviews/1', { confirm: true });

      const [, opts] = mockFetch.mock.calls[1];
      expect(opts.method).toBe('DELETE');
      expect(opts.body).toBe(JSON.stringify({ confirm: true }));
    });
  });

  describe('patch', () => {
    it('makes a PATCH request with body', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { token: 'csrf' } }),
      );
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { patched: true } }),
      );

      const result = await api.patch('/api/users/1', { name: 'New Name' });

      expect(result).toEqual({ patched: true });
      const [, opts] = mockFetch.mock.calls[1];
      expect(opts.method).toBe('PATCH');
    });
  });

  // ---- Schema validation ---------------------------------------------------

  describe('schema validation', () => {
    it('validates response with provided schema', async () => {
      const { z } = await import('zod');
      const schema = z.object({ id: z.number(), name: z.string() });

      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: { id: 1, name: 'Test' } }),
      );

      const result = await api.get('/api/test', undefined, schema);

      expect(result).toEqual({ id: 1, name: 'Test' });
    });

    it('throws on schema validation failure', async () => {
      vi.useFakeTimers();

      const { z } = await import('zod');
      const schema = z.object({ id: z.number(), name: z.string() });

      mockFetch.mockResolvedValue(
        jsonResponse({ success: true, data: { wrong: 'shape' } }),
      );

      const promise = api.get('/api/test', undefined, schema);
      const assertion = expect(promise).rejects.toThrow('Invalid API response structure');
      await vi.advanceTimersByTimeAsync(10000);
      await assertion;
    });
  });
});
