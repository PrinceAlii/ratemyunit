CREATE TABLE IF NOT EXISTS "site_banner_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"palette" varchar(32) DEFAULT 'primary' NOT NULL,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "site_banner_settings" ADD CONSTRAINT "site_banner_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "site_banner_settings" ("id", "enabled", "message", "palette")
VALUES (1, false, '', 'primary')
ON CONFLICT ("id") DO NOTHING;
