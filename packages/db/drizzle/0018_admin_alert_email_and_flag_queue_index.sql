ALTER TABLE "site_banner_settings"
ADD COLUMN IF NOT EXISTS "admin_alert_email" varchar(320);

CREATE INDEX IF NOT EXISTS "review_flags_status_review_id_created_at_idx"
ON "review_flags" ("status", "review_id", "created_at");
