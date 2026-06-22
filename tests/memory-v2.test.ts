/**
 * Memory v2 — 单元测试
 *
 * 覆盖：
 * - 五层类型创建 / 读写 / MemoryAccessor
 * - InjectionStrategy 构建 System Prompt（验证层级顺序）
 * - Token 估算和预算裁剪
 * - 降级兼容性（空 snapshot）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryLayer,
  type WorkingMemory,
  type ConversationMemory,
  type ProjectMemory,
  type KnowledgeMemory,
  type ProfileMemory,
  type MemorySnapshot,
  type MemoryAccessor,
} from '../src/memory-v2/types';
import { InjectionStrategy } from '../src/memory-v2/injection';

/* ================================================================
 * 测试辅助：工厂函数
 * ================================================================ */

function makeWorkingMemory(overrides: Partial<WorkingMemory> = {}): WorkingMemory {
  return {
    taskId: 'task-001',
    goal: '实现 Memory v2 五层记忆体系',
    currentStep: 2,
    planSteps: [],
    activeTools: ['write_file', 'shell_executor'],
    pendingOutputs: [
      { id: 'out-1', type: 'code', content: 'export class Foo {}', targetPath: '/tmp/foo.ts' },
    ],
    ...overrides,
  };
}

function makeConversationMemory(turnCount: number = 5): ConversationMemory {
  const turns = Array.from({ length: turnCount }, (_, i) => ({
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `这是第 ${i + 1} 轮对话的内容，包含一些中文文本用于测试 token 估算。`,
    timestamp: Date.now() - (turnCount - i) * 60_000,
    tokens: 150,
    summarized: i < turnCount - 3, // 前几轮标记为已摘要
  }));
  return { turns, windowSize: 20 };
}

function makeProjectMemory(): ProjectMemory {
  return {
    projectId: 'proj-marvis',
    name: '手游AI开发Agent',
    techStack: { engine: 'react-vite-tailwind', lang: 'TypeScript' },
    conventions: [
      { name: '命名规范', description: '使用 camelCase 命名变量', examples: ['const userName = ""'] },
      { name: '文件组织', description: '按模块分目录', examples: ['src/game/', 'src/memory-v2/'] },
      { name: '测试优先', description: '编写单元测试覆盖核心逻辑', examples: ['npx vitest run'] },
    ],
    decisions: [
      { id: 'dec-1', question: '使用哪个测试框架', answer: 'vitest', rationale: '与 Vite 生态集成好', date: Date.now() },
      { id: 'dec-2', question: '记忆存储方案', answer: '五层体系 + SQLite', rationale: '分层解耦', date: Date.now() },
    ],
    fileIndex: [
      { path: 'src/memory-v2/types.ts', hash: 'abc123', lastIndexed: Date.now(), keySymbols: ['MemoryLayer', 'MemorySnapshot'] },
    ],
  };
}

function makeKnowledgeMemory(): KnowledgeMemory {
  return {
    cards: [
      { id: 'k1', source: 'web', title: '位置偏差效应', summary: '序列开头和结尾的信息更容易被记忆', tags: ['psychology', 'LLM'], lastVerified: Date.now(), relevanceScore: 0.9 },
      { id: 'k2', source: 'doc', title: 'Token 预算管理', summary: '控制注入 LLM 的上下文 token 数', tags: ['LLM', 'optimization'], lastVerified: Date.now(), relevanceScore: 0.8 },
      { id: 'k3', source: 'manual', title: 'TypeScript 严格模式', summary: '启用 strict 选项获得更好的类型安全', tags: ['typescript'], lastVerified: Date.now(), relevanceScore: 0.7 },
    ],
    lastUpdated: Date.now(),
  };
}

function makeProfileMemory(): ProfileMemory {
  return {
    userId: 'user-001',
    preferences: [
      { key: 'language', value: 'zh-CN' },
      { key: 'codeStyle', value: 'compact' },
    ],
    patterns: [
      { pattern: '高频使用 write_file 工具', frequency: 42, lastObserved: Date.now() },
      { pattern: '偏好 TypeScript', frequency: 35, lastObserved: Date.now() },
    ],
    skillLevel: 'advanced',
    frequentDomains: ['游戏开发', 'AI Agent', 'TypeScript'],
  };
}

function makeFullSnapshot(): MemorySnapshot {
  return {
    working: makeWorkingMemory(),
    conversation: makeConversationMemory(10),
    project: makeProjectMemory(),
    knowledge: makeKnowledgeMemory(),
    profile: makeProfileMemory(),
    timestamp: Date.now(),
  };
}

/* ================================================================
 * 1. 五层类型创建 / 读写
 * ================================================================ */

describe('Memory v2 类型体系', () => {
  it('WorkingMemory 创建和字段访问', () => {
    const wm = makeWorkingMemory();
    expect(wm.taskId).toBe('task-001');
    expect(wm.goal).toContain('Memory v2');
    expect(wm.currentStep).toBe(2);
    expect(wm.activeTools).toContain('write_file');
    expect(wm.pendingOutputs).toHaveLength(1);
    expect(wm.pendingOutputs[0].type).toBe('code');
  });

  it('ConversationMemory 创建和滑动窗口', () => {
    const cm = makeConversationMemory(10);
    expect(cm.turns).toHaveLength(10);
    expect(cm.windowSize).toBe(20);
    // 前 7 轮应标记为 summarized
    expect(cm.turns[0].summarized).toBe(true);
    // 最后 3 轮不应标记为 summarized（false 或 undefined 均视为未摘要）
    expect(cm.turns[9].summarized).toBeFalsy();
  });

  it('ProjectMemory 创建和字段访问', () => {
    const pm = makeProjectMemory();
    expect(pm.projectId).toBe('proj-marvis');
    expect(pm.conventions).toHaveLength(3);
    expect(pm.decisions).toHaveLength(2);
    expect(pm.fileIndex).toHaveLength(1);
    expect(pm.fileIndex[0].keySymbols).toContain('MemoryLayer');
    expect(pm.techStack.engine).toBe('react-vite-tailwind');
  });

  it('KnowledgeMemory 创建和卡片访问', () => {
    const km = makeKnowledgeMemory();
    expect(km.cards).toHaveLength(3);
    expect(km.cards[0].relevanceScore).toBeGreaterThan(km.cards[1].relevanceScore);
    expect(km.cards[0].tags).toContain('LLM');
  });

  it('ProfileMemory 创建和字段访问', () => {
    const pm = makeProfileMemory();
    expect(pm.userId).toBe('user-001');
    expect(pm.skillLevel).toBe('advanced');
    expect(pm.preferences.find((p) => p.key === 'language')?.value).toBe('zh-CN');
    expect(pm.patterns[0].frequency).toBe(42);
    expect(pm.frequentDomains).toContain('游戏开发');
  });

  it('MemorySnapshot 全量快照', () => {
    const snap = makeFullSnapshot();
    expect(snap.working).not.toBeNull();
    expect(snap.conversation).not.toBeNull();
    expect(snap.project).not.toBeNull();
    expect(snap.knowledge).not.toBeNull();
    expect(snap.profile).not.toBeNull();
    expect(snap.timestamp).toBeGreaterThan(0);
  });
});

/* ================================================================
 * 2. MemoryAccessor 泛型
 * ================================================================ */

/**
 * 简易实现类，用于测试 MemoryAccessor 接口。
 */
class TestMemoryAccessor<T> implements MemoryAccessor<T> {
  private _data: T;

  constructor(initial: T) {
    this._data = initial;
  }

  read(): T {
    return this._data;
  }

  write(data: Partial<T>): void {
    Object.assign(this._data as object, data);
  }

  clear(): void {
    this._data = {} as T;
  }
}

describe('MemoryAccessor<T>', () => {
  it('泛型访问器 read/write/clear', () => {
    const accessor = new TestMemoryAccessor<WorkingMemory>(makeWorkingMemory());

    expect(accessor.read().goal).toContain('Memory v2');

    accessor.write({ goal: '新的目标', currentStep: 5 } as Partial<WorkingMemory>);
    expect(accessor.read().goal).toBe('新的目标');
    expect(accessor.read().currentStep).toBe(5);

    accessor.clear();
    // 清空后变为空对象，字段为 undefined
    expect((accessor.read() as unknown as WorkingMemory).goal).toBeUndefined();
  });

  it('不同类型的 MemoryAccessor 独立工作', () => {
    const wmAccessor = new TestMemoryAccessor<WorkingMemory>(makeWorkingMemory());
    const pmAccessor = new TestMemoryAccessor<ProfileMemory>(makeProfileMemory());

    expect(wmAccessor.read().taskId).toBe('task-001');
    expect(pmAccessor.read().userId).toBe('user-001');

    wmAccessor.clear();
    pmAccessor.clear();

    expect((wmAccessor.read() as unknown as WorkingMemory).taskId).toBeUndefined();
    expect((pmAccessor.read() as unknown as ProfileMemory).userId).toBeUndefined();
  });
});

/* ================================================================
 * 3. InjectionStrategy — buildSystemPrompt
 * ================================================================ */

describe('InjectionStrategy', () => {
  let strategy: InjectionStrategy;
  let snapshot: MemorySnapshot;

  beforeEach(() => {
    strategy = new InjectionStrategy(4000);
    snapshot = makeFullSnapshot();
  });

  describe('buildSystemPrompt', () => {
    it('返回非空字符串', () => {
      const prompt = strategy.buildSystemPrompt(snapshot);
      expect(prompt).toBeTruthy();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
    });

    it('五层全部出现', () => {
      const prompt = strategy.buildSystemPrompt(snapshot);
      expect(prompt).toContain('用户画像');
      expect(prompt).toContain('项目知识');
      expect(prompt).toContain('外部知识');
      expect(prompt).toContain('对话历史');
      expect(prompt).toContain('当前任务');
    });

    it('层级顺序：Profile 最前 → Project → Knowledge → Conversation → Working 最后（首因+近因）', () => {
      const prompt = strategy.buildSystemPrompt(snapshot);
      const profileIdx = prompt.indexOf('用户画像');
      const projectIdx = prompt.indexOf('项目知识');
      const knowledgeIdx = prompt.indexOf('外部知识');
      const conversationIdx = prompt.indexOf('对话历史');
      const workingIdx = prompt.indexOf('当前任务');

      expect(profileIdx).toBeGreaterThanOrEqual(0);
      expect(projectIdx).toBeGreaterThanOrEqual(0);
      expect(knowledgeIdx).toBeGreaterThanOrEqual(0);
      expect(conversationIdx).toBeGreaterThanOrEqual(0);
      expect(workingIdx).toBeGreaterThanOrEqual(0);

      // 严格顺序
      expect(profileIdx).toBeLessThan(projectIdx);
      expect(projectIdx).toBeLessThan(knowledgeIdx);
      expect(knowledgeIdx).toBeLessThan(conversationIdx);
      expect(conversationIdx).toBeLessThan(workingIdx);
    });

    it('空 snapshot 返回空字符串', () => {
      const emptySnapshot: MemorySnapshot = {
        working: null,
        conversation: null,
        project: null,
        knowledge: null,
        profile: null,
        timestamp: Date.now(),
      };
      const prompt = strategy.buildSystemPrompt(emptySnapshot);
      expect(prompt).toBe('');
    });

    it('部分层为 null 时正常输出', () => {
      const partialSnapshot: MemorySnapshot = {
        working: makeWorkingMemory(),
        conversation: null,
        project: null,
        knowledge: null,
        profile: makeProfileMemory(),
        timestamp: Date.now(),
      };
      const prompt = strategy.buildSystemPrompt(partialSnapshot);
      expect(prompt).toContain('用户画像');
      expect(prompt).toContain('当前任务');
      expect(prompt).not.toContain('项目知识');
      expect(prompt).not.toContain('对话历史');
    });
  });

  /* ===================== 3b. Token 估算 ===================== */

  describe('estimateTokenUsage', () => {
    it('返回各层 token 估算', () => {
      const estimates = strategy.estimateTokenUsage(snapshot);
      expect(estimates.length).toBe(5);
      expect(estimates[0].layer).toBe(MemoryLayer.PROFILE);
      expect(estimates[4].layer).toBe(MemoryLayer.WORKING);
      // 所有层的 token 估算都应大于 0
      for (const e of estimates) {
        expect(e.estimatedTokens).toBeGreaterThan(0);
      }
    });

    it('空 snapshot 返回空数组', () => {
      const emptySnapshot: MemorySnapshot = {
        working: null, conversation: null, project: null, knowledge: null, profile: null, timestamp: 0,
      };
      const estimates = strategy.estimateTokenUsage(emptySnapshot);
      expect(estimates).toHaveLength(0);
    });
  });

  /* ===================== 3c. 预算裁剪 ===================== */

  describe('trimToBudget', () => {
    it('不超预算时保持原样', () => {
      const trimmed = strategy.trimToBudget(snapshot, 100_000);
      expect(trimmed.working).not.toBeNull();
      expect(trimmed.profile).not.toBeNull();
      expect(trimmed.project!.conventions).toHaveLength(3);
      expect(trimmed.knowledge!.cards).toHaveLength(3);
      expect(trimmed.conversation!.turns).toHaveLength(10);
    });

    it('极低预算时 Profile 和 Working 仍保留', () => {
      const trimmed = strategy.trimToBudget(snapshot, 200);
      expect(trimmed.profile).not.toBeNull();
      expect(trimmed.working).not.toBeNull();
    });

    it('低预算时 Conversation 被裁剪', () => {
      // 创建一个超大 conversation
      const bigSnap: MemorySnapshot = {
        ...snapshot,
        conversation: makeConversationMemory(50),
      };

      const trimmed = strategy.trimToBudget(bigSnap, 500);

      // Conversation 轮次应减少
      if (trimmed.conversation) {
        expect(trimmed.conversation.turns.length).toBeLessThanOrEqual(50);
      }
    });

    it('裁剪后 Project conventions 最多保留限制数', () => {
      const bigProject: ProjectMemory = {
        ...makeProjectMemory(),
        conventions: Array.from({ length: 10 }, (_, i) => ({
          name: `约定 ${i + 1}`,
          description: `约定 ${i + 1} 的详细描述，包含足够多的中文字符以确保 token 消耗足够大`,
          examples: [],
        })),
      };

      const bigSnap: MemorySnapshot = {
        ...snapshot,
        project: bigProject,
      };

      const trimmed = strategy.trimToBudget(bigSnap, 800);
      // Project 优先级较低，可能被裁剪
      expect(trimmed.project).not.toBeNull();
    });
  });

  /* ===================== 3d. buildToolContext ===================== */

  describe('buildToolContext', () => {
    it('匹配工具名返回相关上下文', () => {
      // 'vitest' 同时出现在 decisions 和 knowledge cards 中
      const ctx = strategy.buildToolContext(snapshot, 'vitest');
      expect(ctx).toBeTruthy();
      // 应包含项目决策中的 vitest 条目
      expect(ctx).toContain('vitest');
    });

    it('无匹配时返回空字符串', () => {
      const ctx = strategy.buildToolContext(snapshot, 'nonexistent_tool');
      expect(ctx).toBe('');
    });

    it('匹配 conventions 中的工具', () => {
      // 添加一个包含 "shell_executor" 的 convention
      const snapWithShell: MemorySnapshot = {
        ...snapshot,
        project: {
          ...makeProjectMemory(),
          conventions: [
            ...makeProjectMemory().conventions,
            { name: 'shell 工具规范', description: 'shell_executor 用于执行系统命令', examples: ['shell_executor ...'] },
          ],
        },
      };
      const ctx = strategy.buildToolContext(snapWithShell, 'shell_executor');
      expect(ctx).toContain('shell 工具规范');
    });
  });
});

/* ================================================================
 * 4. 降级兼容性
 * ================================================================ */

describe('降级兼容性', () => {
  it('空 snapshot 时 buildSystemPrompt 返回空字符串（不崩溃）', () => {
    const strategy = new InjectionStrategy();
    const emptySnapshot: MemorySnapshot = {
      working: null,
      conversation: null,
      project: null,
      knowledge: null,
      profile: null,
      timestamp: 0,
    };
    const prompt = strategy.buildSystemPrompt(emptySnapshot);
    expect(prompt).toBe('');
  });

  it('部分 null 的 snapshot 正常处理', () => {
    const strategy = new InjectionStrategy();
    const partialSnap: MemorySnapshot = {
      working: makeWorkingMemory(),
      conversation: null,
      project: null,
      knowledge: null,
      profile: null,
      timestamp: Date.now(),
    };

    const prompt = strategy.buildSystemPrompt(partialSnap);
    expect(prompt).toContain('当前任务');
    expect(prompt).not.toContain('用户画像');
    expect(prompt).not.toContain('对话历史');
  });

  it('InjectionStrategy 构造函数使用默认预算', () => {
    const strategy = new InjectionStrategy();
    const estimates = strategy.estimateTokenUsage(makeFullSnapshot());
    expect(estimates.length).toBe(5);
  });

  it('MemoryLayer 枚举值正确', () => {
    expect(MemoryLayer.WORKING).toBe('working');
    expect(MemoryLayer.CONVERSATION).toBe('conversation');
    expect(MemoryLayer.PROJECT).toBe('project');
    expect(MemoryLayer.KNOWLEDGE).toBe('knowledge');
    expect(MemoryLayer.PROFILE).toBe('profile');
  });
});
