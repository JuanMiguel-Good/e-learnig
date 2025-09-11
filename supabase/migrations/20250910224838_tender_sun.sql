/*
  # Fix lesson_progress RLS policies

  1. Security Changes
    - Drop existing policies for lesson_progress table
    - Create new policies for INSERT and UPDATE operations
    - Allow authenticated users to manage their own lesson progress

  2. Policy Details
    - INSERT policy: Users can create progress records for themselves
    - UPDATE policy: Users can update their own progress records
    - SELECT policy: Users can read their own progress records
*/

-- Drop existing policies for lesson_progress
DROP POLICY IF EXISTS "Users can manage own progress" ON lesson_progress;

-- Create specific policies for lesson_progress
CREATE POLICY "Users can create own progress"
  ON lesson_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON lesson_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own progress"
  ON lesson_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Ensure RLS is enabled on lesson_progress table
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;