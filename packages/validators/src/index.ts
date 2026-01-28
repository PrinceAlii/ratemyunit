import { z } from 'zod';

// Auth validators
export const registerSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const verifyEmailSchema = z.object({
  token: z.string().uuid('Invalid token'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().uuid('Invalid token'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password is too long'),
});

// Review validators
export const createReviewSchema = z.object({
  unitId: z.string().uuid('Invalid unit ID'),
  sessionTaken: z.string().min(1, 'Session taken is required'),
  displayNameType: z.enum(['nickname', 'anonymous', 'verified'] as const, {
    error: 'Invalid display name type',
  }),
  customNickname: z.string().max(50, 'Nickname is too long').optional().nullable(),
  overallRating: z.number().int().min(1).max(5),
  teachingQualityRating: z.number().int().min(1).max(5),
  workloadRating: z.number().int().min(1).max(5),
  difficultyRating: z.number().int().min(1).max(5),
  usefulnessRating: z.number().int().min(1).max(5),
  reviewText: z
    .string()
    .min(50, 'Review must be at least 50 characters')
    .max(2000, 'Review is too long')
    .optional()
    .nullable(),
  wouldRecommend: z.boolean(),
});

export const updateReviewSchema = createReviewSchema.partial().omit({ unitId: true });

export const voteReviewSchema = z.object({
  voteType: z.enum(['helpful', 'not_helpful'] as const, {
    error: 'Invalid vote type',
  }),
});

export const flagReviewSchema = z.object({
  reason: z.enum(['spam', 'inappropriate', 'inaccurate', 'other'] as const, {
    error: 'Invalid flag reason',
  }),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
});

// Unit validators
export const searchUnitsSchema = z.object({
  search: z.string().optional(),
  faculty: z.string().optional(),
  minRating: z.number().min(1).max(5).optional(),
  sort: z
    .enum(['rating_desc', 'rating_asc', 'recent', 'most_reviewed'])
    .optional()
    .default('rating_desc'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  offset: z.number().int().min(0).optional().default(0),
});

// Admin validators
export const updateUnitSchema = z.object({
  unitName: z.string().optional(),
  description: z.string().optional(),
  creditPoints: z.number().int().optional(),
  prerequisites: z.string().optional(),
  antiRequisites: z.string().optional(),
  faculty: z.string().optional(),
  active: z.boolean().optional(),

  // Academic Structure - new fields for UTS scraper
  level: z.number().int().min(100).max(900).optional(),
  corequisites: z.string().optional(),
  workload: z.number().int().min(0).optional(),
  assessmentStrategy: z.string().optional(),

  // Learning Outcomes - new fields for UTS scraper
  learningOutcomes: z.array(z.string()).optional(),
  syllabus: z.string().optional(),

  // Status Tracking - new fields for UTS scraper
  approvalStatus: z.string().max(50).optional(),
  department: z.string().max(255).optional(),
  lastModifiedCourseLoop: z.date().optional(),

  // Delivery Information - new fields for UTS scraper
  deliveryModes: z.array(z.string()).optional(),
});

export const moderateReviewSchema = z.object({
  action: z.enum(['remove', 'restore'] as const, {
    error: 'Invalid moderation action',
  }),
});

export const banUserSchema = z.object({
  banned: z.boolean(),
});

// Type exports from validators
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
export type VoteReviewInput = z.infer<typeof voteReviewSchema>;
export type FlagReviewInput = z.infer<typeof flagReviewSchema>;
export type SearchUnitsInput = z.infer<typeof searchUnitsSchema>;
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>;
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;
export type BanUserInput = z.infer<typeof banUserSchema>;
