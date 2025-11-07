/*
  # Setup Storage Buckets Only
  
  1. Storage Buckets
    - Create all required storage buckets
    - Configure buckets as public for read access
  
  Note: This migration ONLY creates buckets. It does NOT create any policies
  on storage.objects as that requires special permissions. Storage policies
  should be configured through the Supabase Dashboard.
*/

-- Create storage buckets with safe error handling
DO $$
DECLARE
    bucket_exists boolean;
BEGIN
    -- Check and create company-logos bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'company-logos') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true);
    END IF;

    -- Check and create instructor-signatures bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'instructor-signatures') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('instructor-signatures', 'instructor-signatures', true);
    END IF;

    -- Check and create responsible-signatures bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'responsible-signatures') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('responsible-signatures', 'responsible-signatures', true);
    END IF;

    -- Check and create course-images bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'course-images') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('course-images', 'course-images', true);
    END IF;

    -- Check and create lesson-videos bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'lesson-videos') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-videos', 'lesson-videos', true);
    END IF;

    -- Check and create certificates bucket
    SELECT EXISTS(SELECT 1 FROM storage.buckets WHERE id = 'certificates') INTO bucket_exists;
    IF NOT bucket_exists THEN
        INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', true);
    END IF;
END $$;
