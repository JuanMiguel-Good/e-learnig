/*
  # Fix Policies for Evaluations Table
  
  Since the application uses custom authentication (not Supabase Auth),
  we need to remove authentication requirements from the evaluations table.
  
  1. Changes
    - Drop existing policies that require authentication
    - Create new policy allowing all operations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read evaluations" ON evaluations;
DROP POLICY IF EXISTS "Authenticated users can insert evaluations" ON evaluations;
DROP POLICY IF EXISTS "Authenticated users can update evaluations" ON evaluations;
DROP POLICY IF EXISTS "Authenticated users can delete evaluations" ON evaluations;
DROP POLICY IF EXISTS "Admins can manage evaluations" ON evaluations;
DROP POLICY IF EXISTS "Users can read evaluations" ON evaluations;

-- Create new policy allowing all operations
CREATE POLICY "Allow all operations on evaluations"
  ON evaluations
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
