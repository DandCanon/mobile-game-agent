#!/usr/bin/env node
/**
 * mgai CLI bootstrap
 *
 * Node.js 的 ESM bin 入口需要一个 .js shim 来加载 .ts（通过 tsx 或直接 import）。
 * 简化方案：使用 tsx 运行时直接执行 mgai.ts。
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mgaiPath = path.join(__dirname, 'mgai.ts');
const args = process.argv.slice(2);

// 尝试三种方式加载
const attempts = [
  { cmd: 'npx', args: ['tsx', mgaiPath, ...args] },
  { cmd: 'node', args: ['--loader', 'ts-node/esm', mgaiPath, ...args] },
];

for (const attempt of attempts) {
  try {
    const result = spawnSync(attempt.cmd, attempt.args, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
      shell: true,
      timeout: 120000,
    });
    process.exit(result.status ?? 0);
  } catch {
    continue;
  }
}

console.error('错误: 无法启动 CLI。请确保已安装 tsx: npm install -D tsx');
process.exit(1);
