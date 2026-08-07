import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const envPath = resolve(projectRoot, '.env');
const verifyOnly = process.argv.includes('--verify-only');
const listKeysOnly = process.argv.includes('--list-keys');

if (!existsSync(envPath)) throw new Error('A local .env is required for Supabase Auth configuration.');

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/u))
    .filter(Boolean)
    .map((match) => [match[1], match[2].replace(/^['"]|['"]$/gu, '')]),
);

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'SUPABASE_PROJECT_REF',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
  'POSTMARK_SERVER_TOKEN',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM_EMAIL',
  'SMTP_FROM_NAME',
];
const missing = required.filter((name) => !env[name]?.trim());
if (missing.length > 0) throw new Error(`Missing required local configuration names: ${missing.join(', ')}`);

const apiUrl = `https://api.supabase.com/v1/projects/${encodeURIComponent(env.SUPABASE_PROJECT_REF)}/config/auth`;
const logoObjectName = 'cardnest-email-logo.png';
const logoUrl = `${env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/brand-assets/${logoObjectName}`;
const templateNames = ['confirmation', 'recovery', 'email-change', 'magic-link', 'invite'];

async function managementRequest(method, body) {
  const response = await fetch(apiUrl, {
    method,
    headers: {
      Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    let detail = await response.text();
    for (const value of Object.values(env)) {
      if (value.length >= 6) detail = detail.replaceAll(value, '[redacted]');
    }
    throw new Error(`Supabase Auth Management API returned HTTP ${response.status}: ${detail.slice(0, 600)}`);
  }
  return response.json();
}

async function loadTemplates() {
  const entries = await Promise.all(
    templateNames.map(async (name) => {
      const source = await readFile(resolve(projectRoot, 'supabase', 'templates', `${name}.html`), 'utf8');
      return [name, source.replaceAll('__CARDNEST_LOGO_URL__', logoUrl)];
    }),
  );
  return Object.fromEntries(entries);
}

async function uploadLogo() {
  const logo = await readFile(resolve(projectRoot, 'assets', 'images', 'cardnest-icon.png'));
  const response = await fetch(
    `${env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/brand-assets/${logoObjectName}`,
    {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
      },
      body: logo,
    },
  );
  if (!response.ok) throw new Error(`Brand asset upload returned HTTP ${response.status}. Apply migrations first.`);
}

async function verifyPostmarkToken() {
  const response = await fetch('https://api.postmarkapp.com/server', {
    headers: { Accept: 'application/json', 'X-Postmark-Server-Token': env.POSTMARK_SERVER_TOKEN },
  });
  if (!response.ok) throw new Error(`Postmark server verification returned HTTP ${response.status}.`);
  const server = await response.json();
  if (server.TrackLinks && server.TrackLinks !== 'None') {
    throw new Error('Postmark link tracking is enabled. Disable it for the Card Nest Auth server before using confirmation links.');
  }
}

async function verifyConfiguration(config) {
  const templates = await loadTemplates();
  const expected = {
    external_email_enabled: true,
    mailer_autoconfirm: false,
    mailer_secure_email_change_enabled: true,
    mailer_subjects_confirmation: 'Confirm your Card Nest account',
    mailer_subjects_email_change: 'Confirm your new Card Nest email',
    mailer_subjects_invite: 'You’re invited to Card Nest',
    mailer_subjects_magic_link: 'Your secure Card Nest sign-in link',
    mailer_subjects_recovery: 'Reset your Card Nest password',
    password_min_length: 8,
    site_url: 'https://cardnest.ytosko.dev',
    smtp_admin_email: env.SMTP_FROM_EMAIL,
    smtp_host: env.SMTP_HOST,
    smtp_port: env.SMTP_PORT,
    smtp_sender_name: env.SMTP_FROM_NAME,
    smtp_user: env.SMTP_USER,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (config[key] !== value) throw new Error(`Hosted Auth verification failed for ${key}.`);
  }
  if (!config.smtp_pass) throw new Error('Hosted Auth verification found no SMTP password.');

  const remoteTemplates = {
    confirmation: config.mailer_templates_confirmation_content,
    recovery: config.mailer_templates_recovery_content,
    'email-change': config.mailer_templates_email_change_content,
    'magic-link': config.mailer_templates_magic_link_content,
    invite: config.mailer_templates_invite_content,
  };
  for (const name of templateNames) {
    if (remoteTemplates[name] !== templates[name]) throw new Error(`Hosted Auth template verification failed for ${name}.`);
  }

  const redirectList = String(config.uri_allow_list ?? '');
  if (
    !redirectList.includes('https://cardnest.ytosko.dev/auth/callback') ||
    !redirectList.includes('cardnest://**') ||
    !redirectList.includes('exp://**/--/auth/callback')
  ) {
    throw new Error('Hosted Auth redirect allow list is missing Card Nest mobile callbacks.');
  }

  const logoResponse = await fetch(logoUrl);
  if (!logoResponse.ok || !logoResponse.headers.get('content-type')?.includes('image/png')) {
    throw new Error('The public Card Nest transactional-email logo is unavailable.');
  }
}

if (listKeysOnly) {
  const hostedConfig = await managementRequest('GET');
  console.log(Object.keys(hostedConfig).sort().join('\n'));
  process.exit(0);
}

await verifyPostmarkToken();

if (!verifyOnly) {
  await uploadLogo();
  const templates = await loadTemplates();
  await managementRequest('PATCH', {
    external_email_enabled: true,
    disable_signup: false,
    mailer_autoconfirm: false,
    mailer_secure_email_change_enabled: true,
    password_min_length: 8,
    site_url: 'https://cardnest.ytosko.dev',
    uri_allow_list: 'https://cardnest.ytosko.dev/auth/callback,cardnest://**,exp://**/--/auth/callback,http://localhost:*/auth/callback,http://127.0.0.1:*/auth/callback',
    smtp_admin_email: env.SMTP_FROM_EMAIL,
    smtp_host: env.SMTP_HOST,
    smtp_port: env.SMTP_PORT,
    smtp_user: env.SMTP_USER,
    smtp_pass: env.SMTP_PASS,
    smtp_sender_name: env.SMTP_FROM_NAME,
    mailer_subjects_confirmation: 'Confirm your Card Nest account',
    mailer_templates_confirmation_content: templates.confirmation,
    mailer_subjects_recovery: 'Reset your Card Nest password',
    mailer_templates_recovery_content: templates.recovery,
    mailer_subjects_email_change: 'Confirm your new Card Nest email',
    mailer_templates_email_change_content: templates['email-change'],
    mailer_subjects_magic_link: 'Your secure Card Nest sign-in link',
    mailer_templates_magic_link_content: templates['magic-link'],
    mailer_subjects_invite: 'You’re invited to Card Nest',
    mailer_templates_invite_content: templates.invite,
  });
}

const hostedConfig = await managementRequest('GET');
await verifyConfiguration(hostedConfig);

console.log(
  verifyOnly
    ? 'Hosted Card Nest Auth verification passed: Postmark, SMTP metadata, redirects, confirmations, and five branded templates match.'
    : 'Hosted Card Nest Auth configured and verified: Postmark, SMTP, redirects, confirmations, brand asset, and five templates are active.',
);
