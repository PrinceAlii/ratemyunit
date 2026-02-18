import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockRequest, createMockReply } from '../__tests__/helpers/auth-mock';
import { TEST_IDS, mockUnit, mockReview } from '../__tests__/helpers/fixtures';

// --- Mocks ------------------------------------------------------------------

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}));

vi.mock('@ratemyunit/db/client', () => ({
  db: { select: mockSelect },
}));

vi.mock('@ratemyunit/db/schema', () => ({
  units: {
    id: 'id',
    unitCode: 'unitCode',
    unitName: 'unitName',
    description: 'description',
    faculty: 'faculty',
    creditPoints: 'creditPoints',
    active: 'active',
    universityId: 'universityId',
    scrapedAt: 'scrapedAt',
  },
  reviews: {
    id: 'id',
    unitId: 'unitId',
    userId: 'userId',
    sessionTaken: 'sessionTaken',
    overallRating: 'overallRating',
    teachingQualityRating: 'teachingQualityRating',
    workloadRating: 'workloadRating',
    difficultyRating: 'difficultyRating',
    usefulnessRating: 'usefulnessRating',
    reviewText: 'reviewText',
    wouldRecommend: 'wouldRecommend',
    createdAt: 'createdAt',
    displayNameType: 'displayNameType',
    customNickname: 'customNickname',
    status: 'status',
  },
  users: {
    id: 'id',
    displayName: 'displayName',
    role: 'role',
    emailVerified: 'emailVerified',
    domainVerified: 'domainVerified',
    email: 'email',
  },
  reviewVotes: {
    reviewId: 'reviewId',
    voteType: 'voteType',
  },
  universities: {
    id: 'id',
    name: 'name',
    abbreviation: 'abbreviation',
    websiteUrl: 'websiteUrl',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  sql: Object.assign(vi.fn().mockReturnValue({ as: vi.fn(), mapWith: vi.fn() }), {}),
  inArray: vi.fn(),
  getTableColumns: vi.fn((table: unknown) => table),
}));

import { unitsRoutes } from './units';

// --- Helpers ----------------------------------------------------------------

/**
 * Chain builder where every method returns the builder.
 * Resolution happens via .then() (used by `await`).
 */
function createChainBuilder(resolveValue: unknown = []) {
  const b: Record<string, unknown> = {};
  const methods = [
    'from', 'where', 'limit', 'offset', 'orderBy',
    'leftJoin', 'innerJoin', 'groupBy', 'as',
  ];
  for (const m of methods) {
    b[m] = vi.fn().mockReturnValue(b);
  }
  b.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) =>
    Promise.resolve(resolveValue).then(resolve),
  );
  return b;
}

type Handler = (req: unknown, reply: unknown) => Promise<unknown>;
const handlers: Record<string, Handler> = {};

function captureApp() {
  return {
    get: vi.fn((path: string, ...args: unknown[]) => {
      handlers[`GET ${path}`] = args[args.length - 1] as Handler;
    }),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    addHook: vi.fn(),
  } as unknown as FastifyInstance;
}

// --- Tests ------------------------------------------------------------------

describe('unitsRoutes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
    await unitsRoutes(captureApp());
  });

  // ---- GET /search ---------------------------------------------------------

  describe('GET /search', () => {
    it('returns paginated results', async () => {
      const searchResults = [
        {
          id: TEST_IDS.unit,
          unitCode: '31251',
          unitName: 'Data Structures',
          description: 'Learn about DS.',
          faculty: 'FEIT',
          creditPoints: 6,
          universityName: 'UTS',
          universityAbbr: 'UTS',
          averageRating: 4.2,
          reviewCount: 10,
          scrapedAt: new Date(),
        },
      ];

      // 3 db.select() calls: subquery, results, count
      mockSelect
        .mockReturnValueOnce(createChainBuilder('subquery-ref'))
        .mockReturnValueOnce(createChainBuilder(searchResults))
        .mockReturnValueOnce(createChainBuilder([{ count: 1 }]));

      const request = createMockRequest({ query: {} });
      const reply = createMockReply();
      await handlers['GET /search'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            data: searchResults,
            pagination: expect.objectContaining({
              total: 1,
              page: 1,
            }),
          }),
        }),
      );
    });

    it('returns empty results with zero pagination', async () => {
      mockSelect
        .mockReturnValueOnce(createChainBuilder('subquery-ref'))
        .mockReturnValueOnce(createChainBuilder([]))
        .mockReturnValueOnce(createChainBuilder([{ count: 0 }]));

      const request = createMockRequest({ query: {} });
      const reply = createMockReply();
      await handlers['GET /search'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            data: [],
            pagination: expect.objectContaining({ total: 0 }),
          }),
        }),
      );
    });

    it('uses custom limit and offset', async () => {
      mockSelect
        .mockReturnValueOnce(createChainBuilder('subquery-ref'))
        .mockReturnValueOnce(createChainBuilder([]))
        .mockReturnValueOnce(createChainBuilder([{ count: 0 }]));

      const request = createMockRequest({
        query: { limit: '10', offset: '20' },
      });
      const reply = createMockReply();
      await handlers['GET /search'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            pagination: expect.objectContaining({
              limit: 10,
              offset: 20,
              page: 3,
            }),
          }),
        }),
      );
    });
  });

  // ---- GET /:unitCode ------------------------------------------------------

  describe('GET /:unitCode', () => {
    it('returns unit details with university info', async () => {
      const dbResult = {
        ...mockUnit,
        uniId: TEST_IDS.university,
        uniName: 'UTS',
        uniAbbr: 'UTS',
        uniUrl: 'https://uts.edu.au',
      };
      mockSelect.mockReturnValueOnce(createChainBuilder([dbResult]));

      const request = createMockRequest({ params: { unitCode: '31251' } });
      const reply = createMockReply();
      await handlers['GET /:unitCode'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            unitCode: '31251',
            university: expect.objectContaining({
              id: TEST_IDS.university,
              name: 'UTS',
              abbreviation: 'UTS',
            }),
          }),
        }),
      );
    });

    it('returns 404 when unit not found', async () => {
      mockSelect.mockReturnValueOnce(createChainBuilder([]));

      const request = createMockRequest({ params: { unitCode: 'INVALID' } });
      const reply = createMockReply();
      await handlers['GET /:unitCode'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Unit not found' }),
      );
    });
  });

  // ---- GET /:unitCode/reviews ----------------------------------------------

  describe('GET /:unitCode/reviews', () => {
    it('returns reviews for unit with processed display names', async () => {
      const reviewData = [
        {
          ...mockReview,
          displayNameType: 'nickname',
          customNickname: 'CoolStudent',
          user: {
            id: TEST_IDS.user,
            displayName: 'Test Student',
            role: 'student',
            emailVerified: true,
            domainVerified: true,
            email: 'student@student.uts.edu.au',
          },
          voteCount: 3,
        },
      ];

      // First select: find unit by code
      mockSelect.mockReturnValueOnce(createChainBuilder([{ id: TEST_IDS.unit }]));
      // Second select: reviews
      mockSelect.mockReturnValueOnce(createChainBuilder(reviewData));

      const request = createMockRequest({ params: { unitCode: '31251' } });
      const reply = createMockReply();
      await handlers['GET /:unitCode/reviews'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              user: expect.objectContaining({
                displayName: 'CoolStudent',
                emailDomain: 'student.uts.edu.au',
              }),
            }),
          ]),
        }),
      );
    });

    it('returns 404 when unit not found', async () => {
      mockSelect.mockReturnValueOnce(createChainBuilder([]));

      const request = createMockRequest({ params: { unitCode: 'INVALID' } });
      const reply = createMockReply();
      await handlers['GET /:unitCode/reviews'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Unit not found' }),
      );
    });

    it('processes verified display name type', async () => {
      const reviewData = [
        {
          ...mockReview,
          displayNameType: 'verified',
          customNickname: null,
          user: {
            id: TEST_IDS.user,
            displayName: 'Real Name',
            role: 'student',
            emailVerified: true,
            domainVerified: true,
            email: 'student@uts.edu.au',
          },
          voteCount: 0,
        },
      ];

      mockSelect
        .mockReturnValueOnce(createChainBuilder([{ id: TEST_IDS.unit }]))
        .mockReturnValueOnce(createChainBuilder(reviewData));

      const request = createMockRequest({ params: { unitCode: '31251' } });
      const reply = createMockReply();
      await handlers['GET /:unitCode/reviews'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              user: expect.objectContaining({ displayName: 'Real Name' }),
            }),
          ]),
        }),
      );
    });

    it('processes anonymous display name type', async () => {
      const reviewData = [
        {
          ...mockReview,
          displayNameType: 'anonymous',
          customNickname: null,
          user: {
            id: TEST_IDS.user,
            displayName: 'Hidden',
            role: 'student',
            emailVerified: true,
            domainVerified: true,
            email: 'student@uts.edu.au',
          },
          voteCount: 0,
        },
      ];

      mockSelect
        .mockReturnValueOnce(createChainBuilder([{ id: TEST_IDS.unit }]))
        .mockReturnValueOnce(createChainBuilder(reviewData));

      const request = createMockRequest({ params: { unitCode: '31251' } });
      const reply = createMockReply();
      await handlers['GET /:unitCode/reviews'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              user: expect.objectContaining({
                displayName: 'Anonymous Student',
              }),
            }),
          ]),
        }),
      );
    });

    it('returns empty array when no approved reviews', async () => {
      mockSelect
        .mockReturnValueOnce(createChainBuilder([{ id: TEST_IDS.unit }]))
        .mockReturnValueOnce(createChainBuilder([]));

      const request = createMockRequest({ params: { unitCode: '31251' } });
      const reply = createMockReply();
      await handlers['GET /:unitCode/reviews'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [] }),
      );
    });
  });
});
