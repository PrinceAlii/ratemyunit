import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createReviewSchema,
  updateReviewSchema,
  voteReviewSchema,
  flagReviewSchema,
  searchUnitsSchema,
  moderateReviewSchema,
  banUserSchema,
  updateSiteBannerSchema,
} from './index';

describe('registerSchema', () => {
  const validInput = {
    email: 'student@uts.edu.au',
    password: 'password123',
    displayName: 'Test Student',
    universityId: '11111111-1111-4111-a111-111111111111',
  };

  it('accepts valid input', () => {
    const result = registerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('lowercases email', () => {
    const result = registerSchema.parse({ ...validInput, email: 'STUDENT@UTS.EDU.AU' });
    expect(result.email).toBe('student@uts.edu.au');
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({ ...validInput, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = registerSchema.safeParse({ ...validInput, password: '1234567' });
    expect(result.success).toBe(false);
  });

  it('rejects password over 100 chars', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('rejects missing displayName', () => {
    const { displayName, ...rest } = validInput;
    const result = registerSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects displayName under 2 chars', () => {
    const result = registerSchema.safeParse({ ...validInput, displayName: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects non-UUID universityId', () => {
    const result = registerSchema.safeParse({ ...validInput, universityId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    const result = registerSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid input', () => {
    const result = loginSchema.safeParse({ email: 'test@uts.edu.au', password: 'password123' });
    expect(result.success).toBe(true);
  });

  it('lowercases email', () => {
    const result = loginSchema.parse({ email: 'TEST@UTS.EDU.AU', password: 'password123' });
    expect(result.email).toBe('test@uts.edu.au');
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'bad', password: 'password123' });
    expect(result.success).toBe(false);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'test@uts.edu.au', password: '' });
    expect(result.success).toBe(false);
  });
});

describe('verifyEmailSchema', () => {
  it('accepts valid base64url token', () => {
    const result = verifyEmailSchema.safeParse({ token: 'nTg7a2rj5h7wZ8d8B3Wq4T1Q9f_7mK2pL5u8V3y1xZ0' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid token', () => {
    const result = verifyEmailSchema.safeParse({ token: 'not a token' });
    expect(result.success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'test@uts.edu.au' });
    expect(result.success).toBe(true);
  });

  it('lowercases email', () => {
    const result = forgotPasswordSchema.parse({ email: 'TEST@UTS.EDU.AU' });
    expect(result.email).toBe('test@uts.edu.au');
  });

  it('rejects invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'bad' });
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid input', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'nTg7a2rj5h7wZ8d8B3Wq4T1Q9f_7mK2pL5u8V3y1xZ0',
      password: 'newpassword123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects short password', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'nTg7a2rj5h7wZ8d8B3Wq4T1Q9f_7mK2pL5u8V3y1xZ0',
      password: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid token', () => {
    const result = resetPasswordSchema.safeParse({
      token: 'not a token',
      password: 'newpassword123',
    });
    expect(result.success).toBe(false);
  });
});

describe('createReviewSchema', () => {
  const validReview = {
    unitId: '11111111-1111-4111-a111-111111111111',
    sessionTaken: 'Autumn 2025',
    displayNameType: 'nickname',
    overallRating: 4,
    teachingQualityRating: 3,
    workloadRating: 4,
    difficultyRating: 3,
    usefulnessRating: 5,
    wouldRecommend: true,
  };

  it('accepts valid full input', () => {
    const result = createReviewSchema.safeParse({
      ...validReview,
      customNickname: 'TestNick',
      reviewText: 'A'.repeat(50),
    });
    expect(result.success).toBe(true);
  });

  it('accepts minimal valid input (no optional fields)', () => {
    const result = createReviewSchema.safeParse(validReview);
    expect(result.success).toBe(true);
  });

  it('rejects rating below 1', () => {
    const result = createReviewSchema.safeParse({ ...validReview, overallRating: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects rating above 5', () => {
    const result = createReviewSchema.safeParse({ ...validReview, overallRating: 6 });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer rating', () => {
    const result = createReviewSchema.safeParse({ ...validReview, overallRating: 3.5 });
    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = createReviewSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects reviewText too short', () => {
    const result = createReviewSchema.safeParse({ ...validReview, reviewText: 'Too short' });
    expect(result.success).toBe(false);
  });

  it('rejects reviewText too long', () => {
    const result = createReviewSchema.safeParse({ ...validReview, reviewText: 'A'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('accepts reviewText at min boundary (50 chars)', () => {
    const result = createReviewSchema.safeParse({ ...validReview, reviewText: 'A'.repeat(50) });
    expect(result.success).toBe(true);
  });

  it('rejects invalid displayNameType', () => {
    const result = createReviewSchema.safeParse({ ...validReview, displayNameType: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid displayNameTypes', () => {
    for (const type of ['nickname', 'anonymous', 'verified']) {
      const result = createReviewSchema.safeParse({ ...validReview, displayNameType: type });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid unitId', () => {
    const result = createReviewSchema.safeParse({ ...validReview, unitId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});

describe('updateReviewSchema', () => {
  it('accepts partial updates', () => {
    const result = updateReviewSchema.safeParse({ overallRating: 5 });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all optional)', () => {
    const result = updateReviewSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('strips unitId (omitted from schema)', () => {
    const result = updateReviewSchema.safeParse({ unitId: '11111111-1111-4111-a111-111111111111' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).unitId).toBeUndefined();
    }
  });
});

describe('voteReviewSchema', () => {
  it('accepts helpful', () => {
    const result = voteReviewSchema.safeParse({ voteType: 'helpful' });
    expect(result.success).toBe(true);
  });

  it('accepts not_helpful', () => {
    const result = voteReviewSchema.safeParse({ voteType: 'not_helpful' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid vote type', () => {
    const result = voteReviewSchema.safeParse({ voteType: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('flagReviewSchema', () => {
  it('accepts valid reasons', () => {
    for (const reason of ['spam', 'inappropriate', 'inaccurate', 'other']) {
      const result = flagReviewSchema.safeParse({ reason });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid reason', () => {
    const result = flagReviewSchema.safeParse({ reason: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('accepts optional description', () => {
    const result = flagReviewSchema.safeParse({ reason: 'spam', description: 'This is spam' });
    expect(result.success).toBe(true);
  });

  it('rejects description over 500 chars', () => {
    const result = flagReviewSchema.safeParse({ reason: 'spam', description: 'A'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('accepts null description', () => {
    const result = flagReviewSchema.safeParse({ reason: 'spam', description: null });
    expect(result.success).toBe(true);
  });
});

describe('searchUnitsSchema', () => {
  it('applies defaults', () => {
    const result = searchUnitsSchema.parse({});
    expect(result.sort).toBe('rating_desc');
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('accepts all sort options', () => {
    for (const sort of ['rating_desc', 'rating_asc', 'recent', 'most_reviewed']) {
      const result = searchUnitsSchema.safeParse({ sort });
      expect(result.success).toBe(true);
    }
  });

  it('rejects limit over 100', () => {
    const result = searchUnitsSchema.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it('rejects limit under 1', () => {
    const result = searchUnitsSchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative offset', () => {
    const result = searchUnitsSchema.safeParse({ offset: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects minRating over 5', () => {
    const result = searchUnitsSchema.safeParse({ minRating: 6 });
    expect(result.success).toBe(false);
  });

  it('rejects minRating under 1', () => {
    const result = searchUnitsSchema.safeParse({ minRating: 0 });
    expect(result.success).toBe(false);
  });
});

describe('moderateReviewSchema', () => {
  it('accepts remove', () => {
    const result = moderateReviewSchema.safeParse({ action: 'remove' });
    expect(result.success).toBe(true);
  });

  it('accepts restore', () => {
    const result = moderateReviewSchema.safeParse({ action: 'restore' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid action', () => {
    const result = moderateReviewSchema.safeParse({ action: 'invalid' });
    expect(result.success).toBe(false);
  });
});

describe('banUserSchema', () => {
  it('accepts banned=true', () => {
    const result = banUserSchema.safeParse({ banned: true });
    expect(result.success).toBe(true);
  });

  it('accepts banned=false', () => {
    const result = banUserSchema.safeParse({ banned: false });
    expect(result.success).toBe(true);
  });

  it('rejects non-boolean', () => {
    const result = banUserSchema.safeParse({ banned: 'yes' });
    expect(result.success).toBe(false);
  });

  it('rejects missing banned field', () => {
    const result = banUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('updateSiteBannerSchema', () => {
  const basePayload = {
    enabled: false,
    enforceEduAuEmail: false,
    allowGuestReviews: false,
    adminAlertEmail: '',
    message: '',
    palette: 'primary',
  } as const;

  it('accepts valid admin alert email', () => {
    const result = updateSiteBannerSchema.safeParse({
      ...basePayload,
      adminAlertEmail: 'admin@ratemyunit.dev',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty admin alert email', () => {
    const result = updateSiteBannerSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
  });

  it('rejects invalid admin alert email', () => {
    const result = updateSiteBannerSchema.safeParse({
      ...basePayload,
      adminAlertEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });
});
