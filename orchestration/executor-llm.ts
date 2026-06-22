/**
 * Executor LLM — 基于 LLMClient 的智能步骤执行器
 *
 * 职责：
 * 1. 使用 LLM 的 function-calling 能力自主决定工具调用
 * 2. 执行工具 → 把结果回传给 LLM → LLM 决定下一步
 * 3. 达到终止条件（完成 / 超限 / 报错）后返回 StepResult
 *
 * 设计原则：
 * - 与现有 executePlan() 共享 ToolInvoker 签名，适配器层零改动
 * - 单步骤内 LLM 最多发起 10 轮工具调用
 * - 每轮 LLM 调用超时 30s
 */

import type {
  PlanStep,
  StepResult,
  StepRecord,
  ToolCallRecord,
  Artifact,
  AgentError,
} from '../protocol/agent-protocol';
import type {
  LLMClient,
  LLMMessage,
  LLMToolDefinition,
  LLMToolCall,
} from './llm-client';
import type { ToolInvoker, ExecutorConfig } from './executor';
import type { ToolSchema } from '../protocol/agent-protocol';

/* ===================== 配置默认值 ===================== */

const DEFAULT_CONFIG: ExecutorConfig = {
  toolTimeoutMs: 30_000,
  maxCallsPerStep: 10,
  stepTimeoutMs: 300_000,
};

const MAX_LLM_ROUNDS = 10;

/* ===================== 主函数 ===================== */

/**
 * 使用 LLM 执行单个步骤。
 *
 * 返回更新后的 StepRecord（含 step.result）。
 */
export async function executeStepWithLLM(
  client: LLMClient,
  step: StepRecord,
  invokeTool: ToolInvoker,
  availableTools: ToolSchema[],
  config: Partial<ExecutorConfig> = {},
): Promise<StepRecord> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // 跳过已标记为跳过的步骤
  if (step.status === 'skipped') {
    return step;
  }

  step.status = 'executing';
  step.startedAt = Date.now();

  const toolCalls: ToolCallRecord[] = [];
  const errors: AgentError[] = [];

  // 构建工具定义（供 LLM function calling）
  const toolDefinitions: LLMToolDefinition[] = availableTools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  // 构建初始消息
  const messages: LLMMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt(step, availableTools),
    },
    {
      role: 'user',
      content: buildUserPrompt(step),
    },
  ];

  let rounds = 0;

  while (rounds < MAX_LLM_ROUNDS) {
    rounds++;

    try {
      const llmResult = await client.complete(messages, {
        tools: toolDefinitions,
        temperature: 0.2,
        maxTokens: 4096,
      });

      // 如果 LLM 返回了工具调用
      if (llmResult.toolCalls && llmResult.toolCalls.length > 0) {
        // 记录 assistant 消息（含 tool calls）
        messages.push({
          role: 'assistant',
          content: llmResult.content,
          toolCalls: llmResult.toolCalls,
        });

        // 逐个执行工具调用
        for (const tc of llmResult.toolCalls) {
          if (toolCalls.length >= cfg.maxCallsPerStep) {
            errors.push({
              code: 'MAX_CALLS_REACHED',
              message: `工具调用次数已达上限 ${cfg.maxCallsPerStep}`,
              stepId: step.stepId,
              recoverable: false,
            });
            break;
          }

          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(tc.function.arguments || '{}');
          } catch {
            errors.push({
              code: 'PARSE_ARGS_ERROR',
              message: `无法解析工具调用参数: ${tc.function.arguments}`,
              stepId: step.stepId,
              toolName: tc.function.name,
              recoverable: true,
            });
          }

          const startTime = Date.now();
          const toolResult = await invokeTool(tc.function.name, input);
          const duration = Date.now() - startTime;

          const record: ToolCallRecord = {
            toolName: tc.function.name,
            input,
            output: toolResult.output,
            success: toolResult.success,
            error: toolResult.error,
            durationMs: duration,
          };
          toolCalls.push(record);

          // 工具结果作为 tool 消息回传给 LLM
          messages.push({
            role: 'tool',
            content: toolResult.success
              ? JSON.stringify(toolResult.output).slice(0, 4000)
              : `错误: ${toolResult.error}`,
            toolCallId: tc.id,
          });

          if (!toolResult.success && toolResult.error) {
            errors.push({
              code: 'TOOL_ERROR',
              message: toolResult.error,
              stepId: step.stepId,
              toolName: tc.function.name,
              recoverable: true,
            });
          }
        }

        if (toolCalls.length >= cfg.maxCallsPerStep) {
          break;
        }
      } else {
        // LLM 没有工具调用，认为步骤完成
        break;
      }

      // 检查步骤超时
      if (Date.now() - step.startedAt > cfg.stepTimeoutMs) {
        errors.push({
          code: 'STEP_TIMEOUT',
          message: `步骤执行超时 (${cfg.stepTimeoutMs}ms)`,
          stepId: step.stepId,
          recoverable: false,
        });
        break;
      }
    } catch (err) {
      errors.push({
        code: 'LLM_CALL_ERROR',
        message: `LLM 调用失败: ${String(err)}`,
        stepId: step.stepId,
        recoverable: true,
      });
      break;
    }
  }

  // 构建结果
  const success = errors.length === 0 || errors.every((e) => e.recoverable);
  const artifacts = extractArtifacts(toolCalls, step);

  step.result = {
    stepId: step.stepId,
    success,
    artifacts,
    toolCalls,
    errors,
    durationMs: Date.now() - step.startedAt,
  };

  step.status = success ? 'completed' : 'failed';
  step.completedAt = Date.now();

  return step;
}

/* ===================== Prompt 构建 ===================== */

function buildSystemPrompt(step: StepRecord, tools: ToolSchema[]): string {
  const toolList = tools
    .map((t) => `  ${t.name}: ${t.description}`)
    .join('\n');

  return `你是手游开发步骤执行器。根据当前步骤定义，使用可用工具完成任务。

## 当前步骤
标题: ${step.plan.title}
描述: ${step.plan.description}
阶段: ${step.plan.phase}
预计工具: ${step.plan.estimatedTools.join(', ')}
验收标准: ${step.plan.acceptanceCriteria.map((a) => `${a.description} (${a.verifyBy})`).join('; ')}

## 可用工具
${toolList}

## 规则
1. 按验收标准逐项完成任务
2. 优先使用预计工具列表中的工具
3. 每次最多调用 3 个工具
4. 工具调用返回后，分析结果再决定下一步
5. 验收标准全部满足后停止调用工具
6. 遇到不可恢复的错误时立即停止`;
}

function buildUserPrompt(step: StepRecord): string {
  return [
    `请执行步骤「${step.plan.title}」。`,
    `目录结构：${step.plan.directoryStructure.join(', ')}`,
    `最大代码行数：${step.plan.maxCodeLines}`,
  ].join('\n');
}

/* ===================== 辅助函数 ===================== */

function extractArtifacts(
  toolCalls: ToolCallRecord[],
  step: StepRecord,
): Artifact[] {
  const artifacts: Artifact[] = [];

  for (const tc of toolCalls) {
    if (!tc.success) continue;

    // write_file 工具：提取产物路径
    if (
      tc.toolName === 'write_file' &&
      tc.input.file_path &&
      typeof tc.input.file_path === 'string'
    ) {
      artifacts.push({
        path: tc.input.file_path,
        type: classifyFile(tc.input.file_path),
        description: `${step.plan.title} — 生成文件`,
        createdAt: Date.now(),
      });
    }
  }

  // 补充目录结构为产物
  for (const dir of step.plan.directoryStructure) {
    if (!artifacts.some((a) => a.path === dir)) {
      artifacts.push({
        path: dir,
        type: 'directory',
        description: `${step.plan.title} — 目录`,
        createdAt: Date.now(),
      });
    }
  }

  return artifacts;
}

function classifyFile(path: string): Artifact['type'] {
  if (/\.(ts|tsx|js|jsx)$/i.test(path)) return 'code';
  if (/\.(json|yaml|yml)$/i.test(path)) return 'config';
  if (/\.(png|jpg|jpeg|svg)$/i.test(path)) return 'image';
  if (/\.(md|txt)$/i.test(path)) return 'doc';
  return 'file';
}

/* ===================== 全量执行（替换 executePlan） ===================== */

import type { ExecutionPlan, Context } from '../protocol/agent-protocol';

/**
 * 使用 LLM 执行器执行完整计划。
 * 签名与现有 executePlan() 兼容，可在适配器中无缝替换。
 */
export async function executePlanWithLLM(
  client: LLMClient,
  plan: ExecutionPlan,
  context: Context,
  invokeTool: ToolInvoker,
  availableTools: ToolSchema[],
  config: Partial<ExecutorConfig> = {},
): Promise<{ context: Context; success: boolean }> {
  const steps: StepRecord[] = [...context.history];

  for (const planStep of plan.steps) {
    const depsFailed = planStep.dependencies.some((depId) => {
      const dep = steps.find((s) => s.stepId === depId);
      return dep && dep.status === 'failed';
    });

    const record: StepRecord = {
      stepId: planStep.id,
      phase: planStep.phase,
      status: depsFailed ? 'skipped' : 'planned',
      plan: planStep,
      startedAt: Date.now(),
      retryCount: 0,
    };

    if (depsFailed) {
      record.result = {
        stepId: planStep.id,
        success: false,
        artifacts: [],
        toolCalls: [],
        errors: [
          {
            code: 'DEP_FAILED',
            message: '前置步骤失败',
            stepId: planStep.id,
            recoverable: false,
          },
        ],
        durationMs: 0,
      };
      steps.push(record);
      continue;
    }

    const executed = await executeStepWithLLM(
      client,
      record,
      invokeTool,
      availableTools,
      config,
    );
    steps.push(executed);

    if (executed.status === 'failed') {
      // 不中断执行，让后续步骤自行跳过着依赖失败的
    }
  }

  const updatedContext: Context = {
    ...context,
    history: steps,
    artifacts: steps
      .flatMap((s) => s.result?.artifacts ?? [])
      .filter((a, i, arr) => arr.findIndex((x) => x.path === a.path) === i),
    errors: steps.flatMap((s) => s.result?.errors ?? []),
  };

  const success = steps.every((s) => s.status === 'completed' || s.status === 'skipped');

  return { context: updatedContext, success };
}
