/*
  # Make DNI unique for authentication

  1. Changes to users table
    - Add unique constraint to `dni` field to allow login with DNI
    - Create index for faster lookups during authentication

  2. Notes
    - DNI will be used as an alternative login method alongside email
    - This ensures each DNI is unique across the system
    - Existing NULL values are allowed, but non-NULL values must be unique
*/

-- Add unique constraint to DNI field (allowing NULL values)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_dni_key'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_dni_key UNIQUE (dni);
  END IF;
END $$;

-- Ensure the index exists for faster DNI lookups
CREATE INDEX IF NOT EXISTS idx_users_dni_unique ON users(dni) WHERE dni IS NOT NULL;