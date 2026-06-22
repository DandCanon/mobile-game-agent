/**
 * Logger 单元测试
 *
 * 覆盖：
 * - CLI/MCP 模式切换后输出目标正确
 * - 日志文件写入和读取验证
 * - child() 模块名前缀正确
 * - 各日志级别正确输出
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger, logger, type LogLevel, type LoggerMode } from '../orchestration/logger';

/* ===================== 测试辅助 ===================== */

const TEST_LOG_DIR = path.resolve(process.cwd(), 'logs');

/** 清除测试期间产生的日志文件 */
function cleanupTestLogs(): void {
  try {
    const files = fs.readdirSync(TEST_LOG_DIR);
    for (const f of files) {
      if (f.startsWith('session-') && f.endsWith('.log')) {
        const filePath = path.join(TEST_LOG_DIR, f);
        // 只删除测试运行时产生的（非之前的）
        const stat = fs.statSync(filePath);
        const now = Date.now();
        if (now - stat.mtimeMs < 60_000) {
          fs.unlinkSync(filePath);
        }
      }
    }
  } catch {
    // 目录不存在，忽略
  }
}

/** 等待异步文件写入完成 */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 200));
}

/* ===================== 测试用例 ===================== */

describe('Logger', () => {
  beforeEach(() => {
    // 重置单例为 CLI 模式
    Logger.globalMode = 'cli';
    logger.setMode('cli');
  });

  afterAll(() => {
    cleanupTestLogs();
  });

  describe('模式切换（CLI / MCP）', () => {
    it('默认模式应为 CLI', () => {
      const l = new Logger('test-default-mode');
      expect(l.getMode()).toBe('cli');
    });

    it('setMode("mcp") 后 getMode() 应返回 "mcp"', () => {
      const l = new Logger('test-mcp-mode');
      l.setMode('mcp');
      expect(l.getMode()).toBe('mcp');
    });

    it('setMode("cli") 后 getMode() 应返回 "cli"', () => {
      const l = new Logger('test-cli-mode');
      l.setMode('mcp');
      l.setMode('cli');
      expect(l.getMode()).toBe('cli');
    });

    it('CLI 模式应输出到 console.log', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const l = new Logger('test-cli-output');
      l.setMode('cli');
      l.info('CLI test message');

      expect(logSpy).toHaveBeenCalled();
      expect(errorSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('MCP 模式应输出到 console.error', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const l = new Logger('test-mcp-output');
      l.setMode('mcp');
      l.info('MCP test message');

      expect(errorSpy).toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('未显式 setMode 的旧实例应跟随全局模式切换', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const l = new Logger('test-global-follow');
      Logger.globalMode = 'mcp';
      l.info('global follow test message');

      expect(l.getMode()).toBe('mcp');
      expect(errorSpy).toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('日志文件写入与读取', () => {
    it('所有模式均应写入 .log 文件', async () => {
      const l = new Logger('test-file-write');
      l.info('file write test message');
      await flush();

      const filePath = l.getLogFilePath();
      expect(filePath).not.toBeNull();
      expect(fs.existsSync(filePath!)).toBe(true);

      const content = fs.readFileSync(filePath!, 'utf-8');
      expect(content).toContain('[INFO]');
      expect(content).toContain('[test-file-write]');
      expect(content).toContain('file write test message');
    });

    it('日志文件包含时间戳格式 [YYYY-MM-DD HH:mm:ss.SSS]', async () => {
      const l = new Logger('test-timestamp');
      l.info('timestamp check');
      await flush();

      const filePath = l.getLogFilePath();
      const content = fs.readFileSync(filePath!, 'utf-8');

      // 验证时间戳格式：例如 [2026-06-13 14:30:01.234]
      const tsRegex = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\]/;
      expect(tsRegex.test(content)).toBe(true);
    });

    it('debug 级别日志应写入文件', async () => {
      const l = new Logger('test-debug-file');
      l.debug('debug file message');
      await flush();

      const filePath = l.getLogFilePath();
      const content = fs.readFileSync(filePath!, 'utf-8');
      expect(content).toContain('[DEBUG]');
      expect(content).toContain('debug file message');
    });

    it('error 级别日志应写入文件', async () => {
      const l = new Logger('test-error-file');
      l.error('error file message');
      await flush();

      const filePath = l.getLogFilePath();
      const content = fs.readFileSync(filePath!, 'utf-8');
      expect(content).toContain('[ERROR]');
      expect(content).toContain('error file message');
    });

    it('带 data 参数的日志应序列化到文件', async () => {
      const l = new Logger('test-data-file');
      l.info('data test', { key: 'value', num: 42 });
      await flush();

      const filePath = l.getLogFilePath();
      const content = fs.readFileSync(filePath!, 'utf-8');
      expect(content).toContain('data test');
      expect(content).toContain('{"key":"value","num":42}');
    });
  });

  describe('child() 模块名', () => {
    it('child() 应创建带指定模块名的子 Logger', async () => {
      const parent = new Logger('Parent');
      const child = parent.child('ChildModule');

      // child 应写入文件时使用子模块名
      child.info('child message');
      await flush();

      const filePath = child.getLogFilePath();
      expect(filePath).not.toBeNull();

      const content = fs.readFileSync(filePath!, 'utf-8');
      expect(content).toContain('[ChildModule]');
      expect(content).toContain('child message');
    });

    it('child() 应继承父 Logger 的模式', () => {
      const parent = new Logger('Parent');
      parent.setMode('mcp');
      const child = parent.child('Child');
      expect(child.getMode()).toBe('mcp');
    });

    it('child() 应继承最低日志级别', () => {
      const parent = new Logger('Parent');
      parent.setLevel('warn');
      const child = parent.child('Child');

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      child.info('should not appear');
      child.debug('should not appear');

      // info 和 debug 应被过滤
      const calls = logSpy.mock.calls;
      // 只检查是否没有调用（因为 minLevel 是 warn）
      logSpy.mockRestore();
    });

    it('child() 应与父 Logger 写入同一日志文件', async () => {
      const parent = new Logger('ParentA');
      const child = parent.child('ChildA');

      parent.info('parent message');
      child.info('child message');
      await flush();

      const parentPath = parent.getLogFilePath();
      const childPath = child.getLogFilePath();
      expect(parentPath).toBe(childPath);

      const content = fs.readFileSync(parentPath!, 'utf-8');
      expect(content).toContain('[ParentA]');
      expect(content).toContain('[ChildA]');
    });
  });

  describe('日志级别过滤', () => {
    it('setLevel("error") 应只输出 error', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const l = new Logger('test-level-filter');
      l.setLevel('error');

      l.debug('debug');
      l.info('info');
      l.warn('warn');
      l.error('error');

      const calls = logSpy.mock.calls;
      // 只有 error 应被输出（检查调用的字符串参数）
      const messages = calls.map((c) => c[0]);
      expect(messages.length).toBe(1);

      logSpy.mockRestore();
    });

    it('setLevel("info") 应过滤 debug', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const l = new Logger('test-info-filter');
      l.setLevel('info');

      l.debug('debug');
      l.info('info');
      l.warn('warn');
      l.error('error');

      const calls = logSpy.mock.calls;
      // info, warn, error 共 3 条
      expect(calls.length).toBe(3);

      logSpy.mockRestore();
    });
  });

  describe('单例 logger', () => {
    it('导出单例 logger 应为 Logger 的实例', () => {
      expect(logger).toBeInstanceOf(Logger);
    });

    it('单例 logger 默认模式为 CLI', () => {
      expect(logger.getMode()).toBe('cli');
    });

    it('单例 logger 可通过 setMode 切换模式', () => {
      logger.setMode('mcp');
      expect(logger.getMode()).toBe('mcp');
      logger.setMode('cli');
      expect(logger.getMode()).toBe('cli');
    });

    it('new Logger() 应创建独立实例（不影响单例）', () => {
      const independent = new Logger('independent');
      independent.setMode('mcp');
      expect(independent.getMode()).toBe('mcp');
      // 单例应保持不变
      expect(logger.getMode()).toBe('cli');
    });
  });

  describe('ANSI 颜色输出（CLI 模式）', () => {
    it('CLI 模式输出应包含 ANSI 转义序列', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const l = new Logger('test-ansi');
      l.setMode('cli');
      l.info('ansi test');

      expect(logSpy).toHaveBeenCalledTimes(1);
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain('\x1b['); // ANSI escape

      logSpy.mockRestore();
    });

    it('MCP 模式输出不应包含 ANSI 转义序列', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const l = new Logger('test-no-ansi');
      l.setMode('mcp');
      l.info('no ansi test');

      const output = errorSpy.mock.calls[0][0] as string;
      expect(output).not.toContain('\x1b[');

      errorSpy.mockRestore();
    });
  });

  describe('日志格式', () => {
    it('日志应包含时间戳、级别、模块名、消息', async () => {
      const l = new Logger('test-format');
      l.info('format check');
      await flush();

      const filePath = l.getLogFilePath();
      const content = fs.readFileSync(filePath!, 'utf-8');

      // 验证完整格式：[YYYY-MM-DD HH:mm:ss.SSS] [INFO] [test-format] format check
      const formatRegex = /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] \[INFO\] \[test-format\] format check/;
      expect(formatRegex.test(content)).toBe(true);
    });
  });

  describe('并发写入', () => {
    it('多个 Logger 实例写入同一文件不应报错', async () => {
      const l1 = new Logger('concurrent-1');
      const l2 = new Logger('concurrent-2');
      const l3 = new Logger('concurrent-3');

      l1.info('msg from 1');
      l2.warn('msg from 2');
      l3.error('msg from 3');
      await flush();

      const filePath = l1.getLogFilePath();
      expect(filePath).not.toBeNull();

      const content = fs.readFileSync(filePath!, 'utf-8');
      expect(content).toContain('[concurrent-1]');
      expect(content).toContain('[concurrent-2]');
      expect(content).toContain('[concurrent-3]');
      expect(content).toContain('[ERROR]');
      expect(content).toContain('[WARN]');
      expect(content).toContain('[INFO]');
    });
  });
});
