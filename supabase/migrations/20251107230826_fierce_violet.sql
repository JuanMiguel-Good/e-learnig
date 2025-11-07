/*
# Create Storage Buckets for File Uploads

## Storage Buckets
- company-logos - For company logo uploads
- instructor-signatures - For instructor signature uploads  
- responsible-signatures - For company responsible signature uploads
- course-images - For course cover images
- lesson-videos - For lesson video files
- certificates - For generated certificates

## Security
- Enable RLS on all buckets
- Add policies for authenticated users to manage files
- Add policies for public access to certain files
*/

-- Create buckets only if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'company-logos') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('company-logos', 'Company Logos', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'instructor-signatures') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('instructor-signatures', 'Instructor Signatures', true, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf']);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'responsible-signatures') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('responsible-signatures', 'Responsible Signatures', true, 10485760, ARRAY['image/jpeg', 'image/png', 'application/pdf']);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'course-images') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('course-images', 'Course Images', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'lesson-videos') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('lesson-videos', 'Lesson Videos', true, 1073741824, ARRAY['video/mp4', 'video/webm', 'video/ogg']);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'certificates') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES ('certificates', 'Certificates', true, 10485760, ARRAY['image/png', 'image/jpeg', 'application/pdf']);
    END IF;
END $$;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public can view all files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all files" ON storage.objects;

-- Create policies for public read access
CREATE POLICY "Public can view all files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id IN (
    'company-logos', 
    'instructor-signatures', 
    'responsible-signatures',
    'course-images', 
    'lesson-videos', 
    'certificates'
  ));

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id IN (
    'company-logos', 
    'instructor-signatures', 
    'responsible-signatures',
    'course-images', 
    'lesson-videos', 
    'certificates'
  ));

CREATE POLICY "Authenticated users can update their files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner)
  WITH CHECK (bucket_id IN (
    'company-logos', 
    'instructor-signatures', 
    'responsible-signatures',
    'course-images', 
    'lesson-videos', 
    'certificates'
  ));

CREATE POLICY "Authenticated users can delete their files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (auth.uid() = owner);

-- Create policy for service role (full access)
CREATE POLICY "Service role can manage all files"
  ON storage.objects FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);