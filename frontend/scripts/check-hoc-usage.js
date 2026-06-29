// Script to check if all Next.js pages in /app use withPageRequiredAuth
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');

const PAGES_DIR = path.join(__dirname, '../app');
const HOC_NAME = 'withPageRequiredAuth';
const IGNORED = ['_app.tsx', '_document.tsx', '_error.tsx', 'not-found.tsx', 'not-authorized', 'layout.tsx', 'login', 'api'];

function isPageFile(filename) {
  return filename.endsWith('.tsx') && !IGNORED.some(f => filename.includes(f));
}

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return content.includes(HOC_NAME);
}

function walk(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!IGNORED.includes(file)) {
        results = results.concat(walk(filePath));
      }
    } else if (isPageFile(file)) {
      results.push(filePath);
    }
  });
  return results;
}

const pageFiles = walk(PAGES_DIR);
const missingHOC = [];

pageFiles.forEach(file => {
  if (!checkFile(file)) {
    missingHOC.push(file.replace(PAGES_DIR, ''));
  }
});

if (missingHOC.length === 0) {
  console.log('✅ All pages use withPageRequiredAuth');
} else {
  console.log('❌ The following pages are missing withPageRequiredAuth:');
  missingHOC.forEach(f => console.log('  -', f));
}
