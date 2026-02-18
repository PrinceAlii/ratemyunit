/**
 * Factory functions to create mock Drizzle query builders.
 * Each returns chainable mocks (.from, .where, .limit, .returning, .values, etc.)
 */
import { vi } from 'vitest';

export function createMockQueryBuilder(returnValue: unknown[] = []) {
  const builder: Record<string, unknown> = {};

  builder.from = vi.fn().mockReturnValue(builder);
  builder.where = vi.fn().mockReturnValue(builder);
  builder.limit = vi.fn().mockResolvedValue(returnValue);
  builder.orderBy = vi.fn().mockReturnValue(builder);
  builder.offset = vi.fn().mockReturnValue(builder);
  builder.leftJoin = vi.fn().mockReturnValue(builder);
  builder.innerJoin = vi.fn().mockReturnValue(builder);
  builder.groupBy = vi.fn().mockReturnValue(builder);
  builder.as = vi.fn().mockReturnValue(builder);

  // When called as a promise (await), resolve to returnValue
  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    return Promise.resolve(returnValue).then(resolve);
  });

  return builder;
}

export function createMockInsertBuilder(returnValue: unknown[] = []) {
  const builder: Record<string, unknown> = {};

  builder.values = vi.fn().mockReturnValue(builder);
  builder.returning = vi.fn().mockResolvedValue(returnValue);
  builder.onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);

  // When called without returning (await db.insert(...).values(...))
  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    return Promise.resolve(returnValue).then(resolve);
  });

  return builder;
}

export function createMockUpdateBuilder(returnValue: unknown[] = []) {
  const builder: Record<string, unknown> = {};

  builder.set = vi.fn().mockReturnValue(builder);
  builder.where = vi.fn().mockReturnValue(builder);
  builder.returning = vi.fn().mockResolvedValue(returnValue);

  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    return Promise.resolve(returnValue).then(resolve);
  });

  return builder;
}

export function createMockDeleteBuilder() {
  const builder: Record<string, unknown> = {};

  builder.where = vi.fn().mockReturnValue(builder);

  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    return Promise.resolve(undefined).then(resolve);
  });

  return builder;
}

export function createMockSelectDistinctBuilder(returnValue: unknown[] = []) {
  const builder: Record<string, unknown> = {};

  builder.from = vi.fn().mockReturnValue(builder);
  builder.where = vi.fn().mockReturnValue(builder);
  builder.orderBy = vi.fn().mockResolvedValue(returnValue);

  builder.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => {
    return Promise.resolve(returnValue).then(resolve);
  });

  return builder;
}

export function createMockDb() {
  return {
    select: vi.fn().mockReturnValue(createMockQueryBuilder()),
    insert: vi.fn().mockReturnValue(createMockInsertBuilder()),
    update: vi.fn().mockReturnValue(createMockUpdateBuilder()),
    delete: vi.fn().mockReturnValue(createMockDeleteBuilder()),
    selectDistinct: vi.fn().mockReturnValue(createMockSelectDistinctBuilder()),
  };
}
