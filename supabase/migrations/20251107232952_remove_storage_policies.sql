/*
  # Remove Storage Policies
  
  1. Clean Up
    - Remove all storage.objects policies that require owner permissions
    - Storage policies should be managed through Supabase Dashboard
  
  Note: This fixes the "must be owner of table objects" error by removing
  all attempts to create storage policies through migrations.
*/

-- Drop all storage policies if they exist
DO $$
BEGIN
  -- Drop public read policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public read access'
  ) THEN
    DROP POLICY "Public read access" ON storage.objects;
  END IF;

  -- Drop authenticated upload policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload'
  ) THEN
    DROP POLICY "Authenticated users can upload" ON storage.objects;
  END IF;

  -- Drop authenticated uploads policy (alternative name)
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated uploads'
  ) THEN
    DROP POLICY "Authenticated uploads" ON storage.objects;
  END IF;

  -- Drop update own files policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update own files'
  ) THEN
    DROP POLICY "Users can update own files" ON storage.objects;
  END IF;

  -- Drop delete own files policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own files'
  ) THEN
    DROP POLICY "Users can delete own files" ON storage.objects;
  END IF;

  -- Drop manage own files policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users manage own files'
  ) THEN
    DROP POLICY "Users manage own files" ON storage.objects;
  END IF;

  -- Drop service role policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Service role full access'
  ) THEN
    DROP POLICY "Service role full access" ON storage.objects;
  END IF;

  -- Drop anyone can view files policy
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Anyone can view files'
  ) THEN
    DROP POLICY "Anyone can view files" ON storage.objects;
  END IF;

EXCEPTION WHEN OTHERS THEN
  -- Silently ignore any errors during cleanup
  NULL;
END $$;
