/**
 * Planner LLM — 基于 LLMClient 的计划生成器
 *
 * 职责：
 * 1. 将用户自然语言需求转化为结构化的 ExecutionPlan
 * 2. LLM 失败时自动降级回规则模板 generatePlan()
 * 3. 产出 JSON 格式计划，由类型守卫函数验证后返回
 */

import type {
  ExecutionPlan,
  PlanStep,
  PipelinePhase,
  Context,
  InterfaceContract,
  DataModel,
  AcceptanceCriterion,
  TechStack,
} from '../protocol/agent-protocol';
import type { LLMClient, LLMMessage } from './llm-client';
import { generatePlan } from './planner';

/* ===================== LLM Prompt ===================== */

const SYSTEM_PROMPT = `你是手游开发计划生成器。根据用户需求输出一个结构化的 JSON 执行计划。

## 阶段定义
可选阶段：立项、原型、生产、验证
- 立项：项目初始化、类型定义、数据模型、核心引擎
- 原型：可交互 MVP，含 UI 画面
- 生产：内容填充、关卡设计、美术素材
- 验证：类型检查、单元测试、dev server 启动

## 输出格式
请严格输出合法 JSON，结构如下：
{
  "overallGoal": "用户原始需求",
  "techRecommendation": {
    "engine": "react-vite-tailwind",
    "reason": "选择原因",
    "alternatives": ["godot"],
    "pros": ["轻量", "快速原型"],
    "cons": ["3D性能弱"]
  },
  "steps": [
    {
      "id": "step-01",
      "phase": "立项",
      "title": "步骤标题",
      "description": "步骤详情",
      "directoryStructure": ["src/game/"],
      "interfaceContracts": [
        { "name": "GameEngine", "signature": "class GameEngine", "params": [], "returns": "void", "purpose": "游戏主循环" }
      ],
      "dataModels": [
        { "name": "Player", "fields": [{"name": "hp", "type": "number", "nullable": false, "description": "生命值"}], "description": "玩家数据" }
      ],
      "acceptanceCriteria": [
        { "id": "ac-01", "description": "文件存在", "verifyBy": "file-exists", "verifyParam": "src/game/types.ts" }
      ],
      "estimatedTools": ["write_file", "shell_executor"],
      "dependencies": [],
      "maxCodeLines": 200
    }
  ],
  "estimatedDuration": 600,
  "risks": ["性能风险：..."]
}

## 规则
- steps 按阶段分组，同阶段内按依赖顺序排列
- 每个阶段至少 2 个步骤
- dependencies 填写前置步骤的 id（空数组表示立即执行）
- verifyBy 可选值：file-exists / type-check / unit-test / manual / shell
- 步骤总数 4~12 个`;

/* ===================== 类型守卫 ===================== */

function isValidPlan(json: unknown): json is {
  overallGoal: string;
  techRecommendation: {
    engine: string;
    reason: string;
    alternatives: string[];
    pros: string[];
    cons: string[];
  };
  steps: Array<{
    id: string;
    phase: string;
    title: string;
    description: string;
    directoryStructure: string[];
    interfaceContracts: InterfaceContract[];
    dataModels: DataModel[];
    acceptanceCriteria: AcceptanceCriterion[];
    estimatedTools: string[];
    dependencies: string[];
    maxCodeLines: number;
  }>;
  estimatedDuration: number;
  risks: string[];
} {
  if (!json || typeof json !== 'object') return false;
  const plan = json as Record<string, unknown>;
  return (
    typeof plan.overallGoal === 'string' &&
    Array.isArray(plan.steps) &&
    plan.steps.length > 0 &&
    plan.steps.every(
      (s: unknown) => s && typeof s === 'object' && 'id' in s && 'title' in s,
    )
  );
}

function normalizePhase(phase: string): PipelinePhase {
  // "验证"映射到"测试"阶段
  if (phase === '验证') return '测试';
  const valid: PipelinePhase[] = ['立项', '原型', '生产', '测试', '发行', '运营'];
  if (valid.includes(phase as PipelinePhase)) return phase as PipelinePhase;
  return '原型';
}

/* ===================== 主函数 ===================== */

export async function generatePlanWithLLM(
  client: LLMClient,
  userRequest: string,
  context: Context,
  sysPromptPrefix = '',
): Promise<{ plan: ExecutionPlan; source: 'llm' | 'fallback' }> {
  try {
    const systemPrompt = sysPromptPrefix
      ? `${sysPromptPrefix}\n\n${SYSTEM_PROMPT}`
      : SYSTEM_PROMPT;

    const messages: LLMMessage[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `工作目录：${context.workspacePath}\n团队规模：${context.preferences.teamSize ?? 1}人\n需求：${userRequest}`,
      },
    ];

    const result = await client.complete(messages, {
      temperature: 0.3,
      maxTokens: 8192,
      jsonMode: true,
    });

    // 尝试解析 JSON
    let parsed: unknown;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      // 有些 LLM 会在 JSON 外包裹 markdown 代码块
      const match = result.content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match) {
        parsed = JSON.parse(match[1]);
      } else {
        throw new Error('无法解析 LLM 返回的 JSON');
      }
    }

    if (!isValidPlan(parsed)) {
      throw new Error('LLM 返回的计划结构不完整');
    }

    // 转换为 ExecutionPlan
    const plan: ExecutionPlan = {
      planId: `plan-llm-${Date.now()}`,
      overallGoal: parsed.overallGoal,
      techRecommendation: {
        engine: (parsed.techRecommendation.engine as TechStack['engine']) || 'react-vite-tailwind',
        reason: parsed.techRecommendation.reason || 'LLM 推荐',
        alternatives: parsed.techRecommendation.alternatives || [],
        pros: parsed.techRecommendation.pros || [],
        cons: parsed.techRecommendation.cons || [],
      },
      steps: parsed.steps.map((s) => ({
        id: s.id,
        phase: normalizePhase(s.phase),
        title: s.title,
        description: s.description,
        directoryStructure: s.directoryStructure.map(
          (d) => `${context.workspacePath}\\${d}`,
        ),
        interfaceContracts: s.interfaceContracts ?? [],
        dataModels: s.dataModels ?? [],
        acceptanceCriteria: s.acceptanceCriteria ?? [],
        estimatedTools: s.estimatedTools ?? [],
        dependencies: s.dependencies ?? [],
        maxCodeLines: s.maxCodeLines ?? 200,
      })),
      estimatedDuration: parsed.estimatedDuration ?? parsed.steps.length * 120,
      risks: parsed.risks ?? [],
    };

    return { plan, source: 'llm' };
  } catch (err) {
    // 降级：回退到规则模板
    console.warn(`LLM Planner 降级: ${String(err)}`);

    const gameType = inferGameType(userRequest);
    const fallbackPlan = generatePlan(userRequest, gameType, context);
    return { plan: fallbackPlan, source: 'fallback' };
  }
}

/* ===================== 辅助 ===================== */

function inferGameType(task: string): string {
  const patterns: Record<string, RegExp> = {
    '放置': /放置|idle|挂机|clicker|点点点/,
    '卡牌': /卡牌|card|TCG|抽卡|牌组/,
    '肉鸽': /肉鸽|roguelike|rogue/,
    '文字冒险': /文字|text.*adventure|AVG|视觉小说/,
    '动作': /动作|action|格斗|fight/,
    '射击': /射击|shooter|FPS|TPS/,
  };
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(task)) return type;
  }
  return '放置';
}
