/*
  # Remove Authentication Requirements for Storage and Companies Table
  
  Since the application uses a custom authentication system (not Supabase Auth),
  we need to remove the authentication requirements from RLS policies.
  
  1. Changes to Companies Table
    - Update policies to allow public access (since custom auth is handled in the app)
    
  2. Changes to Storage
    - Update company-logos bucket policies to allow public uploads and access
    
  IMPORTANT: This is necessary because the app uses localStorage-based custom auth,
  not Supabase Auth tokens.
*/

-- Companies table: Make all operations public
DROP POLICY IF EXISTS "Authenticated users can read companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can update companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can delete companies" ON companies;

CREATE POLICY "Allow all operations on companies"
  ON companies
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Storage: Make company-logos bucket fully accessible
DROP POLICY IF EXISTS "Allow authenticated users to upload company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update company logos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete company logos" ON storage.objects;

CREATE POLICY "Allow all operations on company logos"
  ON storage.objects
  FOR ALL
  TO public
  USING (bucket_id = 'company-logos')
  WITH CHECK (bucket_id = 'company-logos');
