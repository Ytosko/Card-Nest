import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

const projectRoot = resolve(import.meta.dirname, '..');
const envPath = resolve(projectRoot, '.env');
const origin = 'https://cardnest.ytosko.dev';

if (!existsSync(envPath)) throw new Error('A local .env is required for production Auth verification.');

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, '')]),
);

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'POSTMARK_SERVER_TOKEN',
];
const missing = required.filter((name) => !env[name]?.trim());
if (missing.length > 0) throw new Error(`Missing required local configuration names: ${missing.join(', ')}`);

const admin = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});
const publicClient = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});
const testUserIds = new Set();
const postmarkHeaders = {
  Accept: 'application/json',
  'X-Postmark-Server-Token': env.POSTMARK_SERVER_TOKEN,
};

function testEmail(label) {
  return `production-${label}-${randomUUID()}@example.invalid`;
}

function testPassword() {
  return `T3st-${randomBytes(18).toString('base64url')}`;
}

async function createConfirmedUser(label) {
  const { data, error } = await admin.auth.admin.createUser({
    email: testEmail(label),
    password: testPassword(),
    email_confirm: true,
  });
  if (error) throw error;
  testUserIds.add(data.user.id);
  return data.user.email;
}

async function verifyToken(label, tokenHash, type, expectSession = true) {
  const response = await fetch(`${origin}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenHash, type }),
  });
  const result = await response.json();

  if (!response.ok || !result.ok || result.flowType !== type) {
    throw new Error(`${label} verification returned HTTP ${response.status}.`);
  }
  if (expectSession && (!result.session?.accessToken || !result.session?.refreshToken)) {
    throw new Error(`${label} verification did not return a mobile session.`);
  }

  const reuseResponse = await fetch(`${origin}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenHash, type }),
  });
  if (reuseResponse.status !== 400) {
    throw new Error(`${label} token reuse returned HTTP ${reuseResponse.status}.`);
  }
}

async function generatedLink(params) {
  const { data, error } = await admin.auth.admin.generateLink(params);
  if (error) throw error;
  testUserIds.add(data.user.id);
  if (!data.properties.hashed_token) throw new Error('Supabase returned no token hash.');
  return data.properties.hashed_token;
}

function pause(milliseconds) {
  return new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));
}

async function getPostmarkMessage(recipient) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const response = await fetch('https://api.postmarkapp.com/messages/outbound?count=50&offset=0', {
      headers: postmarkHeaders,
    });
    if (!response.ok) throw new Error(`Postmark message search returned HTTP ${response.status}.`);

    const result = await response.json();
    const message = result.Messages?.find((candidate) => candidate.Recipients?.includes(recipient));
    if (message) {
      const detailResponse = await fetch(
        `https://api.postmarkapp.com/messages/outbound/${message.MessageID}/details`,
        { headers: postmarkHeaders },
      );
      if (!detailResponse.ok) {
        if (detailResponse.status === 422) {
          await pause(1_500);
          continue;
        }
        throw new Error(`Postmark message detail returned HTTP ${detailResponse.status}.`);
      }
      return detailResponse.json();
    }

    await pause(1_200);
  }

  throw new Error('Timed out waiting for a hosted email-change message.');
}

function firstPartyCallbackFromHtml(html) {
  const decoded = html.replaceAll('&amp;', '&');
  const match = decoded.match(
    /https:\/\/cardnest\.ytosko\.dev\/auth\/callback\?[^"'<>\s]+/u,
  );
  if (!match) throw new Error('A hosted email did not contain a first-party callback URL.');

  const callback = new URL(match[0]);
  if (callback.origin !== origin) throw new Error('A hosted email exposed a non-Card Nest origin.');

  const tokenHash = callback.searchParams.get('token_hash');
  const type = callback.searchParams.get('type');
  if (!tokenHash || type !== 'email_change') {
    throw new Error('A hosted email contained an invalid email-change callback.');
  }
  return tokenHash;
}

try {
  const signupToken = await generatedLink({
    type: 'signup',
    email: testEmail('signup'),
    password: testPassword(),
    options: { redirectTo: `${origin}/auth/callback` },
  });
  await verifyToken('Signup confirmation', signupToken, 'signup');

  const recoveryEmail = await createConfirmedUser('recovery');
  const recoveryToken = await generatedLink({
    type: 'recovery',
    email: recoveryEmail,
    options: { redirectTo: `${origin}/auth/callback` },
  });
  await verifyToken('Password recovery', recoveryToken, 'recovery');

  const magicToken = await generatedLink({
    type: 'magiclink',
    email: testEmail('magic'),
    options: { redirectTo: `${origin}/auth/callback` },
  });
  // Supabase's generated magic-link token is verified through the generic
  // email OTP type. `magiclink` is a template/generation type, not the
  // verification discriminator accepted for this token.
  await verifyToken('Magic link', magicToken, 'email');

  const inviteToken = await generatedLink({
    type: 'invite',
    email: testEmail('invite'),
    options: { redirectTo: `${origin}/auth/callback` },
  });
  await verifyToken('Invitation', inviteToken, 'invite');

  const emailChangeId = randomUUID().slice(0, 8);
  const currentEmail = `test+${emailChangeId}-old@blackhole.postmarkapp.com`;
  const newEmail = `test+${emailChangeId}-new@blackhole.postmarkapp.com`;
  const emailChangePassword = testPassword();
  const { data: emailChangeUser, error: emailChangeCreateError } = await admin.auth.admin.createUser({
    email: currentEmail,
    password: emailChangePassword,
    email_confirm: true,
  });
  if (emailChangeCreateError) throw emailChangeCreateError;
  testUserIds.add(emailChangeUser.user.id);

  const { error: emailChangeSignInError } = await publicClient.auth.signInWithPassword({
    email: currentEmail,
    password: emailChangePassword,
  });
  if (emailChangeSignInError) throw emailChangeSignInError;

  const { error: emailChangeRequestError } = await publicClient.auth.updateUser(
    { email: newEmail },
    { emailRedirectTo: `${origin}/auth/callback` },
  );
  if (emailChangeRequestError) throw emailChangeRequestError;

  const [currentEmailMessage, newEmailMessage] = await Promise.all([
    getPostmarkMessage(currentEmail),
    getPostmarkMessage(newEmail),
  ]);
  const currentEmailToken = firstPartyCallbackFromHtml(currentEmailMessage.HtmlBody);
  const newEmailToken = firstPartyCallbackFromHtml(newEmailMessage.HtmlBody);
  if (currentEmailToken === newEmailToken) {
    throw new Error('Secure email change returned duplicate approval tokens.');
  }

  await verifyToken('Current email approval', currentEmailToken, 'email_change', false);
  await verifyToken('New email approval', newEmailToken, 'email_change', false);

  const { data: changedUser, error: changedUserError } = await admin.auth.admin.getUserById(
    emailChangeUser.user.id,
  );
  if (changedUserError) throw changedUserError;
  if (changedUser.user.email !== newEmail) {
    throw new Error('Secure email change did not update the disposable account.');
  }

  const malformed = await fetch(`${origin}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenHash: 'not-a-valid-token', type: 'signup' }),
  });
  if (malformed.status !== 400) throw new Error(`Malformed token returned HTTP ${malformed.status}.`);

  console.log('Production Card Nest verification passed for signup, recovery, email change, magic link, invitation, token reuse, and malformed tokens.');
} finally {
  for (const userId of testUserIds) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}
