/*
  # Fix All Table Policies for Custom Authentication
  
  Since the application uses custom authentication (localStorage-based),
  not Supabase Auth, we need to update ALL table policies to allow
  public access. The application handles authorization in the frontend.
  
  1. Tables Updated
    - attendance_lists
    - attendance_signatures
    - certificates
    - course_assignments
    - courses
    - evaluation_attempts
    - instructors
    - lesson_progress
    - lessons
    - modules
    - question_options
    - questions
    - users
*/

-- attendance_lists
DROP POLICY IF EXISTS "Users can read attendance lists for assigned courses" ON attendance_lists;
DROP POLICY IF EXISTS "Admins can manage attendance lists" ON attendance_lists;
CREATE POLICY "Allow all operations on attendance_lists" ON attendance_lists FOR ALL TO public USING (true) WITH CHECK (true);

-- attendance_signatures
DROP POLICY IF EXISTS "Users can manage own attendance signatures" ON attendance_signatures;
DROP POLICY IF EXISTS "Admins can manage attendance signatures" ON attendance_signatures;
CREATE POLICY "Allow all operations on attendance_signatures" ON attendance_signatures FOR ALL TO public USING (true) WITH CHECK (true);

-- certificates (no policies, but ensure access)
CREATE POLICY "Allow all operations on certificates" ON certificates FOR ALL TO public USING (true) WITH CHECK (true);

-- course_assignments
DROP POLICY IF EXISTS "Allow admins to manage assignments" ON course_assignments;
DROP POLICY IF EXISTS "Users can read own assignments" ON course_assignments;
CREATE POLICY "Allow all operations on course_assignments" ON course_assignments FOR ALL TO public USING (true) WITH CHECK (true);

-- courses
DROP POLICY IF EXISTS "Users can read assigned courses" ON courses;
DROP POLICY IF EXISTS "Allow admins to manage courses" ON courses;
CREATE POLICY "Allow all operations on courses" ON courses FOR ALL TO public USING (true) WITH CHECK (true);

-- evaluation_attempts
DROP POLICY IF EXISTS "Admins can manage evaluation attempts" ON evaluation_attempts;
DROP POLICY IF EXISTS "Users can manage own evaluation attempts" ON evaluation_attempts;
CREATE POLICY "Allow all operations on evaluation_attempts" ON evaluation_attempts FOR ALL TO public USING (true) WITH CHECK (true);

-- evaluations (already has one public policy, remove the old one)
DROP POLICY IF EXISTS "Users can read assigned course evaluations" ON evaluations;

-- instructors
DROP POLICY IF EXISTS "Allow authenticated users to read instructors" ON instructors;
DROP POLICY IF EXISTS "Users can read instructor info" ON instructors;
DROP POLICY IF EXISTS "Allow admins to manage instructors" ON instructors;
CREATE POLICY "Allow all operations on instructors" ON instructors FOR ALL TO public USING (true) WITH CHECK (true);

-- lesson_progress (no policies, add one)
CREATE POLICY "Allow all operations on lesson_progress" ON lesson_progress FOR ALL TO public USING (true) WITH CHECK (true);

-- lessons
DROP POLICY IF EXISTS "Users can read lessons for assigned courses" ON lessons;
DROP POLICY IF EXISTS "Allow admins to manage lessons" ON lessons;
CREATE POLICY "Allow all operations on lessons" ON lessons FOR ALL TO public USING (true) WITH CHECK (true);

-- modules
DROP POLICY IF EXISTS "Allow admins to manage modules" ON modules;
DROP POLICY IF EXISTS "Users can read modules for assigned courses" ON modules;
CREATE POLICY "Allow all operations on modules" ON modules FOR ALL TO public USING (true) WITH CHECK (true);

-- question_options
DROP POLICY IF EXISTS "Admins can manage question options" ON question_options;
DROP POLICY IF EXISTS "Users can read options from assigned questions" ON question_options;
CREATE POLICY "Allow all operations on question_options" ON question_options FOR ALL TO public USING (true) WITH CHECK (true);

-- questions
DROP POLICY IF EXISTS "Admins can manage questions" ON questions;
DROP POLICY IF EXISTS "Users can read questions from assigned evaluations" ON questions;
CREATE POLICY "Allow all operations on questions" ON questions FOR ALL TO public USING (true) WITH CHECK (true);

-- users
DROP POLICY IF EXISTS "Service role can manage users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can read own profile" ON users;
CREATE POLICY "Allow all operations on users" ON users FOR ALL TO public USING (true) WITH CHECK (true);
