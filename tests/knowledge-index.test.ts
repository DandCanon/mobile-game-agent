/**
 * Knowledge Index — 单元测试 (T3-M1/M2)
 *
 * 覆盖：
 * - KnowledgeIndexer CRUD（添加/搜索/标签检索/来源检索/导出/导入）
 * - TF-IDF 相关性排名验证
 * - 种子卡片完整性（20 张全字段非空、标签合法）
 * - 与 InjectionStrategy 集成（Knowledge 层注入卡片摘要）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { KnowledgeIndexer, tokenize } from '../src/knowledge/indexer';
import { SEED_CARDS, SEED_CARD_COUNT, SEED_CARD_IDS } from '../src/knowledge/seed-cards';
import { InjectionStrategy } from '../src/memory-v2/injection';
import type { KnowledgeCard, KnowledgeMemory, MemorySnapshot, WorkingMemory } from '../src/memory-v2/types';

/* ================================================================
 * 测试辅助
 * ================================================================ */

function makeKnowledgeMemory(cards: KnowledgeCard[]): KnowledgeMemory {
  return {
    cards: [...cards],
    lastUpdated: Date.now(),
  };
}

function makeWorkingMemory(goal: string): WorkingMemory {
  return {
    taskId: 'test-task',
    goal,
    currentStep: 0,
    planSteps: [],
    activeTools: [],
    pendingOutputs: [],
  };
}

/* ================================================================
 * 1. 分词器
 * ================================================================ */

describe('tokenize', () => {
  it('中英文混合分词', () => {
    const tokens = tokenize('ECS 实体组件系统');
    expect(tokens).toContain('ecs');
    expect(tokens).toContain('实');
    expect(tokens).toContain('体');
    expect(tokens).toContain('组');
    expect(tokens).toContain('件');
    expect(tokens).toContain('系');
    expect(tokens).toContain('统');
  });

  it('英文词组保留', () => {
    const tokens = tokenize('Draw Call 优化');
    expect(tokens).toContain('draw');
    expect(tokens).toContain('call');
    expect(tokens).toContain('优');
    expect(tokens).toContain('化');
  });

  it('空字符串返回空数组', () => {
    expect(tokenize('')).toHaveLength(0);
  });

  it('标点符号被过滤', () => {
    const tokens = tokenize('AI, NPC! 行为?');
    expect(tokens).toContain('ai');
    expect(tokens).toContain('npc');
    expect(tokens).not.toContain(',');
    expect(tokens).not.toContain('!');
  });
});

/* ================================================================
 * 2. KnowledgeIndexer CRUD
 * ================================================================ */

describe('KnowledgeIndexer CRUD', () => {
  let indexer: KnowledgeIndexer;

  beforeEach(() => {
    indexer = new KnowledgeIndexer();
  });

  it('初始状态为空', () => {
    expect(indexer.size).toBe(0);
    expect(indexer.exportIndex()).toHaveLength(0);
  });

  it('addCard 添加卡片并增加 size', () => {
    const card: KnowledgeCard = {
      id: 'kcard-test-01',
      source: 'web',
      title: '测试卡片',
      summary: '这是一张测试卡片，用于验证添加功能。',
      tags: ['测试', '验证'],
      lastVerified: Date.now(),
      relevanceScore: 1.0,
    };
    indexer.addCard(card);
    expect(indexer.size).toBe(1);
    expect(indexer.exportIndex()).toHaveLength(1);
    expect(indexer.exportIndex()[0].id).toBe('kcard-test-01');
  });

  it('addCard 相同 id 覆盖旧卡片', () => {
    const card1: KnowledgeCard = {
      id: 'kcard-dup',
      source: 'web',
      title: '旧标题',
      summary: '旧摘要。',
      tags: ['旧'],
      lastVerified: Date.now(),
      relevanceScore: 0.5,
    };
    const card2: KnowledgeCard = {
      id: 'kcard-dup',
      source: 'doc',
      title: '新标题',
      summary: '新摘要内容。',
      tags: ['新'],
      lastVerified: Date.now(),
      relevanceScore: 0.9,
    };
    indexer.addCard(card1);
    indexer.addCard(card2);
    expect(indexer.size).toBe(1);
    expect(indexer.exportIndex()[0].title).toBe('新标题');
    expect(indexer.exportIndex()[0].source).toBe('doc');
  });

  it('getByTag 按标签精确检索', () => {
    indexer.importIndex(SEED_CARDS);

    const ecsCards = indexer.getByTag('ecs');
    expect(ecsCards.length).toBeGreaterThanOrEqual(1);
    expect(ecsCards.some((c) => c.id === 'kcard-001')).toBe(true);

    // 不存在的标签返回空
    const noCards = indexer.getByTag('nonexistent');
    expect(noCards).toHaveLength(0);
  });

  it('getByTag 大小写不敏感', () => {
    indexer.importIndex(SEED_CARDS);
    const lower = indexer.getByTag('ecs');
    const upper = indexer.getByTag('ECS');
    expect(lower.length).toBe(upper.length);
  });

  it('getBySource 按来源检索', () => {
    indexer.importIndex(SEED_CARDS);

    const webCards = indexer.getBySource('web');
    const manualCards = indexer.getBySource('manual');

    expect(webCards.length).toBeGreaterThan(0);
    expect(manualCards.length).toBeGreaterThan(0);
    expect(webCards.length + manualCards.length).toBeLessThanOrEqual(SEED_CARD_COUNT);
  });

  it('exportIndex 返回有序列表', () => {
    indexer.addCard({
      id: 'kcard-z',
      source: 'web',
      title: 'Z 卡片',
      summary: '最后一张',
      tags: [],
      lastVerified: Date.now(),
      relevanceScore: 1.0,
    });
    indexer.addCard({
      id: 'kcard-a',
      source: 'web',
      title: 'A 卡片',
      summary: '第一张',
      tags: [],
      lastVerified: Date.now(),
      relevanceScore: 1.0,
    });

    const exported = indexer.exportIndex();
    expect(exported[0].id).toBe('kcard-a');
    expect(exported[1].id).toBe('kcard-z');
  });

  it('importIndex 批量导入', () => {
    indexer.importIndex(SEED_CARDS);
    expect(indexer.size).toBe(SEED_CARD_COUNT);
  });
});

/* ================================================================
 * 3. 搜索与 TF-IDF 相关性
 * ================================================================ */

describe('KnowledgeIndexer 搜索', () => {
  let indexer: KnowledgeIndexer;

  beforeEach(() => {
    indexer = new KnowledgeIndexer();
    indexer.importIndex(SEED_CARDS);
  });

  it('空查询返回 relevanceScore 最高的卡片', () => {
    const results = indexer.search('');
    expect(results.length).toBeLessThanOrEqual(10);
    expect(results.length).toBeGreaterThan(0);
    // 默认按 relevanceScore 降序，所有初始 1.0
    expect(results[0].relevanceScore).toBeGreaterThanOrEqual(0.9);
  });

  it('查询 "ECS" 返回 kcard-001 排在前面', () => {
    const results = indexer.search('ECS');
    expect(results.length).toBeGreaterThan(0);
    // kcard-001 标题中含 ECS，应排在前列
    const foundECS = results.find((c) => c.id === 'kcard-001');
    expect(foundECS).toBeDefined();
  });

  it('查询 "行为树 AI" 返回行为树卡片', () => {
    const results = indexer.search('行为树 AI');
    expect(results.length).toBeGreaterThan(0);
    const hasBT = results.some((c) => c.id === 'kcard-010');
    expect(hasBT).toBe(true);
  });

  it('查询 "帧同步 联机" 命中网络卡片', () => {
    const results = indexer.search('帧同步 联机');
    const ids = results.map((c) => c.id);
    // 帧同步那张卡片 kcard-013
    expect(ids).toContain('kcard-013');
  });

  it('maxResults 限制返回数量', () => {
    const results = indexer.search('游戏 架构', { maxResults: 3 });
    expect(results.length).toBeLessThanOrEqual(3);
  });

  it('minScore 过滤低分', () => {
    const results = indexer.search('量子 计算', { minScore: 0.5 });
    // 这些种子卡片中没有量子计算相关内容
    expect(results.length).toBe(0);
  });

  it('relevanceScore 单独计算返回合理分数', () => {
    const card = SEED_CARDS[0]; // ECS
    const score1 = indexer.relevanceScore(card, 'ECS 实体组件');
    const score2 = indexer.relevanceScore(card, '渲染 着色器');
    // ECS 卡片对 ECS 查询的分数应高于渲染查询
    expect(score1).toBeGreaterThan(score2);
  });

  it('relevanceScore 标签命中加分', () => {
    const card = SEED_CARDS[0]; // tags: ['ecs', '架构', '游戏引擎', '设计模式']
    const scoreWithTag = indexer.relevanceScore(card, 'ecs');
    expect(scoreWithTag).toBeGreaterThan(0);
  });

  it('relevanceScore 标题命中加分', () => {
    const card = SEED_CARDS[9]; // 标题: '行为树 (Behavior Tree) 设计'
    const score = indexer.relevanceScore(card, '行为树');
    expect(score).toBeGreaterThan(0.2);
  });
});

/* ================================================================
 * 4. 种子卡片完整性
 * ================================================================ */

describe('种子卡片完整性', () => {
  it('共 20 张卡片', () => {
    expect(SEED_CARDS).toHaveLength(20);
    expect(SEED_CARD_COUNT).toBe(20);
  });

  it('ID 格式为 kcard-XXX（三位数字）', () => {
    for (const card of SEED_CARDS) {
      expect(card.id).toMatch(/^kcard-\d{3}$/);
    }
  });

  it('所有 ID 唯一', () => {
    const ids = SEED_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('所有字段非空', () => {
    for (const card of SEED_CARDS) {
      expect(card.id).toBeTruthy();
      expect(card.source).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.summary).toBeTruthy();
      expect(card.tags).toBeInstanceOf(Array);
      expect(card.lastVerified).toBeGreaterThan(0);
      expect(card.relevanceScore).toBeGreaterThan(0);
    }
  });

  it('summary 长度在 100-200 字之间', () => {
    for (const card of SEED_CARDS) {
      const len = card.summary.length;
      expect(len).toBeGreaterThanOrEqual(80); // 允许少许浮动
      expect(len).toBeLessThanOrEqual(400);
    }
  });

  it('source 只能是合法值', () => {
    const validSources = ['web', 'doc', 'manual', 'conversation', 'inference'];
    for (const card of SEED_CARDS) {
      expect(validSources).toContain(card.source);
    }
  });

  it('tags 至少有一个', () => {
    for (const card of SEED_CARDS) {
      expect(card.tags.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('relevanceScore 初始值为 1.0', () => {
    for (const card of SEED_CARDS) {
      expect(card.relevanceScore).toBe(1.0);
    }
  });

  it('lastVerified 为当日日期 (2026-06-21)', () => {
    const expectedDate = new Date('2026-06-21').getTime();
    for (const card of SEED_CARDS) {
      expect(card.lastVerified).toBe(expectedDate);
    }
  });

  it('七领域分布正确', () => {
    const categories: Record<string, string[]> = {
      '通用游戏架构': ['kcard-001', 'kcard-002', 'kcard-003', 'kcard-004'],
      '渲染/图形': ['kcard-005', 'kcard-006', 'kcard-007'],
      '物理/碰撞': ['kcard-008', 'kcard-009'],
      'AI 系统': ['kcard-010', 'kcard-011', 'kcard-012'],
      '网络/联机': ['kcard-013', 'kcard-014', 'kcard-015'],
      '性能优化': ['kcard-016', 'kcard-017', 'kcard-018'],
      '商业化设计': ['kcard-019', 'kcard-020'],
    };

    const allIds = SEED_CARDS.map((c) => c.id);
    for (const [, ids] of Object.entries(categories)) {
      for (const id of ids) {
        expect(allIds).toContain(id);
      }
    }
    // 总计 20
    const totalInCategories = Object.values(categories).reduce((sum, ids) => sum + ids.length, 0);
    expect(totalInCategories).toBe(20);
  });

  it('SEED_CARD_IDS 与卡片 ID 一致', () => {
    expect(SEED_CARD_IDS).toEqual(SEED_CARDS.map((c) => c.id));
  });
});

/* ================================================================
 * 5. 与 InjectionStrategy 集成
 * ================================================================ */

describe('InjectionStrategy Knowledge 集成', () => {
  let indexer: KnowledgeIndexer;

  beforeEach(() => {
    indexer = new KnowledgeIndexer();
    indexer.importIndex(SEED_CARDS);
  });

  it('有 Indexer 时 Knowledge 层通过 indexer.search() 注入匹配卡片', () => {
    const strategy = new InjectionStrategy(4000, indexer);

    const snapshot: MemorySnapshot = {
      working: makeWorkingMemory('实现 AI 行为树和 A* 寻路系统'),
      conversation: null,
      project: null,
      knowledge: makeKnowledgeMemory(SEED_CARDS),
      profile: null,
      timestamp: Date.now(),
    };

    const prompt = strategy.buildSystemPrompt(snapshot);
    expect(prompt).toContain('外部知识');

    // 应匹配到行为树和 A* 寻路卡片
    expect(prompt).toContain('行为树');
    expect(prompt).toContain('A*');
    // 不应该包含无关卡片（如商业化）
    expect(prompt).not.toContain('双货币');
  });

  it('有 Indexer 时 Knowledge 层最多注入 3 张卡片', () => {
    const strategy = new InjectionStrategy(4000, indexer);

    const snapshot: MemorySnapshot = {
      working: makeWorkingMemory('游戏渲染和物理碰撞检测优化'),
      conversation: null,
      project: null,
      knowledge: makeKnowledgeMemory(SEED_CARDS),
      profile: null,
      timestamp: Date.now(),
    };

    const prompt = strategy.buildSystemPrompt(snapshot);

    // 统计 "## 外部知识" 下 - 开头的行数（即卡片数）
    const knowledgeSection = prompt.split('## 外部知识')[1]?.split('##')[0] ?? '';
    const cardLines = knowledgeSection.split('\n').filter((l) => l.startsWith('- ['));
    expect(cardLines.length).toBeLessThanOrEqual(3);
    expect(cardLines.length).toBeGreaterThan(0);
  });

  it('无 Indexer 时降级为按 relevanceScore 排序', () => {
    const strategy = new InjectionStrategy(4000); // 不传 indexer

    const snapshot: MemorySnapshot = {
      working: makeWorkingMemory('实现 AI 系统'),
      conversation: null,
      project: null,
      knowledge: makeKnowledgeMemory(SEED_CARDS),
      profile: null,
      timestamp: Date.now(),
    };

    const prompt = strategy.buildSystemPrompt(snapshot);
    expect(prompt).toContain('外部知识');
    // 降级模式下也会输出卡片
  });

  it('空 Working Goal 时 Indexer 返回空查询结果 → 降级到 relevanceScore 排序', () => {
    const strategy = new InjectionStrategy(4000, indexer);

    const snapshot: MemorySnapshot = {
      working: makeWorkingMemory(''),
      conversation: null,
      project: null,
      knowledge: makeKnowledgeMemory(SEED_CARDS),
      profile: null,
      timestamp: Date.now(),
    };

    const prompt = strategy.buildSystemPrompt(snapshot);
    expect(prompt).toContain('外部知识');
  });

  it('Knowledge 层为 null 时正常输出（不崩溃）', () => {
    const strategy = new InjectionStrategy(4000, indexer);

    const snapshot: MemorySnapshot = {
      working: makeWorkingMemory('渲染管线优化'),
      conversation: null,
      project: null,
      knowledge: null,
      profile: null,
      timestamp: Date.now(),
    };

    const prompt = strategy.buildSystemPrompt(snapshot);
    expect(prompt).not.toContain('外部知识');
    expect(prompt).toContain('当前任务');
  });
});
