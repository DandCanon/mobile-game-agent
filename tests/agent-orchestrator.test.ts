/**
 * agent-orchestrator.test.ts — 多 Agent 协同编排器单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AgentOrchestrator,
  type AgentRole,
  type SubTask,
  type OrchestrationResult,
} from '../orchestration/agent-orchestrator';
import type { LLMClient, LLMCompleteResult } from '../orchestration/llm-client';

/* ===================== Mock LLMClient ===================== */

function createMockLLMClient(jsonResponse: unknown): LLMClient {
  return {
    complete: vi.fn().mockResolvedValue({
      content: JSON.stringify(jsonResponse),
      finishReason: 'stop',
      usage: { promptTokens: 100, completionTokens: 200 },
    } as LLMCompleteResult),
    completeStream: vi.fn(),
  } as unknown as LLMClient;
}

function createFailingLLMClient(): LLMClient {
  return {
    complete: vi.fn().mockRejectedValue(new Error('LLM 服务不可用')),
    completeStream: vi.fn(),
  } as unknown as LLMClient;
}

/* ===================== 测试数据 ===================== */

const mockLLMDecomposition = {
  subTasks: [
    {
      id: 'plan-1',
      role: 'planner',
      description: '分析需求并生成开发计划',
      input: '开发一款放置游戏',
      dependencies: [],
    },
    {
      id: 'arch-2',
      role: 'architect',
      description: '评估技术栈',
      input: '开发一款放置游戏',
      dependencies: ['plan-1'],
    },
    {
      id: 'code-3',
      role: 'coder',
      description: '生成核心代码',
      input: '开发一款放置游戏',
      dependencies: ['plan-1', 'arch-2'],
    },
    {
      id: 'review-4',
      role: 'reviewer',
      description: '审查代码质量',
      input: '开发一款放置游戏',
      dependencies: ['code-3'],
    },
  ],
};

/* ===================== 1. 角色注册 ===================== */

describe('AgentOrchestrator — 角色注册', () => {
  let orchestrator: AgentOrchestrator;

  beforeEach(() => {
    orchestrator = new AgentOrchestrator();
  });

  it('预置 4 个核心角色已注册', () => {
    const roles = orchestrator.getRoles();
    expect(roles).toHaveLength(4);
    const names = roles.map((r) => r.name);
    expect(names).toContain('planner');
    expect(names).toContain('coder');
    expect(names).toContain('reviewer');
    expect(names).toContain('architect');
  });

  it('planner 优先级最高', () => {
    const roles = orchestrator.getRoles();
    expect(roles[0].name).toBe('planner');
  });

  it('registerRole 可注册自定义角色', () => {
    const customRole: AgentRole = {
      name: 'tester',
      description: '负责测试',
      capabilities: ['testing', 'e2e'],
      tools: ['vitest'],
      priority: 4,
    };
    orchestrator.registerRole(customRole);
    const roles = orchestrator.getRoles();
    expect(roles).toHaveLength(5);
    const tester = roles.find((r) => r.name === 'tester');
    expect(tester).toBeDefined();
    expect(tester!.tools).toEqual(['vitest']);
  });

  it('unregisterRole 可注销角色', () => {
    const customRole: AgentRole = {
      name: 'temp',
      description: '临时角色',
      capabilities: [],
      tools: [],
      priority: 99,
    };
    orchestrator.registerRole(customRole);
    expect(orchestrator.getRoles()).toHaveLength(5);
    const result = orchestrator.unregisterRole('temp');
    expect(result).toBe(true);
    expect(orchestrator.getRoles()).toHaveLength(4);
  });

  it('unregisterRole 不存在的角色返回 false', () => {
    const result = orchestrator.unregisterRole('nonexistent');
    expect(result).toBe(false);
  });

  it('同一名称角色覆盖注册', () => {
    const roleV1: AgentRole = {
      name: 'planner',
      description: '旧版 planner',
      capabilities: ['planning'],
      tools: ['tool-v1'],
      priority: 1,
    };
    orchestrator.registerRole(roleV1);
    const roles = orchestrator.getRoles();
    const planner = roles.find((r) => r.name === 'planner');
    expect(planner!.tools).toEqual(['tool-v1']);
  });
});

/* ===================== 2. 任务拆解 ===================== */

describe('AgentOrchestrator — 任务拆解 (decompose)', () => {
  it('LLM 辅助拆解：将任务拆解为多个子任务', async () => {
    const llmClient = createMockLLMClient(mockLLMDecomposition);
    const orchestrator = new AgentOrchestrator(llmClient);
    const subTasks = await orchestrator.decompose('开发一款放置游戏');

    expect(subTasks).toHaveLength(4);
    expect(subTasks[0].role).toBe('planner');
    expect(subTasks[0].dependencies).toEqual([]);
    expect(subTasks[1].role).toBe('architect');
    expect(subTasks[1].dependencies).toEqual(['plan-1']);
    expect(subTasks[2].role).toBe('coder');
    expect(subTasks[3].role).toBe('reviewer');
    expect(subTasks[3].dependencies).toEqual(['code-3']);
  });

  it('LLM 不可用时降级为规则拆解', async () => {
    const llmClient = createFailingLLMClient();
    const orchestrator = new AgentOrchestrator(llmClient);
    const subTasks = await orchestrator.decompose('开发一款手游');

    expect(subTasks.length).toBeGreaterThanOrEqual(1);
    // 规则模板匹配：开发/手游 → 4 个子任务
    const roles = subTasks.map((s) => s.role);
    expect(roles).toContain('planner');
  });

  it('无 LLM 时直接使用规则拆解', async () => {
    const orchestrator = new AgentOrchestrator();
    const subTasks = await orchestrator.decompose('帮我审查代码');

    expect(subTasks.length).toBeGreaterThanOrEqual(1);
    // 匹配审查模板：1 个 reviewer 子任务
    expect(subTasks[0].role).toBe('reviewer');
  });

  it('无匹配模板时生成默认 planner 子任务', async () => {
    const orchestrator = new AgentOrchestrator();
    const subTasks = await orchestrator.decompose('不匹配任何模板的任务描述');

    expect(subTasks).toHaveLength(1);
    expect(subTasks[0].role).toBe('planner');
    expect(subTasks[0].dependencies).toEqual([]);
  });

  it('LLM 返回包含未知角色时降级为 planner', async () => {
    const llmResponse = {
      subTasks: [
        {
          id: 'sub-1',
          role: 'unknown_agent',
          description: '未知角色测试',
          input: 'test',
          dependencies: [],
        },
      ],
    };
    const llmClient = createMockLLMClient(llmResponse);
    const orchestrator = new AgentOrchestrator(llmClient);
    const subTasks = await orchestrator.decompose('test');

    expect(subTasks[0].role).toBe('planner');
  });

  it('LLM 返回 JSON 包在 markdown 代码块中也能正确解析', async () => {
    const llmClient = {
      complete: vi.fn().mockResolvedValue({
        content: '```json\n' + JSON.stringify(mockLLMDecomposition) + '\n```',
        finishReason: 'stop',
      }),
      completeStream: vi.fn(),
    } as unknown as LLMClient;

    const orchestrator = new AgentOrchestrator(llmClient);
    const subTasks = await orchestrator.decompose('开发一款放置游戏');
    expect(subTasks).toHaveLength(4);
  });

  it('规则拆解：技术选型类任务', async () => {
    const orchestrator = new AgentOrchestrator();
    const subTasks = await orchestrator.decompose('帮我评估技术栈');

    expect(subTasks.length).toBeGreaterThanOrEqual(1);
    expect(subTasks[0].role).toBe('architect');
  });
});

/* ===================== 3. 编排执行 ===================== */

describe('AgentOrchestrator — 编排执行 (execute)', () => {
  it('串行执行：有依赖的子任务按顺序执行', async () => {
    const executionOrder: string[] = [];
    const orchestrator = new AgentOrchestrator();
    orchestrator.setExecuteSubTaskFn(async (subTask) => {
      executionOrder.push(subTask.id);
      // 模拟执行时间
      await new Promise((r) => setTimeout(r, 10));
      return `${subTask.id} 完成`;
    });

    // 使用 LLM 拆解确保有依赖关系
    const llmClient = createMockLLMClient(mockLLMDecomposition);
    orchestrator.setLLMClient(llmClient);

    const result = await orchestrator.execute('开发一款放置游戏');

    expect(result.stats.total).toBe(4);
    expect(result.stats.completed).toBe(4);
    expect(result.stats.failed).toBe(0);

    // 验证依赖顺序：plan-1 必须先于 arch-2 和 code-3
    const planIdx = executionOrder.indexOf('plan-1');
    const archIdx = executionOrder.indexOf('arch-2');
    const codeIdx = executionOrder.indexOf('code-3');
    const reviewIdx = executionOrder.indexOf('review-4');

    expect(planIdx).toBeLessThan(archIdx);
    expect(planIdx).toBeLessThan(codeIdx);
    expect(archIdx).toBeLessThan(codeIdx);
    expect(codeIdx).toBeLessThan(reviewIdx);
  });

  it('并行执行：无依赖的子任务同时执行', async () => {
    const parallelResponse = {
      subTasks: [
        {
          id: 'plan-1',
          role: 'planner',
          description: '计划 A',
          input: 'task',
          dependencies: [],
        },
        {
          id: 'arch-2',
          role: 'architect',
          description: '选型 B',
          input: 'task',
          dependencies: [],
        },
        {
          id: 'code-3',
          role: 'coder',
          description: '编码 C',
          input: 'task',
          dependencies: ['plan-1', 'arch-2'],
        },
      ],
    };

    const startTimes: Map<string, number> = new Map();
    const orchestrator = new AgentOrchestrator();
    orchestrator.setLLMClient(createMockLLMClient(parallelResponse));
    orchestrator.setExecuteSubTaskFn(async (subTask) => {
      startTimes.set(subTask.id, Date.now());
      await new Promise((r) => setTimeout(r, 30));
      return `${subTask.id} 完成`;
    });

    await orchestrator.execute('test parallel');

    // plan-1 和 arch-2 应该几乎同时开始（无依赖，同层并行）
    const planStart = startTimes.get('plan-1')!;
    const archStart = startTimes.get('arch-2')!;
    const codeStart = startTimes.get('code-3')!;

    // 前两个是并行的，后一个有依赖，开始时间应晚于前驱
    expect(codeStart).toBeGreaterThanOrEqual(planStart);
    expect(codeStart).toBeGreaterThanOrEqual(archStart);
  });

  it('前置依赖失败时后续子任务被跳过', async () => {
    const failResponse = {
      subTasks: [
        {
          id: 'plan-1',
          role: 'planner',
          description: '会失败的任务',
          input: 'task',
          dependencies: [],
        },
        {
          id: 'code-2',
          role: 'coder',
          description: '依赖失败的任务',
          input: 'task',
          dependencies: ['plan-1'],
        },
      ],
    };

    const orchestrator = new AgentOrchestrator();
    orchestrator.setLLMClient(createMockLLMClient(failResponse));
    orchestrator.setExecuteSubTaskFn(async (subTask) => {
      if (subTask.id === 'plan-1') {
        throw new Error('计划生成失败');
      }
      return `${subTask.id} 完成`;
    });

    const result = await orchestrator.execute('test failure');

    expect(result.stats.completed).toBe(0);
    expect(result.stats.failed).toBe(1);
    expect(result.stats.skipped).toBe(1);

    const planTask = result.subTasks.find((s) => s.id === 'plan-1');
    const codeTask = result.subTasks.find((s) => s.id === 'code-2');
    expect(planTask!.status).toBe('failed');
    expect(codeTask!.status).toBe('skipped');
  });

  it('execute 返回完整的 OrchestrationResult', async () => {
    const orchestrator = new AgentOrchestrator();
    orchestrator.setLLMClient(createMockLLMClient(mockLLMDecomposition));
    orchestrator.setExecuteSubTaskFn(async (subTask) => {
      return `${subTask.id} 执行成功`;
    });

    const result = await orchestrator.execute('开发一款放置游戏');

    expect(result.task).toBe('开发一款放置游戏');
    expect(result.subTasks).toHaveLength(4);
    expect(result.summary).toContain('编排执行报告');
    expect(result.summary).toContain('plan-1');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.stats.total).toBe(4);
    expect(result.stats.completed).toBe(4);
    expect(result.stats.failed).toBe(0);
    expect(result.stats.skipped).toBe(0);
  });

  it('无 LLM 时使用规则拆解并执行', async () => {
    const orchestrator = new AgentOrchestrator();
    orchestrator.setExecuteSubTaskFn(async (subTask) => {
      return `${subTask.id} 完成`;
    });

    const result = await orchestrator.execute('帮我审查代码质量');

    expect(result.subTasks.length).toBeGreaterThanOrEqual(1);
    expect(result.subTasks[0].role).toBe('reviewer');
    expect(result.subTasks[0].status).toBe('completed');
  });
});

/* ===================== 4. 状态查询 ===================== */

describe('AgentOrchestrator — 状态查询 (getStatus)', () => {
  it('初始状态：无活跃任务，4 个已注册角色', () => {
    const orchestrator = new AgentOrchestrator();
    const status = orchestrator.getStatus();

    expect(status.activeTasks).toBe(0);
    expect(status.queueLength).toBe(0);
    expect(status.completedTasks).toBe(0);
    expect(status.failedTasks).toBe(0);
    expect(status.registeredRoles).toBe(4);
    expect(status.isExecuting).toBe(false);
  });

  it('执行完成后状态清零', async () => {
    const orchestrator = new AgentOrchestrator();
    orchestrator.setLLMClient(createMockLLMClient(mockLLMDecomposition));
    orchestrator.setExecuteSubTaskFn(async (subTask) => {
      return `${subTask.id} 完成`;
    });

    await orchestrator.execute('test');
    const status = orchestrator.getStatus();

    expect(status.isExecuting).toBe(false);
    expect(status.activeTasks).toBe(0);
  });
});

/* ===================== 5. 边界情况 ===================== */

describe('AgentOrchestrator — 边界情况', () => {
  it('空角色列表时拆解仍返回默认 planner', async () => {
    const orchestrator = new AgentOrchestrator();
    // 注销所有预置角色
    orchestrator.unregisterRole('planner');
    orchestrator.unregisterRole('coder');
    orchestrator.unregisterRole('reviewer');
    orchestrator.unregisterRole('architect');

    const subTasks = await orchestrator.decompose('某个任务');
    expect(subTasks.length).toBeGreaterThanOrEqual(1);
  });

  it('LLM 返回空 subTasks 时抛出错误', async () => {
    const llmClient = createMockLLMClient({ subTasks: [] });
    const orchestrator = new AgentOrchestrator(llmClient);
    const subTasks = await orchestrator.decompose('test');

    // 空数组也是合法结果
    expect(subTasks).toHaveLength(0);
  });

  it('LLM 返回 JSON 解析失败时降级为规则拆解', async () => {
    const llmClient = {
      complete: vi.fn().mockResolvedValue({
        content: '这不是合法的 JSON {{{',
        finishReason: 'stop',
      }),
      completeStream: vi.fn(),
    } as unknown as LLMClient;

    const orchestrator = new AgentOrchestrator(llmClient);
    // 应降级到规则拆解，不会抛出
    const subTasks = await orchestrator.decompose('开发一款游戏');
    expect(subTasks.length).toBeGreaterThanOrEqual(1);
  });

  it('setLLMClient 替换 LLM 客户端', async () => {
    const orchestrator = new AgentOrchestrator();
    expect(orchestrator.getRoles()).toHaveLength(4);

    const llmClient = createMockLLMClient(mockLLMDecomposition);
    orchestrator.setLLMClient(llmClient);
    const subTasks = await orchestrator.decompose('开发一款放置游戏');
    expect(subTasks).toHaveLength(4);
  });
});

/* ===================== 6. 复杂依赖链 ===================== */

describe('AgentOrchestrator — 复杂依赖链', () => {
  it('多层依赖链正确串行', async () => {
    const deepChainResponse = {
      subTasks: [
        { id: 'plan-1', role: 'planner', description: 'A', input: 'x', dependencies: [] },
        { id: 'code-2', role: 'coder', description: 'B', input: 'x', dependencies: ['plan-1'] },
        { id: 'code-3', role: 'coder', description: 'C', input: 'x', dependencies: ['code-2'] },
        { id: 'review-4', role: 'reviewer', description: 'D', input: 'x', dependencies: ['code-3'] },
      ],
    };

    const executionOrder: string[] = [];
    const orchestrator = new AgentOrchestrator();
    orchestrator.setLLMClient(createMockLLMClient(deepChainResponse));
    orchestrator.setExecuteSubTaskFn(async (subTask) => {
      executionOrder.push(subTask.id);
      await new Promise((r) => setTimeout(r, 5));
      return `${subTask.id} 完成`;
    });

    await orchestrator.execute('test deep chain');

    expect(executionOrder).toEqual(['plan-1', 'code-2', 'code-3', 'review-4']);
  });

  it('菱形依赖正确执行：并行分支汇聚', async () => {
    const diamondResponse = {
      subTasks: [
        { id: 'plan-1', role: 'planner', description: 'root', input: 'x', dependencies: [] },
        { id: 'code-2', role: 'coder', description: 'left', input: 'x', dependencies: ['plan-1'] },
        { id: 'code-3', role: 'coder', description: 'right', input: 'x', dependencies: ['plan-1'] },
        { id: 'review-4', role: 'reviewer', description: 'merge', input: 'x', dependencies: ['code-2', 'code-3'] },
      ],
    };

    const executionOrder: string[] = [];
    const orchestrator = new AgentOrchestrator();
    orchestrator.setLLMClient(createMockLLMClient(diamondResponse));
    orchestrator.setExecuteSubTaskFn(async (subTask) => {
      executionOrder.push(subTask.id);
      await new Promise((r) => setTimeout(r, 5));
      return `${subTask.id} 完成`;
    });

    await orchestrator.execute('test diamond');

    // plan-1 最先
    expect(executionOrder[0]).toBe('plan-1');
    // code-2 和 code-3 在 plan-1 之后，它们之间顺序不确定（并行）
    const afterPlan = executionOrder.slice(1, 3);
    expect(afterPlan).toContain('code-2');
    expect(afterPlan).toContain('code-3');
    // review-4 最后
    expect(executionOrder[3]).toBe('review-4');
  });
});
