import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

const suspiciousPatterns = [
  { name: 'replacement character', pattern: /\uFFFD/ },
  { name: 'private-use mojibake', pattern: /[\uE000-\uF8FF]/ },
  {
    name: 'common mojibake token',
    pattern: /(?:\u9225|\u922B|\u9241|\u9983|\u951B|\u9286|\u9357|\u5A34|\u9429|\u95C7|\u74A7|\u93C2|\u7ECB|\u6434)/,
  },
];

function extname(file) {
  const slash = Math.max(file.lastIndexOf('/'), file.lastIndexOf('\\'));
  const dot = file.lastIndexOf('.');
  return dot > slash ? file.slice(dot).toLowerCase() : '';
}

function listTrackedFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => textExtensions.has(extname(file)));
}

const failures = [];

for (const file of listTrackedFiles()) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);

  for (const { name, pattern } of suspiciousPatterns) {
    for (let i = 0; i < lines.length; i += 1) {
      if (pattern.test(lines[i])) {
        failures.push(`${file}:${i + 1}: ${name}`);
      }
    }
  }
}

if (failures.length > 0) {
  console.error('Encoding check failed. Possible mojibake found:');
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}

console.log('Encoding check passed.');
