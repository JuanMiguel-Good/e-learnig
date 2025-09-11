/*
  # Fix RLS policies for course access and certificate generation

  1. Course Access Tables
    - Update policies for `course_assignments`, `courses`, `modules`, `lessons`
    - Allow authenticated users to read course data they're assigned to
    
  2. Certificate Generation
    - Fix certificate table policies to allow proper insert/update operations
    - Ensure authenticated users can create certificates for completed courses

  3. Progress Tracking
    - Ensure lesson_progress table allows proper read/write access
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow users to read their assignments" ON course_assignments;
DROP POLICY IF EXISTS "Allow authenticated users to read courses" ON courses;
DROP POLICY IF EXISTS "Allow authenticated users to read modules" ON modules;
DROP POLICY IF EXISTS "Allow authenticated users to read lessons" ON lessons;
DROP POLICY IF EXISTS "Allow users to create their own certificates" ON certificates;
DROP POLICY IF EXISTS "Allow users to read their own certificates" ON certificates;
DROP POLICY IF EXISTS "Allow users to update their own certificates" ON certificates;
DROP POLICY IF EXISTS "Allow users to manage their progress" ON lesson_progress;

-- Course Assignments: Users can read their own assignments
CREATE POLICY "Users can read own assignments"
  ON course_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Courses: Authenticated users can read courses they're assigned to
CREATE POLICY "Users can read assigned courses"
  ON courses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_assignments 
      WHERE course_assignments.course_id = courses.id 
      AND course_assignments.user_id = auth.uid()
    )
  );

-- Modules: Users can read modules for courses they're assigned to
CREATE POLICY "Users can read modules for assigned courses"
  ON modules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_assignments 
      WHERE course_assignments.course_id = modules.course_id 
      AND course_assignments.user_id = auth.uid()
    )
  );

-- Lessons: Users can read lessons for courses they're assigned to
CREATE POLICY "Users can read lessons for assigned courses"
  ON lessons
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_assignments 
      JOIN modules ON modules.course_id = course_assignments.course_id
      WHERE modules.id = lessons.module_id 
      AND course_assignments.user_id = auth.uid()
    )
  );

-- Lesson Progress: Users can manage their own progress
CREATE POLICY "Users can manage own progress"
  ON lesson_progress
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Certificates: Users can create, read, and update their own certificates
CREATE POLICY "Users can create own certificates"
  ON certificates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own certificates"
  ON certificates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own certificates"
  ON certificates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Instructors: Allow authenticated users to read instructor info (needed for certificates)
CREATE POLICY "Users can read instructor info"
  ON instructors
  FOR SELECT
  TO authenticated
  USING (true);

-- Admin policies remain unchanged (they have separate admin policies)
-- These policies only add access for regular authenticated users