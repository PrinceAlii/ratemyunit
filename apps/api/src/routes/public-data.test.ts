import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockRequest, createMockReply } from '../__tests__/helpers/auth-mock';
import {
  createMockQueryBuilder,
  createMockSelectDistinctBuilder,
} from '../__tests__/helpers/db-mock';
import { TEST_IDS } from '../__tests__/helpers/fixtures';

// --- Mocks ------------------------------------------------------------------

const { mockSelect, mockSelectDistinct } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockSelectDistinct: vi.fn(),
}));

vi.mock('@ratemyunit/db/client', () => ({
  db: { select: mockSelect, selectDistinct: mockSelectDistinct },
}));

vi.mock('@ratemyunit/db/schema', () => ({
  universities: {
    id: 'id',
    name: 'name',
    abbreviation: 'abbreviation',
    websiteUrl: 'websiteUrl',
    createdAt: 'createdAt',
    active: 'active',
  },
  units: { faculty: 'faculty', universityId: 'universityId' },
  siteBannerSettings: {
    id: 'id',
    enabled: 'enabled',
    enforceEduAuEmail: 'enforceEduAuEmail',
    message: 'message',
    palette: 'palette',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  asc: vi.fn(),
  and: vi.fn((...args: unknown[]) => args),
  isNotNull: vi.fn(),
}));

import { publicDataRoutes } from './public-data';

// --- Handler capture --------------------------------------------------------

type Handler = (req: unknown, reply: unknown) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

function captureApp() {
  return {
    get: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`GET ${path}`] = args[args.length - 1] as Handler;
    }),
    post: vi.fn(),
    addHook: vi.fn(),
  } as unknown as FastifyInstance;
}

// --- Tests ------------------------------------------------------------------

describe('publicDataRoutes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
    await publicDataRoutes(captureApp());
  });

  describe('GET /universities', () => {
    it('returns active universities ordered by name', async () => {
      const unis = [
        {
          id: TEST_IDS.university,
          name: 'UTS',
          abbreviation: 'UTS',
          websiteUrl: 'https://uts.edu.au',
        },
      ];
      mockSelect.mockReturnValue(createMockQueryBuilder(unis));

      const reply = createMockReply();
      await handlers['GET /universities']({}, reply);

      expect(reply.send).toHaveBeenCalledWith({ success: true, data: unis });
    });

    it('returns empty list when no active universities', async () => {
      mockSelect.mockReturnValue(createMockQueryBuilder([]));

      const reply = createMockReply();
      await handlers['GET /universities']({}, reply);

      expect(reply.send).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('deduplicates universities by abbreviation', async () => {
      const uniRows = [
        {
          id: 'uni-1',
          name: 'Monash University',
          abbreviation: 'Monash',
          websiteUrl: 'https://www.monash.edu',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'uni-2',
          name: 'Monash University',
          abbreviation: 'Monash',
          websiteUrl: 'https://www.monash.edu',
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      ];
      mockSelect.mockReturnValue(createMockQueryBuilder(uniRows));

      const reply = createMockReply();
      await handlers['GET /universities']({}, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: [
          {
            id: 'uni-1',
            name: 'Monash University',
            abbreviation: 'Monash',
            websiteUrl: 'https://www.monash.edu',
          },
        ],
      });
    });
  });

  describe('GET /faculties', () => {
    it('returns distinct faculties', async () => {
      const rows = [{ faculty: 'FEIT' }, { faculty: 'Business' }];
      mockSelectDistinct.mockReturnValue(createMockSelectDistinctBuilder(rows));

      const request = createMockRequest({ query: {} });
      const reply = createMockReply();
      await handlers['GET /faculties'](request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: ['FEIT', 'Business'],
      });
    });

    it('filters by universityId when provided', async () => {
      const rows = [{ faculty: 'FEIT' }];
      mockSelectDistinct.mockReturnValue(createMockSelectDistinctBuilder(rows));

      const request = createMockRequest({
        query: { universityId: TEST_IDS.university },
      });
      const reply = createMockReply();
      await handlers['GET /faculties'](request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: ['FEIT'],
      });
    });

    it('returns empty list when no faculties', async () => {
      mockSelectDistinct.mockReturnValue(createMockSelectDistinctBuilder([]));

      const request = createMockRequest({ query: {} });
      const reply = createMockReply();
      await handlers['GET /faculties'](request, reply);

      expect(reply.send).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('filters out null faculty values', async () => {
      const rows = [
        { faculty: 'FEIT' },
        { faculty: null },
        { faculty: 'Business' },
      ];
      mockSelectDistinct.mockReturnValue(createMockSelectDistinctBuilder(rows));

      const request = createMockRequest({ query: {} });
      const reply = createMockReply();
      await handlers['GET /faculties'](request, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: ['FEIT', 'Business'],
      });
    });
  });

  describe('GET /site-banner', () => {
    it('returns site banner settings', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([{
        enabled: true,
        enforceEduAuEmail: true,
        message: 'Welcome back to campus week.',
        palette: 'primary',
      }]));

      const reply = createMockReply();
      await handlers['GET /site-banner']({}, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          enabled: true,
          enforceEduAuEmail: true,
          message: 'Welcome back to campus week.',
          palette: 'primary',
        },
      });
    });

    it('returns defaults when site banner is not configured', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const reply = createMockReply();
      await handlers['GET /site-banner']({}, reply);

      expect(reply.send).toHaveBeenCalledWith({
        success: true,
        data: {
          enabled: false,
          enforceEduAuEmail: false,
          message: '',
          palette: 'primary',
        },
      });
    });
  });
});
