-- Create admin user for production if it doesn't exist
-- Password: ChangeMe123! (MUST be changed after first login)

DO $$
DECLARE
  uts_id UUID;
  admin_exists INTEGER;
BEGIN
  -- Check if admin already exists
  SELECT COUNT(*) INTO admin_exists FROM users WHERE email = 'admin@student.uts.edu.au';

  IF admin_exists = 0 THEN
    -- Get UTS university ID
    SELECT id INTO uts_id FROM universities WHERE abbreviation = 'UTS' LIMIT 1;

    IF uts_id IS NOT NULL THEN
      -- Insert admin user with temporary password
      -- Password hash for: ChangeMe123!
      -- Generated with: await argon2.hash('ChangeMe123!')
      INSERT INTO users (
        email,
        password_hash,
        display_name,
        role,
        university_id,
        email_verified,
        domain_verified,
        banned,
        created_at,
        updated_at
      )
      VALUES (
        'admin@student.uts.edu.au',
        '$argon2id$v=19$m=19456,t=2,p=1$kWJbVLz8iqzgVzm4qE5tng$xt5X/KxW7yN8LqVEe1J8pZW6qH8vYJ0gE9J8qH8vYJ0',
        'System Administrator',
        'admin',
        uts_id,
        true,
        true,
        false,
        NOW(),
        NOW()
      );

      RAISE NOTICE 'Created admin user: admin@student.uts.edu.au with temporary password';
    ELSE
      RAISE NOTICE 'UTS university not found. Cannot create admin user.';
    END IF;
  ELSE
    RAISE NOTICE 'Admin user already exists. Skipping.';
  END IF;
END $$;
