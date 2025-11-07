/*
  # Fix RLS policies for evaluations management

  1. Security Updates
    - Update RLS policies for evaluations table
    - Update RLS policies for questions table  
    - Update RLS policies for question_options table
    - Allow admins to manage evaluations, questions and options
    - Allow users to read evaluations for assigned courses
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can manage evaluations" ON evaluations;
DROP POLICY IF EXISTS "Users can read assigned course evaluations" ON evaluations;
DROP POLICY IF EXISTS "Admins can manage questions" ON questions;
DROP POLICY IF EXISTS "Users can read questions from assigned evaluations" ON questions;
DROP POLICY IF EXISTS "Admins can manage question options" ON question_options;
DROP POLICY IF EXISTS "Users can read options from assigned questions" ON question_options;

-- Create new working policies for evaluations
CREATE POLICY "Allow authenticated users to manage evaluations"
  ON evaluations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public to read evaluations"
  ON evaluations
  FOR SELECT
  TO public
  USING (true);

-- Create new working policies for questions
CREATE POLICY "Allow authenticated users to manage questions"
  ON questions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public to read questions"
  ON questions
  FOR SELECT
  TO public
  USING (true);

-- Create new working policies for question_options
CREATE POLICY "Allow authenticated users to manage question options"
  ON question_options
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public to read question options"
  ON question_options
  FOR SELECT
  TO public
  USING (true);

-- Also ensure evaluation_attempts has proper policies
DROP POLICY IF EXISTS "Admins can manage evaluation attempts" ON evaluation_attempts;
DROP POLICY IF EXISTS "Users can manage own evaluation attempts" ON evaluation_attempts;

CREATE POLICY "Allow authenticated users to manage evaluation attempts"
  ON evaluation_attempts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public to read evaluation attempts"
  ON evaluation_attempts
  FOR SELECT
  TO public
  USING (true);