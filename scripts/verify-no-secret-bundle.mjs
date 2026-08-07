import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const envPath = resolve(projectRoot, '.env');
const bundlePath = resolve(projectRoot, 'dist');
if (!existsSync(envPath) || !existsSync(bundlePath)) throw new Error('A local .env and completed Expo export are required.');

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, '')]),
);
const serverOnlyNames = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'SUPABASE_POOLER_URL',
  'POSTMARK_SERVER_TOKEN',
  'SMTP_USER',
  'SMTP_PASS',
];

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : statSync(path).size <= 10_000_000 ? [path] : [];
  });
}

const bundleText = filesUnder(bundlePath).map((path) => readFileSync(path, 'utf8')).join('\n');
const leaks = serverOnlyNames.filter((name) => env[name]?.length >= 8 && bundleText.includes(env[name]));
if (leaks.length > 0) throw new Error(`Server-only values appeared in the Expo export: ${leaks.join(', ')}`);

console.log('Expo export secret scan passed: no configured server, database, SMTP, or Postmark credentials were bundled.');
