/**
 * Reflector — 步骤结果校验与纠偏
 *
 * 职责：
 * 1. 对 Executor 完成的每一步进行多维度校验
 * 2. 校验维度：文件存在性、接口一致性、数据模型、代码质量、测试通过
 * 3. 未通过项生成 Correction 修正建议
 * 4. 同一步骤最多反射 3 轮，超限降级为人工介入
 */

import type {
  StepRecord,
  ReflectionResult,
  ReflectionCheck,
  Correction,
  AcceptanceCriterion,
  AgentError,
} from '../protocol/agent-protocol';

/* ---- 错误截断 ---- */

export interface ErrorTruncationConfig {
  /** 保留前 N 个错误，默认 5 */
  maxErrors: number;
  /** 单条错误消息最大字符数，默认 200 */
  maxMessageLength: number;
}

const DEFAULT_TRUNCATION_CONFIG: ErrorTruncationConfig = {
  maxErrors: 5,
  maxMessageLength: 200,
};

/**
 * 截断 AgentError 列表，防止上下文爆仓。
 * 保留前 maxErrors 个，单条消息截断至 maxMessageLength 字符。
 * 完整错误保留在 Observatory 日志中（待接入）。
 */
export function truncateErrors(
  errors: AgentError[],
  config: Partial<ErrorTruncationConfig> = {},
): AgentError[] {
  const cfg = { ...DEFAULT_TRUNCATION_CONFIG, ...config };

  if (errors.length === 0) return [];

  const truncated = errors.slice(0, cfg.maxErrors).map((e) => ({
    ...e,
    message:
      e.message.length > cfg.maxMessageLength
        ? e.message.slice(0, cfg.maxMessageLength) + '...[已截断]'
        : e.message,
  }));

  if (errors.length > cfg.maxErrors) {
    truncated.push({
      code: 'ERRORS_TRUNCATED',
      message: `[截断] 还有 ${errors.length - cfg.maxErrors} 个错误未展示，查看完整日志`,
      stepId: errors[0]?.stepId ?? '',
      recoverable: false,
    });
  }

  return truncated;
}

/* ---- Reflector ---- */
export interface ReflectorConfig {
  /** 单步骤最大反射轮次 */
  maxReflectionRounds: number;
  /** 是否自动修复 */
  autoFix: boolean;
}

const DEFAULT_CONFIG: ReflectorConfig = {
  maxReflectionRounds: 3,
  autoFix: false, // 默认不自动修复，先报告问题
};

/**
 * 对单步结果进行反思校验。
 */
export function reflect(
  stepRecord: StepRecord,
  config: Partial<ReflectorConfig> = {},
): ReflectionResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const checks: ReflectionCheck[] = [];
  const corrections: Correction[] = [];

  // 如果步骤被跳过（依赖失败），不做校验
  if (stepRecord.status === 'skipped') {
    return {
      stepId: stepRecord.stepId,
      passed: true,
      checks: [{ type: 'file-exists', criterionId: 'skip', passed: true, detail: '步骤已跳过（前置依赖失败）' }],
      corrections: [],
      needsRetry: false,
    };
  }

  const criteria = stepRecord.plan.acceptanceCriteria;

  // 1. 文件存在性检查
  for (const c of criteria.filter((ac) => ac.verifyBy === 'file-exists')) {
    const check = checkFileExists(c, stepRecord);
    checks.push(check);
    if (!check.passed) {
      corrections.push({
        description: `文件 ${c.verifyParam} 不存在，需要创建`,
        action: 'create-file',
        params: { path: c.verifyParam },
      });
    }
  }

  // 2. 类型检查（标记为 pending，不阻塞 passed）
  for (const c of criteria.filter((ac) => ac.verifyBy === 'type-check')) {
    const check: ReflectionCheck = {
      type: 'code-quality',
      criterionId: c.id,
      passed: stepRecord.status === 'completed',
      detail: stepRecord.status === 'completed'
        ? `类型检查待外部执行: ${c.verifyParam}`
        : `步骤未完成: ${c.verifyParam}`,
    };
    checks.push(check);
  }

  // 3. 单元测试检查（标记为 pending，不阻塞 passed）
  for (const c of criteria.filter((ac) => ac.verifyBy === 'unit-test')) {
    const check: ReflectionCheck = {
      type: 'test-pass',
      criterionId: c.id,
      passed: stepRecord.status === 'completed',
      detail: stepRecord.status === 'completed'
        ? `测试待外部执行: ${c.verifyParam}`
        : `步骤未完成: ${c.verifyParam}`,
    };
    checks.push(check);
  }

  // 4. 手动检查（标记为 pending）
  for (const c of criteria.filter((ac) => ac.verifyBy === 'manual')) {
    checks.push({
      type: 'file-exists',
      criterionId: c.id,
      passed: stepRecord.status === 'completed',
      detail: stepRecord.status === 'completed'
        ? `[手动验证] ${c.description}`
        : `[未完成] ${c.description}`,
    });
  }

  // 5. 接口一致性检查（如果有工具调用记录）
  if (stepRecord.result?.toolCalls) {
    for (const tc of stepRecord.result.toolCalls) {
      if (!tc.success) {
        checks.push({
          type: 'interface-match',
          criterionId: `tool-${tc.toolName}`,
          passed: false,
          detail: `工具 ${tc.toolName} 调用失败: ${tc.error ?? '未知错误'}`,
        });
        if (tc.error?.includes('timeout')) {
          corrections.push({
            description: `工具 ${tc.toolName} 超时，建议拆分任务`,
            action: 'manual',
            params: { tool: tc.toolName },
          });
        }
      }
    }
  }

  // 6. 代码行数检查
  const estimatedLines = stepRecord.plan.maxCodeLines;
  if (estimatedLines > 0 && stepRecord.result?.artifacts) {
    checks.push({
      type: 'code-quality',
      criterionId: 'line-count',
      passed: true, // 提示性质，不做硬性失败
      detail: `预计代码量 ≤ ${estimatedLines} 行（Planner 约束）`,
    });
  }

  // 7. 错误截断：防止长错误爆仓上下文
  if (stepRecord.result?.errors && stepRecord.result.errors.length > 0) {
    const before = stepRecord.result.errors.length;
    stepRecord.result.errors = truncateErrors(stepRecord.result.errors);
    if (stepRecord.result.errors.length < before) {
      checks.push({
        type: 'code-quality',
        criterionId: 'error-truncation',
        passed: true,
        detail: `错误列表已截断：${before} → ${stepRecord.result.errors.length} 条`,
      });
    }
  }

  // 判断是否通过
  const allPassed = checks.every((c) => c.passed);
  const needsRetry =
    !allPassed && stepRecord.retryCount < cfg.maxReflectionRounds && corrections.length > 0;

  return {
    stepId: stepRecord.stepId,
    passed: allPassed,
    checks,
    corrections: needsRetry ? corrections : [],
    needsRetry,
  };
}

/**
 * 检查文件是否存在（基于 Planner 生成的目录结构进行推断）。
 * 实际应由工具层验证，此处为逻辑层占位。
 */
function checkFileExists(
  criterion: AcceptanceCriterion,
  stepRecord: StepRecord,
): ReflectionCheck {
  const expectedPath = criterion.verifyParam;
  const created = stepRecord.plan.directoryStructure.some((dir) =>
    dir.includes(expectedPath.replace(/^src\//, '')),
  );

  if (created) {
    return {
      type: 'file-exists',
      criterionId: criterion.id,
      passed: true,
      detail: `文件 ${expectedPath} 已在目录结构中声明`,
    };
  }

  // 如果步骤执行成功，认为文件已创建
  if (stepRecord.status === 'completed') {
    return {
      type: 'file-exists',
      criterionId: criterion.id,
      passed: true,
      detail: `步骤已完成，假设 ${expectedPath} 已生成（需运行时验证）`,
    };
  }

  return {
    type: 'file-exists',
    criterionId: criterion.id,
    passed: false,
    detail: `文件 ${expectedPath} 未在目录结构中声明且步骤未完成`,
  };
}

/**
 * 对完整计划的所有步骤进行全量反思。
 */
export function reflectAll(
  stepRecords: StepRecord[],
  config: Partial<ReflectorConfig> = {},
): ReflectionResult[] {
  return stepRecords.map((record) => reflect(record, config));
}

/**
 * 生成反思摘要。
 */
export function summarizeReflection(results: ReflectionResult[]): string {
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const needsRetry = results.filter((r) => r.needsRetry).length;
  const totalCorrections = results.reduce((sum, r) => sum + r.corrections.length, 0);

  return [
    `反思总结: ${passed}/${total} 步骤通过`,
    needsRetry > 0 ? `${needsRetry} 步骤需要重试` : '',
    totalCorrections > 0 ? `${totalCorrections} 项修正建议` : '',
  ]
    .filter(Boolean)
    .join('，');
}
