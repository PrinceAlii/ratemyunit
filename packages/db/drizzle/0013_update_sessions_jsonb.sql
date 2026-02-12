-- Convert sessions column from text to jsonb
-- handles existing data by trying to parse it as JSON
ALTER TABLE "units" ALTER COLUMN "sessions" TYPE jsonb USING 
  CASE 
    WHEN sessions IS NULL THEN NULL
    WHEN sessions = '' THEN '[]'::jsonb
    ELSE sessions::jsonb 
  END;
