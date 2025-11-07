/*
  # Storage Policies Configuration

  1. Security Policies
    - Public read access for all storage buckets
    - Authenticated users can upload files
    - Users can manage their own uploaded files
    - Service role has full access
*/

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Users manage own files" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access" ON storage.objects;

-- Create policies for storage.objects
CREATE POLICY "Public read access" 
ON storage.objects 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated uploads" 
ON storage.objects 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users manage own files" 
ON storage.objects 
FOR ALL 
TO authenticated 
USING (auth.uid()::text = owner)
WITH CHECK (auth.uid()::text = owner);

CREATE POLICY "Service role full access" 
ON storage.objects 
FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);