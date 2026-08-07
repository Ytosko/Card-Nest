import { existsSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const envPath = resolve(import.meta.dirname, '..', '.env');
if (!existsSync(envPath)) throw new Error('A local .env is required for hosted Auth verification.');

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, '')]),
);

const baseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!baseUrl || !publicKey || !serviceKey) throw new Error('Hosted Auth verification credentials are not configured.');

const suffix = randomBytes(10).toString('hex');
const email = `phase3-${suffix}@cardnest.invalid`;
const password = `CardNest-${randomBytes(18).toString('base64url')}!`;
let userId;

async function request(path, { method = 'GET', admin = false, token, body } = {}) {
  const key = admin ? serviceKey : publicKey;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  return { response, payload };
}

try {
  const created = await request('/auth/v1/admin/users', {
    method: 'POST',
    admin: true,
    body: { email, password, email_confirm: false, user_metadata: { display_name: 'Phase 3 verifier' } },
  });
  if (!created.response.ok || !created.payload?.id) throw new Error(`Test user creation failed with HTTP ${created.response.status}.`);
  userId = created.payload.id;

  const unconfirmed = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (unconfirmed.response.ok || unconfirmed.payload?.error_code !== 'email_not_confirmed') {
    throw new Error('Hosted Auth did not block an unconfirmed email/password account.');
  }

  const confirmed = await request(`/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    admin: true,
    body: { email_confirm: true },
  });
  if (!confirmed.response.ok) throw new Error(`Test user confirmation failed with HTTP ${confirmed.response.status}.`);

  const signedIn = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
  if (!signedIn.response.ok || !signedIn.payload?.access_token || !signedIn.payload?.refresh_token) {
    throw new Error(`Password sign-in failed with HTTP ${signedIn.response.status}.`);
  }

  const profile = await request(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}&select=user_id,display_name`, {
    token: signedIn.payload.access_token,
  });
  if (!profile.response.ok || profile.payload?.length !== 1 || profile.payload[0].user_id !== userId) {
    throw new Error('The auth-user profile trigger or owner RLS verification failed.');
  }

  const updated = await request(`/rest/v1/profiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    token: signedIn.payload.access_token,
    body: { display_name: 'Verified Card Nest user' },
  });
  if (!updated.response.ok) throw new Error(`Profile update failed with HTTP ${updated.response.status}.`);

  const signedOut = await request('/auth/v1/logout', { method: 'POST', token: signedIn.payload.access_token });
  if (!signedOut.response.ok) throw new Error(`Sign-out failed with HTTP ${signedOut.response.status}.`);

  console.log('Hosted Auth flow passed: confirmation enforcement, password sign-in, session issuance, profile provisioning/RLS, profile update, and sign-out.');
} finally {
  if (userId) {
    const removed = await request(`/auth/v1/admin/users/${userId}`, { method: 'DELETE', admin: true });
    if (!removed.response.ok) throw new Error(`Temporary Auth verifier cleanup failed with HTTP ${removed.response.status}.`);
  }
}
