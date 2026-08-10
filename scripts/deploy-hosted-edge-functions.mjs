import 'dotenv/config';
import { execSync } from 'child_process';

const projectRef = process.env.SUPABASE_PROJECT_REF;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

if (!projectRef || !accessToken) {
  console.error('SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN missing in .env');
  process.exit(1);
}

console.log(`Deploying Edge Functions to hosted Supabase project ref: ${projectRef.slice(0, 4)}...`);

const functions = ['delete-account', 'ai-credentials', 'ai-extract'];

for (const fn of functions) {
  try {
    console.log(`Deploying function '${fn}'...`);
    const output = execSync(`npx supabase functions deploy ${fn} --project-ref ${projectRef} --no-verify-jwt`, {
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
      encoding: 'utf-8',
    });
    console.log(`Function '${fn}' deployment output:\n`, output);
  } catch (error) {
    console.error(`Function '${fn}' error output:\n`, error.stdout || error.stderr || error.message);
  }
}

// The encryption key is managed separately as a hosted Supabase secret. Never
// synthesize a fallback here: replacing it would make existing credentials
// undecryptable, and a committed fallback would not be a secret.
console.log('Edge Function deployment complete. Existing hosted secrets were not changed.');
