/*
  # Create Storage Buckets for File Uploads

  1. Storage Buckets
    - `company-logos` - For company logo uploads
    - `instructor-signatures` - For instructor signature uploads  
    - `responsible-signatures` - For company responsible signature uploads
    - `course-images` - For course cover images
    - `lesson-videos` - For lesson video files
    - `certificates` - For generated certificates

  2. Security
    - Enable RLS on all buckets
    - Add policies for authenticated users to manage files
    - Add policies for public access to certain files
*/

-- Create storage buckets (only if they don't exist)
DO $$ 
BEGIN
  -- company-logos bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'company-logos') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('company-logos', 'company-logos', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp']);
  END IF;

  -- instructor-signatures bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'instructor-signatures') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('instructor-signatures', 'instructor-signatures', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
  END IF;

  -- responsible-signatures bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'responsible-signatures') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('responsible-signatures', 'responsible-signatures', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
  END IF;

  -- course-images bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'course-images') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('course-images', 'course-images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp']);
  END IF;

  -- lesson-videos bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'lesson-videos') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('lesson-videos', 'lesson-videos', true, 1073741824, ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov']);
  END IF;

  -- certificates bucket
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'certificates') THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('certificates', 'certificates', true, 10485760, ARRAY['image/png', 'image/jpeg', 'application/pdf']);
  END IF;
END $$;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create storage policies (drop existing ones first to avoid conflicts)
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Public read access for company logos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;
  
  DROP POLICY IF EXISTS "Public read access for instructor signatures" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload instructor signatures" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update instructor signatures" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete instructor signatures" ON storage.objects;
  
  DROP POLICY IF EXISTS "Public read access for responsible signatures" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload responsible signatures" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update responsible signatures" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete responsible signatures" ON storage.objects;
  
  DROP POLICY IF EXISTS "Public read access for course images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload course images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update course images" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete course images" ON storage.objects;
  
  DROP POLICY IF EXISTS "Public read access for lesson videos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload lesson videos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update lesson videos" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete lesson videos" ON storage.objects;
  
  DROP POLICY IF EXISTS "Public read access for certificates" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update certificates" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete certificates" ON storage.objects;
  
  DROP POLICY IF EXISTS "Service role can manage all files" ON storage.objects;
END $$;

-- Company logos policies
CREATE POLICY "Public read access for company logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can upload company logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can update company logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'company-logos')
WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can delete company logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'company-logos');

-- Instructor signatures policies
CREATE POLICY "Public read access for instructor signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'instructor-signatures');

CREATE POLICY "Authenticated users can upload instructor signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'instructor-signatures');

CREATE POLICY "Authenticated users can update instructor signatures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'instructor-signatures')
WITH CHECK (bucket_id = 'instructor-signatures');

CREATE POLICY "Authenticated users can delete instructor signatures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'instructor-signatures');

-- Responsible signatures policies
CREATE POLICY "Public read access for responsible signatures"
ON storage.objects FOR SELECT
USING (bucket_id = 'responsible-signatures');

CREATE POLICY "Authenticated users can upload responsible signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'responsible-signatures');

CREATE POLICY "Authenticated users can update responsible signatures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'responsible-signatures')
WITH CHECK (bucket_id = 'responsible-signatures');

CREATE POLICY "Authenticated users can delete responsible signatures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'responsible-signatures');

-- Course images policies
CREATE POLICY "Public read access for course images"
ON storage.objects FOR SELECT
USING (bucket_id = 'course-images');

CREATE POLICY "Authenticated users can upload course images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-images');

CREATE POLICY "Authenticated users can update course images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-images')
WITH CHECK (bucket_id = 'course-images');

CREATE POLICY "Authenticated users can delete course images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-images');

-- Lesson videos policies
CREATE POLICY "Public read access for lesson videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'lesson-videos');

CREATE POLICY "Authenticated users can upload lesson videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lesson-videos');

CREATE POLICY "Authenticated users can update lesson videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lesson-videos')
WITH CHECK (bucket_id = 'lesson-videos');

CREATE POLICY "Authenticated users can delete lesson videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lesson-videos');

-- Certificates policies
CREATE POLICY "Public read access for certificates"
ON storage.objects FOR SELECT
USING (bucket_id = 'certificates');

CREATE POLICY "Authenticated users can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Authenticated users can update certificates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'certificates')
WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Authenticated users can delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'certificates');

-- Service role can manage all files
CREATE POLICY "Service role can manage all files"
ON storage.objects
TO service_role
USING (true)
WITH CHECK (true);