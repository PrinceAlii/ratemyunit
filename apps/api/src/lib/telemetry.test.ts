import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@ratemyunit/db/client', () => ({
  db: {
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@ratemyunit/db/schema', () => ({
  users: { id: 'id' },
  userTelemetry: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
}));

vi.mock('pino', () => ({
  default: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

import { db } from '@ratemyunit/db/client';
import { recordTelemetry } from './telemetry';

const mockDb = db as unknown as {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

function chainableInsert() {
  const chain: Record<string, unknown> = {};
  chain.values = vi.fn().mockResolvedValue(undefined);
  return chain;
}

function chainableUpdate() {
  const chain: Record<string, unknown> = {};
  chain.set = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockResolvedValue(undefined);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.insert.mockReturnValue(chainableInsert());
  mockDb.update.mockReturnValue(chainableUpdate());
});

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      ...((overrides.headers as Record<string, string>) ?? {}),
    },
    ip: overrides.ip ?? '192.168.1.1',
  };
}

describe('recordTelemetry', () => {
  it('inserts telemetry record', async () => {
    const request = createRequest();
    await recordTelemetry('user-1', request as never);

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('updates user lastLoginAt and lastIp', async () => {
    const request = createRequest();
    await recordTelemetry('user-1', request as never);

    expect(mockDb.update).toHaveBeenCalled();
  });

  it('handles missing user-agent gracefully', async () => {
    const request = createRequest({ headers: {} });
    await expect(recordTelemetry('user-1', request as never)).resolves.toBeUndefined();
  });

  it('handles missing IP gracefully', async () => {
    const request = { headers: { 'user-agent': 'Test' }, ip: undefined };
    await expect(recordTelemetry('user-1', request as never)).resolves.toBeUndefined();
  });

  it('does not throw on db error', async () => {
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockRejectedValue(new Error('DB error')),
    });
    const request = createRequest();
    await expect(recordTelemetry('user-1', request as never)).resolves.toBeUndefined();
  });
});
