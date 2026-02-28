-- Deduplicate universities by abbreviation before enforcing uniqueness.
-- Keep a canonical row per abbreviation, preferring student domains.

WITH ranked AS (
  SELECT
    id,
    abbreviation,
    ROW_NUMBER() OVER (
      PARTITION BY abbreviation
      ORDER BY
        CASE WHEN email_domain LIKE 'student.%' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM universities
),
canonical AS (
  SELECT abbreviation, id AS keep_id
  FROM ranked
  WHERE rn = 1
),
dupes AS (
  SELECT r.id AS duplicate_id, c.keep_id
  FROM ranked r
  JOIN canonical c ON c.abbreviation = r.abbreviation
  WHERE r.rn > 1
)
UPDATE users u
SET university_id = d.keep_id
FROM dupes d
WHERE u.university_id = d.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    abbreviation,
    ROW_NUMBER() OVER (
      PARTITION BY abbreviation
      ORDER BY
        CASE WHEN email_domain LIKE 'student.%' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM universities
),
canonical AS (
  SELECT abbreviation, id AS keep_id
  FROM ranked
  WHERE rn = 1
),
dupes AS (
  SELECT r.id AS duplicate_id, c.keep_id
  FROM ranked r
  JOIN canonical c ON c.abbreviation = r.abbreviation
  WHERE r.rn > 1
)
UPDATE units un
SET university_id = d.keep_id
FROM dupes d
WHERE un.university_id = d.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    abbreviation,
    ROW_NUMBER() OVER (
      PARTITION BY abbreviation
      ORDER BY
        CASE WHEN email_domain LIKE 'student.%' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM universities
),
canonical AS (
  SELECT abbreviation, id AS keep_id
  FROM ranked
  WHERE rn = 1
),
dupes AS (
  SELECT r.id AS duplicate_id, c.keep_id
  FROM ranked r
  JOIN canonical c ON c.abbreviation = r.abbreviation
  WHERE r.rn > 1
)
UPDATE subject_code_templates t
SET university_id = d.keep_id
FROM dupes d
WHERE t.university_id = d.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    abbreviation,
    ROW_NUMBER() OVER (
      PARTITION BY abbreviation
      ORDER BY
        CASE WHEN email_domain LIKE 'student.%' THEN 0 ELSE 1 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM universities
),
dupes AS (
  SELECT id AS duplicate_id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM universities u
USING dupes d
WHERE u.id = d.duplicate_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'universities_abbreviation_unique'
  ) THEN
    ALTER TABLE universities
      ADD CONSTRAINT universities_abbreviation_unique UNIQUE (abbreviation);
  END IF;
END $$;
