ALTER TABLE "site_banner_settings"
ADD COLUMN IF NOT EXISTS "enforce_edu_au_email" boolean DEFAULT false NOT NULL;
