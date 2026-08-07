import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const envPath = resolve(import.meta.dirname, '..', '.env');
if (!existsSync(envPath)) throw new Error('A local .env is required for account-deletion verification.');
const env = Object.fromEntries(readFileSync(envPath, 'utf8').split(/\r?\n/u).map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u)).filter(Boolean).map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, '')]));
for (const name of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']) if (!env[name]) throw new Error(`Missing local configuration name: ${name}`);

const admin = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
let userId;
try {
  const unauthorized = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, { method: 'POST', headers: { apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: '{}' });
  if (unauthorized.status !== 401) throw new Error(`Unauthenticated account deletion returned HTTP ${unauthorized.status}.`);

  const email = `delete-account-${randomUUID()}@example.invalid`;
  const password = `D3lete-${randomBytes(18).toString('base64url')}!`;
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError) throw createError;
  userId = created.user.id;
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !signedIn.session) throw signInError ?? new Error('Disposable deletion session was not created.');

  const response = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`, {
    method: 'POST',
    headers: { apikey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${signedIn.session.access_token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!response.ok) throw new Error(`Authenticated account deletion returned HTTP ${response.status}.`);

  const { data: lookup } = await admin.auth.admin.getUserById(userId);
  if (lookup.user) throw new Error('The disposable user still exists after deletion.');
  userId = undefined;
  console.log('Account-deletion verification passed: anonymous access was rejected and a disposable authenticated account was removed.');
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
}
