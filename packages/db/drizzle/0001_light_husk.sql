ALTER TYPE "review_status" ADD VALUE 'approved';--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "level" integer;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "corequisites" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "workload" integer;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "assessment_strategy" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "learning_outcomes" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "syllabus" text;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "approval_status" varchar(50);--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "department" varchar(255);--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "last_modified_course_loop" timestamp;--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "delivery_modes" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_unit_id_idx" ON "reviews" ("unit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_status_idx" ON "reviews" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_unit_code_idx" ON "units" ("unit_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "units_active_idx" ON "units" ("active");--> statement-breakpoint
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_user_id_unique" UNIQUE("review_id","user_id");--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_unit_id_user_id_unique" UNIQUE("unit_id","user_id");