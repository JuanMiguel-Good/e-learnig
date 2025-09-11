/*
  # Fix certificates table RLS policies

  1. Security Updates
    - Drop existing restrictive INSERT policy
    - Add proper INSERT policy allowing users to create their own certificates
    - Add UPDATE policy for certificate modifications
    - Ensure policies use proper auth.uid() checks

  2. Policy Details
    - INSERT: Allow authenticated users to create certificates for themselves
    - UPDATE: Allow authenticated users to update their own certificates
    - SELECT: Keep existing policy for reading own certificates
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Allow system to create certificates" ON certificates;

-- Create proper INSERT policy allowing users to create their own certificates
CREATE POLICY "Allow users to create their own certificates"
  ON certificates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create UPDATE policy for certificate modifications
CREATE POLICY "Allow users to update their own certificates"
  ON certificates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update the SELECT policy to be more explicit
DROP POLICY IF EXISTS "Allow users to read their certificates" ON certificates;

CREATE POLICY "Allow users to read their own certificates"
  ON certificates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);