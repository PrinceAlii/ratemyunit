import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@ratemyunit/db/client', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col, val) => ({ _eq: val })),
}));

vi.mock('@ratemyunit/db/schema', () => ({
  emailVerificationTokens: { token: 'token', id: 'id', userId: 'userId' },
  passwordResetTokens: { token: 'token', id: 'id', userId: 'userId' },
}));

import { db } from '@ratemyunit/db/client';
import {
  createEmailVerificationToken,
  verifyEmailToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
  deletePasswordResetToken,
} from './tokens';

const mockDb = db as unknown as {
  insert: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function chainable(resolveValue: unknown = undefined) {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(Array.isArray(resolveValue) ? resolveValue : [resolveValue]);
  chain.then = vi.fn().mockImplementation((r: (v: unknown) => void) =>
    Promise.resolve(Array.isArray(resolveValue) ? resolveValue : undefined).then(r)
  );
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createEmailVerificationToken', () => {
  it('inserts a token and returns the token string', async () => {
    const insertChain = chainable();
    mockDb.insert.mockReturnValue(insertChain);

    const token = await createEmailVerificationToken('user-1');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    expect(mockDb.insert).toHaveBeenCalled();
    expect(insertChain.values).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', token: expect.any(String) })
    );
  });
});

describe('verifyEmailToken', () => {
  it('returns userId for valid token', async () => {
    const record = {
      id: 'rec-1',
      userId: 'user-1',
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 86400000),
    };
    const selectChain = chainable([record]);
    mockDb.select.mockReturnValue(selectChain);
    const deleteChain = chainable();
    mockDb.delete.mockReturnValue(deleteChain);

    const result = await verifyEmailToken('valid-token');
    expect(result).toBe('user-1');
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('returns null for nonexistent token', async () => {
    const selectChain = chainable([]);
    selectChain.limit = vi.fn().mockResolvedValue([]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await verifyEmailToken('nonexistent-token');
    expect(result).toBeNull();
  });

  it('returns null and deletes expired token', async () => {
    const record = {
      id: 'rec-1',
      userId: 'user-1',
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 86400000),
    };
    const selectChain = chainable([record]);
    mockDb.select.mockReturnValue(selectChain);
    const deleteChain = chainable();
    mockDb.delete.mockReturnValue(deleteChain);

    const result = await verifyEmailToken('expired-token');
    expect(result).toBeNull();
    expect(mockDb.delete).toHaveBeenCalled();
  });
});

describe('createPasswordResetToken', () => {
  it('deletes old tokens and inserts new one', async () => {
    const deleteChain = chainable();
    mockDb.delete.mockReturnValue(deleteChain);
    const insertChain = chainable();
    mockDb.insert.mockReturnValue(insertChain);

    const token = await createPasswordResetToken('user-1');
    expect(typeof token).toBe('string');
    expect(mockDb.delete).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe('verifyPasswordResetToken', () => {
  it('returns userId for valid token', async () => {
    const record = {
      id: 'rec-1',
      userId: 'user-1',
      token: 'valid-token',
      expiresAt: new Date(Date.now() + 86400000),
    };
    const selectChain = chainable([record]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await verifyPasswordResetToken('valid-token');
    expect(result).toBe('user-1');
  });

  it('returns null for expired token', async () => {
    const record = {
      id: 'rec-1',
      userId: 'user-1',
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 86400000),
    };
    const selectChain = chainable([record]);
    mockDb.select.mockReturnValue(selectChain);
    const deleteChain = chainable();
    mockDb.delete.mockReturnValue(deleteChain);

    const result = await verifyPasswordResetToken('expired-token');
    expect(result).toBeNull();
  });

  it('returns null for nonexistent token', async () => {
    const selectChain = chainable([]);
    selectChain.limit = vi.fn().mockResolvedValue([]);
    mockDb.select.mockReturnValue(selectChain);

    const result = await verifyPasswordResetToken('nonexistent');
    expect(result).toBeNull();
  });
});

describe('deletePasswordResetToken', () => {
  it('deletes by token value', async () => {
    const deleteChain = chainable();
    mockDb.delete.mockReturnValue(deleteChain);

    await deletePasswordResetToken('token-to-delete');
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
