/*
  # Fix multiple active evaluations per course

  1. Changes
    - Deactivate duplicate active evaluations, keeping only the most recent one per course
    - Add a unique partial index to prevent future duplicates
  
  2. Implementation
    - For each course with multiple active evaluations, keep only the newest one
    - Add constraint to enforce one active evaluation per course
*/

-- Deactivate all active evaluations except the most recent one for each course
WITH ranked_evaluations AS (
  SELECT 
    id,
    course_id,
    ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY created_at DESC) as rn
  FROM evaluations
  WHERE is_active = true
)
UPDATE evaluations
SET is_active = false
WHERE id IN (
  SELECT id 
  FROM ranked_evaluations 
  WHERE rn > 1
);

-- Create a unique partial index to ensure only one active evaluation per course
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_evaluation_per_course 
  ON evaluations (course_id) 
  WHERE is_active = true;
