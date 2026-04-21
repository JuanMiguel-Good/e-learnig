/*
  # Add sede (branch/location) column to users table

  1. Modified Tables
    - `users` (public schema)
      - `sede` (text, nullable) - Stores the branch/location of a participant

  2. Notes
    - This is an optional field, so existing users are unaffected
    - No RLS changes needed as existing user policies already cover all columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'sede'
  ) THEN
    ALTER TABLE public.users ADD COLUMN sede text;
  END IF;
END $$;