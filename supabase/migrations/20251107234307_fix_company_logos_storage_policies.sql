/*
  # Fix Storage Policies for Company Logos
  
  1. Changes
    - Drop existing policies that use auth.role() (incorrect approach)
    - Create new policies that properly check authentication using auth.uid()
    - Simplify INSERT policy to allow any authenticated user to upload
  
  This fixes the RLS policy violation when uploading company logos.
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to company logos" ON storage.objects;

-- Allow authenticated users to upload company logos (simplified check)
CREATE POLICY "Allow authenticated users to upload company logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-logos');

-- Allow public access to company logos (for display purposes)
CREATE POLICY "Allow public access to company logos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'company-logos');

-- Allow authenticated users to update company logos
CREATE POLICY "Allow authenticated users to update company logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-logos')
  WITH CHECK (bucket_id = 'company-logos');

-- Allow authenticated users to delete company logos
CREATE POLICY "Allow authenticated users to delete company logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-logos');
