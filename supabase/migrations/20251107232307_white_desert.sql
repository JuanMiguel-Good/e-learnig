/*
  # Create Storage Buckets

  1. Storage Buckets
    - Create all required buckets for file uploads
    - Set public access for viewing files
    - Configure proper security policies

  2. Security
    - Public read access for all buckets
    - Authenticated write access
    - Users can manage their own files
*/

-- Create storage buckets with safe error handling
DO $$
DECLARE
    bucket_exists boolean;
BEGIN
    -- Check and create company-logos bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'company-logos') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true);
    END IF;

    -- Check and create instructor-signatures bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'instructor-signatures') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('instructor-signatures', 'instructor-signatures', true);
    END IF;

    -- Check and create responsible-signatures bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'responsible-signatures') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('responsible-signatures', 'responsible-signatures', true);
    END IF;

    -- Check and create course-images bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'course-images') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('course-images', 'course-images', true);
    END IF;

    -- Check and create lesson-videos bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'lesson-videos') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-videos', 'lesson-videos', true);
    END IF;

    -- Check and create certificates bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'certificates') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true);
    END IF;
END $$;

-- Create storage policies (only if they don't exist)
DO $$
BEGIN
    -- Public read policy for all buckets
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Public read access'
    ) THEN
        CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (true);
    END IF;

    -- Authenticated users can upload
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can upload'
    ) THEN
        CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT 
        TO authenticated WITH CHECK (true);
    END IF;

    -- Users can update their own files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update own files'
    ) THEN
        CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE 
        TO authenticated USING (auth.uid()::text = (storage.foldername(name))[1]);
    END IF;

    -- Users can delete their own files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete own files'
    ) THEN
        CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE 
        TO authenticated USING (auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END $$;