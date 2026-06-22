/**
 * MemoryManager 单元测试（Mock Persistence）
 *
 * 覆盖：
 * - maintain() 不超限时原样返回
 * - maintain() 超限时触发裁剪与摘要
 * - 错误教训提取
 * - RAG 查询链路
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

/* ================================================================
 * Mocks
 * ================================================================ */

// Mock better-sqlite3
const mockStmt = {
  run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  get: vi.fn(() => undefined as unknown),
  all: vi.fn(() => [] as unknown[]),
};
vi.mock('better-sqlite3', () => ({
  default: function () {
    return {
      prepare: vi.fn(() => mockStmt),
      exec: vi.fn(),
      close: vi.fn(),
      pragma: vi.fn(),
      transaction: (fn: () => void) => fn,
    };
  },
}));

import { MemoryManager, type SummaryGenerator } from '../orchestration/memory-manager';
import { Persistence } from '../orchestration/persistence';
import type { StepRecord } from '../protocol/agent-protocol';

/* ================================================================
 * 辅助
 * ================================================================ */

let stepCounter = 0;
function makeStep(title: string, desc: string, status: StepRecord['status'], errorCodes: string[] = []): StepRecord {
  const sid = `step-${++stepCounter}`;
  return {
    stepId: sid,
    phase: '原型',
    status,
    plan: {
      id: sid,
      title,
      description: desc,
      phase: '原型',
      directoryStructure: [],
      interfaceContracts: [],
      dataModels: [],
      acceptanceCriteria: [{ id: 'ac1', description: 'AC: ' + desc, verifyBy: 'manual' as const, verifyParam: '' }],
      estimatedTools: [],
      dependencies: [],
      maxCodeLines: 200,
    },
    result: {
      stepId: sid,
      success: errorCodes.length === 0,
      durationMs: 100,
      artifacts: [],
      toolCalls: [],
      errors: errorCodes.sort().map((code) => ({
        code,
        message: `错误: ${code}`,
        stepId: sid,
        toolName: 'test_tool',
        recoverable: false,
      })),
    },
    startedAt: Date.now(),
    retryCount: 0,
  };
}

const mockSummaryGen: SummaryGenerator = {
  generateStepSummary: vi.fn(async (steps: StepRecord[]) => `摘要: ${steps.map((s) => s.plan.title).join(', ')}`),
  generateMetaSummary: vi.fn(async (summaries: string[]) => `元摘要: ${summaries.join(' | ')}`),
};

function createMgr(sessionId: string): MemoryManager {
  return new MemoryManager(new Persistence(':memory:'), sessionId, {
    generateStepSummary: vi.fn(async (steps: StepRecord[]) => `摘要: ${steps.map((s) => s.plan.title).join(', ')}`),
    generateMetaSummary: vi.fn(async (summaries: string[]) => `元摘要: ${summaries.join(' | ')}`),
  });
}

/* ================================================================
 * maintain() — 阈值内
 * ================================================================ */

describe('MemoryManager — maintain（阈值内）', () => {
  it('少量步骤原样返回', async () => {
    const mgr = createMgr('sess-tiny');
    const steps = [
      makeStep('初始化', '初始化项目', 'completed'),
      makeStep('构建', '执行构建', 'completed'),
    ];
    const result = await mgr.maintain(steps);
    expect(result).toEqual(steps);
  });

  it('不截断（token 远低于 32K 阈值）', async () => {
    const mgr = createMgr('sess-mid');
    const steps = Array.from({ length: 8 }, (_, i) =>
      makeStep(`步骤${i}`, `实现功能${i}`, 'completed'),
    );
    const result = await mgr.maintain(steps);
    expect(result.length).toBe(8);
    expect(result).toEqual(steps);
  });
});

/* ================================================================
 * maintain() — 超限裁剪
 * ================================================================ */

describe('MemoryManager — maintain（超限裁剪）', () => {
  it('超长步骤触发裁剪', async () => {
    const gen = {
      generateStepSummary: vi.fn(async (steps: StepRecord[]) => `摘要: ${steps.length} 步`),
      generateMetaSummary: vi.fn(async (s: string[]) => `元摘要`),
    };

    mockStmt.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });
    const mgr = new MemoryManager(new Persistence(':memory:'), 'sess-overflow', gen);

    const steps = Array.from({ length: 500 }, (_, i) =>
      makeStep(
        `第${i}个步骤：实现游戏核心战斗系统的全新模块`,
        `详细描述：此步骤包含大量文本内容用来消耗token配额，模拟超长对话场景下的记忆维护流程。`,
        'completed',
      ),
    );

    const result = await mgr.maintain(steps);
    expect(result.length).toBeLessThan(500);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(gen.generateStepSummary).toHaveBeenCalled();
  });

  it('至少保留 3 个步骤', async () => {
    const mgr = createMgr('sess-atleast');
    const steps = Array.from({ length: 600 }, (_, i) =>
      makeStep(
        `步骤${i}，包含大量中文字符来突破阈值限制`,
        `这个步骤的详细描述同样非常长，包含许多中文汉字字符来显著增加 token 估算值。`,
        'completed',
      ),
    );

    const result = await mgr.maintain(steps);
    expect(result.length).toBeGreaterThanOrEqual(3);
  });
});

/* ================================================================
 * 错误教训提取
 * ================================================================ */

describe('MemoryManager — 错误教训', () => {
  it('错误步骤被提取为教训', async () => {
    const mgr = createMgr('sess-err');
    const steps = [
      makeStep('正常', '一切顺利', 'completed'),
      makeStep('失败A', '构建失败', 'failed', ['ERR_BUILD']),
      makeStep('失败B', '部署失败', 'failed', ['ERR_DEPLOY']),
    ];

    // mock upsertErrorLesson
    mockStmt.run.mockReturnValue({ changes: 1, lastInsertRowid: 1 });

    await mgr.maintain(steps);

    // 验证 upsertErrorLesson 被调用（每个错误码一次）
    const calls = mockStmt.run.mock.calls.filter((c: unknown[]) =>
      typeof c[0] === 'string' && (c[0] === 'ERR_BUILD' || c[0] === 'ERR_DEPLOY'),
    );
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it('重复错误累加 frequency', async () => {
    const mgr = createMgr('sess-dup');
    const steps = [
      makeStep('A', '第一次', 'failed', ['ERR_DUP']),
      makeStep('B', '第二次', 'failed', ['ERR_DUP']),
      makeStep('C', '第三次', 'failed', ['ERR_DUP']),
    ];

    await mgr.maintain(steps);

    // ERR_DUP 被 upsert 3 次
    const calls = mockStmt.run.mock.calls.filter((c: unknown[]) => c[0] === 'ERR_DUP');
    expect(calls.length).toBeGreaterThanOrEqual(3);
  });
});

/* ================================================================
 * RAG 向量检索（P3）
 * ================================================================ */

describe('MemoryManager — RAG', () => {
  it('未初始化 RAG 时返回空', async () => {
    const mgr = createMgr('sess-rag');
    const results = await mgr.queryRelevant('背包系统');
    expect(results).toEqual([]);
  });

  it('初始化 RAG 后索引 size 为 0', async () => {
    const mgr = createMgr('sess-rag2');
    const { RuleEmbedder } = await import('../orchestration/embedder');
    await mgr.initRAG(new RuleEmbedder());
    expect(mgr.vectorIndexSize()).toBe(0);
  });

  it('RAG 检索返回相关记忆', async () => {
    const mgr = createMgr('sess-rag3');
    const { RuleEmbedder } = await import('../orchestration/embedder');
    const embedder = new RuleEmbedder();

    // 直接写入向量记录到 Persistence，然后 initRAG
    const v1 = await embedder.embed('实现玩家背包系统，支持道具拖拽和堆叠功能');
    const v2 = await embedder.embed('实现商城系统，支持虚拟货币购买道具');

    const per = new Persistence(':memory:');
    per.upsertVectorRecord({
      id: 'rag-test-1', text: '实现玩家背包系统，支持道具拖拽和堆叠功能',
      category: 'step', priority: 1, embedding: Array.from(v1), created_at: Date.now(),
    });
    per.upsertVectorRecord({
      id: 'rag-test-2', text: '实现商城系统，支持虚拟货币购买道具',
      category: 'step', priority: 1, embedding: Array.from(v2), created_at: Date.now(),
    });

    // 创建新 mgr 但用同一个 per（VectorIndex.loadFromDB 会读取）
    const mgr2 = new MemoryManager(per, 'sess-rag3b', mockSummaryGen);
    await mgr2.initRAG(embedder);

    const results = await mgr2.queryRelevant('背包道具管理');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toContain('背包');
  });
});
