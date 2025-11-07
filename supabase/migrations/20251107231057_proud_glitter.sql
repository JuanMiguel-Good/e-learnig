/*
  # Configure Storage Policies Only
  
  Since buckets already exist, we only configure the necessary policies for file access.
  
  ## Security Policies
  1. Public read access for all buckets (needed to display files)
  2. Authenticated users can upload/update/delete files
  3. Service role has full access
*/

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Service role can manage all files" ON storage.objects;

-- Create unified policies for all buckets
CREATE POLICY "Public Access" ON storage.objects
  FOR SELECT USING (bucket_id IN (
    'company-logos',
    'instructor-signatures', 
    'responsible-signatures',
    'course-images',
    'lesson-videos',
    'certificates'
  ));

CREATE POLICY "Authenticated users can upload files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id IN (
    'company-logos',
    'instructor-signatures',
    'responsible-signatures', 
    'course-images',
    'lesson-videos',
    'certificates'
  ));

CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id IN (
    'company-logos',
    'instructor-signatures',
    'responsible-signatures',
    'course-images', 
    'lesson-videos',
    'certificates'
  ));

CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id IN (
    'company-logos',
    'instructor-signatures',
    'responsible-signatures',
    'course-images',
    'lesson-videos', 
    'certificates'
  ));

CREATE POLICY "Service role can manage all files" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id IN (
    'company-logos',
    'instructor-signatures',
    'responsible-signatures',
    'course-images',
    'lesson-videos',
    'certificates'
  ))
  WITH CHECK (bucket_id IN (
    'company-logos', 
    'instructor-signatures',
    'responsible-signatures',
    'course-images',
    'lesson-videos',
    'certificates'
  ));