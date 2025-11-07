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

-- Create company-logos bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true);

-- Create instructor-signatures bucket  
INSERT INTO storage.buckets (id, name, public) VALUES ('instructor-signatures', 'instructor-signatures', true);

-- Create responsible-signatures bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('responsible-signatures', 'responsible-signatures', true);

-- Create course-images bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('course-images', 'course-images', true);

-- Create lesson-videos bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-videos', 'lesson-videos', true);

-- Create certificates bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true);

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (true);

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated updates" ON storage.objects
FOR UPDATE TO authenticated
USING (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role')
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role');

-- Policy: Allow authenticated users to delete their own files  
CREATE POLICY "Allow authenticated deletes" ON storage.objects
FOR DELETE TO authenticated
USING (auth.uid()::text = (storage.foldername(name))[1] OR auth.role() = 'service_role');

-- Policy: Allow public access to read files in all buckets
CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT TO public
USING (true);

-- Policy: Allow service role full access
CREATE POLICY "Allow service role access" ON storage.objects
FOR ALL TO service_role
USING (true)
WITH CHECK (true);