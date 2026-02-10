-- Add domain_verified column to users table
ALTER TABLE users
ADD COLUMN domain_verified BOOLEAN NOT NULL DEFAULT false;

-- Create index for efficient querying
CREATE INDEX users_domain_verified_idx ON users(domain_verified);

-- Update existing users: set domain_verified to true if their email matches their university's domain
UPDATE users u
SET domain_verified = true
FROM universities uni
WHERE u.university_id = uni.id
AND u.email LIKE '%@' || uni.email_domain;
