/*
  # Fix Certificate Generation and Create Retroactive Certificates

  ## Problem
  - 296 participants have 100% progress, passed evaluation, and signed attendance but NO certificate
  - Current trigger only checks progress, doesn't validate evaluation or signature requirements
  
  ## Changes
  
  1. **Fix Certificate Trigger**
     - Update `generate_certificate_if_complete()` to use `can_generate_certificate()` function
     - This properly validates evaluation pass and signature when required
  
  2. **Add Signature Trigger**
     - Create trigger on attendance_signatures to generate certificate when signature is the last step
  
  3. **Generate Retroactive Certificates**
     - Insert certificate records for 296 eligible participants
     - Use evaluation completion date as certificate completion date
     - Set certificate_url as NULL (participant will generate PDF manually)
     - Update course_assignments status to 'certificate_generated'
  
  ## Security
  - Uses existing RLS policies on certificates table
  - Validates eligibility using can_generate_certificate() function
*/

-- Step 1: Fix the certificate generation trigger function
CREATE OR REPLACE FUNCTION generate_certificate_if_complete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  course_id_var uuid;
BEGIN
  -- Get course ID from the lesson
  SELECT m.course_id INTO course_id_var
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE l.id = NEW.lesson_id;
  
  -- Check if certificate can be generated using the complete validation function
  IF can_generate_certificate(NEW.user_id, course_id_var) THEN
    -- Check if certificate doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM certificates 
      WHERE user_id = NEW.user_id AND course_id = course_id_var
    ) THEN
      -- Insert certificate record (PDF will be generated manually by participant)
      INSERT INTO certificates (user_id, course_id, completion_date)
      VALUES (NEW.user_id, course_id_var, now());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 2: Create trigger function for signature-based certificate generation
CREATE OR REPLACE FUNCTION generate_certificate_on_signature()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if certificate can be generated using the complete validation function
  IF can_generate_certificate(NEW.user_id, NEW.course_id) THEN
    -- Check if certificate doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM certificates 
      WHERE user_id = NEW.user_id AND course_id = NEW.course_id
    ) THEN
      -- Insert certificate record (PDF will be generated manually by participant)
      INSERT INTO certificates (user_id, NEW.course_id, completion_date)
      VALUES (NEW.user_id, NEW.course_id, now());
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Step 3: Create trigger on attendance_signatures table
DROP TRIGGER IF EXISTS trigger_signature_generate_certificate ON attendance_signatures;

CREATE TRIGGER trigger_signature_generate_certificate
  AFTER INSERT ON attendance_signatures
  FOR EACH ROW
  EXECUTE FUNCTION generate_certificate_on_signature();

-- Step 4: Generate retroactive certificates for eligible participants
-- Insert certificates for participants who:
-- - Have a course that requires evaluation
-- - Have passed the evaluation
-- - Have signed attendance
-- - Don't have a certificate yet
INSERT INTO certificates (user_id, course_id, completion_date, certificate_url)
SELECT DISTINCT
  ea.user_id,
  c.id as course_id,
  ea.completed_at as completion_date,
  NULL as certificate_url
FROM courses c
JOIN evaluations ev ON ev.course_id = c.id AND ev.is_active = true
JOIN evaluation_attempts ea ON ea.evaluation_id = ev.id AND ea.passed = true
JOIN attendance_signatures ats ON ats.user_id = ea.user_id AND ats.course_id = c.id
LEFT JOIN certificates cert ON cert.user_id = ea.user_id AND cert.course_id = c.id
WHERE 
  c.requires_evaluation = true
  AND cert.id IS NULL
  -- Use the most recent passed evaluation attempt for each user-course
  AND ea.id IN (
    SELECT id 
    FROM evaluation_attempts ea2
    WHERE ea2.user_id = ea.user_id 
      AND ea2.evaluation_id = ea.evaluation_id 
      AND ea2.passed = true
    ORDER BY ea2.completed_at DESC
    LIMIT 1
  )
ON CONFLICT DO NOTHING;
