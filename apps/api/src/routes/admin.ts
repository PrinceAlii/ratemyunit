import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { units, reviews, users } from '@ratemyunit/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';
import { scraperQueue } from '../lib/queue.js';
import { moderateReviewSchema, banUserSchema } from '@ratemyunit/validators';
import { scrapeUTSSubjects, scrapeAllUTSSubjects } from '../scrapers/uts/index.js';

const scrapeSchema = z.object({
  unitCode: z.string().min(1),
});

const bulkScrapeSchema = z.object({
  unitCodes: z.array(z.string().min(1)).min(1).max(100),
  delayMs: z.number().int().min(500).max(10000).optional(),
});

const scrapeRangeSchema = z.object({
  startCode: z.string().regex(/^\d{5}$/, 'Must be 5 digits'),
  endCode: z.string().regex(/^\d{5}$/, 'Must be 5 digits'),
  limit: z.number().int().min(1).max(1000).optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  // Protect all admin routes
  app.addHook('preHandler', requireAdmin);

  /**
   * GET /api/admin/stats
   * Get basic system statistics.
   */
  app.get('/stats', async () => {
    // Use separate subqueries instead of cartesian product joins.
    const [userCount] = await db.select({ count: sql<number>`count(*)` }).from(users);
    const [reviewCount] = await db.select({ count: sql<number>`count(*)` }).from(reviews);
    const [unitCount] = await db.select({ count: sql<number>`count(*)` }).from(units);
    const [flaggedCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(reviews)
      .where(eq(reviews.status, 'flagged'));

    const stats = {
      totalUsers: userCount.count,
      totalReviews: reviewCount.count,
      totalUnits: unitCount.count,
      flaggedReviews: flaggedCount.count,
    };

    return { success: true, data: stats };
  });

  /**
   * GET /api/admin/reviews/flagged
   * Get reviews that have been flagged.
   */
  app.get('/reviews/flagged', async () => {
    const flaggedReviews = await db
      .select({
        id: reviews.id,
        reviewText: reviews.reviewText,
        status: reviews.status,
        createdAt: reviews.createdAt,
        userEmail: users.email,
        unitCode: units.unitCode,
      })
      .from(reviews)
      .innerJoin(users, eq(reviews.userId, users.id))
      .innerJoin(units, eq(reviews.unitId, units.id))
      .where(eq(reviews.status, 'flagged'))
      .orderBy(desc(reviews.createdAt));

    return { success: true, data: flaggedReviews };
  });

  /**
   * POST /api/admin/reviews/:id/moderate
   * Approve or remove a review.
   */
  app.post('/reviews/:id/moderate', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { action } = moderateReviewSchema.parse(request.body);

    const status = action === 'restore' ? 'approved' : 'removed';

    await db.update(reviews)
      .set({ status: status as any, updatedAt: new Date() })
      .where(eq(reviews.id, id));

    return reply.send({ success: true, message: `Review ${action}d.` });
  });

  /**
   * GET /api/admin/users
   * List all users with pagination.
   */
  app.get('/users', async (request) => {
    const querySchema = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0),
    });

    const { limit, offset } = querySchema.parse(request.query);

    const allUsers = await db.select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
      banned: users.banned,
      createdAt: users.createdAt,
    }).from(users)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    return { success: true, data: allUsers };
  });

  /**
   * POST /api/admin/users/:id/ban
   * Ban or unban a user.
   */
  app.post('/users/:id/ban', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { banned } = banUserSchema.parse(request.body);

    // Prevent admin from banning themselves.
    if (request.user && request.user.id === id) {
      return reply.status(400).send({
        success: false,
        error: 'You cannot ban your own account.',
      });
    }

    await db.update(users)
      .set({ banned, updatedAt: new Date() })
      .where(eq(users.id, id));

    return reply.send({ success: true, message: `User ${banned ? 'banned' : 'unbanned'}.` });
  });

  /**
   * POST /api/admin/scrape
   * Trigger a scrape job for a unit.
   */
  app.post('/scrape', async (request, reply) => {
    const result = scrapeSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: result.error,
      });
    }

    const { unitCode } = result.data;

    // Add to queue.
    await scraperQueue.add('scrape-unit', { unitCode });

    return reply.send({
      success: true,
      message: `Scrape job queued for unit ${unitCode}`,
    });
  });

  /**
   * POST /api/admin/scrape/bulk
   * Scrape multiple units immediately (not queued).
   */
  app.post('/scrape/bulk', async (request, reply) => {
    const result = bulkScrapeSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: result.error,
      });
    }

    const { unitCodes, delayMs } = result.data;

    try {
      const scrapeResult = await scrapeUTSSubjects(unitCodes, {
        delayMs,
        continueOnError: true,
      });

      return reply.send({
        success: true,
        data: {
          total: scrapeResult.total,
          successful: scrapeResult.successful,
          failed: scrapeResult.failed,
          errors: scrapeResult.errors,
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /api/admin/scrape/range
   * Scrape a range of unit codes.
   */
  app.post('/scrape/range', async (request, reply) => {
    const result = scrapeRangeSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: result.error,
      });
    }

    const { startCode, endCode, limit } = result.data;

    try {
      const scrapeResult = await scrapeAllUTSSubjects({
        startCode,
        endCode,
        limit,
        delayMs: 2000,
      });

      return reply.send({
        success: true,
        data: {
          total: scrapeResult.total,
          successful: scrapeResult.successful,
          failed: scrapeResult.failed,
          errors: scrapeResult.errors,
          durationMs:
            scrapeResult.completedAt.getTime() -
            scrapeResult.startedAt.getTime(),
        },
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /api/admin/scrape/status
   * Get scraping job status from queue.
   */
  app.get('/scrape/status', async () => {
    const waiting = await scraperQueue.getWaiting();
    const active = await scraperQueue.getActive();
    const completed = await scraperQueue.getCompleted();
    const failed = await scraperQueue.getFailed();

    return {
      success: true,
      data: {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
      },
    };
  });
}
