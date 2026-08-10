import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const sensitiveNames = new Set([
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
  'SUPABASE_POOLER_URL',
  'POSTMARK_SERVER_TOKEN',
  'SMTP_USER',
  'SMTP_PASS',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'GOOGLE_API_KEY',
  'ANTHROPIC_API_KEY',
  'MYAPP_RELEASE_STORE_PASSWORD',
  'MYAPP_RELEASE_KEY_PASSWORD',
]);

function parseEnv(source) {
  const values = new Map();

  for (const rawLine of source.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator < 1) continue;

    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }

    values.set(name, value);
  }

  return values;
}

function isRealSecret(value) {
  return (
    value.length >= 8 &&
    !/^(?:your_|replace_|example|changeme|placeholder)/iu.test(value) &&
    !value.includes('YOUR_')
  );
}

const localEnv = existsSync('.env')
  ? parseEnv(readFileSync('.env', 'utf8'))
  : new Map();

const configuredSecrets = [...localEnv.entries()].filter(
  ([name, value]) =>
    (sensitiveNames.has(name) || /(?:API_KEY|SECRET|TOKEN|PASSWORD)$/u.test(name)) &&
    isRealSecret(value),
);

const fileList = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);

// Known-benign literals that intentionally imitate credential formats (QA fixtures).
// Never add a real credential here.
const allowlistedDummies = ['sk-proj-dummyKeyForQA1234'];

function stripAllowlisted(source) {
  let output = source;
  for (const dummy of allowlistedDummies) output = output.split(dummy).join('');
  return output;
}

const findings = [];
const credentialPatterns = [
  ['OpenAI API key pattern', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/u],
  ['Google API key pattern', /\bAIza[A-Za-z0-9_-]{30,}\b/u],
  ['Supabase access token pattern', /\bsbp_[A-Za-z0-9_-]{20,}\b/u],
  ['Private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ['Gradle signing password literal', /\b(?:storePassword|keyPassword)\s+['"][^'"]{8,}['"]/u],
];

const historicalPatterns = [
  ['OpenAI API key pattern', '\\bsk-(proj-)?[A-Za-z0-9_-]{20,}\\b'],
  ['Google API key pattern', '\\bAIza[A-Za-z0-9_-]{30,}\\b'],
  ['Supabase access token pattern', '\\bsbp_[A-Za-z0-9_-]{20,}\\b'],
  ['Private key material', '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'],
];

for (const file of fileList) {
  if (!existsSync(file)) continue;

  const buffer = readFileSync(file);
  if (buffer.includes(0)) continue;

  const source = buffer.toString('utf8');

  for (const [name, value] of configuredSecrets) {
    if (source.includes(value)) {
      findings.push(`${file}: contains configured value for ${name}`);
    }
  }

  for (const [label, pattern] of credentialPatterns) {
    if (pattern.test(stripAllowlisted(source))) {
      findings.push(`${file}: matches ${label}`);
    }
  }
}

const commits = execFileSync('git', ['rev-list', '--all'], { encoding: 'utf8' })
  .split(/\r?\n/u)
  .filter(Boolean);

function scanHistory(args, label) {
  for (const commit of commits) {
    // Match at line level (no -l) so allowlisted QA fixtures can be excluded by content.
    const result = spawnSync('git', ['grep', '-I', ...args, commit, '--', '.'], {
      encoding: 'utf8',
    });

    if (result.status === 1) continue;
    if (result.status !== 0) {
      console.error('Unable to complete Git history secret verification.');
      process.exit(1);
    }

    const flaggedPaths = new Set();
    for (const line of result.stdout.split(/\r?\n/u).filter(Boolean)) {
      const withoutCommit = line.startsWith(`${commit}:`) ? line.slice(commit.length + 1) : line;
      const separator = withoutCommit.indexOf(':');
      if (separator < 1) continue;
      const path = withoutCommit.slice(0, separator);
      const content = withoutCommit.slice(separator + 1);
      if (allowlistedDummies.some((dummy) => content.includes(dummy))) continue;
      flaggedPaths.add(path);
    }

    for (const path of flaggedPaths) {
      findings.push(`${commit.slice(0, 12)}:${path}: historical ${label}`);
    }
  }
}

for (const [name, value] of configuredSecrets) {
  scanHistory(['-F', '-e', value], `configured value for ${name}`);
}

for (const [label, pattern] of historicalPatterns) {
  scanHistory(['-E', '-e', pattern], label);
}

if (findings.length > 0) {
  console.error('Repository secret verification failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(
  `Repository secret verification passed (${fileList.length} current files and ${commits.length} historical commits checked).`,
);
