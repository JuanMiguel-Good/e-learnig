@@ .. @@
-/*
-  # Test migration
-  
-  Empty migration to test if the system works
-*/
-
-SELECT 1;
+/*
+  # Configure storage policies properly
+  
+  This migration sets up storage policies with correct permissions
+*/
+
+-- Enable RLS on storage.objects (should already be enabled)
+DO $$ 
+BEGIN
+  -- This should work without owner issues
+  IF NOT EXISTS (
+    SELECT 1 FROM pg_policies 
+    WHERE schemaname = 'storage' 
+    AND tablename = 'objects' 
+    AND policyname = 'Anyone can view files'
+  ) THEN
+    CREATE POLICY "Anyone can view files" ON storage.objects FOR SELECT USING (true);
+  END IF;
+END $$;
+
+-- Create policies for authenticated users
+DO $$ 
+BEGIN
+  -- Upload policy
+  IF NOT EXISTS (
+    SELECT 1 FROM pg_policies 
+    WHERE schemaname = 'storage' 
+    AND tablename = 'objects' 
+    AND policyname = 'Authenticated users can upload'
+  ) THEN
+    CREATE POLICY "Authenticated users can upload" ON storage.objects 
+    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
+  END IF;
+  
+  -- Update own files policy  
+  IF NOT EXISTS (
+    SELECT 1 FROM pg_policies 
+    WHERE schemaname = 'storage' 
+    AND tablename = 'objects' 
+    AND policyname = 'Users can update own files'
+  ) THEN
+    CREATE POLICY "Users can update own files" ON storage.objects 
+    FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
+  END IF;
+  
+  -- Delete own files policy
+  IF NOT EXISTS (
+    SELECT 1 FROM pg_policies 
+    WHERE schemaname = 'storage' 
+    AND tablename = 'objects' 
+    AND policyname = 'Users can delete own files'
+  ) THEN
+    CREATE POLICY "Users can delete own files" ON storage.objects 
+    FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);
+  END IF;
+END $$;