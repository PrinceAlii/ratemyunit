/**
 * Mock helpers for Lucia auth and Fastify request/reply objects.
 */
import { vi } from 'vitest';

export function createMockLucia() {
  return {
    validateSession: vi.fn(),
    createSession: vi.fn(),
    createSessionCookie: vi.fn().mockReturnValue({
      name: 'auth_session',
      value: 'mock-session-value',
      attributes: { path: '/', httpOnly: true },
    }),
    createBlankSessionCookie: vi.fn().mockReturnValue({
      name: 'auth_session',
      value: '',
      attributes: { path: '/', httpOnly: true, maxAge: 0 },
    }),
    invalidateSession: vi.fn(),
    invalidateUserSessions: vi.fn(),
  };
}

interface MockRequestOptions {
  user?: Record<string, unknown> | null;
  cookies?: Record<string, string>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  ip?: string;
}

export function createMockRequest(options: MockRequestOptions = {}) {
  return {
    user: options.user ?? null,
    cookies: options.cookies ?? {},
    body: options.body ?? {},
    params: options.params ?? {},
    query: options.query ?? {},
    headers: options.headers ?? {},
    ip: options.ip ?? '127.0.0.1',
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  };
}

export function createMockReply() {
  const reply: Record<string, unknown> = {
    sent: false,
    statusCode: 200,
    _body: null as unknown,
  };

  reply.status = vi.fn().mockImplementation((code: number) => {
    reply.statusCode = code;
    return reply;
  });

  reply.send = vi.fn().mockImplementation((body: unknown) => {
    reply._body = body;
    reply.sent = true;
    return reply;
  });

  reply.setCookie = vi.fn().mockReturnValue(reply);
  reply.generateCsrf = vi.fn().mockResolvedValue('mock-csrf-token');

  return reply;
}
