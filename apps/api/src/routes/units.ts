import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { units, reviews, users, reviewVotes, universities } from '@ratemyunit/db/schema';
import { eq, desc, and, sql, inArray, getTableColumns } from 'drizzle-orm';

export async function unitsRoutes(app: FastifyInstance) {
  /**
   * GET /api/units/search
   * Search for units with filters and sorting.
   */
  app.get('/search', async (request, reply) => {
    const searchQuerySchema = z.object({
      q: z.string().optional(),
      search: z.string().optional(),
      faculty: z.string().optional(),
      universityId: z.string().uuid().optional(),
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
            faculty: units.faculty,
            creditPoints: units.creditPoints,
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

    let orderBy = desc(units.unitCode); // Default sort
    let sortClause: any = orderBy;
    
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
      
    return reply.send({
      success: true,
      data: results,
    });
  });

  /**
   * GET /api/units/:unitCode
   * Get details for a specific unit.
   */
  app.get('/:unitCode', async (request, reply) => {
    const { unitCode } = request.params as { unitCode: string };

    const [result] = await db
      .select({
        ...getTableColumns(units),
        uniId: universities.id,
        uniName: universities.name,
        uniAbbr: universities.abbreviation,
        uniUrl: universities.websiteUrl,
      })
      .from(units)
      .leftJoin(universities, eq(units.universityId, universities.id))
      .where(eq(units.unitCode, unitCode))
      .limit(1);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: 'Unit not found',
      });
    }

    const unit = {
      ...result,
      university: {
        id: result.uniId,
        name: result.uniName,
        abbreviation: result.uniAbbr,
        websiteUrl: result.uniUrl,
      }
    };

    return reply.send({
      success: true,
      data: unit,
    });
  });

  /**
   * GET /api/units/:unitCode/reviews
   * Get reviews for a unit.
   */
  app.get('/:unitCode/reviews', async (request, reply) => {
    const { unitCode } = request.params as { unitCode: string };

    const [unit] = await db
      .select({ id: units.id })
      .from(units)
      .where(eq(units.unitCode, unitCode))
      .limit(1);

    if (!unit) {
      return reply.status(404).send({
        success: false,
        error: 'Unit not found',
      });
    }

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
        }
      };
    });

    return reply.send({
      success: true,
      data: processedReviews,
    });
  });
}
