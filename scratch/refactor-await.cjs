const fs = require('fs');
const path = require('path');

const srcLib = path.join(__dirname, '..', 'src', 'lib');
const files = fs.readdirSync(srcLib);

for (const file of files) {
  if (file.endsWith('.ts') && file !== 'sqlite.server.ts' && file !== 'db.server.ts') {
    const p = path.join(srcLib, file);
    let c = fs.readFileSync(p, 'utf8');
    const nc = c.replace(/(?<!await\s+)(?<!function\s+)(?<!export\s+)(?<!\w)(q1?)\s*\(/g, 'await $1(');
    if (nc !== c) {
      fs.writeFileSync(p, nc, 'utf8');
      console.log('Refactored', file);
    }
  }
}
