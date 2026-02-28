-- Seed Australian universities
-- This file is idempotent (safe to run multiple times)

INSERT INTO universities (name, abbreviation, email_domain, website_url, handbook_url, scraper_type, active, created_at, updated_at)
VALUES
  ('University of Technology Sydney', 'UTS', 'student.uts.edu.au', 'https://www.uts.edu.au', 'https://handbook.uts.edu.au', 'courseloop', true, NOW(), NOW()),
  ('University of Sydney', 'USYD', 'uni.sydney.edu.au', 'https://www.sydney.edu.au', 'https://www.sydney.edu.au/units', 'cusp', true, NOW(), NOW()),
  ('University of New South Wales', 'UNSW', 'student.unsw.edu.au', 'https://www.unsw.edu.au', 'https://www.handbook.unsw.edu.au', 'courseloop', true, NOW(), NOW()),
  ('Monash University', 'Monash', 'student.monash.edu', 'https://www.monash.edu', 'https://handbook.monash.edu', 'courseloop', true, NOW(), NOW()),
  ('University of Melbourne', 'UniMelb', 'student.unimelb.edu.au', 'https://www.unimelb.edu.au', 'https://handbook.unimelb.edu.au', 'courseloop', true, NOW(), NOW()),
  ('Australian National University', 'ANU', 'anu.edu.au', 'https://www.anu.edu.au', 'https://programsandcourses.anu.edu.au', 'custom', true, NOW(), NOW()),
  ('University of Queensland', 'UQ', 'student.uq.edu.au', 'https://www.uq.edu.au', 'https://my.uq.edu.au/programs-courses', 'custom', true, NOW(), NOW()),
  ('University of Adelaide', 'Adelaide', 'student.adelaide.edu.au', 'https://www.adelaide.edu.au', 'https://www.adelaide.edu.au/course-outlines', 'custom', true, NOW(), NOW())
ON CONFLICT (abbreviation) DO UPDATE SET
  name = EXCLUDED.name,
  email_domain = EXCLUDED.email_domain,
  website_url = EXCLUDED.website_url,
  handbook_url = EXCLUDED.handbook_url,
  scraper_type = EXCLUDED.scraper_type,
  updated_at = NOW();
