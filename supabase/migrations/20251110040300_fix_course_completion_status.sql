/*
  # Corregir lógica de estado completado

  1. Cambios en la función de cálculo de estado
    - Un curso se considera completado cuando:
      - Si requiere evaluación: el participante ha aprobado la evaluación
      - Si NO requiere evaluación: el participante ha completado todas las lecciones
    - La firma de asistencia ya no es requerida para considerar un curso como completado
*/

-- Actualizar la función para calcular el estado actual de un participante en un curso
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

    IF v_has_passed_evaluation THEN
      RETURN 'completed';
    ELSE
      RETURN 'evaluation_pending';
    END IF;
  END IF;

  -- Si el curso requiere evaluación y las lecciones están completas pero la evaluación está pendiente
  IF v_requires_evaluation AND v_completed_lessons >= v_total_lessons AND v_total_lessons > 0 THEN
    RETURN 'evaluation_pending';
  END IF;

  -- Si tiene lecciones en progreso
  RETURN 'in_progress';
END;
$$;

-- Actualizar todos los estados existentes con la nueva lógica
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
