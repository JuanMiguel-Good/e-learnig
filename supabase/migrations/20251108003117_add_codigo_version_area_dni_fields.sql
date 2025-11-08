/*
  # Add código, versión, área, and DNI fields
  
  1. Changes to companies table
    - Add `codigo` (text) - Código del documento
    - Add `version` (text) - Versión del documento
  
  2. Changes to users table
    - Add `area` (text) - Área del participante
    - Modify `dni` to ensure it exists (should already exist)
  
  3. Changes to company_responsibles table
    - Add `signature_url` (text) - URL de la firma del responsable
  
  4. Changes to instructors table
    - Add `signature_url` (text) - URL de la firma del instructor
  
  5. Notes
    - All fields are nullable to maintain backwards compatibility
    - These fields will be used in attendance list generation
*/

-- Add codigo and version to companies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'codigo'
  ) THEN
    ALTER TABLE companies ADD COLUMN codigo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'version'
  ) THEN
    ALTER TABLE companies ADD COLUMN version text;
  END IF;
END $$;

-- Add area to users (DNI should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'area'
  ) THEN
    ALTER TABLE users ADD COLUMN area text;
  END IF;
END $$;

-- Add signature_url to company_responsibles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'company_responsibles' AND column_name = 'signature_url'
  ) THEN
    ALTER TABLE company_responsibles ADD COLUMN signature_url text;
  END IF;
END $$;

-- Add signature_url to instructors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'instructors' AND column_name = 'signature_url'
  ) THEN
    ALTER TABLE instructors ADD COLUMN signature_url text;
  END IF;
END $$;
