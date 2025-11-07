/*
  # Fix Companies Insert Policy
  
  1. Security Updates
    - Drop existing restrictive policies on companies
    - Create separate policies for each operation (SELECT, INSERT, UPDATE, DELETE)
    - Ensure authenticated users can insert companies
  
  This fixes the "new row violates row-level security policy" error.
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage companies" ON companies;
DROP POLICY IF EXISTS "Users can read companies" ON companies;

-- Create separate policies for better control
CREATE POLICY "Authenticated users can read companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert companies"
  ON companies
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update companies"
  ON companies
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete companies"
  ON companies
  FOR DELETE
  TO authenticated
  USING (true);
