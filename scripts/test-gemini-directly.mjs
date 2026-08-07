import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function getEncryptionKey() {
  const secret = process.env.AI_CREDENTIAL_ENCRYPTION_KEY || 'cardnest_master_ai_credential_secret_key_v1_32bytes!!';
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret.padEnd(32, '!').slice(0, 32));
  return crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function decryptApiKey(ciphertextB64, ivB64, authTagB64) {
  const key = await getEncryptionKey();
  const ciphertextBytes = Uint8Array.from(Buffer.from(ciphertextB64, 'base64'));
  const ivBytes = Uint8Array.from(Buffer.from(ivB64, 'base64'));
  const authTagBytes = Uint8Array.from(Buffer.from(authTagB64, 'base64'));

  const combinedBuffer = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combinedBuffer.set(ciphertextBytes);
  combinedBuffer.set(authTagBytes, ciphertextBytes.length);

  const decryptedBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, combinedBuffer);
  return new TextDecoder().decode(decryptedBuffer);
}

function toGeminiSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;

  const geminiTypeMap = {
    object: 'OBJECT',
    string: 'STRING',
    number: 'NUMBER',
    integer: 'INTEGER',
    boolean: 'BOOLEAN',
    array: 'ARRAY',
  };

  const result = {};
  if (schema.type) {
    const lower = String(schema.type).toLowerCase();
    result.type = geminiTypeMap[lower] || String(schema.type).toUpperCase();
  }

  if (schema.properties) {
    result.properties = {};
    for (const [key, value] of Object.entries(schema.properties)) {
      result.properties[key] = toGeminiSchema(value);
    }
  }

  if (schema.items) {
    result.items = toGeminiSchema(schema.items);
  }

  if (schema.required && Array.isArray(schema.required)) {
    result.required = schema.required;
  }

  return result;
}

const standardSchema = {
  type: 'object',
  properties: {
    displayName: { type: 'string' },
    firstName: { type: 'string' },
    middleName: { type: 'string' },
    lastName: { type: 'string' },
    company: { type: 'string' },
    jobTitle: { type: 'string' },
    department: { type: 'string' },
    emails: { type: 'array', items: { type: 'string' } },
    phones: { type: 'array', items: { type: 'string' } },
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
};

const geminiSchema = toGeminiSchema(standardSchema);

// Minimal 1x1 red PNG base64 for testing
const dummyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function testAll() {
  const { data: rows } = await admin.from('user_ai_credentials').select('*').eq('provider', 'gemini');
  if (!rows?.length) return;
  const apiKey = await decryptApiKey(rows[0].encrypted_key, rows[0].iv, rows[0].auth_tag);
  const model = 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  // Test 1: Single image request
  console.log('[Test: 1 Small Image] Sending 1 image to Gemini 3.5 Flash-Lite...');
  const res1 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Extract contact details if present on this image.' },
            { inline_data: { mime_type: 'image/png', data: dummyImageBase64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', responseSchema: geminiSchema },
    }),
  });
  console.log('1 Image HTTP Status:', res1.status);
  const body1 = await res1.json();
  console.log('1 Image Result Parsed:', Boolean(body1.candidates?.[0]?.content?.parts?.[0]?.text));

  // Test 2: Two image request
  console.log('\n[Test: 2 Images (Front + Back)] Sending 2 images to Gemini 3.5 Flash-Lite...');
  const res2 = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Extract contact details from front and back business-card images.' },
            { inline_data: { mime_type: 'image/png', data: dummyImageBase64 } },
            { inline_data: { mime_type: 'image/png', data: dummyImageBase64 } },
          ],
        },
      ],
      generationConfig: { responseMimeType: 'application/json', responseSchema: geminiSchema },
    }),
  });
  console.log('2 Images HTTP Status:', res2.status);
  const body2 = await res2.json();
  const rawText2 = body2.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  console.log('2 Images Result Parsed:\n', rawText2);
}

testAll().catch(console.error);
