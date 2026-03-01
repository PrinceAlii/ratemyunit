import type { FastifyInstance } from 'fastify';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { reviews, reviewVotes, reviewFlags, siteBannerSettings, units } from '@ratemyunit/db/schema';
import { eq, and, count, gte } from 'drizzle-orm';
import { 
  createReviewSchema, 
  updateReviewSchema, 
  voteReviewSchema, 
  flagReviewSchema 
} from '@ratemyunit/validators';
import { authenticateUser, requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { generateFlaggedReviewAlertEmail, sendEmail } from '../lib/email.js';

const SITE_BANNER_ROW_ID = 1;
const GUEST_REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000;

function hashGuestIp(ip: string): string {
  const salt = config.GUEST_REVIEW_IP_HASH_SALT;
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

export async function reviewsRoutes(app: FastifyInstance) {
  /**
   * POST /api/reviews
   * Create a new review.
   */
  app.post('/', { preHandler: authenticateUser }, async (request, reply) => {
    const body = createReviewSchema.parse(request.body);
    const user = request.user;

    const [siteSettings] = await db
      .select({
        allowGuestReviews: siteBannerSettings.allowGuestReviews,
      })
      .from(siteBannerSettings)
      .where(eq(siteBannerSettings.id, SITE_BANNER_ROW_ID))
      .limit(1);

    const allowGuestReviews = siteSettings?.allowGuestReviews ?? false;

    if (!user && !allowGuestReviews) {
      return reply.status(401).send({
        success: false,
        error: 'Authentication required',
      });
    }

    if (user?.banned) {
      return reply.status(403).send({
        success: false,
        error: 'Your account has been banned',
      });
    }

    if (user && !user.emailVerified) {
      return reply.status(403).send({
        success: false,
        error: 'Please verify your email address',
      });
    }

    let guestIpHash: string | null = null;

    if (user) {
      const [existingReview] = await db
        .select()
        .from(reviews)
        .where(and(
          eq(reviews.userId, user.id),
          eq(reviews.unitId, body.unitId)
        ))
        .limit(1);

      if (existingReview) {
        return reply.status(400).send({
          success: false,
          error: 'You have already reviewed this unit.',
        });
      }
    } else {
      guestIpHash = hashGuestIp(request.ip || 'unknown');
      const cutoff = new Date(Date.now() - GUEST_REVIEW_WINDOW_MS);

      const [recentGuestReview] = await db
        .select({ id: reviews.id })
        .from(reviews)
        .where(and(
          eq(reviews.unitId, body.unitId),
          eq(reviews.guestIpHash, guestIpHash),
          gte(reviews.createdAt, cutoff)
        ))
        .limit(1);

      if (recentGuestReview) {
        return reply.status(429).send({
          success: false,
          error: 'Guest reviews are limited to one review per unit every 24 hours.',
        });
      }
    }

    const [newReview] = await db
      .insert(reviews)
      .values({
        ...body,
        userId: user?.id ?? null,
        guestIpHash,
        displayNameType: user ? body.displayNameType : 'anonymous',
        customNickname: user ? body.customNickname : null,
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
  app.put('/:id', { preHandler: requireAuth }, async (request, reply) => {
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
  app.delete('/:id', { preHandler: requireAuth }, async (request, reply) => {
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
    preHandler: requireAuth,
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

    if (request.user!.id === review.userId) {
      return reply.status(400).send({
        success: false,
        error: 'You cannot vote on your own review.',
      });
    }

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
    preHandler: requireAuth,
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

    const [review] = await db
      .select({
        id: reviews.id,
        unitId: reviews.unitId,
        unitCode: units.unitCode,
      })
      .from(reviews)
      .innerJoin(units, eq(reviews.unitId, units.id))
      .where(eq(reviews.id, id))
      .limit(1);

    if (!review) {
      return reply.status(404).send({
        success: false,
        error: 'Review not found.',
      });
    }

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

    await db.insert(reviewFlags).values({
      reviewId: id,
      userId: request.user!.id,
      ...body,
    });

    const [flagCount] = await db
      .select({ value: count() })
      .from(reviewFlags)
      .where(and(
        eq(reviewFlags.reviewId, id),
        eq(reviewFlags.status, 'pending')
      ));

    const [moderationSettings] = await db
      .select({
        adminAlertEmail: siteBannerSettings.adminAlertEmail,
      })
      .from(siteBannerSettings)
      .where(eq(siteBannerSettings.id, SITE_BANNER_ROW_ID))
      .limit(1);

    if (!moderationSettings?.adminAlertEmail) {
      request.log.warn({ reviewId: id }, 'Review flagged but adminAlertEmail is not configured');
    } else {
      try {
        await sendEmail({
          to: moderationSettings.adminAlertEmail,
          subject: `[RateMyUnit] Review Flagged (${review.unitCode})`,
          html: generateFlaggedReviewAlertEmail({
            reviewId: id,
            unitCode: review.unitCode,
            reason: body.reason,
            description: body.description ?? null,
            flagCount: Number(flagCount.value),
            moderationUrl: `${config.FRONTEND_URL}/admin`,
          }),
        });
      } catch (error) {
        request.log.error(
          {
            error,
            reviewId: id,
            unitCode: review.unitCode,
            flagCount: Number(flagCount.value),
            reporterUserId: request.user!.id,
          },
          'Failed to send flagged review alert email'
        );
      }
    }

    return reply.send({
      success: true,
      message: 'Review flagged. Thank you for your feedback.',
    });
  });
}
