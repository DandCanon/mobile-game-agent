/**
 * Persistence — SQLite 持久化层
 *
 * 职责：
 * 1. 管理三表 schema：user_profile / session_summaries / error_lessons
 * 2. 提供同步 CRUD（better-sqlite3 同步 API，与 ToolInvoker 调用模式一致）
 * 3. 单文件零配置：路径默认写入 workspace 下的 .agent_memory.db
 *
 * 设计约束：
 * - 同步 API，无 async/await（better-sqlite3 特性）
 * - 所有写操作用 WAL 模式（写入不阻塞读）
 * - 数据库文件路径可由外部指定
 *
 * 降级策略：
 * - better-sqlite3 加载失败时自动降级为 Noop 模式
 * - isAvailable() 返回 false，所有 CRUD 操作返回空/零值
 * - 不抛异常、不导致进程崩溃
 */

import { loadBetterSqlite3 } from './native-loader.js';

/* ===================== 类型定义 ===================== */

export interface UserProfileRow {
  key: string;
  value: string;
  updated_at: number;
}

export interface SessionSummaryRow {
  id: number;
  session_id: string;
  type: 'step' | 'meta';
  summary: string;
  source_ids: string;          // JSON 数组
  compressed_count: number;    // 压缩了多少步
  compressed_at: number;
}

export interface ErrorLessonRow {
  error_code: string;
  category: string;
  root_cause: string | null;
  fix_strategy: string | null;
  frequency: number;
  last_seen: number;
}

export interface VectorRecordRow {
  id: string;
  text: string;
  category: string | null;
  priority: number | null;
  embedding: number[];   // 序列化为 JSON 数组
  created_at: number;
}

/* ===================== Persistence 类 ===================== */

let DatabaseClass: any = null;
let dbLoadError: string | null = null;

// 惰性加载 better-sqlite3，失败不崩溃
function getDatabase(projectRoot?: string): any {
  if (DatabaseClass !== null) return DatabaseClass;
  if (dbLoadError !== null) return null;
  try {
    const root = projectRoot ?? process.cwd();
    const DB = loadBetterSqlite3(root);
    if (!DB) {
      dbLoadError = 'better-sqlite3 未找到（loadBetterSqlite3 返回 null）';
      return null;
    }
    DatabaseClass = DB;
    return DatabaseClass;
  } catch (err: unknown) {
    dbLoadError = err instanceof Error ? err.message : String(err);
    return null;
  }
}

export class Persistence {
  private db: any = null;
  private initialized = false;
  private _available = false;
  private _loadError: string | null = null;

  constructor(dbPath?: string) {
    const DB = getDatabase();
    if (!DB) {
      this._available = false;
      this._loadError = dbLoadError;
      return;
    }
    try {
      const path = dbPath ?? this.defaultPath();
      this.db = new DB(path);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      this.init();
      this._available = true;
    } catch (err: unknown) {
      this._available = false;
      this._loadError = err instanceof Error ? err.message : String(err);
    }
  }

  /** 检查 Persistence 是否可用 */
  isAvailable(): boolean {
    return this._available;
  }

  /** 获取加载失败原因（用于诊断） */
  getLoadError(): string | null {
    return this._loadError;
  }

  /* ---- 初始化 ---- */

  private init(): void {
    if (this.initialized) return;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_profile (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS session_summaries (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id       TEXT NOT NULL,
        type             TEXT NOT NULL CHECK(type IN ('step','meta')),
        summary          TEXT NOT NULL,
        source_ids       TEXT NOT NULL DEFAULT '[]',
        compressed_count INTEGER NOT NULL DEFAULT 0,
        compressed_at    INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_ss_session
        ON session_summaries(session_id);
      CREATE INDEX IF NOT EXISTS idx_ss_type
        ON session_summaries(type);

      CREATE TABLE IF NOT EXISTS error_lessons (
        error_code   TEXT NOT NULL,
        category     TEXT NOT NULL,
        root_cause   TEXT,
        fix_strategy TEXT,
        frequency    INTEGER NOT NULL DEFAULT 1,
        last_seen    INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (error_code, category)
      );

      CREATE TABLE IF NOT EXISTS vector_records (
        id         TEXT PRIMARY KEY,
        text       TEXT NOT NULL,
        category   TEXT,
        priority   INTEGER,
        embedding  TEXT NOT NULL,  -- JSON 数组
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_vr_category
        ON vector_records(category);
    `);

    this.initialized = true;
  }

  /* ---- 用户画像 (user_profile) ---- */

  getProfile(key: string): string | null {
    if (!this._available) return null;
    const stmt = this.db.prepare('SELECT value FROM user_profile WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  getAllProfiles(): UserProfileRow[] {
    if (!this._available) return [];
    const stmt = this.db.prepare('SELECT * FROM user_profile');
    return stmt.all() as UserProfileRow[];
  }

  setProfile(key: string, value: string): void {
    if (!this._available) return;
    const stmt = this.db.prepare(`
      INSERT INTO user_profile (key, value, updated_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = unixepoch()
    `);
    stmt.run(key, value);
  }

  setProfileBatch(entries: Array<{ key: string; value: string }>): void {
    if (!this._available) return;
    const stmt = this.db.prepare(`
      INSERT INTO user_profile (key, value, updated_at)
      VALUES (?, ?, unixepoch())
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = unixepoch()
    `);
    const tx = this.db.transaction(() => {
      for (const { key, value } of entries) {
        stmt.run(key, value);
      }
    });
    tx();
  }

  deleteProfile(key: string): boolean {
    if (!this._available) return false;
    const stmt = this.db.prepare('DELETE FROM user_profile WHERE key = ?');
    const result = stmt.run(key);
    return result.changes > 0;
  }

  /* ---- 会话摘要 (session_summaries) ---- */

  insertSummary(
    sessionId: string,
    type: 'step' | 'meta',
    summary: string,
    sourceIds: string[],
    compressedCount: number,
  ): number {
    if (!this._available) return 0;
    const stmt = this.db.prepare(`
      INSERT INTO session_summaries (session_id, type, summary, source_ids, compressed_count)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(sessionId, type, summary, JSON.stringify(sourceIds), compressedCount);
    return Number(result.lastInsertRowid);
  }

  getRecentSummaries(
    sessionId: string,
    type?: 'step' | 'meta',
    limit = 5,
  ): SessionSummaryRow[] {
    if (!this._available) return [];
    if (type) {
      return this.db
        .prepare(
          `SELECT * FROM session_summaries
           WHERE session_id = ? AND type = ?
           ORDER BY compressed_at DESC LIMIT ?`,
        )
        .all(sessionId, type, limit) as SessionSummaryRow[];
    }
    return this.db
      .prepare(
        `SELECT * FROM session_summaries
         WHERE session_id = ?
         ORDER BY compressed_at DESC LIMIT ?`,
      )
      .all(sessionId, limit) as SessionSummaryRow[];
  }

  countSummaries(sessionId: string, type?: 'step' | 'meta'): number {
    if (!this._available) return 0;
    if (type) {
      const row = this.db
        .prepare(
          'SELECT COUNT(*) as cnt FROM session_summaries WHERE session_id = ? AND type = ?',
        )
        .get(sessionId, type) as { cnt: number };
      return row.cnt;
    }
    const row = this.db
      .prepare('SELECT COUNT(*) as cnt FROM session_summaries WHERE session_id = ?')
      .get(sessionId) as { cnt: number };
    return row.cnt;
  }

  deleteOldSummaries(sessionId: string, keepRows: number): void {
    if (!this._available) return;
    this.db
      .prepare(
        `DELETE FROM session_summaries
         WHERE session_id = ? AND id NOT IN (
           SELECT id FROM session_summaries
           WHERE session_id = ?
           ORDER BY compressed_at DESC LIMIT ?
         )`,
      )
      .run(sessionId, sessionId, keepRows);
  }

  /* ---- 错误教训 (error_lessons) ---- */

  upsertErrorLesson(
    errorCode: string,
    category: string,
    rootCause?: string,
    fixStrategy?: string,
  ): void {
    if (!this._available) return;
    const stmt = this.db.prepare(`
      INSERT INTO error_lessons (error_code, category, root_cause, fix_strategy, frequency, last_seen)
      VALUES (?, ?, ?, ?, 1, unixepoch())
      ON CONFLICT(error_code, category) DO UPDATE SET
        frequency = frequency + 1,
        root_cause = COALESCE(excluded.root_cause, error_lessons.root_cause),
        fix_strategy = COALESCE(excluded.fix_strategy, error_lessons.fix_strategy),
        last_seen = unixepoch()
    `);
    stmt.run(errorCode, category, rootCause ?? null, fixStrategy ?? null);
  }

  upsertErrorLessonBatch(
    entries: Array<{
      errorCode: string;
      category: string;
      rootCause?: string;
      fixStrategy?: string;
    }>,
  ): void {
    if (!this._available) return;
    const stmt = this.db.prepare(`
      INSERT INTO error_lessons (error_code, category, root_cause, fix_strategy, frequency, last_seen)
      VALUES (?, ?, ?, ?, 1, unixepoch())
      ON CONFLICT(error_code, category) DO UPDATE SET
        frequency = frequency + 1,
        root_cause = COALESCE(excluded.root_cause, error_lessons.root_cause),
        fix_strategy = COALESCE(excluded.fix_strategy, error_lessons.fix_strategy),
        last_seen = unixepoch()
    `);
    const tx = this.db.transaction(() => {
      for (const e of entries) {
        stmt.run(e.errorCode, e.category, e.rootCause ?? null, e.fixStrategy ?? null);
      }
    });
    tx();
  }

  getTopErrorLessons(
    minFrequency = 2,
    limit = 5,
  ): ErrorLessonRow[] {
    if (!this._available) return [];
    return this.db
      .prepare(
        `SELECT * FROM error_lessons
         WHERE frequency >= ?
         ORDER BY frequency DESC, last_seen DESC
         LIMIT ?`,
      )
      .all(minFrequency, limit) as ErrorLessonRow[];
  }

  getErrorLessonsByCategory(category: string): ErrorLessonRow[] {
    if (!this._available) return [];
    return this.db
      .prepare(
        'SELECT * FROM error_lessons WHERE category = ? ORDER BY frequency DESC',
      )
      .all(category) as ErrorLessonRow[];
  }

  /* ---- 向量记录 (vector_records) ---- */

  upsertVectorRecord(record: {
    id: string;
    text: string;
    category: string | null;
    priority: number | null;
    embedding: number[];
    created_at: number;
  }): void {
    if (!this._available) return;
    const stmt = this.db.prepare(`
      INSERT INTO vector_records (id, text, category, priority, embedding, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        category = excluded.category,
        priority = excluded.priority,
        embedding = excluded.embedding,
        created_at = excluded.created_at
    `);
    stmt.run(
      record.id,
      record.text,
      record.category,
      record.priority,
      JSON.stringify(record.embedding),
      record.created_at,
    );
  }

  getAllVectorRecords(): VectorRecordRow[] {
    if (!this._available) return [];
    return this.db
      .prepare('SELECT * FROM vector_records ORDER BY created_at DESC')
      .all()
      .map((row: any) => ({
        ...row,
        embedding: JSON.parse(row.embedding) as number[],
      })) as VectorRecordRow[];
  }

  deleteVectorRecord(id: string): boolean {
    if (!this._available) return false;
    const result = this.db.prepare('DELETE FROM vector_records WHERE id = ?').run(id);
    return result.changes > 0;
  }

  /* ---- 工具方法 ---- */

  close(): void {
    if (this._available && this.db) {
      this.db.close();
    }
  }

  vacuum(): void {
    if (this._available) {
      this.db.pragma('optimize');
    }
  }

  private defaultPath(): string {
    // 默认路径：项目根目录下的 .agent_memory.db
    // 如果 process.cwd() 不可控，回退到 temp 目录
    try {
      return `${process.cwd()}\\.agent_memory.db`;
    } catch {
      const tmp = process.env.TEMP ?? process.env.TMP ?? '.';
      return `${tmp}\\.agent_memory.db`;
    }
  }
}
