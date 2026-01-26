import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '@ratemyunit/db/client';
import { units, reviews, users, reviewVotes } from '@ratemyunit/db/schema';
import { eq, desc, and, sql, inArray } from 'drizzle-orm';

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

    const conditions = [eq(units.active, true)];

    // Text Search
    if (searchTerm && searchTerm.length >= 2) {
      conditions.push(
        sql`(${units.unitCode} ILIKE ${searchTerm + '%'} OR ${units.unitName} ILIKE ${'%' + searchTerm + '%'})`
      );
    }

    // Faculty Filter
    if (faculty) {
      conditions.push(sql`${units.faculty} = ${faculty}`);
    }

    // Rating Filter (This is tricky without a materialized view or subquery for aggregates)
    // For now, we'll do a simple join or subquery if needed.
    // Optimization: Usually rating averages are stored on the unit table or a materialized view.
    // For this MVP, we will calculate average on the fly or just filter if possible.
    // Let's rely on a calculated average if we can, or just return all and let frontend filter if dataset small?
    // No, let's try to aggregate.
    
    // Sort logic
    let orderBy = desc(units.unitCode); // Default
    if (sort === 'recent') {
       orderBy = desc(units.scrapedAt);
    } else if (sort === 'rating_asc') {
       // Requires aggregated rating
    } else if (sort === 'rating_desc') {
       // Requires aggregated rating
    }

    // Building the query
    // We need to join with reviews to get average rating if we want to sort/filter by it.
    // This can be heavy. Let's do a subquery for average rating.
    
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
            averageRating: sql<number>`COALESCE(${avgRatingSq.avgRating}, 0)`,
            reviewCount: sql<number>`COALESCE(${avgRatingSq.reviewCount}, 0)`
        })
        .from(units)
        .leftJoin(avgRatingSq, eq(units.id, avgRatingSq.unitId));

    // Apply where clauses
    let whereClause = and(...conditions);
    
    // Apply rating filter via HAVING or Wrapper? 
    // Since we joined a subquery, we can filter on the result in a wrapper or just use the subquery column?
    // Drizzle with subqueries in where:
    if (ratingFilter) {
        whereClause = and(whereClause, sql`COALESCE(${avgRatingSq.avgRating}, 0) >= ${ratingFilter}`);
    }

    // Apply Sort
    let sortClause = orderBy;
    if (sort === 'rating_desc') {
        sortClause = desc(sql`COALESCE(${avgRatingSq.avgRating}, 0)`);
    } else if (sort === 'rating_asc') {
        sortClause = sql`COALESCE(${avgRatingSq.avgRating}, 0) ASC`;
    } else if (sort === 'most_reviewed') {
        sortClause = desc(sql`COALESCE(${avgRatingSq.reviewCount}, 0)`);
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

    const [unit] = await db
      .select()
      .from(units)
      .where(eq(units.unitCode, unitCode))
      .limit(1);

    if (!unit) {
      return reply.status(404).send({
        success: false,
        error: 'Unit not found',
      });
    }

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

    // First find the unit ID
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

    // Fetch reviews with vote counts
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
          role: users.role, // Useful to show if review is from verified user/admin (though verified status is separate)
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

    // Process display names based on privacy settings.
    // Remove internal user IDs from public responses.
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
