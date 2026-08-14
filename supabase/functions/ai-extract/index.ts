import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Dedicated master encryption key derived via SHA-256
async function getEncryptionKey(version = 1): Promise<CryptoKey> {
  let secret: string | undefined;
  if (version === 1) {
    secret = Deno.env.get('AI_CREDENTIAL_ENCRYPTION_KEY');
  } else if (version === 2) {
    secret = Deno.env.get('AI_CREDENTIAL_ENCRYPTION_KEY_V2') || Deno.env.get('AI_CREDENTIAL_ENCRYPTION_KEY');
  }

  if (!secret || secret.trim().length < 16) {
    throw new Error('AI_ENCRYPTION_KEY_NOT_CONFIGURED');
  }

  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptApiKey(
  plaintext: string,
  version = 1
): Promise<{ ciphertext: string; iv: string; authTag: string; encryptionVersion: number }> {
  const key = await getEncryptionKey(version);
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

  return { ciphertext, iv, authTag, encryptionVersion: version };
}

// AES-256-GCM Decryption with tag verification, key versioning, and legacy fallback
async function decryptApiKey(
  ciphertextB64: string,
  ivB64: string,
  authTagB64: string,
  version = 1
): Promise<{ decryptedKey: string; legacyMigrated: boolean }> {
  let primaryKey: CryptoKey | null = null;
  try {
    primaryKey = await getEncryptionKey(version);
  } catch (keyErr) {
    if (version > 1) throw keyErr;
  }

  const ciphertextBytes = Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
  const authTagBytes = Uint8Array.from(atob(authTagB64), (c) => c.charCodeAt(0));

  const combinedBuffer = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combinedBuffer.set(ciphertextBytes);
  combinedBuffer.set(authTagBytes, ciphertextBytes.length);

  if (primaryKey) {
    try {
      const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, primaryKey, combinedBuffer);
      const decoder = new TextDecoder();
      return { decryptedKey: decoder.decode(decryptedBuffer), legacyMigrated: false };
    } catch {
      // Primary key failed; fallback to legacy derivation if available
    }
  }

  const legacySecret = Deno.env.get('AI_CREDENTIAL_ENCRYPTION_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacySecret) {
    try {
      const enc = new TextEncoder();
      const legacyKeyData = enc.encode(legacySecret.padEnd(32, '!').slice(0, 32));
      const legacyKey = await crypto.subtle.importKey('raw', legacyKeyData, { name: 'AES-GCM' }, false, ['decrypt']);
      const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, legacyKey, combinedBuffer);
      const decoder = new TextDecoder();
      return { decryptedKey: decoder.decode(decryptedBuffer), legacyMigrated: true };
    } catch {
      // Legacy decryption also failed
    }
  }

  throw new Error('AI_DECRYPTION_FAILED');
}

// Convert standard JSON schema to Gemini v1beta Schema (Uppercase Types, No additionalProperties)
function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return schema;

  const geminiTypeMap: Record<string, string> = {
    object: 'OBJECT',
    string: 'STRING',
    number: 'NUMBER',
    integer: 'INTEGER',
    boolean: 'BOOLEAN',
    array: 'ARRAY',
  };

  const result: Record<string, unknown> = {};
  if (schema.type) {
    const lower = String(schema.type).toLowerCase();
    result.type = geminiTypeMap[lower] || String(schema.type).toUpperCase();
  }

  if (schema.properties && typeof schema.properties === 'object') {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      props[key] = toGeminiSchema(value as Record<string, unknown>);
    }
    result.properties = props;
  }

  if (schema.items && typeof schema.items === 'object') {
    result.items = toGeminiSchema(schema.items as Record<string, unknown>);
  }

  if (schema.required && Array.isArray(schema.required)) {
    result.required = schema.required;
  }

  return result;
}

const openAiJsonSchema = {
  type: 'object',
  properties: {
    documentClassification: {
      type: 'object',
      properties: {
        result: { type: 'string', enum: ['VALID_CARD', 'UNCERTAIN_CARD', 'NOT_A_CARD'] },
        confidence: { type: 'number' },
        reason: { type: 'string' },
      },
      required: ['result', 'confidence', 'reason'],
      additionalProperties: false,
    },
    displayName: { type: 'string' },
    firstName: { type: 'string' },
    middleName: { type: 'string' },
    lastName: { type: 'string' },
    company: { type: 'string' },
    jobTitle: { type: 'string' },
    department: { type: 'string' },
    emails: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          label: { type: 'string' },
          isPrimary: { type: 'boolean' },
        },
        required: ['email', 'label', 'isPrimary'],
        additionalProperties: false,
      },
    },
    phones: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'string' },
          label: { type: 'string' },
          service: { type: 'string' },
          serviceLabel: { type: 'string' },
          isPrimary: { type: 'boolean' },
        },
        required: ['number', 'label', 'service', 'serviceLabel', 'isPrimary'],
        additionalProperties: false,
      },
    },
    websites: { type: 'array', items: { type: 'string' } },
    addressLine1: { type: 'string' },
    addressLine2: { type: 'string' },
    city: { type: 'string' },
    stateRegion: { type: 'string' },
    postalCode: { type: 'string' },
    country: { type: 'string' },
    notes: { type: 'string' },
    rawText: { type: 'string' },
    confidence: { type: 'number' },
  },
  required: [
    'documentClassification',
    'displayName',
    'firstName',
    'middleName',
    'lastName',
    'company',
    'jobTitle',
    'department',
    'emails',
    'phones',
    'websites',
    'addressLine1',
    'addressLine2',
    'city',
    'stateRegion',
    'postalCode',
    'country',
    'notes',
    'rawText',
    'confidence',
  ],
  additionalProperties: false,
};

const geminiJsonSchema = toGeminiSchema(openAiJsonSchema);

const extractionPrompt = `Extract contact information from business cards according to the business_card JSON schema.
Classification Rules:
1. Set documentClassification.result to "VALID_CARD" if this is a standard visiting or business card.
2. Set documentClassification.result to "UNCERTAIN_CARD" if image is partially illegible, handwritten, or ambiguous.
3. Set documentClassification.result to "NOT_A_CARD" if the image contains no business card or contact info.

Multilingual Rules:
- Original native script text MUST NOT be translated (e.g. keep Bengali, Arabic, Chinese characters in native script).
- Preserve rawText fully.
- Set confidence between 0 and 1.`;

function classifyProviderError(status: number, errText: string): string {
  const lower = errText.toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('invalid_api_key') ||
    lower.includes('invalid api key') ||
    lower.includes('api key not valid') ||
    lower.includes('api_key_invalid')
  ) {
    return 'AI_AUTH_FAILED';
  }
  if (status === 429 || lower.includes('quota') || lower.includes('rate_limit')) {
    return 'AI_RATE_LIMITED';
  }
  if (
    lower.includes('model_not_found') ||
    lower.includes('is not found') ||
    lower.includes('was not found') ||
    lower.includes('decommissioned') ||
    lower.includes('deprecated')
  ) {
    return 'AI_MODEL_UNAVAILABLE';
  }
  if (status === 400) return 'AI_MODEL_UNSUPPORTED';
  return 'AI_PROVIDER_ERROR';
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' }, 200);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    return json({ ok: false, code: 'AI_AUTH_FAILED', message: 'Authentication token required.' }, 200);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ ok: false, code: 'AI_PROVIDER_ERROR', message: 'Server configuration error.' }, 200);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ ok: false, code: 'AI_AUTH_FAILED', message: 'Your session is no longer valid.' }, 200);
  }
  const userId = userData.user.id;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await request.json().catch(() => ({}));
    let { provider, model, images } = body;

    // 1. Auto-resolve active provider server-side if missing from payload
    if (!provider || !['openai', 'gemini'].includes(provider)) {
      const { data: prefRow } = await adminClient
        .from('user_preferences')
        .select('selected_ai_provider')
        .eq('user_id', userId)
        .maybeSingle();

      if (prefRow?.selected_ai_provider && ['openai', 'gemini'].includes(prefRow.selected_ai_provider)) {
        provider = prefRow.selected_ai_provider;
      } else {
        const { data: creds } = await adminClient
          .from('user_ai_credentials')
          .select('provider')
          .eq('user_id', userId);

        if (creds?.some((c: { provider: string }) => c.provider === 'gemini')) provider = 'gemini';
        else if (creds?.some((c: { provider: string }) => c.provider === 'openai')) provider = 'openai';
        else provider = 'gemini';
      }
    }

    // 2. Auto-resolve selected model server-side if missing from payload
    if (!model || typeof model !== 'string' || !model.trim()) {
      const { data: prefRow } = await adminClient
        .from('user_preferences')
        .select('selected_ai_model, gemini_selected_model, openai_selected_model')
        .eq('user_id', userId)
        .maybeSingle();

      const prefModel = provider === 'gemini' ? prefRow?.gemini_selected_model : prefRow?.openai_selected_model;
      model = prefModel || prefRow?.selected_ai_model || (provider === 'gemini' ? 'gemini-2.5-flash' : 'gpt-4o');
    }

    if (!images || !Array.isArray(images) || images.length === 0) {
      console.warn(`[CardNest AI Pipeline] IMAGE_READ_ERROR`, JSON.stringify({ userId, provider, model }));
      return json({ ok: false, code: 'IMAGE_READ_ERROR', message: "We couldn't process this image. Please try another photo." }, 200);
    }

    // Fetch user's plaintext credentials server-side for this provider
    const { data: credRow, error: credError } = await adminClient
      .from('user_ai_credentials')
      .select('api_key, key_last4')
      .eq('user_id', userId)
      .eq('provider', provider)
      .maybeSingle();

    const apiKey = credRow?.api_key?.trim();

    console.log(
      `[CardNest AI Pipeline] ai_config_loaded`,
      JSON.stringify({
        userId,
        provider,
        selectedModel: model,
        credentialFound: Boolean(apiKey),
        keyLast4: credRow?.key_last4 || (apiKey ? apiKey.slice(-4) : undefined),
        imageCount: images.length,
        imageReadable: true,
      })
    );

    if (credError || !apiKey) {
      console.warn(`[CardNest AI Pipeline] AI_CREDENTIAL_MISSING`, JSON.stringify({ userId, provider }));
      return json(
        {
          ok: false,
          code: 'AI_CREDENTIAL_MISSING',
          message: 'AI extraction is temporarily unavailable.',
          action: 'open_settings',
        },
        200
      );
    }

    let extractedText: string | null = null;
    let providerStatus = 0;

    try {
      console.log(`[CardNest AI Pipeline] providerRequestStarted`, JSON.stringify({ provider, selectedModel: model }));

      if (provider === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: extractionPrompt },
                  ...images.map((data: string) => {
                    const cleanBase64 = data.replace(/^data:image\/[a-zA-Z]+;base64,/u, '');
                    return { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } };
                  }),
                ],
              },
            ],
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'business_card', strict: true, schema: openAiJsonSchema },
            },
          }),
        });

        providerStatus = response.status;

        if (!response.ok) {
          const errBody = await response.text();
          const code = classifyProviderError(response.status, errBody);
          console.warn(`[CardNest AI Pipeline] providerRequestFailed`, JSON.stringify({ provider, selectedModel: model, providerStatus, finalFailureCode: code }));
          
          let message = 'AI extraction is temporarily unavailable.';
          if (code === 'AI_MODEL_UNSUPPORTED' || code === 'AI_MODEL_UNAVAILABLE') {
            message = "The selected AI model can't process card images. Choose another model.";
          }
          return json({ ok: false, code, provider: 'openai', providerStatus, message }, 200);
        }
        const body = await response.json();
        extractedText = body.choices?.[0]?.message?.content ?? null;
      } else {
        const modelName = model.startsWith('models/') ? model.slice(7) : model;
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: extractionPrompt },
                    ...images.map((data: string) => {
                      const cleanBase64 = data.replace(/^data:image\/[a-zA-Z]+;base64,/u, '');
                      return { inline_data: { mime_type: 'image/jpeg', data: cleanBase64 } };
                    }),
                  ],
                },
              ],
              generationConfig: { responseMimeType: 'application/json', responseSchema: geminiJsonSchema },
            }),
          }
        );

        providerStatus = response.status;

        if (!response.ok) {
          const errBody = await response.text();
          const code = classifyProviderError(response.status, errBody);
          console.warn(`[CardNest AI Pipeline] providerRequestFailed`, JSON.stringify({ provider, selectedModel: model, providerStatus, finalFailureCode: code }));

          let message = 'AI extraction is temporarily unavailable.';
          if (code === 'AI_MODEL_UNSUPPORTED' || code === 'AI_MODEL_UNAVAILABLE') {
            message = "The selected AI model can't process card images. Choose another model.";
          }
          return json({ ok: false, code, provider: 'gemini', providerStatus, message }, 200);
        }
        const body = await response.json();
        extractedText = body.candidates?.[0]?.content?.parts?.find((p: { text?: string }) => p.text)?.text ?? null;
      }
    } catch (netErr) {
      console.warn(`[CardNest AI Pipeline] AI_NETWORK_ERROR`, JSON.stringify({ provider, selectedModel: model }));
      return json({ ok: false, code: 'AI_NETWORK_ERROR', message: 'AI extraction is temporarily unavailable.' }, 200);
    }

    if (!extractedText) {
      console.warn(`[CardNest AI Pipeline] AI_RESPONSE_INVALID`, JSON.stringify({ provider, selectedModel: model, responseSchemaValid: false }));
      return json({ ok: false, code: 'AI_RESPONSE_INVALID', message: "We couldn't extract the contact details. Please retry." }, 200);
    }

    try {
      const parsedJson = JSON.parse(extractedText);
      const docResult = parsedJson?.documentClassification?.result;

      console.log(
        `[CardNest AI Pipeline] extractionComplete`,
        JSON.stringify({
          provider,
          selectedModel: model,
          responseSchemaValid: true,
          documentClassification: docResult,
          finalFailureCode: docResult === 'NOT_A_CARD' ? 'NOT_A_CARD' : 'SUCCESS',
        })
      );

      if (docResult === 'NOT_A_CARD') {
        return json({
          ok: false,
          code: 'NOT_A_CARD',
          message: "This doesn't look like a contact card.",
          result: parsedJson,
        }, 200);
      }

      return json({ ok: true, result: parsedJson, provider, model });
    } catch {
      console.warn(`[CardNest AI Pipeline] AI_RESPONSE_INVALID`, JSON.stringify({ provider, selectedModel: model, responseSchemaValid: false }));
      return json({ ok: false, code: 'AI_RESPONSE_INVALID', message: "We couldn't extract the contact details. Please retry." }, 200);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server extraction failed.';
    return json({ ok: false, code: 'AI_PROVIDER_ERROR', message }, 200);
  }
});
