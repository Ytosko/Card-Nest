-- Migration: Plaintext Account-Level AI Credentials & key_last4 Metadata Security
-- 1. Add api_key and key_last4 columns
ALTER TABLE public.user_ai_credentials
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS key_last4 VARCHAR(4);

-- 2. Drop NOT NULL constraints on legacy encryption columns
ALTER TABLE public.user_ai_credentials
  ALTER COLUMN encrypted_key DROP NOT NULL,
  ALTER COLUMN iv DROP NOT NULL,
  ALTER COLUMN auth_tag DROP NOT NULL,
  ALTER COLUMN key_suffix DROP NOT NULL;

-- 3. Security Boundary: Revoke direct column SELECT of plaintext api_key from authenticated/anon client roles
REVOKE SELECT (api_key) ON public.user_ai_credentials FROM authenticated, anon;

-- 4. Grant SELECT on safe metadata columns (including key_last4) to authenticated users
GRANT SELECT (id, user_id, provider, key_last4, created_at, updated_at, last_validated_at) ON public.user_ai_credentials TO authenticated;

-- 5. Grant full access to service_role for Edge Functions
GRANT ALL ON public.user_ai_credentials TO service_role;
