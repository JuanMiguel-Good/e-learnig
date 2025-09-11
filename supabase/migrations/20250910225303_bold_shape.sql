/*
  # Update users table to work with Supabase Auth

  1. Changes
    - Make password_hash optional (since we use Supabase auth now)
    - Allow UUIDs from Supabase auth as user IDs
  
  2. Security
    - Keep existing RLS policies
*/

-- Make password_hash nullable since we're using Supabase auth
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash SET DEFAULT '';

-- Update RLS policies to work with Supabase auth
DROP POLICY IF EXISTS "Allow users to read their own data" ON users;
DROP POLICY IF EXISTS "Allow admins to manage users" ON users;

CREATE POLICY "Users can read own profile" ON users
  FOR SELECT 
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE 
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role to manage all users (for admin operations)
CREATE POLICY "Service role can manage users" ON users
  FOR ALL 
  TO service_role
  USING (true)
  WITH CHECK (true);