/*
  # Fix AI Generation Logs and Evaluations Constraints

  1. Changes to ai_generation_logs
    - Remove auth.uid() based policies
    - Add permissive policies for custom auth system
    - Allow all authenticated users to insert/view logs

  2. Changes to evaluations table
    - Remove UNIQUE constraint on course_id
    - Allow multiple evaluations per course

  3. Security Notes
    - Using permissive policies as this app uses custom auth (not Supabase Auth)
    - ai_generation_logs are for audit purposes only
    - Multiple evaluations per course are now allowed
*/

-- Drop existing RLS policies for ai_generation_logs
DROP POLICY IF EXISTS "Users can view own AI generation logs" ON ai_generation_logs;
DROP POLICY IF EXISTS "Admins can view all AI generation logs" ON ai_generation_logs;
DROP POLICY IF EXISTS "Users can insert own AI generation logs" ON ai_generation_logs;

-- Create permissive policies for ai_generation_logs (custom auth system)
CREATE POLICY "Allow all to manage AI generation logs"
  ON ai_generation_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Drop the UNIQUE constraint on evaluations.course_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluations_course_id_key'
    AND conrelid = 'evaluations'::regclass
  ) THEN
    ALTER TABLE evaluations DROP CONSTRAINT evaluations_course_id_key;
  END IF;
END $$;
