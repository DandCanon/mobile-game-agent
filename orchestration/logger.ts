/**
 * Logger — 观测层彩色日志模块
 *
 * 零外部依赖，纯 TypeScript 实现。
 * CLI 模式：console.log 彩虹色输出
 * MCP 模式：console.error（stderr）输出，不污染 stdout
 * 所有模式同时写入 logs/session-{timestamp}.log 文件
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/* ===================== 类型定义 ===================== */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LoggerMode = 'cli' | 'mcp';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/* ===================== ANSI 彩虹色表 ===================== */

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  // 级别专属色
  debug: '\x1b[36m',  // cyan
  info: '\x1b[32m',   // green
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
  // 时间戳色（所有级别通用）
  timestamp: '\x1b[90m', // bright black (gray)
  // 模块名色
  module: '\x1b[35m',    // magenta
};

/* ===================== 格式化工具 ===================== */

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function pad3(n: number): string {
  if (n < 10) return `00${n}`;
  if (n < 100) return `0${n}`;
  return `${n}`;
}

function formatTimestamp(d: Date): string {
  const y = d.getFullYear();
  const mo = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());
  const ms = pad3(d.getMilliseconds());
  return `${y}-${mo}-${day} ${h}:${mi}:${s}.${ms}`;
}

/* ===================== Logger 类 ===================== */

export class Logger {
  /** 全局默认模式：所有新实例若不显式覆盖则使用此值 */
  static globalMode: LoggerMode = 'cli';

  private modeOverride: LoggerMode | null = null;
  private minLevel: LogLevel = 'debug';
  private moduleName: string;
  private logDir: string;
  private logStream: fs.WriteStream | null = null;
  private logFilePath: string | null = null;
  private readonly dirReady: Promise<void>;

  constructor(moduleName = 'root') {
    this.moduleName = moduleName;

    // 日志目录：项目根下的 logs/
    this.logDir = path.resolve(process.cwd(), 'logs');

    // 异步确保目录存在并打开写入流
    this.dirReady = this.initLogStream();
  }

  private async initLogStream(): Promise<void> {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
      const ts = formatTimestamp(new Date()).replace(/[:.]/g, '-');
      this.logFilePath = path.join(this.logDir, `session-${ts}.log`);
      this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
    } catch {
      // 静默失败：文件写入不可用时仍可正常控制台输出
    }
  }

  /** 获取当前日志文件路径（可能为 null，如果初始化失败） */
  getLogFilePath(): string | null {
    return this.logFilePath;
  }

  /** 切换输出模式 */
  setMode(mode: LoggerMode): void {
    this.modeOverride = mode;
  }

  /** 获取当前模式 */
  getMode(): LoggerMode {
    return this.currentMode();
  }

  /** 设置最低日志级别 */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** 创建子 Logger（继承模式与最低级别，带模块名前缀） */
  child(moduleName: string): Logger {
    const childLogger = new Logger(moduleName);
    childLogger.modeOverride = this.modeOverride;
    childLogger.minLevel = this.minLevel;
    // 子 Logger 复用父 Logger 的日志流（指向同一个文件）
    childLogger.logDir = this.logDir;
    childLogger.logFilePath = this.logFilePath;
    childLogger.logStream = this.logStream;
    return childLogger;
  }

  /* ===================== 日志方法 ===================== */

  debug(message: string, data?: unknown): void {
    this.emit('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.emit('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.emit('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.emit('error', message, data);
  }

  /* ===================== 内部方法 ===================== */

  private emit(level: LogLevel, message: string, data?: unknown): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;

    const now = new Date();
    const timestamp = formatTimestamp(now);

    // 1. 控制台输出（根据模式）
    this.writeConsole(level, timestamp, message, data);

    // 2. 文件写入（纯文本，无 ANSI）
    this.writeFile(level, timestamp, message, data);
  }

  private writeConsole(level: LogLevel, timestamp: string, message: string, data?: unknown): void {
    const mode = this.currentMode();
    const output = mode === 'mcp' ? console.error : console.log;
    // MCP 模式不使用 ANSI 彩色，避免污染 stderr 协议解析
    const line = mode === 'mcp'
      ? `[${timestamp}] [${level.toUpperCase()}] [${this.moduleName}] ${message}`
      : this.colorize(level, timestamp, message);

    if (data !== undefined && data !== null) {
      output(line, data);
    } else {
      output(line);
    }
  }

  private writeFile(level: LogLevel, timestamp: string, message: string, data?: unknown): void {
    // 非阻塞写入（通过 stream），不等待 dirReady
    this.dirReady.then(() => {
      if (!this.logStream) return;
      let line = `[${timestamp}] [${level.toUpperCase()}] [${this.moduleName}] ${message}`;
      if (data !== undefined && data !== null) {
        try {
          line += ` | ${JSON.stringify(data)}`;
        } catch {
          line += ` | ${String(data)}`;
        }
      }
      this.logStream!.write(line + '\n');
    }).catch(() => {
      // 静默失败
    });
  }

  private colorize(level: LogLevel, timestamp: string, message: string): string {
    const ts = `${ANSI.timestamp}${timestamp}${ANSI.reset}`;
    const lvl = `${ANSI[level]}[${level.toUpperCase()}]${ANSI.reset}`;
    const mod = `${ANSI.module}[${this.moduleName}]${ANSI.reset}`;
    return `${ts} ${lvl} ${mod} ${message}`;
  }

  private currentMode(): LoggerMode {
    return this.modeOverride ?? Logger.globalMode;
  }
}

/* ===================== 单例 ===================== */

const _singleton = new Logger('gateway');
export const logger: Logger = _singleton;
