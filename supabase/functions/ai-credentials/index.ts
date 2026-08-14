import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Server configuration error.' }, 500);
  }

  // Authenticate User
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Your session is no longer valid.' }, 401);
  const userId = userData.user.id;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  // GET: Fetch safe credential metadata status or dynamic model list (ZERO raw key material returned)
  if (request.method === 'GET') {
    if (action === 'models') {
      const provider = url.searchParams.get('provider');
      if (!provider || !['openai', 'gemini'].includes(provider)) return json({ error: 'Invalid provider.' }, 400);

      const { data: credential } = await adminClient
        .from('user_ai_credentials')
        .select('api_key, key_last4')
        .eq('user_id', userId)
        .eq('provider', provider)
        .maybeSingle();

      const rawKey = credential?.api_key?.trim();
      if (!rawKey) return json({ error: `Configure a ${provider} key before loading models.` }, 400);

      try {
        if (provider === 'openai') {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${rawKey}` },
          });
          if (!response.ok) return json({ error: 'OpenAI model discovery failed.' }, 400);
          const body = await response.json();
          // Filter to image-capable / vision models
          const models = (body.data || [])
            .map((model: { id?: string }) => model.id)
            .filter((id?: string) => Boolean(id) && (id?.includes('gpt-4') || id?.includes('gpt-3.5') || id?.includes('o1') || id?.includes('o3')))
            .sort();
          return json({ ok: true, models: models.length > 0 ? models : ['gpt-4o', 'gpt-4o-mini'] });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(rawKey)}`);
        if (!response.ok) return json({ error: 'Gemini model discovery failed.' }, 400);
        const body = await response.json();
        const models = (body.models || [])
          .filter((model: { supportedGenerationMethods?: string[] }) => model.supportedGenerationMethods?.includes('generateContent'))
          .map((model: { name?: string }) => (model.name?.startsWith('models/') ? model.name.slice(7) : model.name))
          .filter(Boolean)
          .sort();
        return json({ ok: true, models: models.length > 0 ? models : ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'] });
      } catch {
        return json({ error: 'Failed to contact provider for model catalog.' }, 400);
      }
    }

    // Fetch safe metadata status only (no raw key material)
    const { data: rows, error: fetchError } = await adminClient
      .from('user_ai_credentials')
      .select('provider, key_last4, api_key, updated_at, last_validated_at')
      .eq('user_id', userId);

    if (fetchError) return json({ error: 'Could not fetch credential metadata.' }, 500);

    const credentials: Record<string, { connected: boolean; keyLast4?: string; updatedAt: string; lastValidatedAt?: string }> = {};
    for (const row of rows || []) {
      const hasKey = Boolean(row.key_last4 || (row.api_key && typeof row.api_key === 'string' && row.api_key.trim().length > 0));
      if (hasKey) {
        const last4 = row.key_last4 || (row.api_key ? row.api_key.trim().slice(-4) : undefined);
        credentials[row.provider] = {
          connected: true,
          keyLast4: last4,
          updatedAt: row.updated_at,
          lastValidatedAt: row.last_validated_at,
        };
      }
    }

    return json({ ok: true, credentials });
  }

  // DELETE: Remove API key for provider
  if (request.method === 'DELETE') {
    const provider = url.searchParams.get('provider');
    if (!provider || !['openai', 'gemini'].includes(provider)) {
      return json({ error: 'Invalid provider parameter.' }, 400);
    }

    const { error: deleteError } = await adminClient
      .from('user_ai_credentials')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    if (deleteError) return json({ error: 'Could not remove credential.' }, 500);

    return json({ ok: true, provider, connected: false, message: 'Credential removed permanently.' });
  }

  // POST: Save, test, or replace key
  if (request.method === 'POST') {
    try {
      const body = await request.json();
      const { provider, apiKey, skipTest } = body;

      if (!provider || !['openai', 'gemini'].includes(provider)) {
        return json({ error: 'Invalid provider.' }, 400);
      }

      if (action === 'test') {
        let keyToTest = apiKey?.trim();
        if (!keyToTest) {
          // Look up stored key server-side
          const { data: cred } = await adminClient
            .from('user_ai_credentials')
            .select('api_key')
            .eq('user_id', userId)
            .eq('provider', provider)
            .maybeSingle();
          keyToTest = cred?.api_key?.trim();
        }

        if (!keyToTest) return json({ error: 'No API key configured for testing.' }, 400);

        const ok = await testProviderKey(provider, keyToTest);
        if (!ok) return json({ error: 'This API key was rejected by ' + provider + '.' }, 400);
        return json({ ok: true, message: 'Provider key is valid.' });
      }

function normalizeApiKey(input: unknown): string {
  if (typeof input !== 'string') return '';
  let key = input.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/[\r\n\t]/g, '').trim();
  return key;
}

      const cleanKey = normalizeApiKey(apiKey);
      if (!cleanKey) {
        return json({ error: 'API key is required.' }, 400);
      }

      if (!skipTest) {
        const isValid = await testProviderKey(provider, cleanKey);
        if (!isValid) {
          return json({ error: 'The provided key could not be verified with ' + provider + '.' }, 400);
        }
      }

      const last4 = cleanKey.slice(-4);
      const now = new Date().toISOString();

      const { error: upsertError } = await adminClient
        .from('user_ai_credentials')
        .upsert(
          {
            user_id: userId,
            provider,
            api_key: cleanKey,
            key_last4: last4,
            updated_at: now,
            last_validated_at: now,
          },
          { onConflict: 'user_id,provider' }
        );

      if (upsertError) return json({ error: 'Could not store credential.' }, 500);

      return json({
        ok: true,
        provider,
        connected: true,
        keyLast4: last4,
        message: 'Credential saved successfully.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Processing error.';
      return json({ error: message }, 500);
    }
  }

  return json({ error: 'Method not allowed.' }, 405);
});

async function testProviderKey(provider: string, apiKey: string): Promise<boolean> {
  try {
    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return res.ok;
    } else {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
      return res.ok;
    }
  } catch {
    return false;
  }
}

