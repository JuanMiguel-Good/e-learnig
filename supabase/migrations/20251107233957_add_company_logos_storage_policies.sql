/*
  # Add Storage Policies for Company Logos
  
  1. Storage Policies
    - Allow authenticated users to upload company logos to the company-logos bucket
    - Allow public access to read company logos (so they can be displayed on the frontend)
  
  This fixes the "new row violates row-level security policy" error when uploading company logos.
*/

-- Allow authenticated users to upload company logos
CREATE POLICY "Allow authenticated users to upload company logos"
  ON storage.objects
  FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

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
  TO public
  USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated')
  WITH CHECK (bucket_id = 'company-logos' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete company logos
CREATE POLICY "Allow authenticated users to delete company logos"
  ON storage.objects
  FOR DELETE
  TO public
  USING (bucket_id = 'company-logos' AND auth.role() = 'authenticated');
