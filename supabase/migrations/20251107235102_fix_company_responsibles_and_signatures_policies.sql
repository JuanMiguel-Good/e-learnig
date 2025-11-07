/*
  # Fix Policies for Company Responsibles and Signatures
  
  Since the application uses custom authentication (not Supabase Auth),
  we need to remove authentication requirements from:
  
  1. company_responsibles table - allow all operations
  2. instructor-signatures storage bucket - allow all operations
  
  This fixes the "new row violates row-level security policy" error.
*/

-- Fix company_responsibles table policies
DROP POLICY IF EXISTS "Admins can manage company responsibles" ON company_responsibles;
DROP POLICY IF EXISTS "Users can read company responsibles" ON company_responsibles;

CREATE POLICY "Allow all operations on company responsibles"
  ON company_responsibles
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Fix storage policies for instructor-signatures bucket
DROP POLICY IF EXISTS "Allow authenticated users to upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to signatures" ON storage.objects;

CREATE POLICY "Allow all operations on instructor signatures"
  ON storage.objects
  FOR ALL
  TO public
  USING (bucket_id = 'instructor-signatures')
  WITH CHECK (bucket_id = 'instructor-signatures');
