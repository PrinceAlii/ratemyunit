import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { reviews, reviewVotes, reviewFlags } from '@ratemyunit/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { 
  createReviewSchema, 
  updateReviewSchema, 
  voteReviewSchema, 
  flagReviewSchema 
} from '@ratemyunit/validators';
import { requireAuth } from '../middleware/auth.js';

export async function reviewsRoutes(app: FastifyInstance) {
  // Apply auth middleware to all routes in this plugin
  app.addHook('preHandler', requireAuth);

  /**
   * POST /api/reviews
   * Create a new review.
   */
  app.post('/', async (request, reply) => {
    const body = createReviewSchema.parse(request.body);

    const [existingReview] = await db
      .select()
      .from(reviews)
      .where(and(
        eq(reviews.userId, request.user!.id),
        eq(reviews.unitId, body.unitId)
      ))
      .limit(1);

    if (existingReview) {
      return reply.status(400).send({
        success: false,
        error: 'You have already reviewed this unit.',
      });
    }

    const [newReview] = await db
      .insert(reviews)
      .values({
        ...body,
        userId: request.user!.id,
        status: 'auto-approved',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return reply.status(201).send({
      success: true,
      message: 'Review submitted successfully.',
      data: newReview,
    });
  });

  /**
   * PUT /api/reviews/:id
   * Update an existing review.
   */
  app.put('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid('Invalid review ID') });
    const { id } = paramsSchema.parse(request.params);
    const body = updateReviewSchema.parse(request.body);

    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!review) {
      return reply.status(404).send({
        success: false,
        error: 'Review not found.',
      });
    }

    if (review.userId !== request.user!.id && request.user!.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'You are not authorized to edit this review.',
      });
    }

    const [updatedReview] = await db
      .update(reviews)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, id))
      .returning();

    return reply.send({
      success: true,
      message: 'Review updated successfully.',
      data: updatedReview,
    });
  });

  /**
   * DELETE /api/reviews/:id
   * Delete a review.
   */
  app.delete('/:id', async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid('Invalid review ID') });
    const { id } = paramsSchema.parse(request.params);

    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!review) {
      return reply.status(404).send({
        success: false,
        error: 'Review not found.',
      });
    }

    if (review.userId !== request.user!.id && request.user!.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'You are not authorized to delete this review.',
      });
    }

    await db.delete(reviews).where(eq(reviews.id, id));

    return reply.send({
      success: true,
      message: 'Review deleted successfully.',
    });
  });
  
  /**
   * POST /api/reviews/:id/vote
   * Vote on a review (helpful/not helpful).
   */
  app.post('/:id/vote', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  }, async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid('Invalid review ID') });
    const { id } = paramsSchema.parse(request.params);
    const { voteType } = voteReviewSchema.parse(request.body);

    // Check review exists
    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!review) {
      return reply.status(404).send({
        success: false,
        error: 'Review not found.',
      });
    }

    // Prevent self-voting
    if (request.user!.id === review.userId) {
      return reply.status(400).send({
        success: false,
        error: 'You cannot vote on your own review.',
      });
    }

    // Upsert vote
    await db
      .insert(reviewVotes)
      .values({
        reviewId: id,
        userId: request.user!.id,
        voteType,
      })
      .onConflictDoUpdate({
        target: [reviewVotes.reviewId, reviewVotes.userId],
        set: { voteType },
      });

    return reply.send({
      success: true,
      message: 'Vote recorded.',
    });
  });

  /**
   * POST /api/reviews/:id/flag
   * Flag a review for moderation.
   */
  app.post('/:id/flag', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 hour',
      },
    },
  }, async (request, reply) => {
    const paramsSchema = z.object({ id: z.string().uuid('Invalid review ID') });
    const { id } = paramsSchema.parse(request.params);
    const body = flagReviewSchema.parse(request.body);

    // Check review exists
    const [review] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, id))
      .limit(1);

    if (!review) {
      return reply.status(404).send({
        success: false,
        error: 'Review not found.',
      });
    }

    // Check if user already flagged this review
    const [existingFlag] = await db
      .select()
      .from(reviewFlags)
      .where(and(
        eq(reviewFlags.reviewId, id),
        eq(reviewFlags.userId, request.user!.id)
      ))
      .limit(1);

    if (existingFlag) {
      return reply.status(400).send({
        success: false,
        error: 'You have already flagged this review.',
      });
    }

    // Record flag
    await db.insert(reviewFlags).values({
      reviewId: id,
      userId: request.user!.id,
      ...body,
    });

    // Auto-flag: require at least 3 flags before hiding a review to prevent single-user censorship.
    const [flagCount] = await db
      .select({ value: count() })
      .from(reviewFlags)
      .where(eq(reviewFlags.reviewId, id));

    if (flagCount.value >= 3) {
      await db
        .update(reviews)
        .set({ status: 'flagged' })
        .where(eq(reviews.id, id));
    }

    return reply.send({
      success: true,
      message: 'Review flagged. Thank you for your feedback.',
    });
  });
}