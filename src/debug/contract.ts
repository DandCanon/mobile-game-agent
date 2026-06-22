/**
 * Debug Contract — 调试协议类型与工具
 *
 * 定义完整的调试协议：ErrorReport / FileSnapshot / EnvInfo / BugBundle，
 * 为后续实机排错提供标准化的错误信息打包与传输格式。
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/* ===================== 类型定义 ===================== */

/** 错误类型 */
export type ErrorType = 'runtime' | 'compile' | 'logic' | 'perf';

/** 严重级别 */
export type Severity = 'fatal' | 'error' | 'warning';

/** 标准化错误报告 */
export interface ErrorReport {
  sessionId: string;
  timestamp: string; // ISO 8601
  errorType: ErrorType;
  severity: Severity;
  message: string;
  stackTrace?: string;
  codeSnippet?: string;
  context: Record<string, unknown>;
}

/** 代码文件快照 */
export interface FileSnapshot {
  path: string;
  content: string;
  modifiedAt: string; // ISO 8601
  lineCount: number;
  relevantLines?: [number, number]; // [start, end] 1-based 闭区间
}

/** 环境信息 */
export interface EnvInfo {
  os: string;
  nodeVersion: string;
  projectVersion: string;
  dependencies: Record<string, string>;
  uptimeMs: number;
}

/** Bug 打包完整上下文 */
export interface BugBundle {
  errorReport: ErrorReport;
  logs: string[];
  codeFiles: FileSnapshot[];
  envInfo: EnvInfo;
  reproSteps?: string[];
}

/* ===================== 工具函数 ===================== */

/**
 * 从 Error 对象创建标准 ErrorReport。
 * 自动推断 errorType — 有 stack 则为 runtime，否则 logic。
 */
export function createErrorReport(
  error: Error,
  context: Record<string, unknown> = {},
  sessionId = 'unknown',
): ErrorReport {
  const hasStack = typeof error.stack === 'string' && error.stack.length > 0;

  // 从 call stack 推断 errorType
  let errorType: ErrorType = 'runtime';
  if (hasStack) {
    const stackLower = error.stack!.toLowerCase();
    if (stackLower.includes('syntaxerror') || stackLower.includes('typeerror')) {
      errorType = 'compile';
    } else if (
      stackLower.includes('assertion') ||
      stackLower.includes('rangeerror') ||
      stackLower.includes('referenceerror')
    ) {
      errorType = 'logic';
    }
  } else {
    errorType = 'logic';
  }

  // severity: Error 一律为 error，除非通过 context 显式覆盖
  let severity: Severity = 'error';
  if (context.severity === 'fatal' || context.severity === 'warning') {
    severity = context.severity;
  }

  const report: ErrorReport = {
    sessionId,
    timestamp: new Date().toISOString(),
    errorType,
    severity,
    message: error.message,
    stackTrace: hasStack ? error.stack : undefined,
    context,
  };

  return report;
}

/**
 * 序列化 ErrorReport 为 JSON 字符串。
 */
export function serializeReport(report: ErrorReport): string {
  return JSON.stringify(report, null, 2);
}

/**
 * 从 JSON 字符串反序列化为 ErrorReport。
 * 进行基本的字段存在性校验。
 */
export function deserializeReport(json: string): ErrorReport {
  const obj = JSON.parse(json) as Record<string, unknown>;

  // 必填字段校验
  const requiredFields: (keyof ErrorReport)[] = [
    'sessionId', 'timestamp', 'errorType', 'severity', 'message', 'context',
  ];
  for (const field of requiredFields) {
    if (!(field in obj)) {
      throw new Error(`Invalid ErrorReport: missing required field "${field}"`);
    }
  }

  // 校验 errorType
  const validErrorTypes: ErrorType[] = ['runtime', 'compile', 'logic', 'perf'];
  if (!validErrorTypes.includes(obj.errorType as ErrorType)) {
    throw new Error(
      `Invalid ErrorReport: unknown errorType "${String(obj.errorType)}"`,
    );
  }

  // 校验 severity
  const validSeverities: Severity[] = ['fatal', 'error', 'warning'];
  if (!validSeverities.includes(obj.severity as Severity)) {
    throw new Error(
      `Invalid ErrorReport: unknown severity "${String(obj.severity)}"`,
    );
  }

  return obj as unknown as ErrorReport;
}

/* ===================== File Snapshot ===================== */

/**
 * 读取指定路径文件并生成 FileSnapshot。
 * 读取失败时返回 null，不抛出异常。
 */
export function takeSnapshot(filePath: string): FileSnapshot | null {
  try {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      return null;
    }

    const stat = fs.statSync(absPath);
    if (!stat.isFile()) {
      return null;
    }

    const content = fs.readFileSync(absPath, 'utf-8');
    const lines = content.length === 0 ? [] : content.split(/\r?\n/);
    const lineCount = lines.length;

    const snapshot: FileSnapshot = {
      path: absPath,
      content,
      modifiedAt: stat.mtime.toISOString(),
      lineCount,
    };

    return snapshot;
  } catch {
    return null;
  }
}

/* ===================== Env Info ===================== */

let _startTime = Date.now();

/**
 * 自动采集当前运行时环境信息。
 * uptimeMs 从首次调用 captureEnv() 或模块加载时开始计时。
 */
export function captureEnv(): EnvInfo {
  const pkgPath = path.resolve(process.cwd(), 'package.json');
  let projectVersion = '0.0.0';
  let dependencies: Record<string, string> = {};

  try {
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      projectVersion = pkg.version ?? '0.0.0';
      dependencies = pkg.dependencies ?? {};
    }
  } catch {
    // 静默降级
  }

  return {
    os: `${process.platform} ${process.arch}`,
    nodeVersion: process.version,
    projectVersion,
    dependencies,
    uptimeMs: Date.now() - _startTime,
  };
}

/**
 * 重置启动时间戳（主要用于测试）。
 */
export function resetUptime(): void {
  _startTime = Date.now();
}

/* ===================== Bug Bundle ===================== */

/**
 * 从 Error + 日志 session + 代码文件列表打包生成 BugBundle。
 */
export function createBugBundle(
  error: Error,
  logSession: string[],
  codeFiles: FileSnapshot[],
  sessionId = 'unknown',
  context: Record<string, unknown> = {},
): BugBundle {
  const errorReport = createErrorReport(error, context, sessionId);
  const envInfo = captureEnv();

  return {
    errorReport,
    logs: logSession,
    codeFiles,
    envInfo,
  };
}

/**
 * 导出 BugBundle 为 JSON 文件。
 * @returns 写入的文件绝对路径，失败返回 null。
 */
export function exportBundle(bundle: BugBundle, outputPath?: string): string | null {
  try {
    const dest = outputPath
      ? path.resolve(outputPath)
      : path.resolve(
          process.cwd(),
          `bug-bundle-${bundle.errorReport.sessionId}-${Date.now()}.json`,
        );

    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(dest, JSON.stringify(bundle, null, 2), 'utf-8');
    return dest;
  } catch {
    return null;
  }
}
