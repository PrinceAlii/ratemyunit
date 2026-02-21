import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { units, reviews, users, reviewVotes, universities } from '@ratemyunit/db/schema';
import { eq, desc, and, sql, inArray, getTableColumns } from 'drizzle-orm';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

export async function unitsRoutes(app: FastifyInstance) {
  const unitQuerySchema = z.object({
    universityId: z.string().uuid().or(z.literal('')).transform(v => v === '' ? undefined : v).optional(),
    universityAbbr: z.string().transform(v => v === '' ? undefined : v).optional(),
  });

  const resolveUnit = async (
    identifier: string,
    query: z.infer<typeof unitQuerySchema>
  ): Promise<
    | { status: 'ok'; unit: Record<string, unknown> }
    | { status: 'not_found' }
    | { status: 'ambiguous'; candidates: Array<Record<string, unknown>> }
  > => {
    const trimmed = identifier.trim();
    const identifierIsUuid = isUuid(trimmed);

    const baseQuery = db
      .select({
        ...getTableColumns(units),
        uniId: universities.id,
        uniName: universities.name,
        uniAbbr: universities.abbreviation,
        uniUrl: universities.websiteUrl,
      })
      .from(units)
      .leftJoin(universities, eq(units.universityId, universities.id));

    const conditions = [];

    if (identifierIsUuid) {
      conditions.push(eq(units.id, trimmed));
    } else {
      conditions.push(sql`lower(${units.unitCode}) = ${trimmed.toLowerCase()}`);
    }

    if (query.universityId) {
      conditions.push(eq(units.universityId, query.universityId));
    }

    if (query.universityAbbr) {
      conditions.push(eq(universities.abbreviation, query.universityAbbr.toUpperCase()));
    }

    const results = await baseQuery.where(and(...conditions));

    if (results.length === 0) {
      return { status: 'not_found' };
    }

    if (!identifierIsUuid && results.length > 1 && !query.universityId && !query.universityAbbr) {
      const candidates = results.map((result) => ({
        id: result.id,
        unitCode: result.unitCode,
        unitName: result.unitName,
        universityId: result.universityId,
        universityName: result.uniName,
        universityAbbr: result.uniAbbr,
      }));

      return { status: 'ambiguous', candidates };
    }

    return { status: 'ok', unit: results[0] };
  };

  /**
   * GET /api/units/search
   * Search for units with filters and sorting.
   */
  app.get('/search', async (request, reply) => {
    const searchQuerySchema = z.object({
      q: z.string().optional(),
      search: z.string().optional(),
      faculty: z.string().transform(v => v === '' ? undefined : v).optional(),
      universityId: z.string().uuid().or(z.literal('')).transform(v => v === '' ? undefined : v).optional(),
      minRating: z.coerce.number().min(1).max(5).optional(),
      sort: z.enum(['rating_desc', 'rating_asc', 'recent', 'most_reviewed']).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      offset: z.coerce.number().int().min(0).default(0),
    });

    const validatedQuery = searchQuerySchema.parse(request.query);
    const searchTerm = validatedQuery.search || validatedQuery.q;
    const ratingFilter = validatedQuery.minRating;
    const limitVal = validatedQuery.limit;
    const offsetVal = validatedQuery.offset;
    const sort = validatedQuery.sort;
    const faculty = validatedQuery.faculty;
    const universityId = validatedQuery.universityId;

    const conditions = [eq(units.active, true)];

    if (searchTerm && searchTerm.length >= 2) {
      const escapedTerm = searchTerm.replace(/[\\%_]/g, '\\$&');
      conditions.push(
        sql`(${units.unitCode} ILIKE ${escapedTerm + '%'} ESCAPE '\\' OR ${units.unitName} ILIKE ${'%' + escapedTerm + '%'} ESCAPE '\\')`
      );
    }

    if (faculty) {
      conditions.push(sql`${units.faculty} = ${faculty}`);
    }

    if (universityId) {
      conditions.push(eq(units.universityId, universityId));
    }

    const avgRatingSq = db
        .select({
            unitId: reviews.unitId,
            avgRating: sql<number>`avg(${reviews.overallRating})`.as('avgRating'),
            reviewCount: sql<number>`count(*)`.as('reviewCount')
        })
        .from(reviews)
        .groupBy(reviews.unitId)
        .as('avg_sq');

    const baseQuery = db
        .select({
            id: units.id,
            unitCode: units.unitCode,
            unitName: units.unitName,
            description: units.description,
            faculty: units.faculty,
            creditPoints: units.creditPoints,
            universityId: units.universityId,
            universityName: universities.name,
            universityAbbr: universities.abbreviation,
            averageRating: sql<number>`COALESCE(${avgRatingSq.avgRating}, 0)`,
            reviewCount: sql<number>`COALESCE(${avgRatingSq.reviewCount}, 0)`,
            scrapedAt: units.scrapedAt
        })
        .from(units)
        .leftJoin(avgRatingSq, eq(units.id, avgRatingSq.unitId))
        .leftJoin(universities, eq(units.universityId, universities.id));

    let whereClause = and(...conditions);
    
    if (ratingFilter) {
        whereClause = and(whereClause, sql`COALESCE(${avgRatingSq.avgRating}, 0) >= ${ratingFilter}`);
    }

    const orderBy = desc(units.unitCode); // Default sort
    let sortClause: import('drizzle-orm').SQL | import('drizzle-orm').AnyColumn = orderBy;
    
    if (sort === 'rating_desc') {
        sortClause = desc(sql`COALESCE(${avgRatingSq.avgRating}, 0)`);
    } else if (sort === 'rating_asc') {
        sortClause = sql`COALESCE(${avgRatingSq.avgRating}, 0) ASC`;
    } else if (sort === 'most_reviewed') {
        sortClause = desc(sql`COALESCE(${avgRatingSq.reviewCount}, 0)`);
    } else if (sort === 'recent') {
       sortClause = desc(units.scrapedAt);
    }

    const results = await baseQuery
        .where(whereClause)
        .orderBy(sortClause)
        .limit(limitVal)
        .offset(offsetVal);

    // Get total count for pagination
    const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(units)
        .leftJoin(avgRatingSq, eq(units.id, avgRatingSq.unitId))
        .where(whereClause);
    
    const total = Number(countResult[0]?.count || 0);
      
    return reply.send({
      success: true,
      data: {
        data: results,
        pagination: {
          total,
          limit: limitVal,
          offset: offsetVal,
          page: Math.floor(offsetVal / limitVal) + 1,
          totalPages: Math.ceil(total / limitVal),
        },
      },
    });
  });

  /**
   * GET /api/units/:identifier
   * Get details for a specific unit by UUID or unit code.
   */
  app.get('/:identifier', async (request, reply) => {
    const paramsSchema = z.object({ identifier: z.string().min(1) });
    const { identifier } = paramsSchema.parse(request.params);
    const query = unitQuerySchema.parse(request.query);

    const resolved = await resolveUnit(identifier, query);

    if (resolved.status === 'not_found') {
      return reply.status(404).send({
        success: false,
        error: 'Unit not found',
      });
    }

    if (resolved.status === 'ambiguous') {
      return reply.status(409).send({
        success: false,
        error: 'Multiple units match this code. Provide universityId or universityAbbr.',
        data: { candidates: resolved.candidates },
      });
    }

    const result = resolved.unit as {
      uniId: string | null;
      uniName: string | null;
      uniAbbr: string | null;
      uniUrl: string | null;
    };

    const unit = {
      ...resolved.unit,
      university: {
        id: result.uniId,
        name: result.uniName,
        abbreviation: result.uniAbbr,
        websiteUrl: result.uniUrl,
      },
    };

    return reply.send({
      success: true,
      data: unit,
    });
  });

  /**
   * GET /api/units/:identifier/reviews
   * Get reviews for a unit by UUID or unit code.
   */
  app.get('/:identifier/reviews', async (request, reply) => {
    const paramsSchema = z.object({ identifier: z.string().min(1) });
    const { identifier } = paramsSchema.parse(request.params);
    const query = unitQuerySchema.parse(request.query);

    const resolved = await resolveUnit(identifier, query);

    if (resolved.status === 'not_found') {
      return reply.status(404).send({
        success: false,
        error: 'Unit not found',
      });
    }

    if (resolved.status === 'ambiguous') {
      return reply.status(409).send({
        success: false,
        error: 'Multiple units match this code. Provide universityId or universityAbbr.',
        data: { candidates: resolved.candidates },
      });
    }

    const unit = resolved.unit as { id: string };

    const unitReviews = await db
      .select({
        id: reviews.id,
        sessionTaken: reviews.sessionTaken,
        overallRating: reviews.overallRating,
        teachingQualityRating: reviews.teachingQualityRating,
        workloadRating: reviews.workloadRating,
        difficultyRating: reviews.difficultyRating,
        usefulnessRating: reviews.usefulnessRating,
        reviewText: reviews.reviewText,
        wouldRecommend: reviews.wouldRecommend,
        createdAt: reviews.createdAt,
        displayNameType: reviews.displayNameType,
        customNickname: reviews.customNickname,
        user: {
          id: users.id,
          displayName: users.displayName,
          role: users.role,
          emailVerified: users.emailVerified,
          domainVerified: users.domainVerified,
          email: users.email,
        },
        voteCount: sql<number>`(
          SELECT COUNT(*) FILTER (WHERE ${reviewVotes.voteType} = 'helpful') -
          COUNT(*) FILTER (WHERE ${reviewVotes.voteType} = 'not_helpful')
          FROM ${reviewVotes}
          WHERE ${reviewVotes.reviewId} = ${reviews.id}
        )`.mapWith(Number)
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(and(
        eq(reviews.unitId, unit.id),
        inArray(reviews.status, ['approved', 'auto-approved'])
      ))
      .orderBy(desc(reviews.createdAt));

    const processedReviews = unitReviews.map(review => {
      let displayName = 'Anonymous Student';

      if (review.displayNameType === 'verified') {
        displayName = review.user?.displayName || 'Verified Student';
      } else if (review.displayNameType === 'nickname') {
        displayName = review.customNickname || 'Student';
      }

      return {
        ...review,
        user: {
          displayName: displayName,
          role: review.user?.role,
          emailVerified: review.user?.emailVerified,
          domainVerified: review.user?.domainVerified,
          emailDomain: review.user?.email?.split('@')[1] || '',
        }
      };
    });

    return reply.send({
      success: true,
      data: processedReviews,
    });
  });
}
