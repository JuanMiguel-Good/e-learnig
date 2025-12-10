/*
  # Agregar course_id a attendance_signatures

  1. Cambios a la tabla attendance_signatures
    - Agregar columna `course_id` (uuid) - Referencia al curso para el cual se firmó
    - Esta columna vincula directamente la firma con un curso específico
    - Permite NULL para mantener compatibilidad con firmas existentes
    - Las firmas de cursos con evaluación tendrán course_id inferido desde evaluation_attempts
    - Las firmas de actividades attendance_only tendrán course_id directo

  2. Migración de Datos Existentes
    - Para firmas con evaluation_attempt_id NOT NULL:
      - Obtener course_id desde evaluations a través de evaluation_attempts
      - Actualizar course_id en attendance_signatures
    - Para firmas con evaluation_attempt_id NULL:
      - Mantener como están (course_id = NULL) por ahora
      - Las nuevas firmas siempre tendrán course_id

  3. Índices
    - Crear índice en course_id para optimizar consultas
    - Mejorar rendimiento al filtrar firmas por curso

  4. Nota Importante
    - NO se agregan constraints que rompan datos existentes
    - Se mantiene compatibilidad hacia atrás
    - Las nuevas firmas desde la app incluirán course_id
*/

-- Agregar columna course_id a attendance_signatures
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance_signatures' AND column_name = 'course_id'
  ) THEN
    ALTER TABLE attendance_signatures
    ADD COLUMN course_id uuid REFERENCES courses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Migrar datos existentes: obtener course_id desde evaluation_attempts
-- Solo para firmas que tienen evaluation_attempt_id
UPDATE attendance_signatures AS sig
SET course_id = eval.course_id
FROM (
  SELECT
    ea.id as attempt_id,
    e.course_id
  FROM evaluation_attempts ea
  INNER JOIN evaluations e ON ea.evaluation_id = e.id
) AS eval
WHERE sig.evaluation_attempt_id = eval.attempt_id
  AND sig.course_id IS NULL;

-- Crear índice en course_id para optimizar consultas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'attendance_signatures'
    AND indexname = 'idx_attendance_signatures_course_id'
  ) THEN
    CREATE INDEX idx_attendance_signatures_course_id
    ON attendance_signatures(course_id);
  END IF;
END $$;

-- Crear índice compuesto para búsquedas por usuario y curso
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'attendance_signatures'
    AND indexname = 'idx_attendance_signatures_user_course'
  ) THEN
    CREATE INDEX idx_attendance_signatures_user_course
    ON attendance_signatures(user_id, course_id);
  END IF;
END $$;
