/**
 * Marvis 框架适配器
 *
 * 实现 AgentProtocol 接口，桥接核心循环（Planner/Executor/Reflector）
 * 与 Marvis 框架的工具调用能力。
 *
 * 工作原理：
 * - execute() 接收 AgentRequest，走完整 P→E→R 循环
 * - 工具调用通过 ToolInvoker 委托给 Marvis 的工具系统
 * - 所有步骤记录、产出物、错误统一封装为 AgentResponse
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

import type {
  AgentProtocol,
  AgentRequest,
  AgentResponse,
  StepRecord,
  ToolSchema,
  Context,
  ExecutionPlan,
  TechStack,
  PlanStep,
} from '../protocol/agent-protocol';
import { generatePlan } from '../orchestration/planner';
import type { ToolInvoker } from '../orchestration/executor';
import { executeStep } from '../orchestration/executor';
import { reflect } from '../orchestration/reflector';
import { selectTech } from '../orchestration/tech-selector';
import { generateCode } from '../orchestration/code-generator';
import { ToolCache } from '../orchestration/tool-cache';
import { createOutputGuard } from '../orchestration/guard';

/* ===================== 适配器实现 ===================== */

export class MarvisAdapter implements AgentProtocol {
  private readonly workspacePath: string;
  private context: Context;
  private toolCache: ToolCache | null = null;
  private outputGuard = createOutputGuard();

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.context = this.createInitialContext();
  }

  /** 注入 ToolCache：启用工具调用结果缓存 */
  setToolCache(tc: ToolCache): void {
    this.toolCache = tc;
  }

  /**
   * 核心入口：接收 AgentRequest，执行完整 P→E→R 循环。
   */
  async execute(request: AgentRequest): Promise<AgentResponse> {
    const maxRetries = request.options?.maxRetriesPerStep ?? 3;
    const errors: NonNullable<AgentResponse['errors']> = [
      ...((request.context?.errors as NonNullable<AgentResponse['errors']>) ?? []),
    ];

    // 合并基础上下文
    this.context = { ...this.context, ...request.context };

    // ---------- P: Planner ----------
    const gameType = inferGameType(request.task);
    const techResult = selectTech(gameType, this.context);
    const plan = generatePlan(request.task, gameType, this.context);

    // ---------- E + R: Executor + Reflector ----------
    const rawInvoker: ToolInvoker = async (toolName: string, input: Record<string, unknown>) => {
      const planStep = input.planStep as PlanStep | undefined;

      switch (toolName) {
        case 'write_file': {
          if (!planStep) {
            return { success: false, output: null, error: 'planStep 未提供' };
          }
          try {
            const files = generateCode(planStep);

            // 输出护栏：检查生成的代码内容
            for (const f of files) {
              const guardReport = this.outputGuard.evaluate(f.content);
              if (!guardReport.passed) {
                const reasons = guardReport.violations.map((v) => `${v.ruleName}: ${v.reason}`).join('; ');
                return {
                  success: false,
                  output: null,
                  error: `[输出护栏] 文件 ${f.filePath} 未通过安全检查: ${reasons}`,
                };
              }
            }

            const written: string[] = [];
            for (const f of files) {
              const fullPath = path.join(this.workspacePath, f.filePath);
              const dir = path.dirname(fullPath);
              if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
              fs.writeFileSync(fullPath, f.content, 'utf-8');
              written.push(f.filePath);
            }
            return { success: true, output: { files: written, count: written.length } };
          } catch (err) {
            return {
              success: false,
              output: null,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }

        case 'shell_executor': {
          // 获取 step title 推断要执行的命令
          const title = planStep?.title ?? '';
          let cmd = '';
          if (title === '项目初始化') {
            cmd = `cd "${this.workspacePath}" && npm install`;
          } else if (/类型(检查|校验)/.test(title)) {
            cmd = `cd "${this.workspacePath}" && npx tsc --noEmit`;
          } else if (/单元测试|引擎测试|vitest|测试/.test(title)) {
            cmd = `cd "${this.workspacePath}" && npx vitest run`;
          } else if (/dev server|devServer|启动验证|启动成功/.test(title)) {
            cmd = `cd "${this.workspacePath}" && npm run dev -- --host 0.0.0.0`;
          } else {
            return { success: true, output: { status: 'skipped', reason: '非项目初始化步骤，跳过 shell 执行' } };
          }
          try {
            const stdout = execSync(cmd, {
              encoding: 'utf-8',
              timeout: 120_000,
              cwd: this.workspacePath,
              stdio: 'pipe',
              shell: process.env.ComSpec ?? 'cmd.exe',
            }) as string;
            return { success: true, output: { stdout: stdout.slice(0, 2000) } };
          } catch (err: unknown) {
            const stderr = err instanceof Error ? err.message : String(err);
            return { success: false, output: null, error: stderr.slice(0, 1000) };
          }
        }

        default:
          return { success: true, output: { status: 'ok', tool: toolName } };
      }
    };

    // 应用缓存拦截器（若已注入）
    const toolInvoker: ToolInvoker = this.toolCache?.wrap(rawInvoker) ?? rawInvoker;

    const stepRecords: StepRecord[] = [];

    for (const planStep of plan.steps) {
      let stepRecord = await executeStep(planStep, toolInvoker, {});

      // ---------- R: Reflector ----------
      for (let round = 0; round < maxRetries; round++) {
        const reflection = reflect(stepRecord, { maxReflectionRounds: maxRetries });

        if (reflection.passed) {
          break;
        }

        if (reflection.needsRetry) {
          stepRecord.retryCount++;
          // 重试执行
          stepRecord = await executeStep(planStep, toolInvoker, {});
        } else {
          break;
        }
      }

      stepRecords.push(stepRecord);

      if (stepRecord.result?.errors) {
        errors.push(...stepRecord.result.errors);
      }
    }

    const allCompleted = stepRecords.every(
      (s) => s.status === 'completed' || s.status === 'skipped',
    );

    // 回写步骤记录到上下文，保持跨调用状态
    this.context = {
      ...this.context,
      history: [...this.context.history, ...stepRecords],
      artifacts: [
        ...this.context.artifacts,
        ...stepRecords.flatMap((s) => s.result?.artifacts ?? []),
      ],
    };

    return {
      status: allCompleted ? 'success' : 'partial',
      plan,
      steps: stepRecords,
      artifacts: this.context.artifacts,
      techRecommendation: {
        engine: techResult.recommended as TechStack['engine'],
        reason: techResult.reason,
        alternatives: Object.keys(techResult.scores).filter((k) => k !== techResult.recommended),
        pros: [],
        cons: [],
      },
      errors,
    };
  }

  async health(): Promise<{ ok: boolean; framework: string; version: string }> {
    return {
      ok: true,
      framework: 'Marvis',
      version: '1.0.0',
    };
  }

  listTools(): ToolSchema[] {
    return [
      {
        name: 'generate_plan',
        description: '根据用户需求生成手游开发执行计划',
        parameters: { gameType: 'string', userRequest: 'string' },
      },
      {
        name: 'execute_step',
        description: '执行计划中的一个步骤',
        parameters: { stepId: 'string' },
      },
      {
        name: 'reflect',
        description: '对已执行步骤进行反思校验',
        parameters: { stepId: 'string' },
      },
    ];
  }

  getContext(): Context {
    return this.context;
  }

  /* ===================== 内部辅助 ===================== */

  private createInitialContext(): Context {
    return {
      workspacePath: this.workspacePath,
      currentPhase: '立项',
      history: [],
      artifacts: [],
      preferences: {
        language: 'zh-CN',
        codeStyle: 'compact',
        testFramework: 'vitest',
      },
      memoryIds: [],
      errors: [],
    };
  }
}

/**
 * 从用户请求中推断游戏类型。
 */
function inferGameType(task: string): string {
  const patterns: Record<string, RegExp> = {
    '放置': /放置|idle|挂机|clicker|点点点/,
    '卡牌': /卡牌|card|TCG|抽卡|牌组/,
    '休闲': /休闲|casual|三消|match/,
    '肉鸽': /肉鸽|roguelike|rogue/,
    '文字冒险': /文字|text.*adventure|AVG|视觉小说/,
    '动作': /动作|action|格斗|fight/,
    '射击': /射击|shooter|FPS|TPS/,
    '平台跳跃': /平台|platform|横版|跳跃/,
  };

  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(task)) return type;
  }

  return '放置'; // 默认
}
