/*
  # Storage Policies Setup

  1. Storage Policies
    - Create basic storage policies for authenticated users
    - Enable public read access for all buckets
    
  Note: Buckets must be created manually in Supabase Dashboard
*/

-- Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access"
      ON storage.objects
      FOR SELECT
      TO public
      USING (true);
  END IF;
END $$;

-- Create policy for authenticated users to upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Authenticated users can upload'
  ) THEN
    CREATE POLICY "Authenticated users can upload"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

-- Create policy for authenticated users to update their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can update own files'
  ) THEN
    CREATE POLICY "Users can update own files"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = owner)
      WITH CHECK (auth.uid()::text = owner);
  END IF;
END $$;

-- Create policy for authenticated users to delete their own files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Users can delete own files'
  ) THEN
    CREATE POLICY "Users can delete own files"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (auth.uid()::text = owner);
  END IF;
END $$;