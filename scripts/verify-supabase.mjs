import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const envPath = resolve(projectRoot, '.env');

if (!existsSync(envPath)) {
  throw new Error('A local .env is required for remote Supabase verification.');
}

const values = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, '')]),
);

const url = values.EXPO_PUBLIC_SUPABASE_URL;
const publicKey = values.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = values.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !publicKey || !serviceKey) {
  throw new Error('Supabase URL, public key, and service-role key must be configured for verification.');
}

const anonymousCardsResponse = await fetch(`${url}/rest/v1/cards?select=id&limit=1`, {
  headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
});

if (anonymousCardsResponse.ok) {
  const rows = await anonymousCardsResponse.json();
  if (!Array.isArray(rows) || rows.length !== 0) {
    throw new Error('Anonymous card access returned user data.');
  }
} else if (![401, 403].includes(anonymousCardsResponse.status)) {
  throw new Error(`Unexpected anonymous cards response: HTTP ${anonymousCardsResponse.status}.`);
}

for (const bucketId of ['card-images', 'profile-avatars']) {
  const bucketResponse = await fetch(`${url}/storage/v1/bucket/${bucketId}`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });

  if (!bucketResponse.ok) {
    throw new Error(`Unable to verify private Storage bucket ${bucketId}: HTTP ${bucketResponse.status}.`);
  }

  const bucket = await bucketResponse.json();
  if (bucket.id !== bucketId || bucket.public !== false) {
    throw new Error(`The ${bucketId} Storage bucket is missing or public.`);
  }
}

console.log('Remote verification passed: anonymous card data is unavailable and both user-media buckets are private.');
