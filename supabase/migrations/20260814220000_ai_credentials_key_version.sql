-- Add encryption_version column for key rotation support (defaults to 1)
ALTER TABLE public.user_ai_credentials 
ADD COLUMN IF NOT EXISTS encryption_version INT NOT NULL DEFAULT 1;

-- Revoke SELECT on secret columns and internal key metadata from authenticated and anon roles
REVOKE SELECT (encrypted_key, iv, auth_tag, encryption_version) ON public.user_ai_credentials FROM authenticated, anon;

-- Ensure RLS is enabled
ALTER TABLE public.user_ai_credentials ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view metadata for their own credentials
DROP POLICY IF EXISTS "Users can read own ai credential metadata" ON public.user_ai_credentials;
CREATE POLICY "Users can read own ai credential metadata"
ON public.user_ai_credentials FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users cannot directly insert/update/delete secret columns via client SDK; Edge Function service_role performs writes
DROP POLICY IF EXISTS "Users cannot modify ai credentials directly" ON public.user_ai_credentials;
CREATE POLICY "Users cannot modify ai credentials directly"
ON public.user_ai_credentials FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
