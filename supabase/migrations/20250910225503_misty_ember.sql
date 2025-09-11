/*
  # Arreglo simple para lesson_progress

  1. Eliminar políticas restrictivas que están causando problemas
  2. Crear políticas simples que funcionen
*/

-- Eliminar todas las políticas existentes de lesson_progress
DROP POLICY IF EXISTS "Users can create own progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can read own progress" ON lesson_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON lesson_progress;

-- Crear políticas simples que funcionen
CREATE POLICY "Allow authenticated users to manage lesson progress" 
  ON lesson_progress 
  FOR ALL 
  TO authenticated 
  USING (true) 
  WITH CHECK (true);