import type { FastifyInstance } from 'fastify';
import { db } from '@ratemyunit/db/client';
import { universities } from '@ratemyunit/db/schema';
import { eq, asc } from 'drizzle-orm';

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
}
