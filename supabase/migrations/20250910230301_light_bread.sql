/*
  # Deshabilitar RLS en certificates

  1. Changes
    - Deshabilitar Row Level Security en certificates
    - Eliminar políticas restrictivas
*/

-- Deshabilitar RLS completamente
ALTER TABLE certificates DISABLE ROW LEVEL SECURITY;

-- Eliminar todas las políticas
DROP POLICY IF EXISTS "Users can create own certificates" ON certificates;
DROP POLICY IF EXISTS "Users can read own certificates" ON certificates;
DROP POLICY IF EXISTS "Users can update own certificates" ON certificates;