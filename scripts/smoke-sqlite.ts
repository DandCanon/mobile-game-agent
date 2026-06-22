/**
 * SQLite smoke test — verifies better-sqlite3 loads and works correctly.
 * Run: npx tsx scripts/smoke-sqlite.ts
 */

import Database from 'better-sqlite3';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const dbPath = join(tmpdir(), `smoke-sqlite-${randomUUID()}.db`);

try {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS smoke_test (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      value TEXT NOT NULL
    )
  `);

  const insert = db.prepare('INSERT INTO smoke_test (key, value) VALUES (?, ?)');
  insert.run('hello', 'world');
  insert.run('node', process.version);

  const rows = db.prepare('SELECT * FROM smoke_test').all();
  console.log(`Inserted ${rows.length} rows`);

  for (const row of rows) {
    console.log(`  id=${row.id}  key=${row.key}  value=${row.value}`);
  }

  db.close();

  // Clean up
  const fs = await import('fs');
  fs.unlinkSync(dbPath);

  console.log('SQLite OK');
} catch (err) {
  console.error('SQLite FAILED:', err);
  process.exit(1);
}
