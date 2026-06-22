/**
 * Debug Contract & StructuredLogger 单元测试
 *
 * 覆盖：
 * - ErrorReport 创建 / 序列化 / 反序列化
 * - BugBundle 打包 / 导出
 * - FileSnapshot 快照
 * - EnvInfo 采集
 * - StructuredLogger 事件/错误/性能/session 管理
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  createErrorReport,
  serializeReport,
  deserializeReport,
  takeSnapshot,
  captureEnv,
  resetUptime,
  createBugBundle,
  exportBundle,
} from '../src/debug/contract.js';
import type {
  ErrorReport,
  FileSnapshot,
  EnvInfo,
  BugBundle,
} from '../src/debug/contract.js';
import { StructuredLogger } from '../src/debug/structured-logger.js';

/* ===================== Helpers ===================== */

const TEMP_DIR = path.resolve(process.cwd(), 'temp', 'debug-test');

function ensureTempDir(): string {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  return TEMP_DIR;
}

function cleanupTempDir(): void {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

// -------------------------------------------------------------------------
// ErrorReport
// -------------------------------------------------------------------------

describe('ErrorReport', () => {
  const SESSION_ID = 'test-session-001';

  describe('createErrorReport', () => {
    it('should create a report from a standard Error', () => {
      const err = new Error('Something broke');
      const report = createErrorReport(err, {}, SESSION_ID);

      expect(report.sessionId).toBe(SESSION_ID);
      expect(report.errorType).toBe('runtime');
      expect(report.severity).toBe('error');
      expect(report.message).toBe('Something broke');
      expect(report.stackTrace).toBeDefined();
      expect(typeof report.stackTrace).toBe('string');
      expect(report.context).toEqual({});
      // timestamp 应为有效 ISO 8601
      expect(() => new Date(report.timestamp)).not.toThrow();
    });

    it('should detect compile error from SyntaxError', () => {
      const err = new SyntaxError('Unexpected token');
      const report = createErrorReport(err);

      expect(report.errorType).toBe('compile');
    });

    it('should detect compile error from TypeError', () => {
      const err = new TypeError('x is not a function');
      const report = createErrorReport(err);

      expect(report.errorType).toBe('compile');
    });

    it('should detect logic error from RangeError', () => {
      const err = new RangeError('Invalid array length');
      const report = createErrorReport(err);

      expect(report.errorType).toBe('logic');
    });

    it('should accept explicit severity override', () => {
      const err = new Error('test');
      const fatal = createErrorReport(err, { severity: 'fatal' });
      const warning = createErrorReport(err, { severity: 'warning' });

      expect(fatal.severity).toBe('fatal');
      expect(warning.severity).toBe('warning');
    });

    it('should store context data', () => {
      const err = new Error('test');
      const ctx = { userId: 'u1', module: 'game', retryCount: 3 };
      const report = createErrorReport(err, ctx);

      expect(report.context).toEqual(ctx);
    });

    it('should default sessionId to unknown when not provided', () => {
      const err = new Error('test');
      const report = createErrorReport(err);

      expect(report.sessionId).toBe('unknown');
    });
  });

  describe('serializeReport / deserializeReport round-trip', () => {
    it('should serialize and deserialize back to identical fields', () => {
      const original = createErrorReport(
        new Error('Round trip test'),
        { key: 'value', num: 42 },
        'sess-123',
      );
      // 添加 codeSnippet
      original.codeSnippet = 'const x = 1;\nconsole.log(x);';
      original.errorType = 'logic';
      original.severity = 'fatal';

      const json = serializeReport(original);
      expect(typeof json).toBe('string');

      const restored = deserializeReport(json);
      expect(restored.sessionId).toBe(original.sessionId);
      expect(restored.timestamp).toBe(original.timestamp);
      expect(restored.errorType).toBe(original.errorType);
      expect(restored.severity).toBe(original.severity);
      expect(restored.message).toBe(original.message);
      expect(restored.stackTrace).toBe(original.stackTrace);
      expect(restored.codeSnippet).toBe(original.codeSnippet);
      expect(restored.context).toEqual(original.context);
    });

    it('should throw on invalid errorType', () => {
      const bad = JSON.stringify({
        sessionId: 'x',
        timestamp: new Date().toISOString(),
        errorType: 'invalid_type',
        severity: 'error',
        message: 'test',
        context: {},
      });

      expect(() => deserializeReport(bad)).toThrow(/unknown errorType/);
    });

    it('should throw on invalid severity', () => {
      const bad = JSON.stringify({
        sessionId: 'x',
        timestamp: new Date().toISOString(),
        errorType: 'runtime',
        severity: 'critical',
        message: 'test',
        context: {},
      });

      expect(() => deserializeReport(bad)).toThrow(/unknown severity/);
    });

    it('should throw on missing required field', () => {
      const bad = JSON.stringify({
        sessionId: 'x',
        timestamp: new Date().toISOString(),
        errorType: 'runtime',
        // missing severity
        message: 'test',
        context: {},
      });

      expect(() => deserializeReport(bad)).toThrow(/missing required field/);
    });
  });
});

// -------------------------------------------------------------------------
// FileSnapshot
// -------------------------------------------------------------------------

describe('FileSnapshot', () => {
  const testFilePath = path.join(TEMP_DIR, 'snapshot-test.txt');

  beforeEach(() => {
    ensureTempDir();
    fs.writeFileSync(testFilePath, 'line1\nline2\nline3\nline4\nline5', 'utf-8');
  });

  afterEach(() => {
    cleanupTempDir();
  });

  it('should create snapshot with correct fields', () => {
    const snap = takeSnapshot(testFilePath);

    expect(snap).not.toBeNull();
    expect(snap!.path).toBe(testFilePath);
    expect(snap!.content).toBe('line1\nline2\nline3\nline4\nline5');
    expect(snap!.lineCount).toBe(5);
    expect(() => new Date(snap!.modifiedAt)).not.toThrow();
  });

  it('should return null for non-existent file', () => {
    const snap = takeSnapshot(path.join(TEMP_DIR, 'does-not-exist.txt'));
    expect(snap).toBeNull();
  });

  it('should return null for a directory', () => {
    const snap = takeSnapshot(TEMP_DIR);
    expect(snap).toBeNull();
  });

  it('should handle empty file', () => {
    const emptyPath = path.join(TEMP_DIR, 'empty.txt');
    fs.writeFileSync(emptyPath, '', 'utf-8');
    const snap = takeSnapshot(emptyPath);

    expect(snap).not.toBeNull();
    expect(snap!.content).toBe('');
    expect(snap!.lineCount).toBe(0);
  });
});

// -------------------------------------------------------------------------
// EnvInfo
// -------------------------------------------------------------------------

describe('EnvInfo', () => {
  beforeEach(() => {
    resetUptime();
  });

  it('should capture environment info', () => {
    const env = captureEnv();

    expect(typeof env.os).toBe('string');
    expect(env.os).toContain(process.platform);
    expect(typeof env.nodeVersion).toBe('string');
    expect(env.nodeVersion).toBe(process.version);
    expect(typeof env.projectVersion).toBe('string');
    expect(typeof env.dependencies).toBe('object');
    expect(typeof env.uptimeMs).toBe('number');
    expect(env.uptimeMs).toBeGreaterThanOrEqual(0);
  });
});

// -------------------------------------------------------------------------
// BugBundle
// -------------------------------------------------------------------------

describe('BugBundle', () => {
  const SESSION_ID = 'bundle-test-001';
  let tempBundleDir: string;

  beforeEach(() => {
    ensureTempDir();
    tempBundleDir = path.join(TEMP_DIR, 'bundles');
  });

  afterEach(() => {
    cleanupTempDir();
  });

  it('should create a BugBundle with error report, logs, code files, and env info', () => {
    const error = new Error('Bundle test error');
    const logs = ['log line 1', 'log line 2'];
    const codeFiles: FileSnapshot[] = [
      {
        path: '/test/file1.ts',
        content: 'const x = 1;',
        modifiedAt: new Date().toISOString(),
        lineCount: 1,
      },
    ];

    const bundle = createBugBundle(error, logs, codeFiles, SESSION_ID, {
      extra: 'data',
    });

    expect(bundle.errorReport.sessionId).toBe(SESSION_ID);
    expect(bundle.errorReport.message).toBe('Bundle test error');
    expect(bundle.logs).toEqual(logs);
    expect(bundle.codeFiles).toEqual(codeFiles);
    expect(bundle.envInfo).toBeDefined();
    expect(bundle.envInfo.nodeVersion).toBe(process.version);
  });

  it('exportBundle should write JSON file', () => {
    const error = new Error('Export test');
    const bundle = createBugBundle(error, [], [], SESSION_ID);

    const outputPath = path.join(tempBundleDir, 'test-bundle.json');
    const written = exportBundle(bundle, outputPath);

    expect(written).not.toBeNull();
    expect(fs.existsSync(outputPath)).toBe(true);

    // 验证文件内容可解析
    const raw = fs.readFileSync(outputPath, 'utf-8');
    const parsed = JSON.parse(raw) as BugBundle;
    expect(parsed.errorReport.message).toBe('Export test');
  });

  it('exportBundle should auto-generate filename when no path given', () => {
    const error = new Error('Auto name test');
    const bundle = createBugBundle(error, [], [], SESSION_ID);

    const written = exportBundle(bundle);
    expect(written).not.toBeNull();
    expect(fs.existsSync(written!)).toBe(true);

    // 清理
    fs.unlinkSync(written!);
  });
});

// -------------------------------------------------------------------------
// StructuredLogger
// -------------------------------------------------------------------------

describe('StructuredLogger', () => {
  let logger: StructuredLogger;

  beforeEach(() => {
    logger = new StructuredLogger('test');
  });

  // ===== Session 管理 =====

  describe('session management', () => {
    it('should start with a valid sessionId on construction', () => {
      const sid = logger.getSessionId();
      expect(sid).toBeTruthy();
      expect(sid).toMatch(/^debug-\d+-[a-z0-9]+$/);
    });

    it('startSession should create new sessionId', () => {
      const sid1 = logger.getSessionId();
      const sid2 = logger.startSession();

      expect(sid2).toBeTruthy();
      expect(sid2).not.toBe(sid1);
      expect(logger.getSessionId()).toBe(sid2);
    });

    it('listSessions should include current and previous sessions', () => {
      const sid1 = logger.getSessionId();
      logger.startSession();

      const sessions = logger.listSessions();
      const ids = sessions.map((s) => s.sessionId);

      expect(ids).toContain(sid1);
      expect(ids).toContain(logger.getSessionId());
    });

    it('getSessionLogs for current session should return entries', () => {
      logger.logEvent('test_event', { count: 1 });

      const logs = logger.getSessionLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);

      const last = logs[logs.length - 1];
      expect(last.event).toBe('test_event');
      expect(last.data).toEqual({ count: 1 });
    });

    it('getSessionLogs for unknown session should return empty array', () => {
      const logs = logger.getSessionLogs('nonexistent-session');
      expect(logs).toEqual([]);
    });
  });

  // ===== 事件日志 =====

  describe('logEvent', () => {
    it('should log structured event with sessionId', () => {
      logger.logEvent('user_login', { userId: 'u1', method: 'oauth' });

      const logs = logger.getSessionLogs();
      const entry = logs.find((e) => e.event === 'user_login');

      expect(entry).toBeDefined();
      expect(entry!.sessionId).toBe(logger.getSessionId());
      expect(entry!.data).toEqual({ userId: 'u1', method: 'oauth' });
      expect(entry!.level).toBe('info');
      expect(() => new Date(entry!.timestamp)).not.toThrow();
    });

    it('should support custom log levels', () => {
      logger.logEvent('debug_info', { detail: 'stuff' }, 'debug');
      logger.logEvent('warn_user', { reason: 'quota' }, 'warn');
      logger.logEvent('critical', { panic: true }, 'error');

      const logs = logger.getSessionLogs();
      const levels = logs.map((e) => e.level);

      expect(levels).toContain('debug');
      expect(levels).toContain('warn');
      expect(levels).toContain('error');
    });
  });

  // ===== 错误日志 =====

  describe('logError', () => {
    it('should create ErrorReport and log as error_report event', () => {
      const err = new Error('Test error');
      const report = logger.logError(err, { component: 'game-engine' });

      expect(report.sessionId).toBe(logger.getSessionId());
      expect(report.message).toBe('Test error');
      expect(report.context).toEqual({ component: 'game-engine' });

      const logs = logger.getSessionLogs();
      const entry = logs.find((e) => e.event === 'error_report');

      expect(entry).toBeDefined();
      expect(entry!.level).toBe('error');
      expect(entry!.data).toHaveProperty('message', 'Test error');
      expect(entry!.data).toHaveProperty('errorType');
      expect(entry!.data).toHaveProperty('severity');
      expect(entry!.data).toHaveProperty('stackTrace');
    });
  });

  // ===== 性能日志 =====

  describe('logPerformance', () => {
    it('should log performance event with duration', () => {
      logger.logPerformance('render_frame', 16.7, { fps: 60 });

      const logs = logger.getSessionLogs();
      const entry = logs.find((e) => e.event === 'performance');

      expect(entry).toBeDefined();
      expect(entry!.level).toBe('debug');
      expect(entry!.data).toEqual({
        label: 'render_frame',
        durationMs: 16.7,
        fps: 60,
      });
    });

    it('should log performance without extra data', () => {
      logger.logPerformance('db_query', 42.5);

      const logs = logger.getSessionLogs();
      const entry = logs.find((e) => e.event === 'performance');

      expect(entry).toBeDefined();
      expect(entry!.data.label).toBe('db_query');
      expect(entry!.data.durationMs).toBe(42.5);
    });
  });

  // ===== 环境日志 =====

  describe('logEnv', () => {
    it('should capture and log env info', () => {
      const env = logger.logEnv();

      expect(env.nodeVersion).toBe(process.version);
      expect(typeof env.os).toBe('string');
      expect(typeof env.projectVersion).toBe('string');
      expect(typeof env.uptimeMs).toBe('number');

      const logs = logger.getSessionLogs();
      const entry = logs.find((e) => e.event === 'env_info');

      expect(entry).toBeDefined();
      expect(entry!.level).toBe('info');
    });
  });

  // ===== Logger 代理 =====

  describe('Logger delegation', () => {
    it('should expose underlying Logger', () => {
      const baseLogger = logger.getLogger();
      expect(baseLogger).toBeDefined();
      expect(typeof baseLogger.info).toBe('function');
      expect(typeof baseLogger.error).toBe('function');
      expect(typeof baseLogger.setMode).toBe('function');
    });

    it('setMode / getMode should delegate to base Logger', () => {
      logger.setMode('mcp');
      expect(logger.getMode()).toBe('mcp');

      logger.setMode('cli');
      expect(logger.getMode()).toBe('cli');
    });
  });

  // ===== 多事件混合 =====

  describe('mixed events', () => {
    it('should correctly separate event types in getSessionLogs', () => {
      logger.logEvent('app_start', { version: '0.8.0' });
      logger.logError(new Error('Oops'), { step: 'init' });
      logger.logPerformance('load', 120);
      logger.logEvent('app_ready', { status: 'ok' });

      const logs = logger.getSessionLogs();

      const events = logs.filter((e) => e.event !== 'error_report' && e.event !== 'performance');
      const errors = logs.filter((e) => e.event === 'error_report');
      const perfs = logs.filter((e) => e.event === 'performance');

      expect(events.length).toBeGreaterThanOrEqual(2);
      expect(errors.length).toBeGreaterThanOrEqual(1);
      expect(perfs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
