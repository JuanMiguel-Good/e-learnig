/*
  # Add Missing Columns to attendance_lists Table
  
  1. Changes
    - Add attendance_type column (replaces course_type logic)
    - Add responsible_name column for the person responsible for the record
    - Add responsible_position column for their position/role
    - Add responsible_date column for when they signed
    - Add date_range_start column to filter participants by approval date
    - Add date_range_end column to filter participants by approval date
  
  2. Notes
    - These columns are needed for the attendance list creation form
    - The date range columns help filter which participants to include
*/

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add attendance_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_lists' AND column_name = 'attendance_type'
  ) THEN
    ALTER TABLE attendance_lists ADD COLUMN attendance_type text;
    -- Copy existing course_type values to attendance_type
    UPDATE attendance_lists SET attendance_type = course_type WHERE attendance_type IS NULL;
  END IF;

  -- Add responsible_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_lists' AND column_name = 'responsible_name'
  ) THEN
    ALTER TABLE attendance_lists ADD COLUMN responsible_name text;
  END IF;

  -- Add responsible_position column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_lists' AND column_name = 'responsible_position'
  ) THEN
    ALTER TABLE attendance_lists ADD COLUMN responsible_position text;
  END IF;

  -- Add responsible_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_lists' AND column_name = 'responsible_date'
  ) THEN
    ALTER TABLE attendance_lists ADD COLUMN responsible_date timestamptz;
  END IF;

  -- Add date_range_start column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_lists' AND column_name = 'date_range_start'
  ) THEN
    ALTER TABLE attendance_lists ADD COLUMN date_range_start timestamptz;
  END IF;

  -- Add date_range_end column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'attendance_lists' AND column_name = 'date_range_end'
  ) THEN
    ALTER TABLE attendance_lists ADD COLUMN date_range_end timestamptz;
  END IF;
END $$;
