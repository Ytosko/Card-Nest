import fs from 'node:fs';

const filePath = 'node_modules/@supabase/auth-js/dist/module/lib/types.d.ts';
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log(lines.slice(2410, 2450).join('\n'));
}
