import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { subjectCodeTemplates, universities } from '@ratemyunit/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';
import { subjectTemplateService } from '../services/template.js';
import { scraperQueue } from '../lib/queue.js';

// Validation schemas
const createTemplateSchema = z.discriminatedUnion('templateType', [
  z.object({
    templateType: z.literal('range'),
    universityId: z.string().uuid(),
    name: z.string().min(1).max(255),
    startCode: z.string().min(1).max(50),
    endCode: z.string().min(1).max(50),
    pattern: z.string().max(255).optional(),
    description: z.string().optional(),
    faculty: z.string().max(255).optional(),
    priority: z.number().int().min(0).optional().default(0),
    active: z.boolean().optional().default(true),
  }),
  z.object({
    templateType: z.literal('list'),
    universityId: z.string().uuid(),
    name: z.string().min(1).max(255),
    codeList: z.array(z.string().min(1)).min(1).max(10000),
    description: z.string().optional(),
    faculty: z.string().max(255).optional(),
    priority: z.number().int().min(0).optional().default(0),
    active: z.boolean().optional().default(true),
  }),
  z.object({
    templateType: z.literal('pattern'),
    universityId: z.string().uuid(),
    name: z.string().min(1).max(255),
    pattern: z.string().min(1).max(255),
    startCode: z.string().min(1).max(50),
    endCode: z.string().min(1).max(50),
    description: z.string().optional(),
    faculty: z.string().max(255).optional(),
    priority: z.number().int().min(0).optional().default(0),
    active: z.boolean().optional().default(true),
  }),
]);

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  startCode: z.string().min(1).max(50).optional(),
  endCode: z.string().min(1).max(50).optional(),
  codeList: z.array(z.string().min(1)).min(1).max(10000).optional(),
  pattern: z.string().max(255).optional(),
  description: z.string().optional(),
  faculty: z.string().max(255).optional(),
  priority: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

const previewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50),
});

const queueJobsSchema = z.object({
  delay: z.number().int().min(0).optional().default(0),
});

const listQuerySchema = z.object({
  universityId: z.string().uuid().optional(),
  active: z.coerce.boolean().optional(),
});

export async function templateRoutes(app: FastifyInstance) {
  // Protect all template routes with admin middleware
  app.addHook('preHandler', requireAdmin);

  /**
   * GET /api/admin/templates
   * List all templates with optional filtering.
   */
  app.get('/', async (request, reply) => {
    const result = listQuerySchema.safeParse(request.query);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid query parameters',
        details: result.error,
      });
    }

    const { universityId, active } = result.data;

    try {
      const conditions = [];
      if (universityId) {
        conditions.push(eq(subjectCodeTemplates.universityId, universityId));
      }
      if (active !== undefined) {
        conditions.push(eq(subjectCodeTemplates.active, active));
      }

      const templates = await db
        .select({
          id: subjectCodeTemplates.id,
          name: subjectCodeTemplates.name,
          templateType: subjectCodeTemplates.templateType,
          startCode: subjectCodeTemplates.startCode,
          endCode: subjectCodeTemplates.endCode,
          codeList: subjectCodeTemplates.codeList,
          pattern: subjectCodeTemplates.pattern,
          description: subjectCodeTemplates.description,
          faculty: subjectCodeTemplates.faculty,
          priority: subjectCodeTemplates.priority,
          active: subjectCodeTemplates.active,
          createdAt: subjectCodeTemplates.createdAt,
          updatedAt: subjectCodeTemplates.updatedAt,
          universityId: subjectCodeTemplates.universityId,
          universityName: universities.name,
          universityAbbreviation: universities.abbreviation,
        })
        .from(subjectCodeTemplates)
        .innerJoin(
          universities,
          eq(subjectCodeTemplates.universityId, universities.id)
        )
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(subjectCodeTemplates.priority), desc(subjectCodeTemplates.createdAt));

      return { success: true, data: templates };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates',
      });
    }
  });

  /**
   * GET /api/admin/templates/:id
   * Get a specific template by ID.
   */
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const [template] = await db
        .select({
          id: subjectCodeTemplates.id,
          name: subjectCodeTemplates.name,
          templateType: subjectCodeTemplates.templateType,
          startCode: subjectCodeTemplates.startCode,
          endCode: subjectCodeTemplates.endCode,
          codeList: subjectCodeTemplates.codeList,
          pattern: subjectCodeTemplates.pattern,
          description: subjectCodeTemplates.description,
          faculty: subjectCodeTemplates.faculty,
          priority: subjectCodeTemplates.priority,
          active: subjectCodeTemplates.active,
          createdAt: subjectCodeTemplates.createdAt,
          updatedAt: subjectCodeTemplates.updatedAt,
          universityId: subjectCodeTemplates.universityId,
          universityName: universities.name,
          universityAbbreviation: universities.abbreviation,
        })
        .from(subjectCodeTemplates)
        .innerJoin(
          universities,
          eq(subjectCodeTemplates.universityId, universities.id)
        )
        .where(eq(subjectCodeTemplates.id, id))
        .limit(1);

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found',
        });
      }

      return { success: true, data: template };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch template',
      });
    }
  });

  /**
   * POST /api/admin/templates
   * Create a new template.
   */
  app.post('/', async (request, reply) => {
    const result = createTemplateSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: result.error,
      });
    }

    const data = result.data;

    try {
      // Verify university exists
      const [university] = await db
        .select()
        .from(universities)
        .where(eq(universities.id, data.universityId))
        .limit(1);

      if (!university) {
        return reply.status(404).send({
          success: false,
          error: 'University not found',
        });
      }

      // Validate template before creating
      const templateData = {
        id: 'temp',
        templateType: data.templateType,
        startCode: 'startCode' in data ? data.startCode : null,
        endCode: 'endCode' in data ? data.endCode : null,
        codeList: 'codeList' in data ? data.codeList : null,
        pattern: 'pattern' in data ? (data.pattern ?? null) : null,
      };

      const validation = subjectTemplateService.validateTemplate(templateData);

      if (!validation.valid) {
        return reply.status(400).send({
          success: false,
          error: 'Template validation failed',
          details: validation.errors,
        });
      }

      // Create template
      const [newTemplate] = await db
        .insert(subjectCodeTemplates)
        .values({
          universityId: data.universityId,
          name: data.name,
          templateType: data.templateType,
          startCode: 'startCode' in data ? data.startCode : null,
          endCode: 'endCode' in data ? data.endCode : null,
          codeList: 'codeList' in data ? data.codeList : null,
          pattern: 'pattern' in data ? data.pattern : null,
          description: data.description || null,
          faculty: data.faculty || null,
          priority: data.priority || 0,
          active: data.active !== undefined ? data.active : true,
          createdBy: request.user?.id || null,
        })
        .returning();

      return reply.status(201).send({
        success: true,
        message: 'Template created successfully',
        data: newTemplate,
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template',
      });
    }
  });

  /**
   * PATCH /api/admin/templates/:id
   * Update an existing template.
   */
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = updateTemplateSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: result.error,
      });
    }

    const data = result.data;

    try {
      // Check if template exists
      const [existing] = await db
        .select()
        .from(subjectCodeTemplates)
        .where(eq(subjectCodeTemplates.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found',
        });
      }

      // Build update object
      const updates: Record<string, any> = {
        ...data,
        updatedAt: new Date(),
      };

      // Validate updated template if structural fields changed
      if (
        data.startCode ||
        data.endCode ||
        data.codeList ||
        data.pattern !== undefined
      ) {
        const templateData = {
          id: existing.id,
          templateType: existing.templateType,
          startCode: data.startCode || existing.startCode,
          endCode: data.endCode || existing.endCode,
          codeList: data.codeList || existing.codeList,
          pattern: data.pattern !== undefined ? data.pattern : existing.pattern,
        };

        const validation = subjectTemplateService.validateTemplate(templateData);

        if (!validation.valid) {
          return reply.status(400).send({
            success: false,
            error: 'Template validation failed',
            details: validation.errors,
          });
        }
      }

      const [updated] = await db
        .update(subjectCodeTemplates)
        .set(updates)
        .where(eq(subjectCodeTemplates.id, id))
        .returning();

      return {
        success: true,
        message: 'Template updated successfully',
        data: updated,
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update template',
      });
    }
  });

  /**
   * DELETE /api/admin/templates/:id
   * Soft delete a template by setting active=false.
   */
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const [existing] = await db
        .select()
        .from(subjectCodeTemplates)
        .where(eq(subjectCodeTemplates.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found',
        });
      }

      await db
        .update(subjectCodeTemplates)
        .set({ active: false, updatedAt: new Date() })
        .where(eq(subjectCodeTemplates.id, id));

      return {
        success: true,
        message: 'Template deleted successfully',
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete template',
      });
    }
  });

  /**
   * POST /api/admin/templates/:id/preview
   * Preview generated codes from a template.
   */
  app.post('/:id/preview', async (request, reply) => {
    const { id } = request.params as { id: string };
    const queryResult = previewQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid query parameters',
        details: queryResult.error,
      });
    }

    const { limit } = queryResult.data;

    try {
      const [template] = await db
        .select()
        .from(subjectCodeTemplates)
        .where(eq(subjectCodeTemplates.id, id))
        .limit(1);

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found',
        });
      }

      const templateData = {
        id: template.id,
        templateType: template.templateType,
        startCode: template.startCode,
        endCode: template.endCode,
        codeList: template.codeList,
        pattern: template.pattern,
      };

      const allCodes = subjectTemplateService.generateCodesFromTemplateData(templateData);
      const previewCodes = allCodes.slice(0, limit);
      const truncated = allCodes.length > limit;

      return {
        success: true,
        data: {
          codes: previewCodes,
          total: allCodes.length,
          truncated,
        },
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to preview codes',
      });
    }
  });

  /**
   * POST /api/admin/templates/:id/queue
   * Generate codes from template and queue scraping jobs.
   */
  app.post('/:id/queue', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = queueJobsSchema.safeParse(request.body);

    if (!result.success) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid request body',
        details: result.error,
      });
    }

    const { delay } = result.data;

    try {
      const [template] = await db
        .select()
        .from(subjectCodeTemplates)
        .where(eq(subjectCodeTemplates.id, id))
        .limit(1);

      if (!template) {
        return reply.status(404).send({
          success: false,
          error: 'Template not found',
        });
      }

      if (!template.active) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot queue jobs for inactive template',
        });
      }

      const templateData = {
        id: template.id,
        templateType: template.templateType,
        startCode: template.startCode,
        endCode: template.endCode,
        codeList: template.codeList,
        pattern: template.pattern,
      };

      const codes = subjectTemplateService.generateCodesFromTemplateData(templateData);

      if (codes.length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Template generates no codes',
        });
      }

      // Implement queue size safety limit
      const MAX_QUEUE_SIZE = 10000;
      const currentCounts = await scraperQueue.getJobCounts('waiting', 'active');
      const currentTotal = currentCounts.waiting + currentCounts.active;

      if (currentTotal + codes.length > MAX_QUEUE_SIZE) {
          return reply.status(429).send({
              success: false,
              error: `Queue capacity exceeded. Current: ${currentTotal}, New: ${codes.length}, Max: ${MAX_QUEUE_SIZE}. Please wait for existing jobs to complete or use a smaller template.`,
          });
      }

      // Chunk jobs to prevent memory spikes and Redis blocking
      const CHUNK_SIZE = 1000;
      let queuedCount = 0;

      for (let i = 0; i < codes.length; i += CHUNK_SIZE) {
          const chunk = codes.slice(i, i + CHUNK_SIZE);
          const jobs = chunk.map((code) => ({
            name: 'scrape-unit',
            data: {
              type: 'scrape' as const,
              unitCode: code,
              universityId: template.universityId,
            },
            opts: {
              jobId: `scrape-${template.universityId}-${code}`,
              delay,
              backoff: {
                type: 'exponential' as const,
                delay: 5000,
              },
              attempts: 5,
            },
          }));

          await scraperQueue.addBulk(jobs);
          queuedCount += jobs.length;
          
          // Brief pause if there are more chunks
          if (i + CHUNK_SIZE < codes.length) {
              await new Promise(resolve => setTimeout(resolve, 100));
          }
      }

      return {
        success: true,
        message: `Queued ${queuedCount} scraping jobs`,
        data: {
          jobsQueued: queuedCount,
          codes: codes.slice(0, 100),
          totalCodes: codes.length,
        },
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to queue jobs',
      });
    }
  });
}
