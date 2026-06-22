/**
 * StructuredLogger — 结构化日志系统
 *
 * 基于现有 Logger 扩展，支持：
 * - NDJSON 格式的结构化事件日志（一行一个 JSON 对象）
 * - 自动生成 ErrorReport + 写入日志
 * - 性能日志
 * - Session 管理（按 sessionId 检索日志）
 * - 与现有 Logger 协作：NDJSON 写入独立文件，不破坏人类可读 .log 文件
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger } from '../../orchestration/logger.js';
import type { LogLevel } from '../../orchestration/logger.js';
import { createErrorReport, captureEnv } from './contract.js';
import type { ErrorReport, EnvInfo } from './contract.js';

/* ===================== NDJSON 行格式 ===================== */

export interface StructuredLogEntry {
  sessionId: string;
  timestamp: string;
  level: LogLevel;
  event: string;
  data: Record<string, unknown>;
}

/* ===================== Session 索引 ===================== */

interface SessionIndexEntry {
  sessionId: string;
  startedAt: string;
  logFilePath: string;
}

/* ===================== StructuredLogger 类 ===================== */

export class StructuredLogger {
  private baseLogger: Logger;
  private ndjsonDir: string;
  private currentSessionId: string;
  private ndjsonFilePath: string | null = null;
  private sessionIndex: SessionIndexEntry[] = [];
  private indexFilePath: string;

  /**
   * @param moduleName 模块名，传递给底层 Logger
   * @param logDir    NDJSON 文件存放目录，默认项目根下的 logs/ndjson/
   */
  constructor(moduleName = 'debug') {
    this.baseLogger = new Logger(moduleName);
    this.ndjsonDir = path.resolve(process.cwd(), 'logs', 'ndjson');
    this.indexFilePath = path.join(this.ndjsonDir, '_session_index.json');

    // 确保目录存在
    if (!fs.existsSync(this.ndjsonDir)) {
      fs.mkdirSync(this.ndjsonDir, { recursive: true });
    }

    // 加载已有 session 索引
    this.loadIndex();

    // 创建初始 session
    this.currentSessionId = '';
    this.startSession();
  }

  /* ===================== Session 管理 ===================== */

  /**
   * 创建新的日志 session，生成唯一 sessionId。
   * @returns 新 sessionId
   */
  startSession(): string {
    // 生成 sessionId：debug-{timestamp}-{random}
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    this.currentSessionId = `debug-${ts}-${rand}`;

    // 设置 NDJSON 文件路径（写入时按需创建）
    this.ndjsonFilePath = path.join(
      this.ndjsonDir,
      `session-${this.currentSessionId}.ndjson`,
    );

    // 写入 session 索引
    const entry: SessionIndexEntry = {
      sessionId: this.currentSessionId,
      startedAt: new Date().toISOString(),
      logFilePath: this.ndjsonFilePath,
    };
    this.sessionIndex.push(entry);
    this.saveIndex();

    // 同时写入 .log 文件
    this.baseLogger.info(
      `[StructuredLogger] Session started: ${this.currentSessionId}`,
    );

    return this.currentSessionId;
  }

  /** 获取当前 sessionId */
  getSessionId(): string {
    return this.currentSessionId;
  }

  /**
   * 按 sessionId 检索日志。
   * 从对应的 .ndjson 文件中逐行读取并解析。
   * @param sessionId 要检索的 sessionId，不传则返回当前 session 的日志
   * @returns 日志条目数组；session 不存在返回空数组
   */
  getSessionLogs(sessionId?: string): StructuredLogEntry[] {
    const targetId = sessionId ?? this.currentSessionId;

    // 先在索引中查找
    const entry = this.sessionIndex.find((e) => e.sessionId === targetId);
    if (!entry) {
      return [];
    }

    // 读取 NDJSON 文件
    if (!fs.existsSync(entry.logFilePath)) {
      return [];
    }

    try {
      const raw = fs.readFileSync(entry.logFilePath, 'utf-8');
      const lines = raw.split('\n').filter((l) => l.trim().length > 0);
      const entries: StructuredLogEntry[] = [];
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line) as StructuredLogEntry);
        } catch {
          // 跳过损坏的行
        }
      }
      return entries;
    } catch {
      return [];
    }
  }

  /** 列出所有 session */
  listSessions(): SessionIndexEntry[] {
    return [...this.sessionIndex];
  }

  /* ===================== 结构化日志方法 ===================== */

  /**
   * 写入结构化事件日志。
   * 同步写入 NDJSON 文件 + 同时调用底层 Logger 写入人类可读 .log。
   */
  logEvent(
    event: string,
    data: Record<string, unknown>,
    level: LogLevel = 'info',
  ): void {
    const entry: StructuredLogEntry = {
      sessionId: this.currentSessionId,
      timestamp: new Date().toISOString(),
      level,
      event,
      data,
    };

    // 写入 NDJSON 文件
    this.writeNdjson(entry);

    // 同时写入人类可读 .log 文件
    const msg = `[Event:${event}] ${JSON.stringify(data)}`;
    switch (level) {
      case 'debug':
        this.baseLogger.debug(msg);
        break;
      case 'info':
        this.baseLogger.info(msg);
        break;
      case 'warn':
        this.baseLogger.warn(msg);
        break;
      case 'error':
        this.baseLogger.error(msg);
        break;
    }
  }

  /**
   * 记录错误：自动生成 ErrorReport，写入 NDJSON + .log。
   */
  logError(
    error: Error,
    context: Record<string, unknown> = {},
  ): ErrorReport {
    const report = createErrorReport(error, context, this.currentSessionId);

    // 写入结构化日志
    this.logEvent('error_report', report as unknown as Record<string, unknown>, 'error');

    return report;
  }

  /**
   * 记录性能指标。
   */
  logPerformance(label: string, durationMs: number, extra: Record<string, unknown> = {}): void {
    this.logEvent('performance', {
      label,
      durationMs,
      ...extra,
    }, 'debug');
  }

  /**
   * 采集当前环境信息并记录。
   */
  logEnv(): EnvInfo {
    const env = captureEnv();
    this.logEvent('env_info', env as unknown as Record<string, unknown>, 'info');
    return env;
  }

  /* ===================== 底层 Logger 代理 ===================== */

  /** 获取底层 Logger（用于 MCP 模式切换等） */
  getLogger(): Logger {
    return this.baseLogger;
  }

  /** 设置 Logger 输出模式 */
  setMode(mode: 'cli' | 'mcp'): void {
    this.baseLogger.setMode(mode);
  }

  /** 获取当前 Logger 模式 */
  getMode(): 'cli' | 'mcp' {
    return this.baseLogger.getMode();
  }

  /* ===================== 内部方法 ===================== */

  private writeNdjson(entry: StructuredLogEntry): void {
    try {
      // 使用同步追加写入，确保 getSessionLogs 能立即读到已写入的条目
      fs.appendFileSync(this.ndjsonFilePath!, JSON.stringify(entry) + '\n', 'utf-8');
    } catch {
      // 静默失败
    }
  }

  private loadIndex(): void {
    try {
      if (fs.existsSync(this.indexFilePath)) {
        const raw = fs.readFileSync(this.indexFilePath, 'utf-8');
        this.sessionIndex = JSON.parse(raw) as SessionIndexEntry[];
      }
    } catch {
      this.sessionIndex = [];
    }
  }

  private saveIndex(): void {
    try {
      fs.writeFileSync(
        this.indexFilePath,
        JSON.stringify(this.sessionIndex, null, 2),
        'utf-8',
      );
    } catch {
      // 静默失败
    }
  }
}
