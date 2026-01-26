import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { units, reviews, users, universities } from '@ratemyunit/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';
import { scraperQueue } from '../lib/queue.js';
import { moderateReviewSchema, banUserSchema } from '@ratemyunit/validators';

const scrapeSchema = z.object({
  unitCode: z.string().min(1),
  universityId: z.string().uuid().optional(),
});

const bulkScrapeSchema = z.object({
  unitCodes: z.array(z.string().min(1)).min(1).max(100),
  universityId: z.string().uuid().optional(),
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

  // --- Scraper Routes ---

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

    const { unitCode, universityId } = result.data;
    if (!universityId) return reply.status(400).send({ success: false, error: 'University ID required' });

    // Add to queue with university ID
    await scraperQueue.add('scrape-unit', { 
        type: 'scrape',
        unitCode, 
        universityId 
    });

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
    if (!result.success) return reply.status(400).send(result.error);

    const { unitCodes, universityId } = result.data;

    try {
      const effectiveUniId = universityId || (await db.select().from(universities).where(eq(universities.abbreviation, 'UTS')).limit(1).then(r => r[0]?.id));
      
      if (!effectiveUniId) return reply.status(400).send({ success: false, error: 'University ID required or default UTS not found' });

      const finalJobs = unitCodes.map(code => ({
        name: 'scrape-unit',
        data: {
            type: 'scrape' as const,
            unitCode: code,
            universityId: effectiveUniId
        },
        opts: { jobId: `scrape-${effectiveUniId}-${code}` }
      }));

      await scraperQueue.addBulk(finalJobs);

      return reply.send({
        success: true,
        data: {
          total: unitCodes.length,
          queued: unitCodes.length,
          message: `Queued ${unitCodes.length} jobs for background processing.`
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
  app.post('/scrape/range', async (_request, reply) => {
    return reply.status(501).send({ success: false, error: 'Range scraping for generic universities not yet implemented' });
  });

  /**
   * GET /api/admin/queue-stats
   * Get scraping job status from queue.
   */
  app.get('/queue-stats', async () => {
    const counts = await scraperQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    return {
      success: true,
      data: counts,
    };
  });

  /**
   * POST /api/admin/university/:id/scan
   * Trigger a discovery scan for a university.
   */
  app.post('/university/:id/scan', async (request) => {
    const { id } = request.params as { id: string };
    
    // Add discovery job
    await scraperQueue.add('discovery', { 
      type: 'discovery',
      universityId: id 
    });

    return { success: true, message: 'Discovery scan queued' };
  });
}
