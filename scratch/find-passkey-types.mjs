import fs from 'node:fs';
import path from 'node:path';

function findDtsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findDtsFiles(fullPath));
    } else if (fullPath.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const authJsDir = path.resolve('node_modules/@supabase/auth-js');
if (fs.existsSync(authJsDir)) {
  const files = findDtsFiles(authJsDir);
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    if (content.includes('passkey') || content.includes('WebAuthn')) {
      console.log('--- File:', f);
      const lines = content.split('\n').filter(l => l.includes('passkey') || l.includes('WebAuthn') || l.includes('startRegistration') || l.includes('list'));
      console.log(lines.slice(0, 30).join('\n'));
    }
  }
}
