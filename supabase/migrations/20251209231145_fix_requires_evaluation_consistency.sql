/*
  # Fix requires_evaluation consistency

  1. Updates
    - Set `requires_evaluation = true` for all courses with `activity_type = 'topic'`
    - Set `requires_evaluation = false` for all courses with `activity_type = 'attendance_only'`

  2. Purpose
    - Ensures data consistency: topics always require evaluation, attendance_only never does
    - Fixes any existing courses that may have been created with inconsistent values
*/

-- Update topic courses to require evaluation
UPDATE courses
SET requires_evaluation = true
WHERE activity_type = 'topic'
AND requires_evaluation = false;

-- Update attendance_only courses to NOT require evaluation
UPDATE courses
SET requires_evaluation = false
WHERE activity_type = 'attendance_only'
AND requires_evaluation = true;
