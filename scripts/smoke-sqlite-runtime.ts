/**
 * SQLite Runtime Smoke Test
 *
 * 使用与 mgai MCP Server 完全相同的加载逻辑（native-loader），
 * 验证 better-sqlite3 在当前运行时环境中真实可用。
 *
 * 运行方式：
 *   npx tsx scripts/smoke-sqlite-runtime.ts
 *   npx tsx scripts/smoke-sqlite-runtime.ts D:\path\to\mobile-game-agent
 */

import { tryLoadBetterSqlite3 } from '../orchestration/native-loader.js';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';

const projectRoot = process.argv[2] ?? process.cwd();

console.log('========== SQLite Runtime Smoke Test ==========');
console.log(`process.cwd()    : ${process.cwd()}`);
console.log(`process.version  : ${process.version}`);
console.log(`projectRoot      : ${projectRoot}`);
console.log('');

// Step 1: 使用 native-loader 加载
console.log('[1/4] 加载 better-sqlite3 (使用 native-loader)...');
const result = tryLoadBetterSqlite3(projectRoot);

if (!result.loaded) {
  console.error(`  FAILED: ${result.error}`);
  process.exit(1);
}

console.log(`  OK — resolved path: ${result.resolvedPath}`);
console.log(`  Database class: ${typeof result.Database}`);

// Step 2: 创建临时数据库
console.log('[2/4] 创建临时数据库...');
const dbPath = join(tmpdir(), `smoke-runtime-${randomUUID()}.db`);
const db = new result.Database(dbPath);
console.log(`  OK — ${dbPath}`);

// Step 3: 建表 + 写入 + 查询
console.log('[3/4] 建表 + 写入 + 查询...');
db.exec(`
  CREATE TABLE IF NOT EXISTS smoke_test (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL
  )
`);

const insert = db.prepare('INSERT INTO smoke_test (key, value) VALUES (?, ?)');
insert.run('hello', 'world');
insert.run('node_version', process.version);
insert.run('project_root', projectRoot);

const rows = db.prepare('SELECT * FROM smoke_test').all();
console.log(`  Inserted ${rows.length} rows:`);
for (const row of rows as Array<{ id: number; key: string; value: string }>) {
  console.log(`    id=${row.id}  key=${row.key}  value=${row.value}`);
}

// Step 4: 清理
console.log('[4/4] 清理...');
db.close();
import { unlinkSync } from 'node:fs';
unlinkSync(dbPath);
console.log('  OK — 临时数据库已删除');

console.log('');
console.log('SQLITE_RUNTIME_OK');
