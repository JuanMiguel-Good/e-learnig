/*
  # Create Storage Buckets for File Uploads

  1. Storage Buckets
    - company-logos - For company logo uploads
    - instructor-signatures - For instructor signature uploads  
    - responsible-signatures - For company responsible signature uploads
    - course-images - For course cover images
    - lesson-videos - For lesson video files
    - certificates - For generated certificates

  2. Security
    - Enable RLS on all buckets
    - Add policies for authenticated users to manage files
    - Add policies for public access to certain files
*/

-- Function to safely create bucket if it doesn't exist
CREATE OR REPLACE FUNCTION create_bucket_if_not_exists(bucket_name TEXT, bucket_public BOOLEAN DEFAULT true, file_size_limit BIGINT DEFAULT 52428800)
RETURNS VOID AS $$
BEGIN
  -- Check if bucket exists
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = bucket_name) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit)
    VALUES (bucket_name, bucket_name, bucket_public, file_size_limit);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create buckets with appropriate size limits
SELECT create_bucket_if_not_exists('company-logos', true, 52428800);        -- 50MB for images
SELECT create_bucket_if_not_exists('instructor-signatures', true, 10485760); -- 10MB for signatures/PDFs
SELECT create_bucket_if_not_exists('responsible-signatures', true, 10485760); -- 10MB for signatures
SELECT create_bucket_if_not_exists('course-images', true, 52428800);        -- 50MB for images
SELECT create_bucket_if_not_exists('lesson-videos', true, 1073741824);      -- 1GB for videos
SELECT create_bucket_if_not_exists('certificates', true, 10485760);         -- 10MB for certificates

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
DROP POLICY IF EXISTS "Service role can do anything" ON storage.objects;

-- Create comprehensive policies for all buckets
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT TO public
  USING (true);

CREATE POLICY "Authenticated users can upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "Service role can do anything" ON storage.objects
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Clean up the function
DROP FUNCTION create_bucket_if_not_exists(TEXT, BOOLEAN, BIGINT);