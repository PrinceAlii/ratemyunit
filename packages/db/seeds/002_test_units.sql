-- Seed test units for development/testing
-- Only runs if no units exist (safe for production)

DO $$
DECLARE
  uts_id UUID;
  unit_count INTEGER;
BEGIN
  -- Check if units already exist
  SELECT COUNT(*) INTO unit_count FROM units;

  -- Only seed if no units exist
  IF unit_count = 0 THEN
    -- Get UTS university ID
    SELECT id INTO uts_id FROM universities WHERE abbreviation = 'UTS' LIMIT 1;

    IF uts_id IS NOT NULL THEN
      INSERT INTO units (university_id, unit_code, unit_name, description, credit_points, faculty, active, scraped_at, created_at, updated_at)
      VALUES
        (uts_id, '31251', 'Data Structures and Algorithms', 'This subject introduces the fundamental data structures and algorithms used in software engineering and computer science. Topics include arrays, linked lists, stacks, queues, trees, graphs, sorting, and searching algorithms.', 6, 'Faculty of Engineering and IT', true, NOW(), NOW(), NOW()),
        (uts_id, '48023', 'Programming Fundamentals', 'Introduction to programming using Python. Covers basic programming concepts, data types, control structures, functions, and problem solving. Suitable for beginners with no prior programming experience.', 6, 'Faculty of Engineering and IT', true, NOW(), NOW(), NOW()),
        (uts_id, '48024', 'Applications Programming', 'Develops advanced programming skills through practical application development. Focus on object-oriented design, software patterns, and best practices. Builds on Programming Fundamentals.', 6, 'Faculty of Engineering and IT', true, NOW(), NOW(), NOW()),
        (uts_id, '32998', 'Cryptography', 'Introduction to modern cryptographic techniques and their applications in computer security. Covers symmetric and asymmetric encryption, hash functions, digital signatures, and cryptographic protocols.', 6, 'Faculty of Engineering and IT', true, NOW(), NOW(), NOW()),
        (uts_id, '41092', 'Network Fundamentals', 'Introduction to computer networking, network protocols, and network architectures. Covers OSI and TCP/IP models, routing, switching, and network security fundamentals.', 6, 'Faculty of Engineering and IT', true, NOW(), NOW(), NOW()),
        (uts_id, '31250', 'Introduction to Data Analytics', 'Introduces the fundamental concepts and techniques of data analytics. Covers data collection, cleaning, visualization, and basic statistical analysis using modern tools.', 6, 'Faculty of Engineering and IT', true, NOW(), NOW(), NOW()),
        (uts_id, '48430', 'Fundamentals of C Programming', 'Introduction to programming in C. Covers syntax, pointers, memory management, and systems programming concepts. Essential for understanding low-level computing.', 6, 'Faculty of Engineering and IT', true, NOW(), NOW(), NOW()),
        (uts_id, '31242', 'Web Systems', 'Introduction to web development covering HTML, CSS, JavaScript, and modern web frameworks. Includes both frontend and backend development concepts.', 6, 'Faculty of Engineering and IT', true, NOW(), NOW(), NOW())
      ON CONFLICT (university_id, unit_code) DO UPDATE
      SET active = true, updated_at = NOW();

      RAISE NOTICE 'Seeded % test units for UTS', (SELECT COUNT(*) FROM units WHERE university_id = uts_id);
    ELSE
      RAISE NOTICE 'UTS university not found. Skipping unit seeding.';
    END IF;
  ELSE
    RAISE NOTICE 'Units already exist (%). Skipping test unit seeding.', unit_count;
  END IF;
END $$;
