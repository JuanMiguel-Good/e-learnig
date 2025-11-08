/*
  # Vincular intentos de evaluación con firmas de asistencia
  
  1. Changes to attendance_signatures table
    - Add `evaluation_attempt_id` (uuid) - Referencia al intento de evaluación aprobado
    - Este campo vincula la firma con la evaluación aprobada
  
  2. Notes
    - Las firmas ahora pueden estar relacionadas con evaluaciones aprobadas
    - La fecha `signed_at` será la fecha en que firmaron después de aprobar
    - Solo aparecerán en la lista de asistencia los que aprobaron y firmaron
*/

-- Add evaluation_attempt_id to attendance_signatures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_signatures' AND column_name = 'evaluation_attempt_id'
  ) THEN
    ALTER TABLE attendance_signatures 
    ADD COLUMN evaluation_attempt_id uuid REFERENCES evaluation_attempts(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create index for faster queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'attendance_signatures' 
    AND indexname = 'idx_attendance_signatures_evaluation_attempt'
  ) THEN
    CREATE INDEX idx_attendance_signatures_evaluation_attempt 
    ON attendance_signatures(evaluation_attempt_id);
  END IF;
END $$;
