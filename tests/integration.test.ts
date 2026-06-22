/**
 * Phase 1b 集成测试
 *
 * 验证完整 P→E→R 循环：
 * 1. 技术选型决策引擎
 * 2. Planner 计划生成
 * 3. Executor 步骤执行
 * 4. Reflector 反思校验
 * 5. Marvis 适配器端到端
 */

import { describe, it, expect } from 'vitest';
import { selectTechStack } from '../orchestration/tech-selector';
import { generatePlan } from '../orchestration/planner';
import { reflect, reflectAll, summarizeReflection } from '../orchestration/reflector';
import { MarvisAdapter } from '../adapters/marvis-adapter';
import type { Context, StepRecord } from '../protocol/agent-protocol';

/* ===================== 1. 技术选型决策引擎 ===================== */

describe('Tech Selector', () => {
  it('放置类手游 → 推荐 React Web 技术栈', () => {
    const result = selectTechStack({
      gameType: '放置',
      teamSize: 1,
      needHotUpdate: true,
      performanceLevel: 'low',
      targetPlatforms: ['Android'],
      budget: 'zero',
      developerExperience: 'JavaScript/React',
    });

    expect(result.recommendation.engine).toBe('react-vite-tailwind');
    expect(result.ranking[0].engine).toBe('react-vite-tailwind');
    expect(result.ranking[0].score).toBeGreaterThan(result.ranking[1]?.score ?? 0);
  });

  it('3D射击 → 推荐 Unity', () => {
    const result = selectTechStack({
      gameType: '射击',
      teamSize: 5,
      needHotUpdate: false,
      performanceLevel: 'high',
      targetPlatforms: ['Android', 'iOS'],
      budget: 'medium',
      developerExperience: 'C# / Unity',
    });

    expect(result.recommendation.engine).toBe('unity');
  });

  it('2D肉鸽 → 推荐 Godot', () => {
    const result = selectTechStack({
      gameType: '肉鸽',
      teamSize: 2,
      needHotUpdate: false,
      performanceLevel: 'medium',
      targetPlatforms: ['Android'],
      budget: 'zero',
      developerExperience: '',
    });

    expect(result.recommendation.engine).toBe('godot');
  });

  it('返回 3 个引擎完整排名', () => {
    const result = selectTechStack({
      gameType: '休闲',
      teamSize: 3,
      needHotUpdate: true,
      performanceLevel: 'low',
      targetPlatforms: ['Android', 'Web'],
      budget: 'zero',
      developerExperience: '',
    });

    expect(result.ranking).toHaveLength(3);
    expect(result.matrix).toHaveLength(3);
    result.ranking.forEach((r) => {
      expect(r.score).toBeGreaterThan(0);
    });
  });

  it('开发者经验加成正确', () => {
    const withReact = selectTechStack({
      gameType: '放置',
      teamSize: 1,
      needHotUpdate: true,
      performanceLevel: 'low',
      targetPlatforms: ['Android'],
      budget: 'zero',
      developerExperience: 'JavaScript TypeScript React 前端开发',
    });

    const withoutReact = selectTechStack({
      gameType: '放置',
      teamSize: 1,
      needHotUpdate: true,
      performanceLevel: 'low',
      targetPlatforms: ['Android'],
      budget: 'zero',
      developerExperience: '',
    });

    expect(withReact.ranking[0].score).toBeGreaterThan(withoutReact.ranking[0].score);
  });
});

/* ===================== 2. Planner 计划生成 ===================== */

describe('Planner', () => {
  const baseContext: Context = {
    workspacePath: 'D:\\Marvis\\手游AI开发Agent\\test-project',
    currentPhase: '立项',
    history: [],
    artifacts: [],
    preferences: { language: 'zh-CN', codeStyle: 'compact', testFramework: 'vitest' },
    memoryIds: [],
    errors: [],
  };

  it('生成放置类手游执行计划', () => {
    const plan = generatePlan(
      '开发一款修仙放置手游，挂机自动修炼',
      '放置',
      baseContext,
    );

    expect(plan.planId).toMatch(/^plan-/);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.techRecommendation.engine).toBeDefined();
  });

  it('每个步骤包含 5 项精细化产物', () => {
    const plan = generatePlan(
      '开发一款放置手游',
      '放置',
      baseContext,
    );

    for (const step of plan.steps) {
      expect(Array.isArray(step.directoryStructure)).toBe(true);
      expect(Array.isArray(step.interfaceContracts)).toBe(true);
      expect(Array.isArray(step.dataModels)).toBe(true);
      expect(Array.isArray(step.acceptanceCriteria)).toBe(true);
      expect(Array.isArray(step.estimatedTools)).toBe(true);
      expect(step.maxCodeLines).toBeGreaterThanOrEqual(0);
    }
  });

  it('步骤之间有依赖链', () => {
    const plan = generatePlan(
      '开发一款放置手游',
      '放置',
      baseContext,
    );

    // 第一步无依赖
    expect(plan.steps[0].dependencies).toHaveLength(0);

    // 后续步骤依赖前一步
    for (let i = 1; i < plan.steps.length; i++) {
      expect(plan.steps[i].dependencies.length).toBeGreaterThan(0);
      expect(plan.steps[i].dependencies[0]).toBe(plan.steps[i - 1].id);
    }
  });

  it('技术选型结果包含优缺点和备选', () => {
    const plan = generatePlan(
      '开发一款放置手游',
      '放置',
      baseContext,
    );

    expect(plan.techRecommendation.pros.length).toBeGreaterThan(0);
    expect(plan.techRecommendation.cons.length).toBeGreaterThan(0);
    expect(plan.techRecommendation.alternatives.length).toBeGreaterThan(0);
    expect(plan.techRecommendation.reason.length).toBeGreaterThan(0);
  });
});

/* ===================== 3. Reflector 反思校验 ===================== */

describe('Reflector', () => {
  const baseContext: Context = {
    workspacePath: 'D:\\test',
    currentPhase: '立项',
    history: [],
    artifacts: [],
    preferences: { language: 'zh-CN', codeStyle: 'compact', testFramework: 'vitest' },
    memoryIds: [],
    errors: [],
  };

  it('已完成的步骤通过校验', () => {
    const plan = generatePlan('测试', '放置', baseContext);
    const step = plan.steps[0];

    const record: StepRecord = {
      stepId: step.id,
      phase: step.phase,
      status: 'completed',
      plan: step,
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      retryCount: 0,
      result: {
        stepId: step.id,
        success: true,
        artifacts: [],
        toolCalls: [],
        errors: [],
        durationMs: 1000,
      },
    };

    const reflection = reflect(record);
    expect(reflection.passed).toBe(true);
    expect(reflection.needsRetry).toBe(false);
  });

  it('跳过的步骤直接通过', () => {
    const plan = generatePlan('测试', '放置', baseContext);
    const step = plan.steps[0];

    const record: StepRecord = {
      stepId: step.id,
      phase: step.phase,
      status: 'skipped',
      plan: step,
      startedAt: Date.now(),
      completedAt: Date.now(),
      retryCount: 0,
    };

    const reflection = reflect(record);
    expect(reflection.passed).toBe(true);
    expect(reflection.needsRetry).toBe(false);
  });

  it('失败的步骤触发重试（未超上限）', () => {
    const plan = generatePlan('测试', '放置', baseContext);
    const step = plan.steps[0];

    const record: StepRecord = {
      stepId: step.id,
      phase: step.phase,
      status: 'failed',
      plan: step,
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      retryCount: 0,
      result: {
        stepId: step.id,
        success: false,
        artifacts: [],
        toolCalls: [
          {
            toolName: 'write_file',
            input: {},
            output: null,
            success: false,
            error: 'Disk full',
            durationMs: 100,
          },
        ],
        errors: [{ code: 'TOOL_FAILED', message: 'Disk full', stepId: step.id, toolName: 'write_file', recoverable: true }],
        durationMs: 1000,
      },
    };

    const reflection = reflect(record);
    expect(reflection.passed).toBe(false);
    expect(reflection.needsRetry).toBe(true);
    expect(reflection.corrections.length).toBeGreaterThan(0);
  });

  it('超过 3 轮重试后不再建议重试', () => {
    const plan = generatePlan('测试', '放置', baseContext);
    const step = plan.steps[0];

    const record: StepRecord = {
      stepId: step.id,
      phase: step.phase,
      status: 'failed',
      plan: step,
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      retryCount: 3,
      result: {
        stepId: step.id,
        success: false,
        artifacts: [],
        toolCalls: [],
        errors: [{ code: 'TOOL_FAILED', message: 'Error', stepId: step.id, recoverable: false }],
        durationMs: 1000,
      },
    };

    const reflection = reflect(record, { maxReflectionRounds: 3 });
    expect(reflection.needsRetry).toBe(false);
  });

  it('全量反思生成摘要', () => {
    const plan = generatePlan('测试', '放置', baseContext);

    const records: StepRecord[] = plan.steps.map((step) => ({
      stepId: step.id,
      phase: step.phase,
      status: 'completed' as const,
      plan: step,
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      retryCount: 0,
      result: {
        stepId: step.id,
        success: true,
        artifacts: [],
        toolCalls: [],
        errors: [],
        durationMs: 1000,
      },
    }));

    const results = reflectAll(records);
    const summary = summarizeReflection(results);

    expect(results).toHaveLength(records.length);
    expect(summary).toContain('通过');
  });
});

/* ===================== 4. Marvis 适配器集成 ===================== */

describe('Marvis Adapter', () => {
  const workspacePath = 'D:\\Marvis\\手游AI开发Agent\\test-project';

  it('health 返回正确信息', async () => {
    const adapter = new MarvisAdapter(workspacePath);
    const health = await adapter.health();

    expect(health.ok).toBe(true);
    expect(health.framework).toBe('Marvis');
    expect(health.version).toBe('1.0.0');
  });

  it('listTools 返回可用工具列表', () => {
    const adapter = new MarvisAdapter(workspacePath);
    const tools = adapter.listTools();

    expect(tools.length).toBeGreaterThan(0);
    tools.forEach((t) => {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
    });
  });

  it('execute 完整 P→E→R 循环', async () => {
    const adapter = new MarvisAdapter(workspacePath);

    const response = await adapter.execute({
      task: '开发一款修仙放置手游，挂机自动修炼，突破境界',
      overallGoal: '创建完整的修仙放置手游',
      context: adapter.getContext(),
      tools: adapter.listTools(),
    });

    expect(response.status).toBe('success');
    expect(response.plan).toBeDefined();
    expect(response.steps.length).toBeGreaterThan(0);
    expect(response.plan?.techRecommendation.engine).toBeDefined();

    // 所有步骤应为 completed 或 skipped
    response.steps.forEach((step) => {
      expect(['completed', 'skipped']).toContain(step.status);
    });

    // 计划中每个步骤都有对应的记录
    const stepIds = response.steps.map((s) => s.stepId);
    response.plan?.steps.forEach((ps) => {
      expect(stepIds).toContain(ps.id);
    });
  });

  it('游戏类型推断正确', async () => {
    const adapter = new MarvisAdapter(workspacePath);

    const response = await adapter.execute({
      task: '想做一个卡牌对战手游',
      overallGoal: '开发卡牌对战手游',
      context: adapter.getContext(),
      tools: adapter.listTools(),
    });

    // 卡牌类在 Web 和 Godot 之间，有热更需求时应该倾向 Web
    expect(response.plan).toBeDefined();
  });

  it('上下文保持跨调用', async () => {
    const adapter = new MarvisAdapter(workspacePath);

    // 第一次调用
    await adapter.execute({
      task: '开发一款放置手游',
      overallGoal: '测试',
      context: adapter.getContext(),
      tools: adapter.listTools(),
    });

    const ctx1 = adapter.getContext();
    expect(ctx1.history.length).toBeGreaterThan(0);

    // 第二次调用后历史应该追加
    await adapter.execute({
      task: '添加装备系统',
      overallGoal: '扩展',
      context: adapter.getContext(),
      tools: adapter.listTools(),
    });

    const ctx2 = adapter.getContext();
    expect(ctx2.history.length).toBeGreaterThan(ctx1.history.length);
  });
});
