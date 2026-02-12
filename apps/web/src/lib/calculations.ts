import type { ReviewWithUser } from '@ratemyunit/types';

export interface AverageRatings {
  overall: number;
  teaching: number;
  workload: number;
  difficulty: number;
  usefulness: number;
  count: number;
}

/**
 * Calculate average ratings from a list of reviews.
 * Returns numeric values rounded to 1 decimal place.
 */
export function calculateAverages(reviews: ReviewWithUser[]): AverageRatings | null {
  if (reviews.length === 0) {
    return null;
  }

  const sum = reviews.reduce(
    (acc, review) => ({
      overall: acc.overall + review.overallRating,
      teaching: acc.teaching + review.teachingQualityRating,
      workload: acc.workload + review.workloadRating,
      difficulty: acc.difficulty + review.difficultyRating,
      usefulness: acc.usefulness + review.usefulnessRating,
    }),
    { overall: 0, teaching: 0, workload: 0, difficulty: 0, usefulness: 0 }
  );

  const count = reviews.length;

  // Return NUMBERS, format only at display time
  return {
    overall: Math.round((sum.overall / count) * 10) / 10,
    teaching: Math.round((sum.teaching / count) * 10) / 10,
    workload: Math.round((sum.workload / count) * 10) / 10,
    difficulty: Math.round((sum.difficulty / count) * 10) / 10,
    usefulness: Math.round((sum.usefulness / count) * 10) / 10,
    count,
  };
}

/**
 * Format a rating number for display (e.g., 4.5 -> "4.5")
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}
