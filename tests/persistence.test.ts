/**
 * Persistence 单元测试（Mock better-sqlite3）
 *
 * 覆盖：
 * - user_profile CRUD + upsert 语义
 * - session_summaries 写入/查询/计数/清理
 * - error_lessons upsert/频率累加/按类别查询
 * - vector_records 写入/全量读取/删除
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// --------------- Mock better-sqlite3 ---------------
const mockRun = vi.fn(() => ({ changes: 1, lastInsertRowid: 1 }));
const mockGet = vi.fn(() => undefined as unknown);
const mockAll = vi.fn(() => [] as unknown[]);
const mockPrepare = vi.fn(() => ({
  run: mockRun,
  get: mockGet,
  all: mockAll,
}));
const mockExec = vi.fn();
const mockClose = vi.fn();

vi.mock('better-sqlite3', () => ({
  default: function () {
    return {
      prepare: mockPrepare,
      exec: mockExec,
      close: mockClose,
      pragma: vi.fn(),
      transaction: (fn: () => void) => fn,
    };
  },
}));

import { Persistence } from '../orchestration/persistence';

function resetMocks() {
  vi.clearAllMocks();
  mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
  mockGet.mockReturnValue(null);
  mockAll.mockReturnValue([]);
}

/* ================================================================
 * user_profile
 * ================================================================ */

describe('Persistence — user_profile', () => {
  let db: Persistence;

  beforeEach(() => {
    resetMocks();
    db = new Persistence(':memory:');
    expect(mockExec).toHaveBeenCalled(); // schema init
  });

  it('setProfile 执行 INSERT OR REPLACE', () => {
    db.setProfile('lang', 'zh-CN');
    expect(mockRun).toHaveBeenCalledWith('lang', 'zh-CN');
  });

  it('getProfile 查询并返回 value', () => {
    mockGet.mockReturnValue({ value: 'dark' });
    expect(db.getProfile('theme')).toBe('dark');
    expect(mockGet).toHaveBeenCalledWith('theme');
  });

  it('getProfile 不存在时返回 null', () => {
    mockGet.mockReturnValue(undefined);
    expect(db.getProfile('nonexistent')).toBeNull();
  });

  it('getAllProfiles 返回所有记录', () => {
    mockAll.mockReturnValue([
      { key: 'a', value: '1' },
      { key: 'b', value: '2' },
    ]);
    expect(db.getAllProfiles().length).toBe(2);
  });

  it('deleteProfile 执行 DELETE', () => {
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 });
    expect(db.deleteProfile('x')).toBe(true);
  });

  it('deleteProfile 无匹配返回 false', () => {
    mockRun.mockReturnValue({ changes: 0, lastInsertRowid: 0 });
    expect(db.deleteProfile('ghost')).toBe(false);
  });
});

/* ================================================================
 * session_summaries
 * ================================================================ */

describe('Persistence — session_summaries', () => {
  let db: Persistence;

  beforeEach(() => {
    resetMocks();
    db = new Persistence(':memory:');
  });

  it('insertSummary 返回 lastInsertRowid', () => {
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 42 });
    const id = db.insertSummary('sess-01', 'step', '摘要', ['s1'], 2);
    expect(id).toBe(42);
  });

  it('countSummaries 返回数量', () => {
    mockGet.mockReturnValue({ cnt: 5 });
    expect(db.countSummaries('sess', 'step')).toBe(5);
  });

  it('getRecentSummaries 返回列表', () => {
    mockAll.mockReturnValue([
      { id: 1, summary: 'A' },
      { id: 2, summary: 'B' },
    ]);
    const r = db.getRecentSummaries('sess', 'step', 5);
    expect(r.length).toBe(2);
  });

  it('deleteOldSummaries 执行 DELETE', () => {
    db.deleteOldSummaries('sess', 3);
    expect(mockRun).toHaveBeenCalled();
  });
});

/* ================================================================
 * error_lessons
 * ================================================================ */

describe('Persistence — error_lessons', () => {
  let db: Persistence;

  beforeEach(() => {
    resetMocks();
    db = new Persistence(':memory:');
  });

  it('upsertErrorLesson 执行 upsert', () => {
    db.upsertErrorLesson('ERR_001', 'tool', '原因', '方案');
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('getTopErrorLessons 返回列表', () => {
    mockAll.mockReturnValue([
      { error_code: 'E1', category: 'tool', frequency: 3 },
    ]);
    expect(db.getTopErrorLessons(1, 10).length).toBe(1);
  });

  it('getErrorLessonsByCategory 按类别过滤', () => {
    mockAll.mockReturnValue([{ error_code: 'E2' }]);
    expect(db.getErrorLessonsByCategory('safety').length).toBe(1);
  });
});

/* ================================================================
 * vector_records
 * ================================================================ */

describe('Persistence — vector_records', () => {
  let db: Persistence;

  beforeEach(() => {
    resetMocks();
    db = new Persistence(':memory:');
  });

  it('upsertVectorRecord 执行 upsert', () => {
    db.upsertVectorRecord({
      id: 'v1', text: '背包系统', category: 'step', priority: 1,
      embedding: [0.1, 0.2, 0.3], created_at: Date.now(),
    });
    expect(mockRun).toHaveBeenCalled();
  });

  it('getAllVectorRecords 返回所有', () => {
    mockAll.mockReturnValue([
      { id: 'v1', text: '背包', category: 'step', priority: 1, embedding: '[0.1,0.2]', created_at: 1000 },
    ]);
    expect(db.getAllVectorRecords().length).toBe(1);
  });

  it('deleteVectorRecord 执行删除', () => {
    mockRun.mockReturnValue({ changes: 1, lastInsertRowid: 0 });
    expect(db.deleteVectorRecord('v1')).toBe(true);
  });
});
