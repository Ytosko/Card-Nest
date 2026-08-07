import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const projectRoot = resolve(import.meta.dirname, '..');
const envPath = resolve(projectRoot, '.env');
const origin = process.env.WEB_AUTH_VERIFY_ORIGIN ?? 'http://127.0.0.1:3100';

if (!existsSync(envPath)) throw new Error('A local .env is required for callback verification.');

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, '')]),
);

const required = ['EXPO_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const missing = required.filter((name) => !env[name]?.trim());
if (missing.length > 0) throw new Error(`Missing required local configuration names: ${missing.join(', ')}`);

const admin = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
});

let testUserId;

try {
  const email = `web-callback-${randomUUID()}@example.invalid`;
  const password = `T3st-${randomBytes(18).toString('base64url')}`;
  const { data, error } = await admin.auth.admin.generateLink({ type: 'signup', email, password });

  if (error) throw error;
  testUserId = data.user.id;

  const tokenHash = data.properties.hashed_token;
  if (!tokenHash) throw new Error('Supabase did not return a signup token hash.');

  const firstResponse = await fetch(`${origin}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenHash, type: 'signup' }),
  });
  const firstResult = await firstResponse.json();

  if (
    !firstResponse.ok ||
    !firstResult.ok ||
    firstResult.flowType !== 'signup' ||
    !firstResult.session?.accessToken ||
    !firstResult.session?.refreshToken
  ) {
    throw new Error(`First-party callback verification returned HTTP ${firstResponse.status}.`);
  }

  const reuseResponse = await fetch(`${origin}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenHash, type: 'signup' }),
  });

  if (reuseResponse.status !== 400) {
    throw new Error(`Used token was not rejected; received HTTP ${reuseResponse.status}.`);
  }

  console.log('First-party Card Nest callback verified a real signup token and rejected its reuse.');
} finally {
  if (testUserId) {
    const { error } = await admin.auth.admin.deleteUser(testUserId);
    if (error) throw error;
  }
}
