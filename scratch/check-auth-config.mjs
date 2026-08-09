import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, '')]),
);

const apiUrl = `https://api.supabase.com/v1/projects/${encodeURIComponent(env.SUPABASE_PROJECT_REF)}/config/auth`;

const response = await fetch(apiUrl, {
  headers: {
    Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
  },
});

const config = await response.json();
console.log('URI ALLOW LIST:', config.uri_allow_list);
console.log('EXTERNAL GOOGLE ENABLED:', config.external_google_enabled);
console.log('EXTERNAL GOOGLE CLIENT ID:', config.external_google_client_id ? 'EXISTS' : 'MISSING');
console.log('EXTERNAL GOOGLE SECRET:', config.external_google_secret ? 'EXISTS' : 'MISSING');
