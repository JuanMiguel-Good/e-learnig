/*
  # Sistema de Seguimiento de Estado de Participantes por Curso

  1. Nuevas Columnas en course_assignments
    - `status` (text) - Estado actual del participante en el curso
    - `started_at` (timestamptz) - Fecha cuando el participante inició el curso
    - `last_activity_at` (timestamptz) - Última vez que hubo actividad en el curso
    - `completed_at` (timestamptz) - Fecha cuando se completó todo el flujo

  2. Estados Posibles
    - not_started: Curso asignado pero no iniciado
    - in_progress: Participante está tomando lecciones
    - lessons_completed: Todas las lecciones completadas
    - evaluation_pending: Lecciones completas, esperando evaluación
    - evaluation_passed: Evaluación aprobada, esperando firma
    - signature_pending: Evaluación aprobada, esperando firma
    - completed: Todo completado, listo para certificado
    - certificate_generated: Certificado ya generado

  3. Índices
    - Índices en status, started_at, last_activity_at para optimizar queries

  4. Función de Inactividad
    - Función para detectar participantes sin actividad por más de 15 días
*/

-- 1. Agregar columnas de seguimiento a course_assignments
DO $$
BEGIN
  -- Agregar status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_assignments' AND column_name = 'status'
  ) THEN
    ALTER TABLE course_assignments
    ADD COLUMN status text DEFAULT 'not_started'
    CHECK (status IN (
      'not_started',
      'in_progress',
      'lessons_completed',
      'evaluation_pending',
      'evaluation_passed',
      'signature_pending',
      'completed',
      'certificate_generated'
    ));
  END IF;

  -- Agregar started_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_assignments' AND column_name = 'started_at'
  ) THEN
    ALTER TABLE course_assignments ADD COLUMN started_at timestamptz;
  END IF;

  -- Agregar last_activity_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_assignments' AND column_name = 'last_activity_at'
  ) THEN
    ALTER TABLE course_assignments ADD COLUMN last_activity_at timestamptz;
  END IF;

  -- Agregar completed_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_assignments' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE course_assignments ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- 2. Crear índices para optimización
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'course_assignments' AND indexname = 'idx_course_assignments_status'
  ) THEN
    CREATE INDEX idx_course_assignments_status ON course_assignments(status);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'course_assignments' AND indexname = 'idx_course_assignments_last_activity'
  ) THEN
    CREATE INDEX idx_course_assignments_last_activity ON course_assignments(last_activity_at);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'course_assignments' AND indexname = 'idx_course_assignments_user_status'
  ) THEN
    CREATE INDEX idx_course_assignments_user_status ON course_assignments(user_id, status);
  END IF;
END $$;

-- 3. Función para calcular el estado actual de un participante en un curso
CREATE OR REPLACE FUNCTION calculate_participant_course_status(
  p_user_id uuid,
  p_course_id uuid
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_lessons integer;
  v_completed_lessons integer;
  v_requires_evaluation boolean;
  v_has_passed_evaluation boolean;
  v_has_signed boolean;
  v_has_certificate boolean;
  v_has_started boolean;
BEGIN
  -- Verificar si ya tiene certificado
  SELECT EXISTS (
    SELECT 1 FROM certificates
    WHERE user_id = p_user_id AND course_id = p_course_id
  ) INTO v_has_certificate;

  IF v_has_certificate THEN
    RETURN 'certificate_generated';
  END IF;

  -- Contar lecciones totales y completadas
  SELECT COUNT(l.id) INTO v_total_lessons
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = p_course_id;

  SELECT COUNT(lp.id) INTO v_completed_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = p_course_id
    AND lp.user_id = p_user_id
    AND lp.completed = true;

  -- Verificar si ha iniciado el curso
  v_has_started := v_completed_lessons > 0;

  IF NOT v_has_started THEN
    RETURN 'not_started';
  END IF;

  -- Verificar si el curso requiere evaluación
  SELECT requires_evaluation INTO v_requires_evaluation
  FROM courses
  WHERE id = p_course_id;

  -- Si todas las lecciones están completadas
  IF v_completed_lessons >= v_total_lessons AND v_total_lessons > 0 THEN
    -- Si no requiere evaluación, está completado
    IF NOT v_requires_evaluation THEN
      RETURN 'completed';
    END IF;

    -- Si requiere evaluación, verificar estado de evaluación
    SELECT EXISTS (
      SELECT 1
      FROM evaluation_attempts ea
      JOIN evaluations e ON e.id = ea.evaluation_id
      WHERE ea.user_id = p_user_id
        AND e.course_id = p_course_id
        AND ea.passed = true
    ) INTO v_has_passed_evaluation;

    IF NOT v_has_passed_evaluation THEN
      RETURN 'evaluation_pending';
    END IF;

    -- Verificar si ha firmado
    SELECT EXISTS (
      SELECT 1
      FROM attendance_signatures ats
      JOIN evaluation_attempts ea ON ea.id = ats.evaluation_attempt_id
      JOIN evaluations e ON e.id = ea.evaluation_id
      WHERE ats.user_id = p_user_id
        AND e.course_id = p_course_id
        AND ea.passed = true
    ) INTO v_has_signed;

    IF NOT v_has_signed THEN
      RETURN 'signature_pending';
    END IF;

    RETURN 'completed';
  END IF;

  -- Si tiene lecciones en progreso
  RETURN 'in_progress';
END;
$$;

-- 4. Función para actualizar el estado de una asignación
CREATE OR REPLACE FUNCTION update_course_assignment_status(
  p_user_id uuid,
  p_course_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_status text;
  v_current_status text;
  v_has_started boolean;
BEGIN
  -- Calcular nuevo estado
  v_new_status := calculate_participant_course_status(p_user_id, p_course_id);

  -- Obtener estado actual
  SELECT status INTO v_current_status
  FROM course_assignments
  WHERE user_id = p_user_id AND course_id = p_course_id;

  -- Verificar si ha iniciado
  v_has_started := v_new_status != 'not_started';

  -- Actualizar asignación
  UPDATE course_assignments
  SET
    status = v_new_status,
    last_activity_at = CASE WHEN v_has_started THEN now() ELSE last_activity_at END,
    started_at = CASE
      WHEN v_current_status = 'not_started' AND v_has_started THEN now()
      ELSE started_at
    END,
    completed_at = CASE
      WHEN v_new_status IN ('completed', 'certificate_generated')
        AND v_current_status NOT IN ('completed', 'certificate_generated')
      THEN now()
      ELSE completed_at
    END
  WHERE user_id = p_user_id AND course_id = p_course_id;
END;
$$;

-- 5. Trigger para actualizar estado cuando se completa una lección
CREATE OR REPLACE FUNCTION trigger_update_assignment_on_lesson_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_course_id uuid;
BEGIN
  -- Obtener course_id de la lección
  SELECT m.course_id INTO v_course_id
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE l.id = NEW.lesson_id;

  -- Actualizar estado de la asignación
  PERFORM update_course_assignment_status(NEW.user_id, v_course_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_lesson_progress_update_assignment ON lesson_progress;
CREATE TRIGGER trigger_lesson_progress_update_assignment
  AFTER INSERT OR UPDATE ON lesson_progress
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_assignment_on_lesson_progress();

-- 6. Trigger para actualizar estado cuando se completa una evaluación
CREATE OR REPLACE FUNCTION trigger_update_assignment_on_evaluation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_course_id uuid;
BEGIN
  -- Obtener course_id de la evaluación
  SELECT e.course_id INTO v_course_id
  FROM evaluations e
  WHERE e.id = NEW.evaluation_id;

  -- Actualizar estado de la asignación
  PERFORM update_course_assignment_status(NEW.user_id, v_course_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_evaluation_update_assignment ON evaluation_attempts;
CREATE TRIGGER trigger_evaluation_update_assignment
  AFTER INSERT OR UPDATE ON evaluation_attempts
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_assignment_on_evaluation();

-- 7. Trigger para actualizar estado cuando se firma asistencia
CREATE OR REPLACE FUNCTION trigger_update_assignment_on_signature()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_course_id uuid;
BEGIN
  -- Obtener course_id de la evaluación asociada
  SELECT e.course_id INTO v_course_id
  FROM evaluation_attempts ea
  JOIN evaluations e ON e.id = ea.evaluation_id
  WHERE ea.id = NEW.evaluation_attempt_id;

  -- Si no hay evaluation_attempt_id, buscar por attendance_list_id
  IF v_course_id IS NULL AND NEW.attendance_list_id IS NOT NULL THEN
    SELECT atl.course_id INTO v_course_id
    FROM attendance_lists atl
    WHERE atl.id = NEW.attendance_list_id;
  END IF;

  -- Actualizar estado de la asignación si encontramos el curso
  IF v_course_id IS NOT NULL THEN
    PERFORM update_course_assignment_status(NEW.user_id, v_course_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_signature_update_assignment ON attendance_signatures;
CREATE TRIGGER trigger_signature_update_assignment
  AFTER INSERT OR UPDATE ON attendance_signatures
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_assignment_on_signature();

-- 8. Trigger para actualizar estado cuando se genera certificado
CREATE OR REPLACE FUNCTION trigger_update_assignment_on_certificate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Actualizar estado de la asignación
  PERFORM update_course_assignment_status(NEW.user_id, NEW.course_id);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_certificate_update_assignment ON certificates;
CREATE TRIGGER trigger_certificate_update_assignment
  AFTER INSERT ON certificates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_assignment_on_certificate();

-- 9. Función para obtener participantes inactivos
CREATE OR REPLACE FUNCTION get_inactive_participants(days_threshold integer DEFAULT 15)
RETURNS TABLE (
  user_id uuid,
  course_id uuid,
  user_name text,
  course_title text,
  last_activity_at timestamptz,
  days_inactive integer,
  current_status text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ca.user_id,
    ca.course_id,
    CONCAT(u.first_name, ' ', u.last_name) as user_name,
    c.title as course_title,
    ca.last_activity_at,
    EXTRACT(DAY FROM (now() - ca.last_activity_at))::integer as days_inactive,
    ca.status as current_status
  FROM course_assignments ca
  JOIN users u ON u.id = ca.user_id
  JOIN courses c ON c.id = ca.course_id
  WHERE ca.status NOT IN ('completed', 'certificate_generated')
    AND ca.last_activity_at IS NOT NULL
    AND ca.last_activity_at < (now() - INTERVAL '1 day' * days_threshold)
  ORDER BY ca.last_activity_at ASC;
$$;

-- 10. Inicializar estados existentes
DO $$
DECLARE
  assignment_record RECORD;
BEGIN
  FOR assignment_record IN
    SELECT user_id, course_id FROM course_assignments
  LOOP
    PERFORM update_course_assignment_status(
      assignment_record.user_id,
      assignment_record.course_id
    );
  END LOOP;
END $$;
