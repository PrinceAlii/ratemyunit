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
      .set({ status, updatedAt: new Date() })
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
    const isPaused = await scraperQueue.isPaused();
    
    // Add computed status field
    let status = 'idle';
    if (isPaused) {
        status = 'paused';
    } else if (counts.active > 0) {
        status = 'busy';
    } else if (counts.waiting > 0) {
        status = 'queued';
    }

    return {
      success: true,
      data: {
          ...counts,
          status,
          paused: isPaused
      },
    };
  });

  /**
   * POST /api/admin/university/:id/scan
   * Trigger a discovery scan for a university.
   */
  app.post('/university/:id/scan', async (request) => {
    const { id } = request.params as { id: string };

    // Add discovery job with jobId for deduplication
    await scraperQueue.add('discovery', {
      type: 'discovery',
      universityId: id
    }, {
      jobId: `discovery-${id}` // Deduplicate discovery jobs
    });

    return { success: true, message: 'Discovery scan queued' };
  });

  // --- Queue Management Routes ---

  /**
   * POST /api/admin/queue/pause
   * Pause queue processing.
   */
  app.post('/queue/pause', async (_request, reply) => {
    try {
      await scraperQueue.pause();
      return { success: true, message: 'Queue paused successfully' };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pause queue',
      });
    }
  });

  /**
   * POST /api/admin/queue/resume
   * Resume queue processing.
   */
  app.post('/queue/resume', async (_request, reply) => {
    try {
      await scraperQueue.resume();
      return { success: true, message: 'Queue resumed successfully' };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume queue',
      });
    }
  });

  /**
   * POST /api/admin/queue/clear
   * Clear all waiting jobs (requires confirmation).
   */
  app.post('/queue/clear', async (request, reply) => {
    const clearSchema = z.object({
      confirm: z.literal(true),
    });

    const result = clearSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Confirmation required. Send { "confirm": true } to clear queue.',
        details: result.error,
      });
    }

    try {
      // Only clear waiting jobs, not active/completed/failed
      const cleared = await scraperQueue.clean(0, 0, 'wait');
      return {
        success: true,
        message: `Cleared ${cleared.length} waiting jobs`,
        data: { clearedCount: cleared.length }
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear queue',
      });
    }
  });

  /**
   * DELETE /api/admin/queue/job/:jobId
   * Cancel a specific job.
   */
  app.delete('/queue/job/:jobId', async (request, reply) => {
    const { jobId } = request.params as { jobId: string };

    try {
      const job = await scraperQueue.getJob(jobId);

      if (!job) {
        return reply.status(404).send({
          success: false,
          error: `Job ${jobId} not found`,
        });
      }

      const state = await job.getState();

      // Only allow canceling waiting or active jobs
      if (state !== 'waiting' && state !== 'active' && state !== 'delayed') {
        return reply.status(400).send({
          success: false,
          error: `Cannot cancel job in state: ${state}. Only waiting, active, or delayed jobs can be cancelled.`,
        });
      }

      await job.remove();

      return {
        success: true,
        message: `Job ${jobId} cancelled successfully`,
        data: { jobId, previousState: state }
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel job',
      });
    }
  });

  /**
   * GET /api/admin/queue/jobs
   * List jobs with pagination.
   */
  app.get('/queue/jobs', async (request, reply) => {
    const jobsQuerySchema = z.object({
      state: z.enum(['waiting', 'active', 'completed', 'failed', 'delayed']).default('waiting'),
      page: z.coerce.number().int().min(1).max(1000).default(1), // Added max page
      limit: z.coerce.number().int().min(1).max(100).default(20),
    });

    const result = jobsQuerySchema.safeParse(request.query);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid query parameters',
        details: result.error,
      });
    }

    const { state, page, limit } = result.data;
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    try {
      const jobs = await scraperQueue.getJobs(state, start, end);

      const jobsData = jobs.map((job) => ({
        id: job.id,
        name: job.name,
        data: job.data,
        progress: job.progress,
        attemptsMade: job.attemptsMade,
        timestamp: job.timestamp,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        state: state, // Use the state we already know from the query
      }));

      // Get total count for the state
      const counts = await scraperQueue.getJobCounts(state);
      const total = counts[state] || 0;

      return {
        success: true,
        data: {
          jobs: jobsData,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch jobs',
      });
    }
  });

  /**
   * GET /api/admin/queue/status
   * Get queue status (paused/active, counts).
   */
  app.get('/queue/status', async (_request, reply) => {
    try {
      const isPaused = await scraperQueue.isPaused();
      const counts = await scraperQueue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed'
      );

      return {
        success: true,
        data: {
          paused: isPaused,
          status: isPaused ? 'paused' : 'active',
          counts,
        },
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get queue status',
      });
    }
  });
}
