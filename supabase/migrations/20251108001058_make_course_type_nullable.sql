/*
  # Make course_type column nullable
  
  1. Changes
    - Remove NOT NULL constraint from course_type column
    - This column is being replaced by attendance_type but we keep it for backwards compatibility
  
  2. Notes
    - The application now uses attendance_type as the primary field
    - course_type can be populated from attendance_type for legacy compatibility
*/

-- Make course_type nullable
ALTER TABLE attendance_lists 
ALTER COLUMN course_type DROP NOT NULL;
