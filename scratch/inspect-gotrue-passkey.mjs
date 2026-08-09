import fs from 'node:fs';

const filePath = 'node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts';
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let insidePasskey = false;
  lines.forEach((line, idx) => {
    if (line.includes('passkey') || line.includes('Passkey')) {
      console.log(`L${idx+1}:`, line);
    }
  });
}
