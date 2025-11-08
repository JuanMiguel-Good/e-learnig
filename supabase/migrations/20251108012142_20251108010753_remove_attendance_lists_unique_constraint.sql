/*
  # Eliminar restricción única de attendance_lists

  1. Changes
    - Eliminar la restricción UNIQUE(course_id, company_id) de attendance_lists
    - Esto permite crear múltiples listas de asistencia para el mismo curso y empresa
    - Útil para cuando se dicta el mismo curso varias veces a la misma empresa

  2. Notes
    - Se pueden crear listas de asistencia ilimitadas para cualquier combinación de curso y empresa
    - Cada lista es independiente y puede tener diferentes fechas y participantes
*/

-- Drop the existing UNIQUE constraint
ALTER TABLE attendance_lists
DROP CONSTRAINT IF EXISTS attendance_lists_course_id_company_id_key;
