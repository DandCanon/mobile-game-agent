/**
 * Executor — 步骤执行器
 *
 * 职责：
 * 1. 按 Planner 生成的步骤顺序执行
 * 2. 调用框架适配器提供的工具
 * 3. 记录每个步骤的 ToolCall 和结果
 * 4. 处理步骤依赖：前置步骤失败时跳过后续
 */

import type {
  StepRecord,
  StepResult,
  ToolCallRecord,
  Artifact,
  AgentError,
  ExecutionPlan,
  Context,
} from '../protocol/agent-protocol';

/** 工具调用函数签名（由框架适配器注入） */
export type ToolInvoker = (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<{ success: boolean; output: unknown; error?: string }>;

/** Executor 配置 */
export interface ExecutorConfig {
  /** 单工具超时（毫秒） */
  toolTimeoutMs: number;
  /** 单步骤最大工具调用次数 */
  maxCallsPerStep: number;
  /** 步骤超时（毫秒） */
  stepTimeoutMs: number;
}

const DEFAULT_CONFIG: ExecutorConfig = {
  toolTimeoutMs: 30_000,
  maxCallsPerStep: 10,
  stepTimeoutMs: 300_000,
};

/**
 * 执行完整的计划。
 * 返回：更新后的上下文（含所有步骤记录）
 */
export async function executePlan(
  plan: ExecutionPlan,
  context: Context,
  invokeTool: ToolInvoker,
  config: Partial<ExecutorConfig> = {},
): Promise<{ context: Context; success: boolean }> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const steps: StepRecord[] = [...context.history];

  for (const planStep of plan.steps) {
    // 检查依赖
    const depsFailed = planStep.dependencies.some((depId) => {
      const dep = steps.find((s) => s.stepId === depId);
      return dep && dep.status === 'failed';
    });

    if (depsFailed) {
      steps.push({
        stepId: planStep.id,
        phase: planStep.phase,
        status: 'skipped',
        plan: planStep,
        startedAt: Date.now(),
        completedAt: Date.now(),
        retryCount: 0,
      });
      continue;
    }

    // 执行步骤
    const record = await executeStep(planStep, invokeTool, cfg);
    steps.push(record);

    // 更新上下文
    if (record.result?.artifacts) {
      context.artifacts.push(...record.result.artifacts);
    }
  }

  const allCompleted = steps
    .filter((s) => plan.steps.some((ps) => ps.id === s.stepId))
    .every((s) => s.status === 'completed' || s.status === 'skipped');

  return {
    context: { ...context, history: steps },
    success: allCompleted,
  };
}

/**
 * 执行单个步骤。
 */
export async function executeStep(
  planStep: ExecutionPlan['steps'][0],
  invokeTool: ToolInvoker,
  config: Partial<ExecutorConfig> = {},
): Promise<StepRecord> {
  const startedAt = Date.now();
  const toolCalls: ToolCallRecord[] = [];
  const errors: AgentError[] = [];
  const artifacts: Artifact[] = [];

  try {
    // 为每个 estimatedTool 依次调用
    for (const toolName of planStep.estimatedTools) {
      const toolStart = Date.now();

      let result: { success: boolean; output: unknown; error?: string };

      try {
        const timeoutPromise = new Promise<{ success: false; output: null; error: string }>(
          (resolve) =>
            setTimeout(
              () => resolve({ success: false, output: null, error: 'Tool timeout' }),
              config.toolTimeoutMs,
            ),
        );

        result = await Promise.race([invokeTool(toolName, { planStep }), timeoutPromise]);
      } catch (err) {
        result = {
          success: false,
          output: null,
          error: err instanceof Error ? err.message : String(err),
        };
      }

      toolCalls.push({
        toolName,
        input: { stepId: planStep.id, title: planStep.title },
        output: result.output,
        success: result.success,
        error: result.error,
        durationMs: Date.now() - toolStart,
      });

      if (!result.success) {
        errors.push({
          code: 'TOOL_FAILED',
          message: result.error ?? 'Unknown tool error',
          stepId: planStep.id,
          toolName,
          recoverable: true,
        });
      }
    }

    // 模拟产出物记录（实际由工具回调填充）
    for (const dir of planStep.directoryStructure) {
      artifacts.push({
        path: dir,
        type: 'directory',
        description: `步骤 ${planStep.title} 创建的目录`,
        createdAt: Date.now(),
      });
    }

  } catch (err) {
    errors.push({
      code: 'STEP_FAILED',
      message: err instanceof Error ? err.message : String(err),
      stepId: planStep.id,
      recoverable: false,
    });
  }

  const allToolsOk = toolCalls.every((tc) => tc.success);

  return {
    stepId: planStep.id,
    phase: planStep.phase,
    status: allToolsOk && errors.length === 0 ? 'completed' : 'failed',
    plan: planStep,
    result: {
      stepId: planStep.id,
      success: allToolsOk,
      artifacts,
      toolCalls,
      errors,
      durationMs: Date.now() - startedAt,
    },
    startedAt,
    completedAt: Date.now(),
    retryCount: 0,
  };
}
