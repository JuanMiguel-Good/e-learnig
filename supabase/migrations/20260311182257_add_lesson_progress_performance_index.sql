/*
  # Add Performance Index for Lesson Progress

  1. Performance Optimization
    - Add composite index on lesson_progress(user_id, completed) 
    - This dramatically speeds up queries filtering by user and completion status
    - Reduces query time from O(n) to O(log n) for progress lookups
  
  2. Impact
    - Faster loading times for participant dashboard
    - Better performance as user base grows
    - Minimal storage overhead
*/

-- Create index for fast lesson progress lookups
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_completed 
ON lesson_progress(user_id, completed) 
WHERE completed = true;