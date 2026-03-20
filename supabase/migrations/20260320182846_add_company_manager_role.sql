/*
  # Agregar rol de Gestor de Empresa (Company Manager)

  1. Cambios en la tabla users
    - Actualizar la restricción CHECK para permitir el rol 'company_manager'
    - Los company_managers deben tener un company_id asignado

  2. Índices
    - Agregar índice en users(company_id) para optimizar consultas filtradas por empresa
    - Agregar índice en users(role, company_id) para consultas combinadas

  3. Notas importantes
    - Los company_managers tienen permisos híbridos:
      * Como participante: pueden ver y realizar sus propios cursos
      * Como gestor: pueden administrar participantes, asistencias y reportes de su empresa
    - NO pueden crear cursos ni asignar cursos (eso es solo para admin)
    - Solo ven datos de su propia empresa
*/

-- Drop existing check constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE users DROP CONSTRAINT users_role_check;
  END IF;
END $$;

-- Add new check constraint with company_manager role
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'participant', 'company_manager'));

-- Create index on company_id for better query performance
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Create composite index for role and company_id queries
CREATE INDEX IF NOT EXISTS idx_users_role_company_id ON users(role, company_id);

-- Add comment to document the new role
COMMENT ON COLUMN users.role IS 'User role: admin (full access), participant (course access only), company_manager (hybrid role with company-scoped management)';
