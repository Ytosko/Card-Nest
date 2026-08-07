import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const envPath = resolve(projectRoot, '.env');
const examplePath = resolve(projectRoot, '.env.example');
const requiredPublicNames = [
  'EXPO_PUBLIC_APP_NAME',
  'EXPO_PUBLIC_APP_ENV',
  'EXPO_PUBLIC_APP_SCHEME',
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
];
const serverOnlyNames = [
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY',
  'POSTMARK_SERVER_TOKEN',
  'SMTP_PASS',
];

function parseEnvFile(path) {
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/u)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, '')]),
  );
}

if (!existsSync(examplePath)) {
  throw new Error('Missing .env.example.');
}

const example = parseEnvFile(examplePath);
const missingFromExample = requiredPublicNames.filter((name) => !(name in example));
if (missingFromExample.length > 0) {
  throw new Error(`.env.example is missing required names: ${missingFromExample.join(', ')}`);
}

const publicServerLeaks = serverOnlyNames.filter((name) => name.startsWith('EXPO_PUBLIC_'));
if (publicServerLeaks.length > 0) {
  throw new Error(`Server-only names cannot be public: ${publicServerLeaks.join(', ')}`);
}

if (!existsSync(envPath)) {
  console.log('Environment template is valid. Local .env is not present; runtime validation will remain active.');
  process.exit(0);
}

const local = parseEnvFile(envPath);
const missingLocal = requiredPublicNames.filter((name) => {
  const value = local[name]?.trim();
  return !value || /YOUR_|PLACEHOLDER/u.test(value);
});

if (missingLocal.length > 0) {
  throw new Error(`Local .env is missing configured values for: ${missingLocal.join(', ')}`);
}

console.log('Environment names and mobile/server boundaries are valid. Secret values were not displayed.');
