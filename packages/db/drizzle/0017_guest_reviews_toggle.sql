ALTER TABLE "site_banner_settings"
ADD COLUMN IF NOT EXISTS "allow_guest_reviews" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "reviews"
ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "reviews"
ADD COLUMN IF NOT EXISTS "guest_ip_hash" varchar(64);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reviews_guest_limit_idx"
ON "reviews" ("unit_id", "guest_ip_hash", "created_at");
