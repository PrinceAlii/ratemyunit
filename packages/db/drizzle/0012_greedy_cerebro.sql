-- Convert learning_outcomes from text to jsonb with safe data migration
ALTER TABLE "units" ALTER COLUMN "learning_outcomes" TYPE jsonb USING
  CASE
    WHEN "learning_outcomes" IS NULL THEN NULL
    WHEN "learning_outcomes" = '' THEN '[]'::jsonb
    WHEN "learning_outcomes"::text ~ '^\[.*\]$' THEN "learning_outcomes"::jsonb
    ELSE json_build_array("learning_outcomes")::jsonb
  END;
--> statement-breakpoint
-- Convert delivery_modes from text to jsonb with safe data migration
ALTER TABLE "units" ALTER COLUMN "delivery_modes" TYPE jsonb USING
  CASE
    WHEN "delivery_modes" IS NULL THEN NULL
    WHEN "delivery_modes" = '' THEN '[]'::jsonb
    WHEN "delivery_modes"::text ~ '^\[.*\]$' THEN "delivery_modes"::jsonb
    ELSE json_build_array("delivery_modes")::jsonb
  END;