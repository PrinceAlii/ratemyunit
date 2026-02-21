import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockRequest, createMockReply } from '../__tests__/helpers/auth-mock';
import {
  createMockQueryBuilder,
  createMockUpdateBuilder,
  createMockDeleteBuilder,
} from '../__tests__/helpers/db-mock';
import { TEST_IDS, mockAdmin, mockUser } from '../__tests__/helpers/fixtures';

// --- Chain builder for queries that don't end with .limit() ----------------

function createChainBuilder(resolveValue: unknown = []) {
  const b: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'leftJoin', 'innerJoin', 'groupBy', 'set']) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  b.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    Promise.resolve(resolveValue).then(resolve));
  return b;
}

// --- Mocks ------------------------------------------------------------------

const { mockSelect, mockInsert, mockUpdate, mockDelete, mockQueue } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockQueue: {
    add: vi.fn(),
    addBulk: vi.fn(),
    getJobCounts: vi.fn(),
    isPaused: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    clean: vi.fn(),
    getJob: vi.fn(),
    getJobs: vi.fn(),
    obliterate: vi.fn(),
  },
}));

vi.mock('@ratemyunit/db/client', () => ({
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

vi.mock('@ratemyunit/db/schema', () => ({
  units: { id: 'id', unitCode: 'unitCode', createdAt: 'createdAt' },
  reviews: {
    id: 'id',
    userId: 'userId',
    unitId: 'unitId',
    status: 'status',
    reviewText: 'reviewText',
    createdAt: 'createdAt',
  },
  users: {
    id: 'id',
    email: 'email',
    displayName: 'displayName',
    role: 'role',
    banned: 'banned',
    createdAt: 'createdAt',
    lastLoginAt: 'lastLoginAt',
    lastIp: 'lastIp',
  },
  universities: { id: 'id', abbreviation: 'abbreviation' },
  userTelemetry: { id: 'id', userId: 'userId', createdAt: 'createdAt' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn().mockReturnValue('sql-mock'),
}));

vi.mock('@ratemyunit/validators', () => ({
  moderateReviewSchema: { parse: vi.fn((b: unknown) => b) },
  banUserSchema: { parse: vi.fn((b: unknown) => b) },
}));

vi.mock('../middleware/auth.js', () => ({
  requireAdmin: vi.fn(),
}));

vi.mock('../lib/queue.js', () => ({
  scraperQueue: mockQueue,
}));

vi.mock('../lib/auth.js', () => ({
  lucia: { invalidateUserSessions: vi.fn() },
}));

import { adminRoutes } from './admin';
import { lucia } from '../lib/auth.js';

// --- Handler capture --------------------------------------------------------

type Handler = (req: unknown, reply: unknown) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

function captureApp() {
  return {
    get: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`GET ${path}`] = args[args.length - 1] as Handler;
    }),
    post: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`POST ${path}`] = args[args.length - 1] as Handler;
    }),
    put: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`PUT ${path}`] = args[args.length - 1] as Handler;
    }),
    delete: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`DELETE ${path}`] = args[args.length - 1] as Handler;
    }),
    patch: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`PATCH ${path}`] = args[args.length - 1] as Handler;
    }),
    addHook: vi.fn(),
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  } as unknown as FastifyInstance;
}

// --- Tests ------------------------------------------------------------------

describe('adminRoutes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
    await adminRoutes(captureApp());
  });

  // ---- GET /stats -----------------------------------------------------------

  describe('GET /stats', () => {
    it('returns system statistics', async () => {
      mockSelect
        .mockReturnValueOnce(createChainBuilder([{ count: 10 }]))
        .mockReturnValueOnce(createChainBuilder([{ count: 25 }]))
        .mockReturnValueOnce(createChainBuilder([{ count: 50 }]))
        .mockReturnValueOnce(createChainBuilder([{ count: 3 }]));

      const result = await handlers['GET /stats']({}, {});

      expect(result).toEqual({
        success: true,
        data: {
          totalUsers: 10,
          totalReviews: 25,
          totalUnits: 50,
          flaggedReviews: 3,
        },
      });
    });
  });

  // ---- GET /reviews/flagged -------------------------------------------------

  describe('GET /reviews/flagged', () => {
    it('returns flagged reviews', async () => {
      const flaggedReviews = [
        {
          id: TEST_IDS.review,
          reviewText: 'Bad review',
          status: 'flagged',
          createdAt: new Date(),
          userEmail: 'user@test.com',
          unitCode: '31251',
        },
      ];
      mockSelect.mockReturnValueOnce(createChainBuilder(flaggedReviews));

      const result = await handlers['GET /reviews/flagged']({}, {});

      expect(result).toEqual({
        success: true,
        data: flaggedReviews,
      });
    });
  });

  // ---- POST /reviews/:id/moderate -------------------------------------------

  describe('POST /reviews/:id/moderate', () => {
    it('restores a flagged review', async () => {
      mockUpdate.mockReturnValue(createMockUpdateBuilder());

      const request = createMockRequest({
        params: { id: TEST_IDS.review },
        body: { action: 'restore' },
      });
      const reply = createMockReply();
      await handlers['POST /reviews/:id/moderate'](request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Review restored.',
      });
    });

    it('removes a flagged review', async () => {
      mockUpdate.mockReturnValue(createMockUpdateBuilder());

      const request = createMockRequest({
        params: { id: TEST_IDS.review },
        body: { action: 'remove' },
      });
      const reply = createMockReply();
      await handlers['POST /reviews/:id/moderate'](request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'Review removed.',
      });
    });
  });

  // ---- GET /users -----------------------------------------------------------

  describe('GET /users', () => {
    it('lists users with pagination', async () => {
      const userList = [
        {
          id: TEST_IDS.user,
          email: 'student@test.com',
          displayName: 'Test Student',
          role: 'student',
          banned: false,
          createdAt: new Date(),
          lastLoginAt: null,
          lastIp: null,
        },
      ];
      mockSelect.mockReturnValueOnce(createChainBuilder(userList));

      const request = createMockRequest({
        query: { limit: '50', offset: '0' },
      });
      const result = await handlers['GET /users'](request, {});

      expect(result).toEqual({
        success: true,
        data: userList,
      });
    });
  });

  // ---- POST /users/:id/ban -------------------------------------------------

  describe('POST /users/:id/ban', () => {
    it('bans a user', async () => {
      mockUpdate.mockReturnValue(createMockUpdateBuilder());

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.user },
        body: { banned: true },
      });
      const reply = createMockReply();
      await handlers['POST /users/:id/ban'](request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'User banned.',
      });
    });

    it('unbans a user', async () => {
      mockUpdate.mockReturnValue(createMockUpdateBuilder());

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.user },
        body: { banned: false },
      });
      const reply = createMockReply();
      await handlers['POST /users/:id/ban'](request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        message: 'User unbanned.',
      });
    });

    it('cannot ban own account', async () => {
      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.admin },
        body: { banned: true },
      });
      const reply = createMockReply();
      await handlers['POST /users/:id/ban'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'You cannot ban your own account.',
        }),
      );
    });
  });

  // ---- DELETE /users/:id ----------------------------------------------------

  describe('DELETE /users/:id', () => {
    it('deletes a user', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockUser]));
      (lucia.invalidateUserSessions as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
      mockDelete.mockReturnValue(createMockDeleteBuilder());

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.user },
      });
      const reply = createMockReply();
      await handlers['DELETE /users/:id'](request, reply);

      expect(lucia.invalidateUserSessions).toHaveBeenCalledWith(TEST_IDS.user);
      expect(mockDelete).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'User and all associated data deleted successfully.',
        }),
      );
    });

    it('cannot delete own account', async () => {
      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.admin },
      });
      const reply = createMockReply();
      await handlers['DELETE /users/:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'You cannot delete your own account.',
        }),
      );
    });

    it('returns 404 for non-existent user', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.user },
      });
      const reply = createMockReply();
      await handlers['DELETE /users/:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'User not found',
        }),
      );
    });
  });

  // ---- GET /users/:id/telemetry ---------------------------------------------

  describe('GET /users/:id/telemetry', () => {
    it('returns telemetry logs', async () => {
      const telemetryLogs = [
        { id: 'log-1', userId: TEST_IDS.user, event: 'login', createdAt: new Date() },
        { id: 'log-2', userId: TEST_IDS.user, event: 'page_view', createdAt: new Date() },
      ];
      mockSelect.mockReturnValueOnce(createChainBuilder(telemetryLogs));

      const request = createMockRequest({
        params: { id: TEST_IDS.user },
      });
      const reply = createMockReply();
      await handlers['GET /users/:id/telemetry'](request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: telemetryLogs,
      });
    });
  });

  // ---- POST /scrape ---------------------------------------------------------

  describe('POST /scrape', () => {
    it('queues a scrape job', async () => {
      mockSelect.mockReturnValueOnce(createChainBuilder([{ id: TEST_IDS.university }]));
      mockQueue.add.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: { unitCode: '31251' },
      });
      const reply = createMockReply();
      await handlers['POST /scrape'](request, reply);

      expect(mockQueue.add).toHaveBeenCalledWith('scrape-unit', {
        type: 'scrape',
        unitCode: '31251',
        universityId: TEST_IDS.university,
      });
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Scrape job queued for unit 31251',
        }),
      );
    });

    it('rejects invalid body', async () => {
      const request = createMockRequest({
        body: { unitCode: '' },
      });
      const reply = createMockReply();
      await handlers['POST /scrape'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid request body',
        }),
      );
    });
  });

  // ---- POST /scrape/bulk ----------------------------------------------------

  describe('POST /scrape/bulk', () => {
    it('queues bulk scrape jobs', async () => {
      mockSelect.mockReturnValueOnce(createChainBuilder([{ id: TEST_IDS.university }]));
      mockQueue.addBulk.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: { unitCodes: ['31251', '31252', '31253'] },
      });
      const reply = createMockReply();
      await handlers['POST /scrape/bulk'](request, reply);

      expect(mockQueue.addBulk).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total: 3,
            queued: 3,
          }),
        }),
      );
    });
  });

  // ---- POST /scrape/range ---------------------------------------------------

  describe('POST /scrape/range', () => {
    it('queues range scrape jobs', async () => {
      mockSelect.mockReturnValueOnce(createChainBuilder([{ id: TEST_IDS.university }]));
      mockQueue.getJobCounts.mockResolvedValue({ waiting: 0, active: 0 });
      mockQueue.addBulk.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: { startCode: '100', endCode: '102' },
      });
      const reply = createMockReply();
      await handlers['POST /scrape/range'](request, reply);

      expect(mockQueue.addBulk).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            total: 3,
            queued: 3,
          }),
        }),
      );
    });
  });

  // ---- GET /queue-stats -----------------------------------------------------

  describe('GET /queue-stats', () => {
    it('returns queue statistics', async () => {
      mockQueue.getJobCounts.mockResolvedValue({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 1,
      });
      mockQueue.isPaused.mockResolvedValue(false);

      const result = await handlers['GET /queue-stats']({}, {});

      expect(result).toEqual({
        success: true,
        data: {
          waiting: 5,
          active: 2,
          completed: 100,
          failed: 1,
          status: 'busy',
          paused: false,
        },
      });
    });
  });

  // ---- POST /queue/pause ----------------------------------------------------

  describe('POST /queue/pause', () => {
    it('pauses queue', async () => {
      mockQueue.pause.mockResolvedValue(undefined);

      const request = createMockRequest({});
      const reply = createMockReply();
      const result = await handlers['POST /queue/pause'](request, reply);

      expect(mockQueue.pause).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Queue paused successfully',
      });
    });
  });

  // ---- POST /queue/resume ---------------------------------------------------

  describe('POST /queue/resume', () => {
    it('resumes queue', async () => {
      mockQueue.resume.mockResolvedValue(undefined);

      const request = createMockRequest({});
      const reply = createMockReply();
      const result = await handlers['POST /queue/resume'](request, reply);

      expect(mockQueue.resume).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        message: 'Queue resumed successfully',
      });
    });
  });

  // ---- DELETE /units --------------------------------------------------------

  describe('DELETE /units', () => {
    it('deletes all units with confirmation', async () => {
      mockSelect.mockReturnValueOnce(createChainBuilder([{ count: 42 }]));
      mockDelete.mockReturnValue(createMockDeleteBuilder());
      mockQueue.obliterate.mockResolvedValue(undefined);

      const request = createMockRequest({
        body: { confirm: true },
      });
      const reply = createMockReply();
      await handlers['DELETE /units'](request, reply);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockQueue.obliterate).toHaveBeenCalledWith({ force: true });
      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Deleted 42 units and cleared the scraper queue.' },
      });
    });

    it('rejects without confirmation', async () => {
      const request = createMockRequest({
        body: {},
      });
      const reply = createMockReply();
      await handlers['DELETE /units'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'This operation requires { "confirm": true } in the request body.',
        }),
      );
    });
  });
});
