/*
  # Fix attendance_lists course_type check constraint

  ## Problem
  The `course_type` column has an old CHECK constraint that only allows 4 values:
  INDUCCIÓN, CAPACITACIÓN, ENTRENAMIENTO, SIMULACRO DE EMERGENCIA.

  The frontend now supports 8 values (CHARLA 5 MINUTOS, REUNIÓN, CARGO, OTRO were added),
  causing a constraint violation when users select the newer types.

  ## Changes
  - Drop the old `attendance_lists_course_type_check` constraint
  - Add a new constraint allowing all 8 valid course types
*/

ALTER TABLE attendance_lists
  DROP CONSTRAINT IF EXISTS attendance_lists_course_type_check;

ALTER TABLE attendance_lists
  ADD CONSTRAINT attendance_lists_course_type_check
  CHECK (course_type IN (
    'INDUCCIÓN',
    'CAPACITACIÓN',
    'ENTRENAMIENTO',
    'SIMULACRO DE EMERGENCIA',
    'CHARLA 5 MINUTOS',
    'REUNIÓN',
    'CARGO',
    'OTRO'
  ));
