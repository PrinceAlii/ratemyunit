import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLucia } = vi.hoisted(() => ({
  mockLucia: {
    validateSession: vi.fn(),
    createSessionCookie: vi.fn().mockReturnValue({
      name: 'auth_session',
      value: 'new-session',
      attributes: { path: '/' },
    }),
    createBlankSessionCookie: vi.fn().mockReturnValue({
      name: 'auth_session',
      value: '',
      attributes: { path: '/', maxAge: 0 },
    }),
  },
}));

vi.mock('../lib/auth.js', () => ({
  lucia: mockLucia,
}));

import { authenticateUser, requireAuth, requireAdmin } from './auth';

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    cookies: {} as Record<string, string>,
    user: null as unknown,
    ...overrides,
  };
}

function createReply() {
  const reply: Record<string, unknown> = { sent: false };
  reply.status = vi.fn().mockImplementation((_code: number) => reply);
  reply.send = vi.fn().mockImplementation(() => {
    reply.sent = true;
    return reply;
  });
  reply.setCookie = vi.fn().mockReturnValue(reply);
  return reply;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authenticateUser', () => {
  it('sets user to null when no session cookie', async () => {
    const request = createRequest();
    const reply = createReply();

    await authenticateUser(request as never, reply as never);
    expect(request.user).toBeNull();
  });

  it('sets user when session is valid', async () => {
    const mockUser = { id: 'user-1', email: 'test@test.com', role: 'student' };
    mockLucia.validateSession.mockResolvedValue({
      session: { id: 'sess-1', fresh: false },
      user: mockUser,
    });

    const request = createRequest({ cookies: { auth_session: 'valid-session' } });
    const reply = createReply();

    await authenticateUser(request as never, reply as never);
    expect(request.user).toEqual(mockUser);
  });

  it('refreshes cookie on fresh session', async () => {
    const mockUser = { id: 'user-1' };
    mockLucia.validateSession.mockResolvedValue({
      session: { id: 'sess-1', fresh: true },
      user: mockUser,
    });

    const request = createRequest({ cookies: { auth_session: 'valid-session' } });
    const reply = createReply();

    await authenticateUser(request as never, reply as never);
    expect(reply.setCookie).toHaveBeenCalledWith('auth_session', 'new-session', { path: '/' });
  });

  it('clears cookie and sets user null for invalid session', async () => {
    mockLucia.validateSession.mockResolvedValue({
      session: null,
      user: null,
    });

    const request = createRequest({ cookies: { auth_session: 'invalid-session' } });
    const reply = createReply();

    await authenticateUser(request as never, reply as never);
    expect(request.user).toBeNull();
    expect(reply.setCookie).toHaveBeenCalledWith('auth_session', '', expect.objectContaining({ maxAge: 0 }));
  });
});

describe('requireAuth', () => {
  it('returns 401 when no user', async () => {
    mockLucia.validateSession.mockResolvedValue({ session: null, user: null });

    const request = createRequest();
    const reply = createReply();

    await requireAuth(request as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authentication required' }));
  });

  it('returns 403 for banned user', async () => {
    const bannedUser = { id: 'user-1', banned: true, emailVerified: true };
    mockLucia.validateSession.mockResolvedValue({
      session: { id: 'sess-1', fresh: false },
      user: bannedUser,
    });

    const request = createRequest({ cookies: { auth_session: 'sess-id' } });
    const reply = createReply();

    await requireAuth(request as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'Your account has been banned' }));
  });

  it('returns 403 for unverified email', async () => {
    const unverifiedUser = { id: 'user-1', banned: false, emailVerified: false };
    mockLucia.validateSession.mockResolvedValue({
      session: { id: 'sess-1', fresh: false },
      user: unverifiedUser,
    });

    const request = createRequest({ cookies: { auth_session: 'sess-id' } });
    const reply = createReply();

    await requireAuth(request as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'Please verify your email address' }));
  });

  it('passes through for valid user', async () => {
    const validUser = { id: 'user-1', banned: false, emailVerified: true };
    mockLucia.validateSession.mockResolvedValue({
      session: { id: 'sess-1', fresh: false },
      user: validUser,
    });

    const request = createRequest({ cookies: { auth_session: 'sess-id' } });
    const reply = createReply();

    await requireAuth(request as never, reply as never);
    expect(reply.send).not.toHaveBeenCalled();
    expect(request.user).toEqual(validUser);
  });
});

describe('requireAdmin', () => {
  it('returns 401 when auth fails (no user)', async () => {
    mockLucia.validateSession.mockResolvedValue({ session: null, user: null });

    const request = createRequest();
    const reply = createReply();

    await requireAdmin(request as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);
    // Should NOT send a second response (reply.sent check)
    expect(reply.send).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for non-admin user', async () => {
    const studentUser = { id: 'user-1', role: 'student', banned: false, emailVerified: true };
    mockLucia.validateSession.mockResolvedValue({
      session: { id: 'sess-1', fresh: false },
      user: studentUser,
    });

    const request = createRequest({ cookies: { auth_session: 'sess-id' } });
    const reply = createReply();

    await requireAdmin(request as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith(expect.objectContaining({ error: 'Admin access required' }));
  });

  it('passes through for admin user', async () => {
    const adminUser = { id: 'admin-1', role: 'admin', banned: false, emailVerified: true };
    mockLucia.validateSession.mockResolvedValue({
      session: { id: 'sess-1', fresh: false },
      user: adminUser,
    });

    const request = createRequest({ cookies: { auth_session: 'sess-id' } });
    const reply = createReply();

    await requireAdmin(request as never, reply as never);
    // requireAuth does NOT call send for valid users, and requireAdmin also does NOT call send for admins
    // So send should not have been called at all
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('does not send second response when requireAuth already sent 403 for banned user', async () => {
    const bannedUser = { id: 'user-1', role: 'admin', banned: true, emailVerified: true };
    mockLucia.validateSession.mockResolvedValue({
      session: { id: 'sess-1', fresh: false },
      user: bannedUser,
    });

    const request = createRequest({ cookies: { auth_session: 'sess-id' } });
    const reply = createReply();

    await requireAdmin(request as never, reply as never);
    // requireAuth sends 403 for banned, then requireAdmin checks reply.sent and returns early
    expect(reply.send).toHaveBeenCalledTimes(1);
  });
});
