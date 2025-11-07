/*
# Sistema de Evaluaciones y Lista de Asistencia

## Nuevas funcionalidades:
1. Empresas con datos completos
2. Sistema de evaluaciones opcionales
3. Lista de asistencia digital con firmas
4. Responsables por empresa
5. Nuevo flujo de certificación

## Tablas creadas:
- `companies` - Datos de empresas
- `company_responsibles` - Responsables por empresa  
- `evaluations` - Evaluaciones por curso
- `questions` - Preguntas de evaluación
- `question_options` - Opciones de respuesta
- `evaluation_attempts` - Intentos de evaluación
- `attendance_lists` - Listas de asistencia
- `attendance_signatures` - Firmas de asistencia

## Modificaciones:
- `users` - Agregar company_id y dni
- `courses` - Agregar requires_evaluation y hours
*/

-- 1. CREAR TABLA DE EMPRESAS
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razon_social text NOT NULL,
  ruc text UNIQUE NOT NULL,
  direccion text NOT NULL,
  distrito text NOT NULL,
  departamento text NOT NULL,
  provincia text NOT NULL,
  actividad_economica text NOT NULL,
  num_trabajadores integer NOT NULL DEFAULT 0,
  logo_url text,
  codigo text,
  version text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. CREAR TABLA DE RESPONSABLES POR EMPRESA
CREATE TABLE IF NOT EXISTS company_responsibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  cargo text NOT NULL,
  signature_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. MODIFICAR TABLA USERS - Agregar company_id y dni
DO $$
BEGIN
  -- Agregar company_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE users ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
  END IF;

  -- Agregar dni si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'dni'
  ) THEN
    ALTER TABLE users ADD COLUMN dni text;
  END IF;
END $$;

-- 4. MODIFICAR TABLA COURSES - Agregar requires_evaluation y hours
DO $$
BEGIN
  -- Agregar requires_evaluation si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' AND column_name = 'requires_evaluation'
  ) THEN
    ALTER TABLE courses ADD COLUMN requires_evaluation boolean DEFAULT false;
  END IF;

  -- Agregar hours si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'courses' AND column_name = 'hours'
  ) THEN
    ALTER TABLE courses ADD COLUMN hours integer DEFAULT 0;
  END IF;
END $$;

-- 5. CREAR TABLA DE EVALUACIONES
CREATE TABLE IF NOT EXISTS evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  passing_score integer DEFAULT 60,
  max_attempts integer DEFAULT 3,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(course_id)
);

-- 6. CREAR TABLA DE PREGUNTAS
CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid REFERENCES evaluations(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  order_index integer NOT NULL,
  points integer DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 7. CREAR TABLA DE OPCIONES DE RESPUESTA
CREATE TABLE IF NOT EXISTS question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  is_correct boolean DEFAULT false,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 8. CREAR TABLA DE INTENTOS DE EVALUACIÓN
CREATE TABLE IF NOT EXISTS evaluation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  evaluation_id uuid REFERENCES evaluations(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL,
  correct_answers integer NOT NULL DEFAULT 0,
  passed boolean DEFAULT false,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  answers jsonb DEFAULT '[]',
  
  UNIQUE(user_id, evaluation_id, attempt_number)
);

-- 9. CREAR TABLA DE LISTAS DE ASISTENCIA
CREATE TABLE IF NOT EXISTS attendance_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  course_type text NOT NULL CHECK (course_type IN ('INDUCCIÓN', 'CAPACITACIÓN', 'ENTRENAMIENTO', 'SIMULACRO DE EMERGENCIA')),
  charla_5_minutos boolean DEFAULT false,
  reunion boolean DEFAULT false,
  cargo_otro text,
  tema text,
  instructor_name text NOT NULL,
  fecha timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(course_id, company_id)
);

-- 10. CREAR TABLA DE FIRMAS DE ASISTENCIA
CREATE TABLE IF NOT EXISTS attendance_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_list_id uuid REFERENCES attendance_lists(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  signature_data text NOT NULL, -- Base64 de la firma
  signed_at timestamptz DEFAULT now(),
  
  UNIQUE(attendance_list_id, user_id)
);

-- 11. HABILITAR RLS EN TODAS LAS NUEVAS TABLAS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_responsibles ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_signatures ENABLE ROW LEVEL SECURITY;

-- 12. POLÍTICAS RLS PARA COMPANIES
CREATE POLICY "Admins can manage companies"
  ON companies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (true);

-- 13. POLÍTICAS RLS PARA COMPANY_RESPONSIBLES  
CREATE POLICY "Admins can manage company responsibles"
  ON company_responsibles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read company responsibles"
  ON company_responsibles
  FOR SELECT
  TO authenticated
  USING (true);

-- 14. POLÍTICAS RLS PARA EVALUATIONS
CREATE POLICY "Admins can manage evaluations"
  ON evaluations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read assigned course evaluations"
  ON evaluations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_assignments 
      WHERE course_assignments.course_id = evaluations.course_id 
      AND course_assignments.user_id = auth.uid()
    )
  );

-- 15. POLÍTICAS RLS PARA QUESTIONS
CREATE POLICY "Admins can manage questions"
  ON questions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read questions from assigned evaluations"
  ON questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM evaluations e
      JOIN course_assignments ca ON ca.course_id = e.course_id
      WHERE e.id = questions.evaluation_id 
      AND ca.user_id = auth.uid()
    )
  );

-- 16. POLÍTICAS RLS PARA QUESTION_OPTIONS
CREATE POLICY "Admins can manage question options"
  ON question_options
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read options from assigned questions"
  ON question_options
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM questions q
      JOIN evaluations e ON e.id = q.evaluation_id
      JOIN course_assignments ca ON ca.course_id = e.course_id
      WHERE q.id = question_options.question_id 
      AND ca.user_id = auth.uid()
    )
  );

-- 17. POLÍTICAS RLS PARA EVALUATION_ATTEMPTS
CREATE POLICY "Admins can manage evaluation attempts"
  ON evaluation_attempts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage own evaluation attempts"
  ON evaluation_attempts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 18. POLÍTICAS RLS PARA ATTENDANCE_LISTS
CREATE POLICY "Admins can manage attendance lists"
  ON attendance_lists
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read attendance lists for assigned courses"
  ON attendance_lists
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM course_assignments 
      WHERE course_assignments.course_id = attendance_lists.course_id 
      AND course_assignments.user_id = auth.uid()
    )
  );

-- 19. POLÍTICAS RLS PARA ATTENDANCE_SIGNATURES
CREATE POLICY "Admins can manage attendance signatures"
  ON attendance_signatures
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage own attendance signatures"
  ON attendance_signatures
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 20. ÍNDICES PARA OPTIMIZACIÓN
CREATE INDEX IF NOT EXISTS idx_companies_ruc ON companies(ruc);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_dni ON users(dni);
CREATE INDEX IF NOT EXISTS idx_evaluations_course_id ON evaluations(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_evaluation_id ON questions(evaluation_id);
CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_user_evaluation ON evaluation_attempts(user_id, evaluation_id);
CREATE INDEX IF NOT EXISTS idx_attendance_lists_course_company ON attendance_lists(course_id, company_id);
CREATE INDEX IF NOT EXISTS idx_attendance_signatures_list_user ON attendance_signatures(attendance_list_id, user_id);

-- 21. FUNCIÓN PARA CALCULAR INTENTOS DE EVALUACIÓN
CREATE OR REPLACE FUNCTION get_user_evaluation_attempts(user_id_param uuid, evaluation_id_param uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(COUNT(*), 0)::integer
  FROM evaluation_attempts
  WHERE user_id = user_id_param AND evaluation_id = evaluation_id_param;
$$;

-- 22. FUNCIÓN PARA VERIFICAR SI USUARIO APROBÓ EVALUACIÓN
CREATE OR REPLACE FUNCTION user_passed_evaluation(user_id_param uuid, course_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM evaluation_attempts ea
    JOIN evaluations e ON e.id = ea.evaluation_id
    WHERE ea.user_id = user_id_param 
    AND e.course_id = course_id_param
    AND ea.passed = true
  );
$$;

-- 23. FUNCIÓN PARA VERIFICAR SI USUARIO PUEDE GENERAR CERTIFICADO
CREATE OR REPLACE FUNCTION can_generate_certificate(user_id_param uuid, course_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (
    -- Verificar que completó todas las lecciones (100% progreso)
    calculate_course_progress(user_id_param, course_id_param) = 100
    AND (
      -- Si no requiere evaluación, puede generar certificado
      (SELECT NOT requires_evaluation FROM courses WHERE id = course_id_param)
      OR
      -- Si requiere evaluación, debe haberla aprobado Y firmado asistencia
      (
        user_passed_evaluation(user_id_param, course_id_param) 
        AND EXISTS (
          SELECT 1 FROM attendance_signatures ats
          JOIN attendance_lists atl ON atl.id = ats.attendance_list_id
          WHERE ats.user_id = user_id_param AND atl.course_id = course_id_param
        )
      )
    )
  );
$$;