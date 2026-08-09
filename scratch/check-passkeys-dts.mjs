import fs from 'node:fs';
import path from 'node:path';

function searchFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(searchFiles(fullPath));
    } else if (fullPath.endsWith('.d.ts') || fullPath.endsWith('package.json')) {
      results.push(fullPath);
    }
  });
  return results;
}

const dir = path.resolve('node_modules/react-native-passkeys');
if (fs.existsSync(dir)) {
  const files = searchFiles(dir);
  files.forEach(f => {
    console.log('---', f);
    console.log(fs.readFileSync(f, 'utf8').slice(0, 500));
  });
}
