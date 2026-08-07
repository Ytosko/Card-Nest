-- Add contact_photo_path column to cards table
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS contact_photo_path text NULL;

-- Create contact-photos storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('contact-photos', 'contact-photos', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for contact-photos storage bucket
CREATE POLICY "Users can upload their own contact photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'contact-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own contact photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'contact-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own contact photos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'contact-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own contact photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'contact-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
