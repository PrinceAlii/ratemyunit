import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMockRequest, createMockReply } from '../__tests__/helpers/auth-mock';
import {
  createMockQueryBuilder,
  createMockInsertBuilder,
  createMockUpdateBuilder,
  createMockDeleteBuilder,
} from '../__tests__/helpers/db-mock';
import { TEST_IDS, mockUser, mockAdmin, mockReview } from '../__tests__/helpers/fixtures';

// --- Mocks ------------------------------------------------------------------

const { mockSelect, mockInsert, mockUpdate, mockDelete } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
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
  reviews: {
    id: 'id',
    userId: 'userId',
    unitId: 'unitId',
    status: 'status',
    createdAt: 'createdAt',
  },
  reviewVotes: {
    reviewId: 'reviewId',
    userId: 'userId',
    voteType: 'voteType',
  },
  reviewFlags: {
    reviewId: 'reviewId',
    userId: 'userId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@ratemyunit/validators', () => ({
  createReviewSchema: { parse: vi.fn((body: unknown) => body) },
  updateReviewSchema: { parse: vi.fn((body: unknown) => body) },
  voteReviewSchema: { parse: vi.fn((body: unknown) => body) },
  flagReviewSchema: { parse: vi.fn((body: unknown) => body) },
}));

vi.mock('../middleware/auth.js', () => ({
  requireAuth: vi.fn(),
}));

import { reviewsRoutes } from './reviews';

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
    addHook: vi.fn(),
  } as unknown as FastifyInstance;
}

// --- Tests ------------------------------------------------------------------

describe('reviewsRoutes', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    for (const key of Object.keys(handlers)) delete handlers[key];
    await reviewsRoutes(captureApp());
  });

  // ---- POST / (create) ----------------------------------------------------

  describe('POST / (create review)', () => {
    it('creates a review successfully', async () => {
      const newReview = { ...mockReview, id: TEST_IDS.review };
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));
      mockInsert.mockReturnValue(createMockInsertBuilder([newReview]));

      const request = createMockRequest({
        user: mockUser,
        body: {
          unitId: TEST_IDS.unit,
          sessionTaken: 'Autumn 2025',
          overallRating: 4,
          reviewText: 'Great content with well-structured assignments.',
          wouldRecommend: true,
          displayNameType: 'nickname',
          customNickname: 'TestStudent',
        },
      });
      const reply = createMockReply();
      await handlers['POST /'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Review submitted successfully.',
        }),
      );
    });

    it('rejects duplicate review for same unit', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockReview]));

      const request = createMockRequest({
        user: mockUser,
        body: { unitId: TEST_IDS.unit },
      });
      const reply = createMockReply();
      await handlers['POST /'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'You have already reviewed this unit.',
        }),
      );
    });
  });

  // ---- PUT /:id (update) --------------------------------------------------

  describe('PUT /:id (update review)', () => {
    it('updates own review', async () => {
      const updatedReview = { ...mockReview, reviewText: 'Updated text' };
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockReview]));
      mockUpdate.mockReturnValue(createMockUpdateBuilder([updatedReview]));

      const request = createMockRequest({
        user: mockUser,
        params: { id: TEST_IDS.review },
        body: { reviewText: 'Updated text' },
      });
      const reply = createMockReply();
      await handlers['PUT /:id'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Review updated successfully.',
        }),
      );
    });

    it('allows admin to update any review', async () => {
      const updatedReview = { ...mockReview, reviewText: 'Admin edit' };
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockReview]));
      mockUpdate.mockReturnValue(createMockUpdateBuilder([updatedReview]));

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.review },
        body: { reviewText: 'Admin edit' },
      });
      const reply = createMockReply();
      await handlers['PUT /:id'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('returns 403 for non-owner non-admin', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockReview]));

      const request = createMockRequest({
        user: { ...mockUser, id: TEST_IDS.user2, role: 'student' },
        params: { id: TEST_IDS.review },
        body: { reviewText: 'Nope' },
      });
      const reply = createMockReply();
      await handlers['PUT /:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'You are not authorized to edit this review.',
        }),
      );
    });

    it('returns 404 when review does not exist', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        user: mockUser,
        params: { id: TEST_IDS.review },
        body: { reviewText: 'Missing' },
      });
      const reply = createMockReply();
      await handlers['PUT /:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- DELETE /:id ---------------------------------------------------------

  describe('DELETE /:id', () => {
    it('deletes own review', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockReview]));
      mockDelete.mockReturnValue(createMockDeleteBuilder());

      const request = createMockRequest({
        user: mockUser,
        params: { id: TEST_IDS.review },
      });
      const reply = createMockReply();
      await handlers['DELETE /:id'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Review deleted successfully.',
        }),
      );
    });

    it('allows admin to delete any review', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockReview]));
      mockDelete.mockReturnValue(createMockDeleteBuilder());

      const request = createMockRequest({
        user: mockAdmin,
        params: { id: TEST_IDS.review },
      });
      const reply = createMockReply();
      await handlers['DELETE /:id'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('returns 403 for non-owner non-admin', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockReview]));

      const request = createMockRequest({
        user: { ...mockUser, id: TEST_IDS.user2, role: 'student' },
        params: { id: TEST_IDS.review },
      });
      const reply = createMockReply();
      await handlers['DELETE /:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(403);
    });

    it('returns 404 when review does not exist', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        user: mockUser,
        params: { id: TEST_IDS.review },
      });
      const reply = createMockReply();
      await handlers['DELETE /:id'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- POST /:id/vote -----------------------------------------------------

  describe('POST /:id/vote', () => {
    it('records a vote successfully', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockReview]));
      mockInsert.mockReturnValue(createMockInsertBuilder());

      const request = createMockRequest({
        user: { ...mockUser, id: TEST_IDS.user2 },
        params: { id: TEST_IDS.review },
        body: { voteType: 'helpful' },
      });
      const reply = createMockReply();
      await handlers['POST /:id/vote'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: 'Vote recorded.' }),
      );
    });

    it('prevents self-voting', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([mockReview]));

      const request = createMockRequest({
        user: mockUser,
        params: { id: TEST_IDS.review },
        body: { voteType: 'helpful' },
      });
      const reply = createMockReply();
      await handlers['POST /:id/vote'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'You cannot vote on your own review.',
        }),
      );
    });

    it('returns 404 when review does not exist', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        user: mockUser,
        params: { id: TEST_IDS.review },
        body: { voteType: 'helpful' },
      });
      const reply = createMockReply();
      await handlers['POST /:id/vote'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });

  // ---- POST /:id/flag -----------------------------------------------------

  describe('POST /:id/flag', () => {
    it('flags a review successfully', async () => {
      mockSelect
        .mockReturnValueOnce(createMockQueryBuilder([mockReview]))
        .mockReturnValueOnce(createMockQueryBuilder([]))
        .mockReturnValueOnce(createMockQueryBuilder([{ value: 1 }]));
      mockInsert.mockReturnValue(createMockInsertBuilder());

      const request = createMockRequest({
        user: { ...mockUser, id: TEST_IDS.user2 },
        params: { id: TEST_IDS.review },
        body: { reason: 'inappropriate' },
      });
      const reply = createMockReply();
      await handlers['POST /:id/flag'](request, reply);

      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('prevents duplicate flag', async () => {
      mockSelect
        .mockReturnValueOnce(createMockQueryBuilder([mockReview]))
        .mockReturnValueOnce(
          createMockQueryBuilder([{ id: 'existing-flag' }]),
        );

      const request = createMockRequest({
        user: mockUser,
        params: { id: TEST_IDS.review },
        body: { reason: 'inappropriate' },
      });
      const reply = createMockReply();
      await handlers['POST /:id/flag'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(400);
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'You have already flagged this review.',
        }),
      );
    });

    it('auto-flags review when flag count reaches 3', async () => {
      mockSelect
        .mockReturnValueOnce(createMockQueryBuilder([mockReview]))
        .mockReturnValueOnce(createMockQueryBuilder([]))
        .mockReturnValueOnce(createMockQueryBuilder([{ value: 3 }]));
      mockInsert.mockReturnValue(createMockInsertBuilder());
      mockUpdate.mockReturnValue(createMockUpdateBuilder());

      const request = createMockRequest({
        user: { ...mockUser, id: TEST_IDS.user2 },
        params: { id: TEST_IDS.review },
        body: { reason: 'spam' },
      });
      const reply = createMockReply();
      await handlers['POST /:id/flag'](request, reply);

      expect(mockUpdate).toHaveBeenCalled();
      expect(reply.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    it('returns 404 when review does not exist', async () => {
      mockSelect.mockReturnValueOnce(createMockQueryBuilder([]));

      const request = createMockRequest({
        user: mockUser,
        params: { id: TEST_IDS.review },
        body: { reason: 'spam' },
      });
      const reply = createMockReply();
      await handlers['POST /:id/flag'](request, reply);

      expect(reply.status).toHaveBeenCalledWith(404);
    });
  });
});
