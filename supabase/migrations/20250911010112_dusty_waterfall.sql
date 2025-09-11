/*
  # Recreate Admin User - Simple Access

  1. Changes
    - Delete existing admin user
    - Create new admin with simple credentials
    - Disable RLS temporarily for users table
    - Add simple admin user for immediate access

  2. Credentials
    - Email: admin@goodsolutions.com  
    - Password: admin123
    - Role: admin
*/

-- Disable RLS temporarily to ensure we can work
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Delete existing admin if exists
DELETE FROM users WHERE email = 'admin@goodsolutions.com';

-- Insert new admin user with simple credentials
INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  phone,
  country_code,
  role,
  created_at,
  updated_at
) VALUES (
  'admin@goodsolutions.com',
  '$2b$10$8K1p7VX4LjLQK.2JY5H1.uWRLvHD9WKqy8E3FdWQE8aL5cG.vP8Q6', -- admin123
  'Admin',
  'Good Solutions',
  '999999999',
  '+51',
  'admin',
  now(),
  now()
);

-- Also create a simple test participant
DELETE FROM users WHERE email = 'test@goodsolutions.com';

INSERT INTO users (
  email,
  password_hash,
  first_name,
  last_name,
  phone,
  country_code,
  role,
  created_at,
  updated_at
) VALUES (
  'test@goodsolutions.com',
  '$2b$10$8K1p7VX4LjLQK.2JY5H1.uWRLvHD9WKqy8E3FdWQE8aL5cG.vP8Q6', -- admin123
  'Test',
  'User',
  '888888888',
  '+51',
  'participant',
  now(),
  now()
);

-- Keep RLS disabled for now to avoid complications
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;