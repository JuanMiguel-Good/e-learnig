/*
  # Remover restricción UNIQUE de attendance_lists

  1. Problema
    - La restricción UNIQUE(course_id, company_id) impide crear múltiples listas para el mismo curso y empresa
    - Las listas ahora son reportes dinámicos basados en rangos de fechas
    - Debe ser posible crear múltiples listas con diferentes rangos de fechas para el mismo curso-empresa

  2. Solución
    - Remover la restricción UNIQUE(course_id, company_id)
    - Esto permite crear múltiples listas de asistencia para la misma combinación curso-empresa
    - Cada lista será diferenciada por su rango de fechas (date_range_start, date_range_end)

  3. Cambios
    - DROP CONSTRAINT para eliminar la restricción única
    - Las listas serán identificadas por su ID único y rango de fechas

  4. Notas
    - Esta migración es compatible con datos existentes
    - Las listas existentes no se verán afectadas
    - Ahora se pueden crear múltiples reportes del mismo curso para diferentes períodos
*/

-- Remover la restricción UNIQUE que limita una lista por curso-empresa
ALTER TABLE attendance_lists
DROP CONSTRAINT IF EXISTS attendance_lists_course_id_company_id_key;

-- Comentario explicativo
COMMENT ON TABLE attendance_lists IS 'Listas de asistencia como reportes dinámicos. Múltiples listas pueden existir para el mismo curso y empresa con diferentes rangos de fechas.';