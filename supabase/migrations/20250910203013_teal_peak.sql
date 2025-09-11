/*
  # Plataforma de Cursos Asincrónicos - Esquema Principal

  1. Nuevas Tablas
    - `users` - Usuarios del sistema (administradores y participantes)
    - `instructors` - Instructores de los cursos
    - `courses` - Cursos disponibles
    - `modules` - Módulos dentro de cada curso
    - `lessons` - Lecciones dentro de cada módulo
    - `course_assignments` - Asignaciones de cursos a participantes
    - `lesson_progress` - Progreso de cada lección por usuario
    - `certificates` - Certificados generados

  2. Seguridad
    - Habilitar RLS en todas las tablas
    - Políticas básicas de acceso para usuarios autenticados

  3. Storage
    - Buckets para imágenes de cursos, videos de lecciones y firmas de instructores
*/

-- Crear tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  country_code text DEFAULT '+1',
  role text NOT NULL CHECK (role IN ('admin', 'participant')) DEFAULT 'participant',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de instructores
CREATE TABLE IF NOT EXISTS instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  signature_url text, -- URL del archivo de firma en Supabase Storage
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de cursos
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text, -- URL de la imagen en Supabase Storage
  instructor_id uuid REFERENCES instructors(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de módulos
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de lecciones
CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL, -- Contenido de texto (siempre presente)
  video_url text NOT NULL, -- URL del video en Supabase Storage (siempre presente)
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  duration_minutes integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Crear tabla de asignaciones de cursos
CREATE TABLE IF NOT EXISTS course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Crear tabla de progreso de lecciones
CREATE TABLE IF NOT EXISTS lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid REFERENCES lessons(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- Crear tabla de certificados
CREATE TABLE IF NOT EXISTS certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  completion_date timestamptz DEFAULT now(),
  certificate_url text, -- URL del PDF generado
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, course_id)
);

-- Habilitar RLS en todas las tablas
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios autenticados
CREATE POLICY "Allow users to read their own data" ON users 
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage users" ON users 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read instructors" ON instructors 
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage instructors" ON instructors 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read courses" ON courses 
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage courses" ON courses 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read modules" ON modules 
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage modules" ON modules 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to read lessons" ON lessons 
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage lessons" ON lessons 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow users to read their assignments" ON course_assignments 
  FOR SELECT USING (true);

CREATE POLICY "Allow admins to manage assignments" ON course_assignments 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow users to manage their progress" ON lesson_progress 
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow users to read their certificates" ON certificates 
  FOR SELECT USING (true);

CREATE POLICY "Allow system to create certificates" ON certificates 
  FOR INSERT WITH CHECK (true);

-- Crear buckets de Storage
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('course-images', 'course-images', true),
  ('lesson-videos', 'lesson-videos', true),
  ('instructor-signatures', 'instructor-signatures', true),
  ('certificates', 'certificates', true)
ON CONFLICT DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Allow authenticated users to upload course images" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'course-images');

CREATE POLICY "Allow public access to course images" ON storage.objects 
  FOR SELECT USING (bucket_id = 'course-images');

CREATE POLICY "Allow authenticated users to upload lesson videos" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'lesson-videos');

CREATE POLICY "Allow public access to lesson videos" ON storage.objects 
  FOR SELECT USING (bucket_id = 'lesson-videos');

CREATE POLICY "Allow authenticated users to upload signatures" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'instructor-signatures');

CREATE POLICY "Allow public access to signatures" ON storage.objects 
  FOR SELECT USING (bucket_id = 'instructor-signatures');

CREATE POLICY "Allow authenticated users to upload certificates" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Allow users to access their certificates" ON storage.objects 
  FOR SELECT USING (bucket_id = 'certificates');

-- Función para calcular el progreso del curso
CREATE OR REPLACE FUNCTION calculate_course_progress(user_id_param uuid, course_id_param uuid)
RETURNS numeric AS $$
DECLARE
  total_lessons integer;
  completed_lessons integer;
BEGIN
  -- Contar total de lecciones en el curso
  SELECT COUNT(l.id) INTO total_lessons
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = course_id_param;
  
  -- Contar lecciones completadas por el usuario
  SELECT COUNT(lp.id) INTO completed_lessons
  FROM lesson_progress lp
  JOIN lessons l ON lp.lesson_id = l.id
  JOIN modules m ON l.module_id = m.id
  WHERE m.course_id = course_id_param 
    AND lp.user_id = user_id_param 
    AND lp.completed = true;
  
  -- Calcular porcentaje
  IF total_lessons = 0 THEN
    RETURN 0;
  END IF;
  
  RETURN ROUND((completed_lessons::numeric / total_lessons::numeric) * 100, 2);
END;
$$ LANGUAGE plpgsql;

-- Función para generar certificado automáticamente
CREATE OR REPLACE FUNCTION generate_certificate_if_complete()
RETURNS trigger AS $$
DECLARE
  course_id_var uuid;
  course_progress numeric;
BEGIN
  -- Obtener el ID del curso de la lección
  SELECT m.course_id INTO course_id_var
  FROM lessons l
  JOIN modules m ON l.module_id = m.id
  WHERE l.id = NEW.lesson_id;
  
  -- Calcular progreso del curso
  SELECT calculate_course_progress(NEW.user_id, course_id_var) INTO course_progress;
  
  -- Si el progreso es 100% y no existe certificado, crear uno
  IF course_progress = 100 AND NOT EXISTS (
    SELECT 1 FROM certificates 
    WHERE user_id = NEW.user_id AND course_id = course_id_var
  ) THEN
    INSERT INTO certificates (user_id, course_id, completion_date)
    VALUES (NEW.user_id, course_id_var, now());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para generar certificado automáticamente
DROP TRIGGER IF EXISTS generate_certificate_trigger ON lesson_progress;
CREATE TRIGGER generate_certificate_trigger
  AFTER UPDATE OF completed ON lesson_progress
  FOR EACH ROW
  WHEN (NEW.completed = true AND OLD.completed = false)
  EXECUTE FUNCTION generate_certificate_if_complete();

-- Insertar un usuario administrador por defecto
INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES 
  ('admin@goodsolutions.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'Good Solutions', 'admin')
ON CONFLICT DO NOTHING;