import fs from 'node:fs';

const filePath = 'node_modules/@supabase/auth-js/dist/module/lib/types.d.ts';
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('Passkey') || line.includes('passkey')) {
      console.log(`L${idx+1}:`, line);
    }
  });
}
