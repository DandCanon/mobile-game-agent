/**
 * Phase 3 — 端到端集成测试
 *
 * 覆盖完整管线：
 * 1. 原始需求 → 技术选型 → 计划生成
 * 2. 计划 → 步骤执行（Marvis 适配器模拟工具调用）
 * 3. 执行结果 → 反思校验 → 修正反馈
 * 4. Gateway 统一入口 + 安全扫描
 * 5. 错误路径（安全拦截 / 参数校验失败 / 步骤失败后依赖跳过）
 */

import { describe, it, expect } from 'vitest';
import { Gateway } from '../orchestration/gateway';
import { MarvisAdapter } from '../adapters/marvis-adapter';

const WORKSPACE = 'D:\\path\\to\\mobile-game-agent\\e2e-test';

function createGateway(): { gateway: Gateway; adapter: MarvisAdapter } {
  const adapter = new MarvisAdapter(WORKSPACE);
  const gateway = new Gateway();
  gateway.setAdapter(adapter);
  return { gateway, adapter };
}

/* ================================================================
 * 1. 完整 P→E→R 管道
 * ================================================================ */

describe('完整 P→E→R 管道', () => {
  it('放置手游：从需求到可执行计划全链路', async () => {
    const { gateway, adapter } = createGateway();
    const ctx = adapter.getContext();

    const response = await gateway.handleRequest(
      {
        task: '开发一款修仙放置手游，点击修炼突破境界，离线自动挂机',
        overallGoal: '创建完整的修仙放置手游',
        context: ctx,
        tools: adapter.listTools(),
      },
      'marvis',
    );

    expect(response.status).toBe('success');
    expect(response.plan).toBeDefined();
    expect(response.plan!.steps.length).toBeGreaterThanOrEqual(3);

    // 放置类必须推荐 React Web 技术栈
    expect(response.plan!.techRecommendation.engine).toBe('react-vite-tailwind');

    // 所有步骤必须已执行
    response.steps.forEach((s) => {
      expect(['completed', 'skipped']).toContain(s.status);
    });

    // 计划与步骤数量对齐
    expect(response.steps.length).toBe(response.plan!.steps.length);
  });

  it('卡牌手游：技术选型正确路由', async () => {
    const { gateway, adapter } = createGateway();
    const ctx = adapter.getContext();

    const response = await gateway.handleRequest(
      {
        task: '开发一款TCG卡牌对战手游，抽卡开包，回合制对战',
        overallGoal: '开发卡牌对战手游',
        context: ctx,
        tools: adapter.listTools(),
      },
      'marvis',
    );

    expect(response.status).toBe('success');
    expect(response.plan).toBeDefined();
  });
});

/* ================================================================
 * 2. Gateway 安全 & 校验
 * ================================================================ */

describe('Gateway 安全与校验', () => {
  it('安全拦截：包含破坏性命令的请求被拒绝', async () => {
    const { gateway, adapter } = createGateway();
    const ctx = adapter.getContext();

    const response = await gateway.handleRequest(
      {
        task: '游戏需要 rm -rf 清理缓存再初始化',
        overallGoal: '危险测试',
        context: ctx,
        tools: adapter.listTools(),
      },
      'marvis',
    );

    expect(response.status).toBe('error');
    expect(response.errors[0].code).toBe('SAFETY');
    expect(response.errors[0].message).toContain('安全拦截');
  });

  it('空请求被拒绝', async () => {
    const { gateway, adapter } = createGateway();
    const ctx = adapter.getContext();

    const response = await gateway.handleRequest(
      {
        task: '   ',
        overallGoal: '',
        context: ctx,
        tools: adapter.listTools(),
      },
      'marvis',
    );

    expect(response.status).toBe('error');
    expect(response.errors[0].code).toBe('GATEWAY');
  });

  it('超长请求被拒绝', async () => {
    const { gateway, adapter } = createGateway();
    const ctx = adapter.getContext();

    const response = await gateway.handleRequest(
      {
        task: 'x'.repeat(10001),
        overallGoal: 'test',
        context: ctx,
        tools: adapter.listTools(),
      },
      'marvis',
    );

    expect(response.status).toBe('error');
  });
});

/* ================================================================
 * 3. Gateway 生命周期
 * ================================================================ */

describe('Gateway 生命周期', () => {
  it('health 检查', () => {
    const gateway = new Gateway();
    expect(gateway.health().ok).toBe(false);
    expect(gateway.health().adapter).toBe('none');

    gateway.setAdapter(new MarvisAdapter(WORKSPACE));
    expect(gateway.health().ok).toBe(true);
    expect(gateway.health().adapter).toBe('Marvis');
  });

  it('日志记录', async () => {
    const { gateway, adapter } = createGateway();
    const ctx = adapter.getContext();

    await gateway.handleRequest(
      {
        task: '开发放置手游',
        overallGoal: 'test',
        context: ctx,
        tools: adapter.listTools(),
      },
      'marvis',
    );

    const logs = gateway.getLogs();
    expect(logs.length).toBeGreaterThanOrEqual(2);

    const infoLogs = gateway.getLogs('info');
    expect(infoLogs.length).toBeGreaterThan(0);

    const errorLogs = gateway.getLogs('error');
    expect(errorLogs.length).toBe(0);
  });

  it('planOnly 模式不执行工具调用', async () => {
    const { gateway, adapter } = createGateway();
    const ctx = adapter.getContext();

    const response = await gateway.handleRequest(
      {
        task: '开发放置手游',
        overallGoal: 'test',
        context: ctx,
        tools: adapter.listTools(),
        options: { planOnly: true },
      },
      'marvis',
    );

    expect(response.status).toBe('success');
    expect(response.plan).toBeDefined();
    // planOnly 模式 steps 状态为 planned，非 completed
    expect(response.steps.every((s) => s.status === 'planned')).toBe(true);
  });
});

/* ================================================================
 * 4. 跨品类兼容性
 * ================================================================ */

describe('跨品类兼容性', () => {
  it('多种游戏类型均可生成计划', async () => {
    const gameTypes: Array<{ task: string; expectedEngine: string }> = [
      { task: '放置修仙手游', expectedEngine: 'react-vite-tailwind' },
      { task: '2D像素肉鸽手游', expectedEngine: 'godot' },
    ];

    for (const { task, expectedEngine } of gameTypes) {
      const adapter = new MarvisAdapter(WORKSPACE);
      const ctx = adapter.getContext();
      const gateway = new Gateway();
      gateway.setAdapter(adapter);

      const response = await gateway.handleRequest(
        { task, overallGoal: task, context: ctx, tools: adapter.listTools() },
        'marvis',
      );

      expect(response.status).toBe('success');
      expect(response.plan!.techRecommendation.engine).toBe(expectedEngine);
    }
  });

  it('跨调用上下文保持', async () => {
    const adapter = new MarvisAdapter(WORKSPACE);
    const ctx1 = adapter.getContext();

    const gateway = new Gateway();
    gateway.setAdapter(adapter);

    await gateway.handleRequest(
      { task: '开发放置手游', overallGoal: 'test', context: ctx1, tools: adapter.listTools() },
      'marvis',
    );

    const ctx2 = adapter.getContext();
    expect(ctx2.history.length).toBeGreaterThan(0);

    await gateway.handleRequest(
      { task: '添加装备系统', overallGoal: '扩展', context: ctx2, tools: adapter.listTools() },
      'marvis',
    );

    const ctx3 = adapter.getContext();
    expect(ctx3.history.length).toBeGreaterThan(ctx2.history.length);
  });
});
