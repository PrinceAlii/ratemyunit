import { describe, it, expect } from 'vitest';
import { calculateAverages, formatRating } from './calculations';
import type { ReviewWithUser } from '@ratemyunit/types';

function makeReview(overrides: Partial<ReviewWithUser> = {}): ReviewWithUser {
  return {
    id: '1',
    sessionTaken: 'Autumn 2025',
    overallRating: 4,
    teachingQualityRating: 3,
    workloadRating: 4,
    difficultyRating: 3,
    usefulnessRating: 5,
    reviewText: 'Good unit',
    wouldRecommend: true,
    createdAt: new Date().toISOString(),
    displayNameType: 'nickname',
    customNickname: 'Student',
    voteCount: 0,
    user: {
      displayName: 'Test',
      role: 'student',
      emailVerified: true,
      domainVerified: true,
      emailDomain: 'uts.edu.au',
    },
    ...overrides,
  } as ReviewWithUser;
}

describe('calculateAverages', () => {
  it('returns null for empty array', () => {
    expect(calculateAverages([])).toBeNull();
  });

  it('returns exact ratings for single review', () => {
    const reviews = [makeReview({
      overallRating: 4,
      teachingQualityRating: 3,
      workloadRating: 2,
      difficultyRating: 5,
      usefulnessRating: 1,
    })];
    const result = calculateAverages(reviews);
    expect(result).toEqual({
      overall: 4,
      teaching: 3,
      workload: 2,
      difficulty: 5,
      usefulness: 1,
      count: 1,
    });
  });

  it('averages multiple reviews correctly', () => {
    const reviews = [
      makeReview({ overallRating: 4, teachingQualityRating: 2, workloadRating: 4, difficultyRating: 2, usefulnessRating: 4 }),
      makeReview({ overallRating: 2, teachingQualityRating: 4, workloadRating: 2, difficultyRating: 4, usefulnessRating: 2 }),
    ];
    const result = calculateAverages(reviews);
    expect(result).toEqual({
      overall: 3,
      teaching: 3,
      workload: 3,
      difficulty: 3,
      usefulness: 3,
      count: 2,
    });
  });

  it('rounds to 1 decimal place', () => {
    const reviews = [
      makeReview({ overallRating: 5, teachingQualityRating: 5, workloadRating: 5, difficultyRating: 5, usefulnessRating: 5 }),
      makeReview({ overallRating: 4, teachingQualityRating: 4, workloadRating: 4, difficultyRating: 4, usefulnessRating: 4 }),
      makeReview({ overallRating: 4, teachingQualityRating: 4, workloadRating: 4, difficultyRating: 4, usefulnessRating: 4 }),
    ];
    const result = calculateAverages(reviews)!;
    expect(result.overall).toBe(4.3);
  });

  it('returns correct count', () => {
    const reviews = [makeReview(), makeReview(), makeReview()];
    const result = calculateAverages(reviews)!;
    expect(result.count).toBe(3);
  });
});

describe('formatRating', () => {
  it('formats integer as X.0', () => {
    expect(formatRating(4)).toBe('4.0');
  });

  it('formats decimal as X.Y', () => {
    expect(formatRating(4.5)).toBe('4.5');
  });

  it('formats zero as 0.0', () => {
    expect(formatRating(0)).toBe('0.0');
  });

  it('rounds to 1 decimal place', () => {
    expect(formatRating(3.456)).toBe('3.5');
  });
});
