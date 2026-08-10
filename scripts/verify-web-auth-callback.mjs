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

  const callbackUrl = `${origin}/auth/callback?token_hash=${encodeURIComponent(tokenHash)}&type=signup&next=%2Fapp`;
  const firstResponse = await fetch(callbackUrl, { redirect: 'manual' });
  const setCookies = typeof firstResponse.headers.getSetCookie === 'function'
    ? firstResponse.headers.getSetCookie()
    : [firstResponse.headers.get('set-cookie')].filter(Boolean);

  if (firstResponse.status !== 303 || setCookies.length === 0) {
    throw new Error(`First-party callback did not persist a session; received HTTP ${firstResponse.status}.`);
  }

  const destination = new URL(firstResponse.headers.get('location') ?? '/', origin);
  if (destination.pathname !== '/app') {
    throw new Error('First-party callback did not route the verified session to /app.');
  }

  const cookieHeader = setCookies.map((value) => value.split(';', 1)[0]).join('; ');
  const appResponse = await fetch(`${origin}/app`, {
    headers: { Cookie: cookieHeader },
    redirect: 'manual',
  });
  const appHtml = await appResponse.text();
  if (appResponse.status !== 200 || !appHtml.includes('Securing your Card Nest')) {
    throw new Error(`The persisted callback session did not pass the /app route guard; received HTTP ${appResponse.status}.`);
  }

  const reuseResponse = await fetch(callbackUrl, { redirect: 'manual' });
  const reuseDestination = new URL(reuseResponse.headers.get('location') ?? '/', origin);
  if (reuseResponse.status !== 303 || reuseDestination.pathname !== '/auth') {
    throw new Error(`Used token was not rejected by the callback; received HTTP ${reuseResponse.status}.`);
  }

  console.log('First-party Card Nest callback persisted a real session, passed the /app guard, and rejected token reuse.');
} finally {
  if (testUserId) {
    const { error } = await admin.auth.admin.deleteUser(testUserId);
    if (error) throw error;
  }
}
