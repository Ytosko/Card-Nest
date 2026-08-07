-- Create table for encrypted user AI credentials
CREATE TABLE IF NOT EXISTS public.user_ai_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('openai', 'gemini')),
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  key_suffix TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_ai_credentials_user_provider_unique UNIQUE (user_id, provider)
);

-- Enable RLS
ALTER TABLE public.user_ai_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DROP POLICY IF EXISTS "Users can select their own AI credential metadata" ON public.user_ai_credentials;
CREATE POLICY "Users can select their own AI credential metadata"
  ON public.user_ai_credentials
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own AI credentials" ON public.user_ai_credentials;
CREATE POLICY "Users can insert their own AI credentials"
  ON public.user_ai_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own AI credentials" ON public.user_ai_credentials;
CREATE POLICY "Users can update their own AI credentials"
  ON public.user_ai_credentials
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own AI credentials" ON public.user_ai_credentials;
CREATE POLICY "Users can delete their own AI credentials"
  ON public.user_ai_credentials
  FOR DELETE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Create index for user_id lookup
CREATE INDEX IF NOT EXISTS user_ai_credentials_user_idx ON public.user_ai_credentials (user_id);
