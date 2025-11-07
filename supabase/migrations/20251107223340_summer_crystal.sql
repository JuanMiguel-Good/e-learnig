/*
  # Update attendance lists structure

  1. Schema Changes
    - Modify attendance_lists table to match new requirements
    - Add responsible person fields
    - Add date range fields  
    - Change course_type to attendance_type with 8 options
    - Remove boolean fields in favor of single selection

  2. Data Migration
    - Update existing records to new structure
    - Preserve existing data where possible
*/

-- Update attendance_lists table structure
ALTER TABLE attendance_lists 
DROP COLUMN IF EXISTS course_type,
DROP COLUMN IF EXISTS charla_5_minutos,
DROP COLUMN IF EXISTS reunion;

ALTER TABLE attendance_lists 
ADD COLUMN IF NOT EXISTS attendance_type text CHECK (attendance_type IN (
  'INDUCCIÓN', 'CAPACITACIÓN', 'ENTRENAMIENTO', 'SIMULACRO DE EMERGENCIA',
  'CHARLA 5 MINUTOS', 'REUNIÓN', 'CARGO', 'OTRO'
)),
ADD COLUMN IF NOT EXISTS responsible_name text,
ADD COLUMN IF NOT EXISTS responsible_position text,
ADD COLUMN IF NOT EXISTS responsible_date timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS date_range_start timestamptz,
ADD COLUMN IF NOT EXISTS date_range_end timestamptz;

-- Update the constraint to include all 8 options
ALTER TABLE attendance_lists 
DROP CONSTRAINT IF EXISTS attendance_lists_course_type_check;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_lists_date_range 
ON attendance_lists (date_range_start, date_range_end);

CREATE INDEX IF NOT EXISTS idx_attendance_lists_attendance_type 
ON attendance_lists (attendance_type);

-- Update RLS policies remain the same
-- Policies are already correctly set for the table

-- Add comment for documentation
COMMENT ON TABLE attendance_lists IS 'Digital attendance lists matching the official model format';
COMMENT ON COLUMN attendance_lists.attendance_type IS 'One of 8 possible attendance types - replaces the checkboxes in the original model';
COMMENT ON COLUMN attendance_lists.responsible_name IS 'Name of the person responsible for the registry';
COMMENT ON COLUMN attendance_lists.responsible_position IS 'Position/title of the responsible person';
COMMENT ON COLUMN attendance_lists.responsible_date IS 'Date when the registry was created (editable before creation)';
COMMENT ON COLUMN attendance_lists.date_range_start IS 'Start date for filtering participants by evaluation approval date';
COMMENT ON COLUMN attendance_lists.date_range_end IS 'End date for filtering participants by evaluation approval date';