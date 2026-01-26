DO $$ BEGIN
 CREATE TYPE "scraper_type" AS ENUM('courseloop', 'akari', 'custom', 'legacy');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "scraper_type" "scraper_type" DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "scraper_routes" text;--> statement-breakpoint
ALTER TABLE "universities" ADD COLUMN "scraper_selectors" text;