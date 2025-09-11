/*
  # Fix lesson_progress RLS policies

  1. Security
    - Fix uid() function to auth.uid() in existing policies
    - Ensure proper RLS policies for lesson progress operations
*/

-- Drop existing policies to recreate them with correct function
DROP POLICY IF EXISTS "Users can create own progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can read own progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON lesson_progress;

-- Create corrected policies using auth.uid()
CREATE POLICY "Users can create own progress"
  ON lesson_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own progress"
  ON lesson_progress
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON lesson_progress
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);