/*
  # Add Storage Policies for Responsible Signatures
  
  The company responsibles feature uses the 'responsible-signatures' bucket
  to store signature images. We need to allow public access since the app
  uses custom authentication.
  
  1. Storage Policies
    - Allow all operations on the responsible-signatures bucket
*/

-- Create policy for responsible-signatures bucket
CREATE POLICY "Allow all operations on responsible signatures"
  ON storage.objects
  FOR ALL
  TO public
  USING (bucket_id = 'responsible-signatures')
  WITH CHECK (bucket_id = 'responsible-signatures');
