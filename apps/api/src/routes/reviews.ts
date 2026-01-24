import type { FastifyInstance } from 'fastify';
import { db } from '@ratemyunit/db/client';
import { reviews } from '@ratemyunit/db/schema';
import { eq, and } from 'drizzle-orm';
import { createReviewSchema, updateReviewSchema } from '@ratemyunit/validators';
import { authenticateUser, requireAuth } from '../middleware/auth.js';

export async function reviewsRoutes(app: FastifyInstance) {
  // Apply auth middleware to all routes in this plugin
  app.addHook('preHandler', requireAuth);

  /**
   * POST /api/reviews
   * Create a new review.
   */
  app.post('/', async (request, reply) => {
    if (!request.user) return; // Should be handled by requireAuth

    const body = createReviewSchema.parse(request.body);

    // Check if user already reviewed this unit
    const [existingReview] = await db
      .select()
      .from(reviews)
      .where(and(
        eq(reviews.userId, request.user.id),
        eq(reviews.unitId, body.unitId)
      ))
      .limit(1);

    if (existingReview) {
      return reply.status(400).send({
        success: false,
        error: 'You have already reviewed this unit.',
      });
    }

    // Create review
    // Default status: 'auto-approved' for now. In real app, might check for bad words.
    const [newReview] = await db
      .insert(reviews)
      .values({
        ...body,
        userId: request.user.id,
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
    if (!request.user) return;

    const { id } = request.params as { id: string };
    const body = updateReviewSchema.parse(request.body);

    // Check ownership
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

    if (review.userId !== request.user.id && request.user.role !== 'admin') {
      return reply.status(403).send({
        success: false,
        error: 'You are not authorized to edit this review.',
      });
    }

    // Update review
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
    if (!request.user) return;

    const { id } = request.params as { id: string };

    // Check ownership
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

    if (review.userId !== request.user.id && request.user.role !== 'admin') {
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
}
