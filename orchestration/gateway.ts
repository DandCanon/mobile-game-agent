/**
 * API Gateway — 统一入口层
 *
 * 职责：
 * 1. 请求校验（参数检查、游戏类型推断、风险扫描）
 * 2. 路由分发（CLI/HTTP/Marvis/WebSocket 统一适配入口）
 * 3. 日志追踪（reqId + 全链路计时 + 错误聚合）
 * 4. 安全闸门（高危操作拦截、白名单检查）
 */

import type {
  AgentRequest,
  AgentResponse,
  Context,
  ExecutionPlan,
  StepRecord,
  Artifact,
  PlanStep,
  SkillManifest,
} from '../protocol/agent-protocol';
import type { MarvisAdapter } from '../adapters/marvis-adapter';
import { selectTech } from '../orchestration/tech-selector';
import { generatePlan } from '../orchestration/planner';
import { generatePlanWithLLM } from '../orchestration/planner-llm';
import type { LLMClient } from '../orchestration/llm-client';
import { MemoryManager } from '../orchestration/memory-manager';
import type { Persistence } from '../orchestration/persistence';
import { ToolCache } from '../orchestration/tool-cache';
import { Logger, logger, type LogLevel } from '../orchestration/logger';
import { createInputGuard, type GuardReport } from '../orchestration/guard';
import { scanSkills } from '../orchestration/skill-loader';

/* ===================== 类型定义 ===================== */

export type RequestSource = 'cli' | 'http' | 'marvis' | 'ws';
export type { LogLevel };

export interface LogEntry {
  reqId: string;
  level: LogLevel;
  message: string;
  timestamp: number;
  durationMs?: number;
  data?: unknown;
}

interface SafetyRule {
  pattern: RegExp;
  risk: 'high' | 'medium' | 'low';
  reason: string;
}

/* ===================== 安全规则集 ===================== */

const SAFETY_RULES: SafetyRule[] = [
  { pattern: /rm\s+-rf|del\s+\/f\s+\/s|format|erase/i, risk: 'high', reason: '破坏性删除命令' },
  { pattern: /sudo|chmod\s+777/i, risk: 'medium', reason: '提权操作' },
  { pattern: /eval\s*\(|exec\s*\(|system\s*\(/i, risk: 'medium', reason: '动态代码执行' },
  { pattern: /rmdir\s+\/s\s+C:\\Windows|rd\s+\/s\s+C:\\Windows/i, risk: 'high', reason: '系统目录操作' },
];

/* ===================== 空计划（错误响应用） ===================== */

function emptyPlan(): ExecutionPlan {
  return { planId: '', overallGoal: '', techRecommendation: { engine: 'react-vite-tailwind', reason: '', alternatives: [], pros: [], cons: [] }, steps: [], estimatedDuration: 0, risks: [] };
}

/* ===================== Gateway 实现 ===================== */

export class Gateway {
  private adapter: MarvisAdapter | null = null;
  private llmClient: LLMClient | null = null;
  private memory: MemoryManager | null = null;
  private toolCache: ToolCache | null = null;
  private logs: LogEntry[] = [];
  private readonly maxLogs = 1000;
  private gatewayLogger: Logger;
  private inputGuard = createInputGuard(10000);
  private skillsDir: string | null = null;

  constructor() {
    this.gatewayLogger = new Logger('Gateway');
  }

  /** 获取 Gateway 专属 Logger 实例（供外部读取） */
  getLogger(): Logger {
    return this.gatewayLogger;
  }

  setAdapter(adapter: MarvisAdapter): void {
    this.adapter = adapter;
  }

  /** 注入 LLMClient：启用 LLM 驱动的计划生成 */
  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
  }

  /** 注入 MemoryManager：启用上下文裁剪 + 摘要 + 错误教训 */
  setMemory(memory: MemoryManager): void {
    this.memory = memory;
  }

  /** 注入 ToolCache：启用工具调用结果缓存 */
  setToolCache(tc: ToolCache): void {
    this.toolCache = tc;
  }

  /** 设置 skills/ 目录路径，启用 Skill 插件自动扫描 */
  setSkillsDir(dir: string): void {
    this.skillsDir = dir;
  }

  async handleRequest(request: AgentRequest, source: RequestSource): Promise<AgentResponse> {
    const reqId = this.generateReqId(source);
    const startTime = Date.now();

    this.gatewayLogger.info(`任务开始 [${source}] reqId=${reqId}`, { task: request.task.slice(0, 80) });
    this.log('info', `[${source}] 收到请求`, reqId, { task: request.task.slice(0, 80) });

    // ---------- 1. 参数校验 ----------
    const validationError = this.validate(request);
    if (validationError) {
      this.gatewayLogger.warn(`参数校验失败: ${validationError}`, { reqId });
      return this.errorResponse(validationError, reqId, startTime);
    }

    // ---------- 1b. 输入护栏 ----------
    const guardReport = this.inputGuard.evaluate(request.task);
    if (!guardReport.passed) {
      const reasons = guardReport.violations.map((v) => v.reason).join('; ');
      this.gatewayLogger.warn(`输入护栏拦截: ${reasons}`, { reqId, violations: guardReport.violations });
      this.log('warn', `输入护栏拦截: ${reasons}`, reqId, { violations: guardReport.violations });
      return {
        status: 'error',
        plan: emptyPlan(),
        steps: [],
        artifacts: [],
        errors: [{ code: 'GUARD_INPUT', message: `[输入护栏] ${reasons}`, stepId: '', recoverable: false }],
      };
    }

    // ---------- 2. 安全扫描 ----------
    const safetyIssue = this.safetyScan(request.task);
    if (safetyIssue) {
      this.gatewayLogger.warn(`安全拦截: ${safetyIssue.reason}`, { reqId, risk: safetyIssue.risk });
      this.log('warn', `安全拦截: ${safetyIssue.reason}`, reqId, { risk: safetyIssue.risk });
      return {
        status: 'error',
        plan: emptyPlan(),
        steps: [],
        artifacts: [],
        errors: [{ code: 'SAFETY', message: `[安全拦截] ${safetyIssue.reason}（风险等级: ${safetyIssue.risk}）`, stepId: '', recoverable: false }],
      };
    }

    // ---------- 3. 技术选型 ----------
    const gameType = this.inferGameType(request.task);
    const tech = selectTech(gameType, request.context);
    this.gatewayLogger.info(`技术选型: ${tech.recommended}`, { gameType, scores: tech.scores });
    this.log('info', `技术选型: ${tech.recommended}`, reqId, { gameType, scores: tech.scores });

    // ---------- 3b. 注入 Skill 清单 ----------
    if (this.skillsDir) {
      const skillManifests: SkillManifest[] = scanSkills(this.skillsDir).map((m) => ({
        name: m.name,
        version: m.version,
        description: m.description,
        engines: m.engines,
        triggers: m.triggers,
        capabilities: m.capabilities,
      }));
      request.context.skillManifests = skillManifests;
      this.gatewayLogger.info(`Skill 清单注入: ${skillManifests.length} 个`, { reqId });
    }

    // ---------- 4. 生成计划（轻量预览 / LLM 增强） ----------
    const memoryPrefix = this.memory?.buildSystemPromptPrefix() ?? '';
    const planGenResult = this.llmClient
      ? await generatePlanWithLLM(this.llmClient, request.task, request.context, memoryPrefix)
      : { plan: generatePlan(request.task, gameType, request.context), source: 'template' as const };

    this.gatewayLogger.info(`计划生成 (${planGenResult.source}): ${planGenResult.plan.steps.length} 步骤`, { reqId });
    this.log('info', `计划生成 (${planGenResult.source}): ${planGenResult.plan.steps.length} 步骤`, reqId);

    if (request.options?.planOnly) {
      const plan = planGenResult.plan;
      const elapsed = Date.now() - startTime;
      this.gatewayLogger.info(`任务完成 (planOnly): ${plan.steps.length} 步骤, ${elapsed}ms`, { reqId });
      this.log('info', `计划预览完成 (${plan.steps.length} 步骤, ${elapsed}ms)`, reqId);

      const previewSteps: StepRecord[] = plan.steps.map((s) => ({
        stepId: s.id,
        phase: s.phase,
        status: 'planned' as const,
        plan: s,
        startedAt: Date.now(),
        retryCount: 0,
      }));

      return {
        status: 'success',
        plan,
        steps: previewSteps,
        artifacts: [],
        errors: [],
      };
    }

    // ---------- 5. 完整执行 ----------
    if (!this.adapter) {
      this.gatewayLogger.error('Adapter 未初始化');
      return this.errorResponse('Adapter 未初始化，请先调用 setAdapter()', reqId, startTime);
    }

    const plan = planGenResult.plan;

    // 5b. PlanGate 人工确认（如果配置了回调）
    const planGate = request.options?.planGate;
    if (planGate !== undefined && planGate !== true) {
      let approved = false;
      try {
        if (typeof planGate === 'function') {
          approved = await planGate(plan);
        }
      } catch (e) {
        this.gatewayLogger.warn(`PlanGate 回调异常: ${String(e)}`, { reqId });
        this.log('warn', `PlanGate 回调异常: ${String(e)}`, reqId);
      }

      if (!approved) {
        const elapsed = Date.now() - startTime;
        this.gatewayLogger.info(`计划已生成但被 PlanGate 拒绝 (${plan.steps.length} 步骤, ${elapsed}ms)`, { reqId });
        this.log('info', `计划已生成但被 PlanGate 拒绝 (${plan.steps.length} 步骤, ${elapsed}ms)`, reqId);

        const previewSteps: StepRecord[] = plan.steps.map((s) => ({
          stepId: s.id,
          phase: s.phase,
          status: 'planned' as const,
          plan: s,
          startedAt: Date.now(),
          retryCount: 0,
        }));

        return {
          status: 'partial',
          plan,
          steps: previewSteps,
          artifacts: [],
          errors: [],
          gateStatus: { invoked: true, approved: false },
        };
      }
    }

    // 5c. 注入缓存拦截器并通过网关执行
    if (this.toolCache) {
      this.adapter.setToolCache(this.toolCache);
    }
    const response = await this.adapter.execute(request);

    const elapsed = Date.now() - startTime;
    const completed = response.steps.filter((s) => s.status === 'completed').length;
    const failed = response.steps.filter((s) => s.status === 'failed').length;
    this.gatewayLogger.info(`任务完成: ${completed}/${response.steps.length} 步骤通过, ${elapsed}ms`, { reqId, failed });
    this.log('info', `执行完成: ${completed}/${response.steps.length} 步骤通过, ${elapsed}ms`, reqId);

    // 5d. 记忆维护：上下文裁剪 + 摘要生成 + 错误教训（异步，不阻塞响应）
    if (this.memory) {
      this.memory.maintain(response.steps).catch((err) => {
        this.gatewayLogger.warn(`记忆维护失败: ${String(err)}`, { reqId });
        this.log('warn', `记忆维护失败: ${String(err)}`, reqId);
      });
    }

    return {
      ...response,
      techRecommendation: technologyRecommendationFrom(tech),
      gateStatus: planGate !== undefined ? { invoked: true, approved: true } : undefined,
    };
  }

  health(): { ok: boolean; adapter: string } {
    return { ok: this.adapter !== null, adapter: this.adapter ? 'Marvis' : 'none' };
  }

  getLogs(level?: LogLevel): LogEntry[] {
    return level ? this.logs.filter((l) => l.level === level) : [...this.logs];
  }

  clearLogs(): void { this.logs = []; }

  /* ===================== 私有方法 ===================== */

  private validate(request: AgentRequest): string | null {
    if (!request.task || request.task.trim().length === 0) return '请求内容为空';
    if (request.task.length > 10000) return '请求内容超过 10000 字符上限';
    return null;
  }

  private safetyScan(task: string): SafetyRule | null {
    for (const rule of SAFETY_RULES) {
      if (rule.pattern.test(task)) return rule;
    }
    return null;
  }

  private inferGameType(task: string): string {
    const patterns: Record<string, RegExp> = {
      '放置': /放置|idle|挂机|clicker|点点点/,
      '卡牌': /卡牌|card|TCG|抽卡|牌组/,
      '休闲': /休闲|casual|三消|match/,
      '肉鸽': /肉鸽|roguelike|rogue/,
      '文字冒险': /文字|text.*adventure|AVG|视觉小说/,
      '动作': /动作|action|格斗|fight/,
      '射击': /射击|shooter|FPS|TPS/,
      'loot-arpg': /刷宝|looter|loot|地牢刷装|装备.*掉落|掉落.*装备|词缀|arpg.*looot|looot.*arpg|像素.*arpg|2d.*arpg/,
    };
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(task)) return type;
    }
    return '放置';
  }

  private errorResponse(msg: string, reqId: string, startTime: number): AgentResponse {
    this.log('error', msg, reqId, { durationMs: Date.now() - startTime });
    return {
      status: 'error',
      plan: emptyPlan(),
      steps: [],
      artifacts: [],
      errors: [{ code: 'GATEWAY', message: msg, stepId: '', recoverable: false }],
    };
  }

  private log(level: LogLevel, message: string, reqId: string, data?: unknown): void {
    this.logs.push({ reqId, level, message, timestamp: Date.now(), data });
    if (this.logs.length > this.maxLogs) this.logs.shift();
  }

  private generateReqId(source: RequestSource): string {
    const src = source.slice(0, 2);
    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    return `${src}-${ts}-${rand}`;
  }
}

/** 临时：技术选型结果转为协议类型 */
function technologyRecommendationFrom(tech: { recommended: string; reason: string; scores: Record<string, number> }): NonNullable<AgentResponse['techRecommendation']> {
  return {
    engine: tech.recommended as 'react-vite-tailwind',
    reason: tech.reason,
    alternatives: Object.keys(tech.scores).filter((k) => k !== tech.recommended),
    pros: [],
    cons: [],
  };
}

let gatewayInstance: Gateway | null = null;
export function getGateway(): Gateway {
  if (!gatewayInstance) gatewayInstance = new Gateway();
  return gatewayInstance;
}
