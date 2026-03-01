DO $$
BEGIN
  ALTER TABLE "reviews" ALTER COLUMN "status" SET DEFAULT 'approved';
EXCEPTION
  WHEN SQLSTATE '55P04' THEN
    -- In a fresh bootstrap, enum value 'approved' may be newly added in the same
    -- transaction. Keep existing default and continue so the rest of migrations apply.
    NULL;
END $$;
