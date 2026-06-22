/**
 * Debug Session — 排错会话工作流
 *
 * T4-M5：完整的排错会话管理器。
 * 支持 start → reproduce → captureState → generateReport 全链路，
 * 可接入 StructuredLogger 写入 session 事件。
 */

import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  createBugBundle,
  exportBundle,
  captureEnv,
  takeSnapshot,
} from './contract.js';
import type {
  BugBundle,
  ErrorReport,
  EnvInfo,
  FileSnapshot,
} from './contract.js';
import { StructuredLogger } from './structured-logger.js';
import type { DeviceController, DeviceInfo, CommandResult } from './device.js';

/* ===================== 类型定义 ===================== */

/** 复现步骤记录 */
export interface ReproducerStepLog {
  stepIndex: number;
  description: string;
  screenshotPath: string;
  logs: string[];
  timestamp: string;
}

/** 设备状态快照 */
export interface DeviceStateSnapshot {
  screenshotPath: string;
  logs: string[];
  processList: string[];
  timestamp: string;
}

/** 单个排错 session */
export interface DebugSessionRecord {
  sessionId: string;
  deviceId: string;
  bugDescription: string;
  createdAt: string;
  status: 'active' | 'completed';
  initialEnv: EnvInfo;
  reproSteps: ReproducerStepLog[];
  stateSnapshots: DeviceStateSnapshot[];
  errorReport?: ErrorReport;
  bundlePath?: string;
}

/* ===================== DebugSession 类 ===================== */

/**
 * 排错会话管理器。
 *
 * 典型工作流：
 * 1. start()        → 创建 session，采集初始环境快照
 * 2. reproduce()    → 逐步执行复现步骤，每步截图+日志
 * 3. captureState() → 暂停点状态采集（截图+日志+进程列表）
 * 4. generateReport() → 打包 BugBundle 并导出 JSON
 * 5. getHistory()   → 按 session 查询历史
 */
export class DebugSession {
  private sessions: Map<string, DebugSessionRecord> = new Map();
  private controller: DeviceController;
  private logger: StructuredLogger | null;

  /**
   * @param controller 设备控制器实例（真实设备用 ADBController，测试用 MockDeviceController）
   * @param logger     可选的结构化日志记录器，传入后 session 事件自动写入 NDJSON
   */
  constructor(controller: DeviceController, logger?: StructuredLogger) {
    this.controller = controller;
    this.logger = logger ?? null;
  }

  /* ===================== 工作流步骤 ===================== */

  /**
   * 1. start — 创建排错 session。
   * 记录初始环境快照并入库。
   *
   * @returns 新 sessionId
   */
  start(deviceId: string, bugDescription: string): string {
    // 生成 sessionId
    const ts = Date.now();
    const rand = Math.random().toString(36).slice(2, 8);
    const sessionId = `debug-${deviceId}-${ts}-${rand}`;

    // 采集初始环境
    const initialEnv = captureEnv();

    // 获取设备信息（验证设备在线）
    const deviceInfo = this.controller.getDeviceInfo(deviceId);

    const record: DebugSessionRecord = {
      sessionId,
      deviceId,
      bugDescription,
      createdAt: new Date().toISOString(),
      status: 'active',
      initialEnv,
      reproSteps: [],
      stateSnapshots: [],
    };

    this.sessions.set(sessionId, record);

    // 记入结构化日志
    this.logEvent('session_start', {
      sessionId,
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.name,
      platform: deviceInfo.platform,
      bugDescription,
      initialEnv,
    });

    return sessionId;
  }

  /**
   * 2. reproduce — 逐步执行复现步骤。
   * 每步截图 + 采集 logcat，追加到 session。
   *
   * @returns 步骤日志列表
   */
  reproduce(deviceId: string, steps: string[]): ReproducerStepLog[] {
    const record = this.getSessionOrThrow(deviceId);

    const stepLogs: ReproducerStepLog[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // 截图
      let screenshotPath = '';
      try {
        screenshotPath = this.controller.screenshot(deviceId);
      } catch {
        screenshotPath = '';
      }

      // 采集日志
      let logs: string[] = [];
      try {
        logs = this.controller.captureLogs(deviceId, { lines: 200 });
      } catch {
        logs = [];
      }

      const stepLog: ReproducerStepLog = {
        stepIndex: i,
        description: step,
        screenshotPath,
        logs,
        timestamp: new Date().toISOString(),
      };

      stepLogs.push(stepLog);
      record.reproSteps.push(stepLog);
    }

    this.logEvent('reproduce_complete', {
      sessionId: record.sessionId,
      stepsCount: steps.length,
      screenshotsCount: stepLogs.filter((s) => s.screenshotPath).length,
    });

    return stepLogs;
  }

  /**
   * 3. captureState — 采集当前设备状态。
   * 截图 + 日志 + 进程列表。
   *
   * @returns 状态快照
   */
  captureState(deviceId: string): DeviceStateSnapshot {
    const record = this.getSessionOrThrow(deviceId);

    // 截图
    let screenshotPath = '';
    try {
      screenshotPath = this.controller.screenshot(deviceId);
    } catch {
      screenshotPath = '';
    }

    // 日志
    let logs: string[] = [];
    try {
      logs = this.controller.captureLogs(deviceId, { lines: 300 });
    } catch {
      logs = [];
    }

    // 进程列表（Android: ps）
    let processList: string[] = [];
    try {
      const result: CommandResult = this.controller.runCommand(deviceId, 'ps -A');
      if (result.exitCode === 0 && result.stdout) {
        processList = result.stdout
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
      }
    } catch {
      processList = [];
    }

    const snapshot: DeviceStateSnapshot = {
      screenshotPath,
      logs,
      processList,
      timestamp: new Date().toISOString(),
    };

    record.stateSnapshots.push(snapshot);

    this.logEvent('state_captured', {
      sessionId: record.sessionId,
      screenshotPath,
      logLines: logs.length,
      processCount: processList.length,
    });

    return snapshot;
  }

  /**
   * 4. generateReport — 整合 BugBundle 并导出 JSON 文件。
   *
   * 整合：
   * - ErrorReport（基于 bugDescription 构造）
   * - 复现日志（所有 reproSteps 的 logs 合并）
   * - 截图文件快照（将截图路径转为 FileSnapshot）
   * - EnvInfo（初始环境 + 设备信息）
   *
   * @param outputDir 输出目录，默认当前会话工作目录
   * @returns 生成的 BugBundle
   */
  generateReport(sessionId: string, outputDir?: string): BugBundle | null {
    const record = this.sessions.get(sessionId);
    if (!record) return null;

    // 收集所有复现日志
    const allLogs: string[] = [];
    for (const step of record.reproSteps) {
      allLogs.push(`[Step ${step.stepIndex}] ${step.description}`);
      allLogs.push(`[Timestamp] ${step.timestamp}`);
      allLogs.push(`[Screenshot] ${step.screenshotPath || '(none)'}`);
      allLogs.push('--- Logs ---');
      allLogs.push(...step.logs);
      allLogs.push('');
    }

    // 收集截图文件快照
    const codeFiles: FileSnapshot[] = [];
    for (const step of record.reproSteps) {
      if (step.screenshotPath) {
        const snap = takeSnapshot(step.screenshotPath);
        if (snap) {
          // 截图二进制内容无意义，标记路径即可
          snap.content = `[binary image: ${step.screenshotPath}]`;
          codeFiles.push(snap);
        }
      }
    }
    for (const ss of record.stateSnapshots) {
      if (ss.screenshotPath) {
        const snap = takeSnapshot(ss.screenshotPath);
        if (snap) {
          snap.content = `[binary image: ${ss.screenshotPath}]`;
          codeFiles.push(snap);
        }
      }
    }

    // 构造 ErrorReport
    const error: ErrorReport = {
      sessionId,
      timestamp: new Date().toISOString(),
      errorType: 'runtime',
      severity: 'error',
      message: record.bugDescription,
      context: {
        deviceId: record.deviceId,
        reproStepsCount: record.reproSteps.length,
        stateSnapshotsCount: record.stateSnapshots.length,
      },
    };

    // BugBundle
    const bundle: BugBundle = {
      errorReport: error,
      logs: allLogs,
      codeFiles,
      envInfo: record.initialEnv,
      reproSteps: record.reproSteps.map((s) => s.description),
    };

    // 导出 JSON
    const destDir = outputDir ?? path.join(process.cwd(), 'logs', 'bundles');
    const bundlePath = exportBundle(bundle, path.join(destDir, `bug-bundle-${sessionId}.json`));

    record.errorReport = error;
    record.bundlePath = bundlePath ?? undefined;
    record.status = 'completed';

    this.logEvent('report_generated', {
      sessionId,
      bundlePath,
      logLines: allLogs.length,
      codeFilesCount: codeFiles.length,
    });

    return bundle;
  }

  /**
   * 5a. getHistory — 按 sessionId 查询历史记录。
   * 不传 sessionId 则返回所有 session。
   */
  getHistory(sessionId?: string): DebugSessionRecord[] {
    if (sessionId) {
      const record = this.sessions.get(sessionId);
      return record ? [record] : [];
    }
    return Array.from(this.sessions.values());
  }

  /**
   * 5b. getActiveSessions — 返回所有 status === 'active' 的 session。
   */
  getActiveSessions(): DebugSessionRecord[] {
    return Array.from(this.sessions.values()).filter(
      (r) => r.status === 'active',
    );
  }

  /* ===================== 内部方法 ===================== */

  /**
   * 按 deviceId 查找最近一个活跃 session。
   * 找不到时抛出异常。
   */
  private getSessionOrThrow(deviceId: string): DebugSessionRecord {
    // 查找该 device 最近的活跃 session
    const active = Array.from(this.sessions.values())
      .filter((r) => r.deviceId === deviceId && r.status === 'active')
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    if (active.length > 0) {
      return active[0];
    }

    throw new Error(
      `未找到设备 ${deviceId} 的活跃排错 session。请先调用 start()。`,
    );
  }

  private logEvent(event: string, data: Record<string, unknown>): void {
    this.logger?.logEvent(event, data, 'info');
  }
}

/* ===================== 便捷工厂 ===================== */

/**
 * 创建一个带 StructuredLogger 的 DebugSession 实例。
 */
export function createDebugSession(
  controller: DeviceController,
  logDir?: string,
): DebugSession {
  const logger = new StructuredLogger('debug-session');
  return new DebugSession(controller, logger);
}
