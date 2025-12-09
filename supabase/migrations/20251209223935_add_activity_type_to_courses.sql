/*
  # Add activity_type field to courses table

  1. Changes
    - Add `activity_type` column to `courses` table with three values:
      - 'full_course': Traditional course with modules and lessons
      - 'topic': Direct evaluation without lessons
      - 'attendance_only': Only attendance signature, no evaluation or certificate
    - Set default value to 'full_course' for existing courses
    - Add check constraint to ensure valid values

  2. Notes
    - Existing courses will be marked as 'full_course' by default
    - This field determines the workflow for each course/activity
    - Modules/lessons are only required for 'full_course' type
    - Evaluations are only available for 'full_course' and 'topic' types
    - Certificates are never generated for 'attendance_only' type
*/

-- Add activity_type column to courses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'activity_type'
  ) THEN
    ALTER TABLE courses ADD COLUMN activity_type text NOT NULL DEFAULT 'full_course';
    
    -- Add check constraint for valid activity types
    ALTER TABLE courses ADD CONSTRAINT courses_activity_type_check 
      CHECK (activity_type IN ('full_course', 'topic', 'attendance_only'));
  END IF;
END $$;

-- Update the calculate_participant_course_status function to handle different activity types
CREATE OR REPLACE FUNCTION calculate_participant_course_status(
  p_user_id uuid,
  p_course_id uuid
)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_activity_type text;
  v_total_lessons integer;
  v_completed_lessons integer;
  v_requires_evaluation boolean;
  v_has_passed_evaluation boolean;
  v_has_certificate boolean;
  v_has_started boolean;
  v_has_signature boolean;
BEGIN
  -- Get activity type
  SELECT activity_type INTO v_activity_type
  FROM courses
  WHERE id = p_course_id;

  -- For attendance_only type, check if signature exists
  IF v_activity_type = 'attendance_only' THEN
    SELECT EXISTS (
      SELECT 1 FROM attendance_signatures
      WHERE user_id = p_user_id 
        AND attendance_list_id IN (
          SELECT id FROM attendance_lists WHERE course_id = p_course_id
        )
    ) INTO v_has_signature;
    
    IF v_has_signature THEN
      RETURN 'completed';
    ELSE
      RETURN 'not_started';
    END IF;
  END IF;

  -- For topic type, check evaluation directly
  IF v_activity_type = 'topic' THEN
    -- Check if has certificate
    SELECT EXISTS (
      SELECT 1 FROM certificates
      WHERE user_id = p_user_id AND course_id = p_course_id
    ) INTO v_has_certificate;

    IF v_has_certificate THEN
      RETURN 'certificate_generated';
    END IF;

    -- Check if passed evaluation
    SELECT EXISTS (
      SELECT 1
      FROM evaluation_attempts ea
      JOIN evaluations e ON e.id = ea.evaluation_id
      WHERE ea.user_id = p_user_id
        AND e.course_id = p_course_id
        AND ea.passed = true
    ) INTO v_has_passed_evaluation;

    IF v_has_passed_evaluation THEN
      -- Check if has signature
      SELECT EXISTS (
        SELECT 1 FROM attendance_signatures asig
        JOIN evaluation_attempts ea ON ea.id = asig.evaluation_attempt_id
        JOIN evaluations e ON e.id = ea.evaluation_id
        WHERE asig.user_id = p_user_id
          AND e.course_id = p_course_id
      ) INTO v_has_signature;
      
      IF v_has_signature THEN
        RETURN 'completed';
      ELSE
        RETURN 'evaluation_passed';
      END IF;
    END IF;

    -- Check if has attempted evaluation
    SELECT EXISTS (
      SELECT 1
      FROM evaluation_attempts ea
      JOIN evaluations e ON e.id = ea.evaluation_id
      WHERE ea.user_id = p_user_id
        AND e.course_id = p_course_id
    ) INTO v_has_started;

    IF v_has_started THEN
      RETURN 'in_progress';
    ELSE
      RETURN 'not_started';
    END IF;
  END IF;

  -- For full_course type, use original logic
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

-- Refresh all course assignment statuses with new logic
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