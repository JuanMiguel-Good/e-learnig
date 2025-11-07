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

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('company-logos', 'company-logos', true),
  ('instructor-signatures', 'instructor-signatures', true),
  ('responsible-signatures', 'responsible-signatures', true),
  ('course-images', 'course-images', true),
  ('lesson-videos', 'lesson-videos', true),
  ('certificates', 'certificates', true);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for company logos
CREATE POLICY "Company logos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can upload company logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can update company logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-logos');

CREATE POLICY "Authenticated users can delete company logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-logos');

-- Policy for instructor signatures
CREATE POLICY "Instructor signatures are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'instructor-signatures');

CREATE POLICY "Authenticated users can upload instructor signatures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'instructor-signatures');

CREATE POLICY "Authenticated users can update instructor signatures"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'instructor-signatures');

CREATE POLICY "Authenticated users can delete instructor signatures"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'instructor-signatures');

-- Policy for responsible signatures
CREATE POLICY "Responsible signatures are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'responsible-signatures');

CREATE POLICY "Authenticated users can upload responsible signatures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'responsible-signatures');

CREATE POLICY "Authenticated users can update responsible signatures"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'responsible-signatures');

CREATE POLICY "Authenticated users can delete responsible signatures"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'responsible-signatures');

-- Policy for course images
CREATE POLICY "Course images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'course-images');

CREATE POLICY "Authenticated users can upload course images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'course-images');

CREATE POLICY "Authenticated users can update course images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'course-images');

CREATE POLICY "Authenticated users can delete course images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'course-images');

-- Policy for lesson videos
CREATE POLICY "Lesson videos are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lesson-videos');

CREATE POLICY "Authenticated users can upload lesson videos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'lesson-videos');

CREATE POLICY "Authenticated users can update lesson videos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'lesson-videos');

CREATE POLICY "Authenticated users can delete lesson videos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'lesson-videos');

-- Policy for certificates
CREATE POLICY "Certificates are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates');

CREATE POLICY "Authenticated users can upload certificates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Authenticated users can update certificates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'certificates');

CREATE POLICY "Authenticated users can delete certificates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificates');