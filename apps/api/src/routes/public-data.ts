import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { universities, units } from '@ratemyunit/db/schema';
import { and, eq, asc, isNotNull } from 'drizzle-orm';

export async function publicDataRoutes(app: FastifyInstance) {
  /**
   * GET /api/public/universities
   * Get list of active universities for filtering.
   * Publicly accessible, cached for 1 hour ideally (client-side).
   */
  app.get('/universities', async (_request, reply) => {
    const activeUnis = await db
      .select({
        id: universities.id,
        name: universities.name,
        abbreviation: universities.abbreviation,
        websiteUrl: universities.websiteUrl,
      })
      .from(universities)
      .where(eq(universities.active, true))
      .orderBy(asc(universities.name));

    return reply.send({
      success: true,
      data: activeUnis,
    });
  });

  /**
   * GET /api/public/faculties
   * Get distinct faculties, optionally filtered by university.
   * Used by the Browse page filter to show relevant faculty options.
   */
  app.get('/faculties', async (request, reply) => {
    const querySchema = z.object({
      universityId: z.string().uuid().optional(),
    });

    const { universityId } = querySchema.parse(request.query);

    const whereClause = universityId
      ? and(isNotNull(units.faculty), eq(units.universityId, universityId))
      : isNotNull(units.faculty);

    const rows = await db
      .selectDistinct({ faculty: units.faculty })
      .from(units)
      .where(whereClause)
      .orderBy(asc(units.faculty));
    const faculties = rows.map((r) => r.faculty).filter(Boolean) as string[];

    return reply.send({
      success: true,
      data: faculties,
    });
  });
}
