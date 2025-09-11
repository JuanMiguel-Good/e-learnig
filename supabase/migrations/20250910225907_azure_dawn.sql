/*
  # Deshabilitar RLS completamente en lesson_progress
  
  Deshabilita Row Level Security en la tabla lesson_progress para que funcione
  sin restricciones de seguridad.
*/

-- Deshabilitar RLS completamente
ALTER TABLE lesson_progress DISABLE ROW LEVEL SECURITY;

-- Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Allow authenticated users to manage lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can create own lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can read own lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can update own lesson progress" ON lesson_progress;
DROP POLICY IF EXISTS "Allow authenticated users to manage lesson progress simple" ON lesson_progress;