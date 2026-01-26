import { pgTable, uuid, varchar, text, boolean, timestamp, integer, pgEnum, unique, index, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['student', 'admin', 'moderator']);
export const displayNameTypeEnum = pgEnum('display_name_type', ['nickname', 'anonymous', 'verified']);
export const reviewStatusEnum = pgEnum('review_status', ['auto-approved', 'flagged', 'removed', 'approved']);
export const voteTypeEnum = pgEnum('vote_type', ['helpful', 'not_helpful']);
export const flagReasonEnum = pgEnum('flag_reason', ['spam', 'inappropriate', 'inaccurate', 'other']);
export const flagStatusEnum = pgEnum('flag_status', ['pending', 'reviewed', 'dismissed']);
export const scraperTypeEnum = pgEnum('scraper_type', ['courseloop', 'akari', 'custom', 'legacy', 'search_dom']);

// Universities Table
export const universities = pgTable('universities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  abbreviation: varchar('abbreviation', { length: 50 }).notNull(),
  emailDomain: varchar('email_domain', { length: 255 }).notNull().unique(),
  websiteUrl: varchar('website_url', { length: 500 }),
  handbookUrl: varchar('handbook_url', { length: 500 }),
  
  // Scraper Configuration
  scraperType: scraperTypeEnum('scraper_type').default('custom').notNull(),
  scraperRoutes: jsonb('scraper_routes'), 
  scraperSelectors: jsonb('scraper_selectors'),
  
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Users Table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  displayName: varchar('display_name', { length: 100 }),
  role: userRoleEnum('role').default('student').notNull(),
  universityId: uuid('university_id').references(() => universities.id).notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  banned: boolean('banned').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sessions Table (for Lucia)
export const sessions = pgTable('sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

// Email Verification Tokens
export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Password Reset Tokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Units Table
export const units = pgTable('units', {
  id: uuid('id').primaryKey().defaultRandom(),
  universityId: uuid('university_id').references(() => universities.id).notNull(),
  unitCode: varchar('unit_code', { length: 50 }).notNull(),
  unitName: varchar('unit_name', { length: 255 }).notNull(),
  description: text('description'),
  creditPoints: integer('credit_points'),
  prerequisites: text('prerequisites'),
  antiRequisites: text('anti_requisites'),
  sessions: text('sessions'), // JSONB stored as text, will parse in application
  faculty: varchar('faculty', { length: 255 }),
  scrapedAt: timestamp('scraped_at'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // Academic Structure - new fields for UTS scraper
  level: integer('level'),
  corequisites: text('corequisites'),
  workload: integer('workload'),
  assessmentStrategy: text('assessment_strategy'),

  // Learning Outcomes - new fields for UTS scraper
  learningOutcomes: text('learning_outcomes'),
  syllabus: text('syllabus'),

  // Status Tracking - new fields for UTS scraper
  approvalStatus: varchar('approval_status', { length: 50 }),
  department: varchar('department', { length: 255 }),
  lastModifiedCourseLoop: timestamp('last_modified_course_loop'),

  // Delivery Information - new fields for UTS scraper
  deliveryModes: text('delivery_modes'),
}, (t) => ({
  unitCodeIdx: index('units_unit_code_idx').on(t.unitCode),
  unitNameIdx: index('units_unit_name_idx').on(t.unitName),
  universityIdIdx: index('units_university_id_idx').on(t.universityId),
  activeIdx: index('units_active_idx').on(t.active),
  unq: unique().on(t.universityId, t.unitCode),
}));

// Reviews Table
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  unitId: uuid('unit_id').references(() => units.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sessionTaken: varchar('session_taken', { length: 50 }).notNull(),
  displayNameType: displayNameTypeEnum('display_name_type').default('anonymous').notNull(),
  customNickname: varchar('custom_nickname', { length: 50 }),
  overallRating: integer('overall_rating').notNull(),
  teachingQualityRating: integer('teaching_quality_rating').notNull(),
  workloadRating: integer('workload_rating').notNull(),
  difficultyRating: integer('difficulty_rating').notNull(),
  usefulnessRating: integer('usefulness_rating').notNull(),
  reviewText: text('review_text'),
  wouldRecommend: boolean('would_recommend').notNull(),
  status: reviewStatusEnum('status').default('approved').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  unq: unique().on(t.unitId, t.userId),
  unitIdIdx: index('reviews_unit_id_idx').on(t.unitId),
  statusIdx: index('reviews_status_idx').on(t.status),
}));

// Review Votes Table
export const reviewVotes = pgTable('review_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').references(() => reviews.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  voteType: voteTypeEnum('vote_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  unq: unique().on(t.reviewId, t.userId),
}));

// Review Flags Table
export const reviewFlags = pgTable('review_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  reviewId: uuid('review_id').references(() => reviews.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  reason: flagReasonEnum('reason').notNull(),
  description: text('description'),
  status: flagStatusEnum('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const universitiesRelations = relations(universities, ({ many }) => ({
  users: many(users),
  units: many(units),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  university: one(universities, {
    fields: [users.universityId],
    references: [universities.id],
  }),
  reviews: many(reviews),
  reviewVotes: many(reviewVotes),
  reviewFlags: many(reviewFlags),
  sessions: many(sessions),
}));

export const unitsRelations = relations(units, ({ one, many }) => ({
  university: one(universities, {
    fields: [units.universityId],
    references: [universities.id],
  }),
  reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  unit: one(units, {
    fields: [reviews.unitId],
    references: [units.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  votes: many(reviewVotes),
  flags: many(reviewFlags),
}));

export const reviewVotesRelations = relations(reviewVotes, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewVotes.reviewId],
    references: [reviews.id],
  }),
  user: one(users, {
    fields: [reviewVotes.userId],
    references: [users.id],
  }),
}));

export const reviewFlagsRelations = relations(reviewFlags, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewFlags.reviewId],
    references: [reviews.id],
  }),
  user: one(users, {
    fields: [reviewFlags.userId],
    references: [users.id],
  }),
}));