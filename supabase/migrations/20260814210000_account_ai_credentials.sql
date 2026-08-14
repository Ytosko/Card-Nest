-- Migration: Account-Level AI Credentials & Per-Provider Model Sync

-- 1. Enhance user_ai_credentials with last_validated_at timestamp
ALTER TABLE public.user_ai_credentials
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now());

-- 2. Enhance user_preferences with per-provider selected models
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS gemini_selected_model TEXT,
  ADD COLUMN IF NOT EXISTS openai_selected_model TEXT;

-- 3. Security Hardening: Revoke direct column SELECT of secret columns from client roles
-- authenticated and anon roles cannot select encrypted_key, iv, auth_tag via raw client queries.
REVOKE SELECT (encrypted_key, iv, auth_tag) ON public.user_ai_credentials FROM authenticated, anon;

-- Ensure authenticated users can select non-secret metadata columns
GRANT SELECT (id, user_id, provider, created_at, updated_at, last_validated_at) ON public.user_ai_credentials TO authenticated;

-- Grant full permissions to service_role (used by Edge Functions)
GRANT ALL ON public.user_ai_credentials TO service_role;

-- 4. Enable RLS and verify ownership policy
ALTER TABLE public.user_ai_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own AI credential metadata" ON public.user_ai_credentials;
CREATE POLICY "Users can view their own AI credential metadata"
  ON public.user_ai_credentials
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own AI credentials" ON public.user_ai_credentials;
CREATE POLICY "Users can delete their own AI credentials"
  ON public.user_ai_credentials
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
