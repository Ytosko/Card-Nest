import 'dotenv/config';
import { execSync } from 'child_process';

const dbUrl = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;

console.log('Pushing local migrations using connection pooler URL...');

try {
  const output = execSync(`npx supabase db push --db-url "${dbUrl}" --include-all`, {
    env: { ...process.env, SUPABASE_ACCESS_TOKEN: accessToken },
    encoding: 'utf-8',
  });
  console.log('Migration push output:\n', output);
} catch (error) {
  console.error('Migration push error output:\n', error.stdout || error.stderr || error.message);
}
