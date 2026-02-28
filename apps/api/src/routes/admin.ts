import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { units, reviews, users, universities, userTelemetry, siteBannerSettings } from '@ratemyunit/db/schema';
import { eq, desc, sql, and, inArray } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';
import { scraperQueue } from '../lib/queue.js';
import { moderateReviewSchema, banUserSchema, updateSiteBannerSchema } from '@ratemyunit/validators';
import { lucia } from '../lib/auth.js';
import { subjectTemplateService } from '../services/template.js';
import {
  getScraperDiagnosticsSnapshot,
  recordDiscoveryScanEnqueue,
  recordEnqueueBatchError,
  recordEnqueueBatchResult,
  recordKnownAlreadyQueuedSkip,
  recordQueueInputNormalization,
  recordSingleEnqueue,
} from '../lib/scraper-diagnostics.js';

const scrapeSchema = z.object({
  unitCode: z.string().min(1),
  universityId: z.string().uuid().optional(),
});

const bulkScrapeSchema = z.object({
  unitCodes: z.array(z.string().min(1)).min(1).max(100),
  universityId: z.string().uuid().optional(),
});

const rangeScrapeSchema = z.object({
  startCode: z.string().min(1),
  endCode: z.string().min(1),
  universityId: z.string().uuid().optional(),
  delay: z.number().int().min(0).optional().default(0),
});

const queueLookupSchema = z.object({
  unitCode: z.string().min(1),
  universityId: z.string().uuid().optional(),
});

const SITE_BANNER_PALETTE_VALUES = ['primary', 'secondary', 'accent', 'success', 'ink'] as const;
type SiteBannerPalette = (typeof SITE_BANNER_PALETTE_VALUES)[number];

interface SiteBannerSettingsResponse {
  enabled: boolean;
  message: string;
  palette: SiteBannerPalette;
}

const SITE_BANNER_ROW_ID = 1;
const DEFAULT_SITE_BANNER_SETTINGS: SiteBannerSettingsResponse = {
  enabled: false,
  message: '',
  palette: 'primary',
};

const normalizeUnitCode = (code: string) => code.trim().toUpperCase();
const buildJobId = (universityId: string, unitCode: string) =>
  `scrape-${universityId}-${normalizeUnitCode(unitCode)}`;

const normalizeSiteBannerSettings = (
  row?: { enabled: boolean; message: string; palette: string }
): SiteBannerSettingsResponse => {
  const palette = row?.palette;
  const isValidPalette = SITE_BANNER_PALETTE_VALUES.includes(
    palette as SiteBannerPalette
  );

  return {
    enabled: row?.enabled ?? DEFAULT_SITE_BANNER_SETTINGS.enabled,
    message: row?.message ?? DEFAULT_SITE_BANNER_SETTINGS.message,
    palette: isValidPalette
      ? (palette as SiteBannerPalette)
      : DEFAULT_SITE_BANNER_SETTINGS.palette,
  };
};

const resolveUniversityId = async (universityId?: string) => {
  if (universityId) return universityId;
  const [uts] = await db
    .select()
    .from(universities)
    .where(eq(universities.abbreviation, 'UTS'))
    .limit(1);
  return uts?.id;
};

const fetchExistingUnitCodes = async (
  universityId: string,
  codes: string[],
  chunkSize = 1000
) => {
  const existing = new Set<string>();

  for (let i = 0; i < codes.length; i += chunkSize) {
    const chunk = codes.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const rows = await db
      .select({ unitCode: units.unitCode })
      .from(units)
      .where(
        and(
          eq(units.universityId, universityId),
          inArray(units.unitCode, chunk)
        )
      );

    rows.forEach((row) => existing.add(normalizeUnitCode(row.unitCode)));
  }

  return existing;
};

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
   * GET /api/admin/site-banner
   * Get the current site-wide banner settings.
   */
  app.get('/site-banner', async () => {
    const [bannerSettings] = await db
      .select({
        enabled: siteBannerSettings.enabled,
        message: siteBannerSettings.message,
        palette: siteBannerSettings.palette,
      })
      .from(siteBannerSettings)
      .where(eq(siteBannerSettings.id, SITE_BANNER_ROW_ID))
      .limit(1);

    return {
      success: true,
      data: normalizeSiteBannerSettings(bannerSettings),
    };
  });

  /**
   * PUT /api/admin/site-banner
   * Update the current site-wide banner settings.
   */
  app.put('/site-banner', async (request, reply) => {
    const payload = updateSiteBannerSchema.parse(request.body);
    const message = payload.message.trim();
    const updatedAt = new Date();

    await db
      .insert(siteBannerSettings)
      .values({
        id: SITE_BANNER_ROW_ID,
        enabled: payload.enabled,
        message,
        palette: payload.palette,
        updatedBy: request.user!.id,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: siteBannerSettings.id,
        set: {
          enabled: payload.enabled,
          message,
          palette: payload.palette,
          updatedBy: request.user!.id,
          updatedAt,
        },
      });

    return reply.send({
      success: true,
      message: payload.enabled ? 'Site banner enabled.' : 'Site banner disabled.',
      data: {
        enabled: payload.enabled,
        message,
        palette: payload.palette,
      },
    });
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
    const { id } = z.object({ id: z.string().uuid('Invalid review ID') }).parse(request.params);
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
      lastLoginAt: users.lastLoginAt,
      lastIp: users.lastIp,
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
    const { id } = z.object({ id: z.string().uuid('Invalid user ID') }).parse(request.params);
    const { banned } = banUserSchema.parse(request.body);

    if (request.user!.id === id) {
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
   * DELETE /api/admin/users/:id
   * Permanently delete a user and all their data (cascading).
   */
  app.delete('/users/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid('Invalid user ID') }).parse(request.params);

    app.log.info({ userId: id, currentUserId: request.user?.id }, 'Attempting to delete user');

    if (request.user!.id === id) {
      app.log.warn({ userId: id }, 'User tried to delete their own account');
      return reply.status(400).send({
        success: false,
        error: 'You cannot delete your own account.',
      });
    }

    // Check if user exists
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) {
      return reply.status(404).send({ success: false, error: 'User not found' });
    }

    // Invalidate sessions in Lucia
    await lucia.invalidateUserSessions(id);

    // Delete from DB - other tables (reviews, telemetry, sessions) will cascade
    await db.delete(users).where(eq(users.id, id));

    return reply.send({
      success: true,
      message: 'User and all associated data deleted successfully.',
    });
  });

  /**
   * GET /api/admin/users/:id/telemetry
   * Get login and activity logs for a specific user.
   */
  app.get('/users/:id/telemetry', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid('Invalid user ID') }).parse(request.params);

    const logs = await db
      .select()
      .from(userTelemetry)
      .where(eq(userTelemetry.userId, id))
      .orderBy(desc(userTelemetry.createdAt))
      .limit(100);

    return reply.send({
      success: true,
      data: logs,
    });
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
    const normalizedCode = normalizeUnitCode(unitCode);

    // Resolve university ID or default to UTS
    const effectiveUniId = await resolveUniversityId(universityId);

    if (!effectiveUniId) {
      return reply
        .status(400)
        .send({ success: false, error: 'University ID required or default UTS not found' });
    }

    const [existingUnit] = await db
      .select({ id: units.id, scrapedAt: units.scrapedAt })
      .from(units)
      .where(
        and(
          eq(units.universityId, effectiveUniId),
          eq(units.unitCode, normalizedCode)
        )
      )
      .limit(1);

    if (existingUnit) {
      recordQueueInputNormalization('single', 1, 1, 1);
      return reply.send({
        success: true,
        message: `Unit ${normalizedCode} already indexed`,
        data: {
          status: 'already_indexed',
          unitId: existingUnit.id,
          scrapedAt: existingUnit.scrapedAt,
        },
      });
    }

    const jobId = buildJobId(effectiveUniId, normalizedCode);
    const existingJob = await scraperQueue.getJob(jobId);

    if (existingJob) {
      const state = await existingJob.getState();
      recordQueueInputNormalization('single', 1, 1, 0);
      recordKnownAlreadyQueuedSkip(1);
      return reply.send({
        success: true,
        message: `Job already ${state} for unit ${normalizedCode}`,
        data: {
          status: 'already_queued',
          jobId,
          state,
        },
      });
    }

    // Add to queue with university ID
    await scraperQueue.add(
      'scrape-unit',
      {
        type: 'scrape',
        unitCode: normalizedCode,
        universityId: effectiveUniId,
      },
      {
        jobId,
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );
    recordQueueInputNormalization('single', 1, 1, 0);
    recordSingleEnqueue();

    return reply.send({
      success: true,
      message: `Scrape job queued for unit ${normalizedCode}`,
      data: {
        status: 'queued',
        jobId,
      },
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
      const effectiveUniId = await resolveUniversityId(universityId);
      
      if (!effectiveUniId) {
        return reply.status(400).send({
          success: false,
          error: 'University ID required or default UTS not found',
        });
      }

      const normalizedCodes = Array.from(
        new Set(unitCodes.map(normalizeUnitCode))
      );

      const existingUnitCodes = await fetchExistingUnitCodes(
        effectiveUniId,
        normalizedCodes
      );

      const pendingCodes = normalizedCodes.filter(
        (code) => !existingUnitCodes.has(code)
      );

      recordQueueInputNormalization(
        'bulk',
        unitCodes.length,
        normalizedCodes.length,
        existingUnitCodes.size
      );

      const finalJobs = pendingCodes.map(code => ({
        name: 'scrape-unit',
        data: {
            type: 'scrape' as const,
            unitCode: code,
            universityId: effectiveUniId
        },
        opts: { 
          jobId: buildJobId(effectiveUniId, code),
          attempts: 5,
          backoff: { type: 'exponential' as const, delay: 5000 }
        }
      }));

      if (finalJobs.length > 0) {
        const batchStartedAtMs = Date.now();
        try {
          const addedJobs = await scraperQueue.addBulk(finalJobs);
          recordEnqueueBatchResult('bulk', finalJobs.length, addedJobs, batchStartedAtMs);
        } catch (error) {
          recordEnqueueBatchError();
          throw error;
        }
      }

      return reply.send({
        success: true,
        data: {
          total: normalizedCodes.length,
          queued: finalJobs.length,
          alreadyQueued: 0,
          alreadyIndexed: existingUnitCodes.size,
          message: `Queued ${finalJobs.length} job${finalJobs.length === 1 ? '' : 's'} for background processing (BullMQ deduplicates existing jobIds).`,
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
    const result = rangeScrapeSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: result.error,
      });
    }

    const { startCode, endCode, universityId, delay } = result.data;

    const effectiveUniId = await resolveUniversityId(universityId);

    if (!effectiveUniId) {
      return reply.status(400).send({
        success: false,
        error: 'University ID required or default UTS not found',
      });
    }

    let codes: string[] = [];
    try {
      codes = subjectTemplateService.generateCodesFromTemplateData({
        id: 'range-scrape',
        templateType: 'range',
        startCode,
        endCode,
        codeList: null,
        pattern: null,
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Invalid range',
      });
    }

    if (codes.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'Range generates no codes',
      });
    }

    const normalizedCodes = Array.from(new Set(codes.map(normalizeUnitCode)));
    const existingUnitCodes = await fetchExistingUnitCodes(
      effectiveUniId,
      normalizedCodes
    );
    recordQueueInputNormalization(
      'range',
      codes.length,
      normalizedCodes.length,
      existingUnitCodes.size
    );

    const codesToQueue = normalizedCodes.filter(
      (code) => !existingUnitCodes.has(code)
    );

    if (codesToQueue.length === 0) {
      return reply.send({
        success: true,
        data: {
          total: normalizedCodes.length,
          queued: 0,
          alreadyIndexed: existingUnitCodes.size,
          message: 'All codes in this range are already indexed.',
        },
      });
    }

    const MAX_QUEUE_SIZE = 10000;
    const currentCounts = await scraperQueue.getJobCounts('waiting', 'active');
    const currentTotal = currentCounts.waiting + currentCounts.active;

    if (currentTotal + codesToQueue.length > MAX_QUEUE_SIZE) {
      return reply.status(429).send({
        success: false,
        error: `Queue capacity exceeded. Current: ${currentTotal}, New: ${codesToQueue.length}, Max: ${MAX_QUEUE_SIZE}. Please wait for existing jobs to complete or use a smaller range.`,
      });
    }

    const CHUNK_SIZE = 1000;
    let queuedCount = 0;

    for (let i = 0; i < codesToQueue.length; i += CHUNK_SIZE) {
      const chunk = codesToQueue.slice(i, i + CHUNK_SIZE);
      const jobs = chunk.map(code => ({
        name: 'scrape-unit',
        data: {
          type: 'scrape' as const,
          unitCode: code,
          universityId: effectiveUniId,
        },
        opts: {
          jobId: buildJobId(effectiveUniId, code),
          delay,
          backoff: {
            type: 'exponential' as const,
            delay: 5000,
          },
          attempts: 5,
        },
      }));

      const batchStartedAtMs = Date.now();
      try {
        const addedJobs = await scraperQueue.addBulk(jobs);
        recordEnqueueBatchResult('range', jobs.length, addedJobs, batchStartedAtMs);
      } catch (error) {
        recordEnqueueBatchError();
        throw error;
      }

      queuedCount += jobs.length;

      if (i + CHUNK_SIZE < codesToQueue.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return reply.send({
      success: true,
      data: {
        total: normalizedCodes.length,
        queued: queuedCount,
        alreadyIndexed: existingUnitCodes.size,
        message: `Queued ${queuedCount} jobs for background processing.`,
      },
    });
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
   * GET /api/admin/scrape/diagnostics
   * Get scraper runtime diagnostics counters.
   */
  app.get('/scrape/diagnostics', async () => {
    const counts = await scraperQueue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed'
    );
    const isPaused = await scraperQueue.isPaused();

    return {
      success: true,
      data: {
        ...getScraperDiagnosticsSnapshot(),
        queueState: {
          paused: isPaused,
          counts,
        },
      },
    };
  });

  /**
   * GET /api/admin/queue/lookup
   * Lookup queue status for a specific unit code.
   */
  app.get('/queue/lookup', async (request, reply) => {
    const result = queueLookupSchema.safeParse(request.query);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid query parameters',
        details: result.error,
      });
    }

    const { unitCode, universityId } = result.data;
    const normalizedCode = normalizeUnitCode(unitCode);
    const effectiveUniId = await resolveUniversityId(universityId);

    if (!effectiveUniId) {
      return reply.status(400).send({
        success: false,
        error: 'University ID required or default UTS not found',
      });
    }

    const [existingUnit] = await db
      .select({ id: units.id, scrapedAt: units.scrapedAt })
      .from(units)
      .where(
        and(
          eq(units.universityId, effectiveUniId),
          eq(units.unitCode, normalizedCode)
        )
      )
      .limit(1);

    const jobId = buildJobId(effectiveUniId, normalizedCode);
    const existingJob = await scraperQueue.getJob(jobId);
    const state = existingJob ? await existingJob.getState() : null;

    return reply.send({
      success: true,
      data: {
        unitCode: normalizedCode,
        universityId: effectiveUniId,
        jobId,
        state,
        indexed: !!existingUnit,
        unitId: existingUnit?.id || null,
        scrapedAt: existingUnit?.scrapedAt || null,
      },
    });
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
      jobId: `discovery-${id}`, // Deduplicate discovery jobs
      attempts: 3,
      backoff: { type: 'exponential', delay: 10000 },
    });
    recordDiscoveryScanEnqueue();

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

  /**
   * DELETE /api/admin/units
   * Delete all indexed units and their associated reviews.
   * Requires { confirm: true } in the request body to prevent accidental data loss.
   */
  app.delete('/units', async (request, reply) => {
    const bodySchema = z.object({ confirm: z.literal(true) });
    const result = bodySchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'This operation requires { "confirm": true } in the request body.',
      });
    }

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(units);
    await db.delete(units);
    await scraperQueue.obliterate({ force: true });
    return reply.send({
      success: true,
      data: { message: `Deleted ${count} units and cleared the scraper queue.` },
    });
  });
}
