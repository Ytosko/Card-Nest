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

// Encryption key derived from server-only secret
async function getEncryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('AI_CREDENTIAL_ENCRYPTION_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret || secret.length < 16) throw new Error('AI credential encryption is not configured on server.');
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret.padEnd(32, '!').slice(0, 32));
  return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function decryptApiKey(ciphertextB64: string, ivB64: string, authTagB64: string): Promise<string> {
  const key = await getEncryptionKey();
  const ciphertext = Uint8Array.from(atob(ciphertextB64), (char) => char.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivB64), (char) => char.charCodeAt(0));
  const authTag = Uint8Array.from(atob(authTagB64), (char) => char.charCodeAt(0));
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext);
  combined.set(authTag, ciphertext.length);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
  return new TextDecoder().decode(decrypted);
}

async function encryptApiKey(plaintext: string): Promise<{ ciphertext: string; iv: string; authTag: string }> {
  const key = await getEncryptionKey();
  const ivBytes = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encodedText = encoder.encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: ivBytes }, key, encodedText);
  const encryptedArray = new Uint8Array(encryptedBuffer);

  const tagLength = 16;
  const ciphertextBytes = encryptedArray.slice(0, encryptedArray.length - tagLength);
  const tagBytes = encryptedArray.slice(encryptedArray.length - tagLength);

  const ciphertext = btoa(String.fromCharCode(...ciphertextBytes));
  const iv = btoa(String.fromCharCode(...ivBytes));
  const authTag = btoa(String.fromCharCode(...tagBytes));

  return { ciphertext, iv, authTag };
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

  // GET: Fetch safe credential status or dynamic model list (ZERO key material returned)
  if (request.method === 'GET') {
    if (action === 'models') {
      const provider = url.searchParams.get('provider');
      if (!provider || !['openai', 'gemini'].includes(provider)) return json({ error: 'Invalid provider.' }, 400);
      const { data: credential, error: credentialError } = await adminClient
        .from('user_ai_credentials')
        .select('encrypted_key, iv, auth_tag')
        .eq('user_id', userId)
        .eq('provider', provider)
        .maybeSingle();

      if (credentialError || !credential) return json({ error: `Configure a ${provider} key before loading models.` }, 400);

      let decryptedKey: string | null = null;
      try {
        decryptedKey = await decryptApiKey(credential.encrypted_key, credential.iv, credential.auth_tag);
        if (provider === 'openai') {
          const response = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${decryptedKey}` } });
          if (!response.ok) return json({ error: 'OpenAI model discovery failed.' }, 400);
          const body = await response.json();
          const models = (body.data || []).map((model: { id?: string }) => model.id).filter(Boolean).sort();
          return json({ ok: true, models });
        }
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(decryptedKey)}`);
        if (!response.ok) return json({ error: 'Gemini model discovery failed.' }, 400);
        const body = await response.json();
        const models = (body.models || [])
          .filter((model: { supportedGenerationMethods?: string[] }) => model.supportedGenerationMethods?.includes('generateContent'))
          .map((model: { name?: string }) => model.name)
          .filter(Boolean)
          .sort();
        return json({ ok: true, models });
      } catch {
        return json({ error: 'Encrypted provider credential could not be decrypted. Save the key again.' }, 400);
      } finally {
        decryptedKey = null;
      }
    }

    // Fetch safe metadata status only (no raw key material)
    const { data: rows, error: fetchError } = await adminClient
      .from('user_ai_credentials')
      .select('provider, updated_at, last_validated_at')
      .eq('user_id', userId);

    if (fetchError) return json({ error: 'Could not fetch credential metadata.' }, 500);

    const credentials: Record<string, { connected: boolean; updatedAt: string; lastValidatedAt?: string }> = {};
    for (const row of rows || []) {
      credentials[row.provider] = {
        connected: true,
        updatedAt: row.updated_at,
        lastValidatedAt: row.last_validated_at,
      };
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
        const keyToTest = apiKey?.trim();
        if (!keyToTest) return json({ error: 'API key is required for testing.' }, 400);

        const ok = await testProviderKey(provider, keyToTest);
        if (!ok) return json({ error: 'This API key was rejected by ' + provider + '.' }, 400);
        return json({ ok: true, message: 'Provider key is valid.' });
      }

      // Save encrypted key
      if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
        return json({ error: 'API key is required.' }, 400);
      }

      const cleanKey = apiKey.trim();
      if (!skipTest) {
        const isValid = await testProviderKey(provider, cleanKey);
        if (!isValid) {
          return json({ error: 'The provided key could not be verified with ' + provider + '.' }, 400);
        }
      }

      const { ciphertext, iv, authTag } = await encryptApiKey(cleanKey);
      const now = new Date().toISOString();

      const { error: upsertError } = await adminClient
        .from('user_ai_credentials')
        .upsert(
          {
            user_id: userId,
            provider,
            encrypted_key: ciphertext,
            iv,
            auth_tag: authTag,
            updated_at: now,
            last_validated_at: now,
          },
          { onConflict: 'user_id,provider' }
        );

      if (upsertError) return json({ error: 'Could not store encrypted credential.' }, 500);

      return json({
        ok: true,
        provider,
        connected: true,
        message: 'Credential encrypted and saved successfully.',
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
