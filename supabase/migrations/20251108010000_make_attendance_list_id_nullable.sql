/*
  # Hacer attendance_list_id nullable en attendance_signatures

  1. Changes
    - Hacer attendance_list_id nullable para permitir firmas antes de crear listas
    - Las firmas se pueden crear después de aprobar evaluación
    - Luego se vinculan a la lista cuando el admin la crea

  2. Notes
    - Mantener la restricción única pero solo cuando ambos campos no son NULL
    - Permitir múltiples firmas con attendance_list_id NULL para el mismo usuario
*/

-- Drop the existing UNIQUE constraint
ALTER TABLE attendance_signatures
DROP CONSTRAINT IF EXISTS attendance_signatures_attendance_list_id_user_id_key;

-- Make attendance_list_id nullable
ALTER TABLE attendance_signatures
ALTER COLUMN attendance_list_id DROP NOT NULL;

-- Add a new partial unique constraint (only when attendance_list_id is NOT NULL)
CREATE UNIQUE INDEX IF NOT EXISTS attendance_signatures_list_user_unique
ON attendance_signatures(attendance_list_id, user_id)
WHERE attendance_list_id IS NOT NULL;
