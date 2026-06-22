/**
 * Memory v2 — 注入策略
 *
 * 职责：
 * 1. 根据 MemorySnapshot 构建 LLM System Prompt 前缀
 * 2. 按五层优先级排序：Profile > Project > Knowledge > Conversation > Working
 *    - Profile 最前（首因效应）
 *    - Working 最后（近因效应）
 * 3. Token 预算控制和裁剪
 * 4. 构建特定 Tool 的附加上下文
 */

import {
  MemoryLayer,
  type MemorySnapshot,
  type TokenEstimate,
  type TurnEntry,
  type Convention,
  type Decision,
  type KnowledgeCard,
  type BehaviorPattern,
  LAYER_TOKEN_BUDGET,
} from './types';
import type { KnowledgeIndexer } from '../knowledge/indexer';

/* ===================== Token 估算 ===================== */

/**
 * TokenEstimate 重新导出（types.ts 中定义但此处具体实现估算逻辑）。
 */
export type { TokenEstimate } from './types';

/** 默认 System Prompt 内存部分总预算 */
const DEFAULT_TOTAL_BUDGET = 4000;

/**
 * 简易字符级 token 估算。
 * 中文 ~1.5 token/字符，英文 ~0.3 token/字符。
 */
function estimateTokens(text: string): number {
  let chars = 0;
  let chineseChars = 0;

  for (const ch of text) {
    chars++;
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      chineseChars++;
    }
  }

  const englishChars = chars - chineseChars;
  return Math.ceil(chineseChars * 1.5 + englishChars * 0.3);
}

/* ===================== InjectionStrategy ===================== */

export class InjectionStrategy {
  private maxTokens: number;
  private indexer: KnowledgeIndexer | null;

  constructor(maxTokens: number = DEFAULT_TOTAL_BUDGET, indexer?: KnowledgeIndexer) {
    this.maxTokens = maxTokens;
    this.indexer = indexer ?? null;
  }

  /**
   * 估算各层 token 消耗。
   */
  estimateTokenUsage(snapshot: MemorySnapshot): TokenEstimate[] {
    const estimates: TokenEstimate[] = [];

    if (snapshot.profile) {
      const text = buildProfileBlock(snapshot.profile);
      estimates.push({ layer: MemoryLayer.PROFILE, estimatedTokens: estimateTokens(text) });
    }
    if (snapshot.project) {
      const text = buildProjectBlock(snapshot.project);
      estimates.push({ layer: MemoryLayer.PROJECT, estimatedTokens: estimateTokens(text) });
    }
    if (snapshot.knowledge) {
      const text = buildKnowledgeBlock(snapshot.knowledge);
      estimates.push({ layer: MemoryLayer.KNOWLEDGE, estimatedTokens: estimateTokens(text) });
    }
    if (snapshot.conversation) {
      const text = buildConversationBlock(snapshot.conversation);
      estimates.push({ layer: MemoryLayer.CONVERSATION, estimatedTokens: estimateTokens(text) });
    }
    if (snapshot.working) {
      const text = buildWorkingBlock(snapshot.working);
      estimates.push({ layer: MemoryLayer.WORKING, estimatedTokens: estimateTokens(text) });
    }

    return estimates;
  }

  /**
   * 按预算裁剪 MemorySnapshot。
   *
   * 优先级（不裁剪 → 可裁剪）：
   *   Profile > Working > Project > Knowledge > Conversation
   */
  trimToBudget(snapshot: MemorySnapshot, maxTokens: number = this.maxTokens): MemorySnapshot {
    const trimmed: MemorySnapshot = {
      ...snapshot,
      working: snapshot.working ? { ...snapshot.working } : null,
      conversation: snapshot.conversation ? { ...snapshot.conversation, turns: [...snapshot.conversation.turns] } : null,
      project: snapshot.project ? {
        ...snapshot.project,
        conventions: [...(snapshot.project.conventions ?? [])],
        decisions: [...(snapshot.project.decisions ?? [])],
        fileIndex: [...(snapshot.project.fileIndex ?? [])],
      } : null,
      knowledge: snapshot.knowledge ? {
        ...snapshot.knowledge,
        cards: [...snapshot.knowledge.cards],
      } : null,
    };

    const consumed = this.calculateTotal(trimmed);
    if (consumed <= maxTokens) return trimmed;

    let remaining = maxTokens - consumed;

    // 裁剪顺序：Conversation → Knowledge → Project → (Working/Profile 不裁)
    // 1. Conversation：减少轮次
    if (trimmed.conversation && remaining < 0) {
      remaining += this.trimConversation(trimmed.conversation, -remaining);
    }

    // 2. Knowledge：提升相关性阈值
    if (trimmed.knowledge && remaining < 0) {
      remaining += this.trimKnowledge(trimmed.knowledge, 0.6);
    }

    // 3. Project：减少 convention/decision 条数
    if (trimmed.project && remaining < 0) {
      remaining += this.trimProject(trimmed.project, 3);
    }

    return trimmed;
  }

  /**
   * 构建 LLM System Prompt 前缀。
   *
   * 注入顺序（位置偏差效应）：
   *   1. Profile — 首因效应，用户画像最优先
   *   2. Project — 项目约定和决策
   *   3. Knowledge — 外部知识卡片摘要
   *   4. Conversation — 最近 N 轮摘要
   *   5. Working — 近因效应，当前任务状态最后
   */
  buildSystemPrompt(snapshot: MemorySnapshot): string {
    const parts: string[] = [];
    const trimmed = this.trimToBudget(snapshot);

    // 1. Profile（首因）
    if (trimmed.profile) {
      parts.push(buildProfileBlock(trimmed.profile));
    }

    // 2. Project
    if (trimmed.project) {
      parts.push(buildProjectBlock(trimmed.project));
    }

    // 3. Knowledge（接入 Indexer 检索）
    if (trimmed.knowledge) {
      // 从 Working Memory 提取上下文关键词
      const contextQuery = trimmed.working?.goal ?? '';
      parts.push(buildKnowledgeBlock(trimmed.knowledge, this.indexer, contextQuery));
    }

    // 4. Conversation
    if (trimmed.conversation) {
      parts.push(buildConversationBlock(trimmed.conversation));
    }

    // 5. Working（近因）
    if (trimmed.working) {
      parts.push(buildWorkingBlock(trimmed.working));
    }

    return parts.join('\n\n');
  }

  /**
   * 为特定 Tool 构建附加上下文。
   *
   * @param snapshot 当前记忆快照
   * @param toolName 工具名称
   */
  buildToolContext(snapshot: MemorySnapshot, toolName: string): string {
    const parts: string[] = [];

    // 注入项目约定中与工具相关的部分
    if (snapshot.project) {
      const relevantConventions = snapshot.project.conventions.filter(
        (c) =>
          c.name.toLowerCase().includes(toolName.toLowerCase()) ||
          c.examples.some((e) => e.toLowerCase().includes(toolName.toLowerCase())),
      );
      if (relevantConventions.length > 0) {
        parts.push('## 相关项目约定');
        for (const c of relevantConventions) {
          parts.push(`- ${c.name}: ${c.description}`);
        }
      }

      // 关键决策
      const relevantDecisions = snapshot.project.decisions.filter(
        (d) =>
          d.question.toLowerCase().includes(toolName.toLowerCase()) ||
          d.answer.toLowerCase().includes(toolName.toLowerCase()),
      );
      if (relevantDecisions.length > 0) {
        parts.push('## 相关决策');
        for (const d of relevantDecisions) {
          parts.push(`- Q: ${d.question} → A: ${d.answer}`);
        }
      }
    }

    // 注入知识卡片
    if (snapshot.knowledge) {
      const relevantCards = snapshot.knowledge.cards.filter(
        (c) =>
          c.title.toLowerCase().includes(toolName.toLowerCase()) ||
          c.tags.some((t) => t.toLowerCase().includes(toolName.toLowerCase())),
      );
      if (relevantCards.length > 0) {
        parts.push('## 相关知识卡片');
        for (const c of relevantCards.slice(0, 2)) {
          parts.push(`- [${c.title}] ${c.summary}`);
        }
      }
    }

    return parts.join('\n');
  }

  /* ===================== 内部：token 计算 ===================== */

  private calculateTotal(snapshot: MemorySnapshot): number {
    return this.estimateTokenUsage(snapshot).reduce((sum, e) => sum + e.estimatedTokens, 0);
  }

  private trimConversation(mem: NonNullable<MemorySnapshot['conversation']>, excessTokens: number): number {
    // 假设每轮约 200 token，逐步裁剪
    const tokensPerTurn = 200;
    const turnsToRemove = Math.ceil(excessTokens / tokensPerTurn);
    // 至少保留 5 轮
    const minTurns = 5;
    const currentTurns = mem.turns.length;
    const canRemove = Math.max(0, currentTurns - minTurns);
    const toRemove = Math.min(turnsToRemove, canRemove);

    if (toRemove > 0) {
      mem.turns = mem.turns.slice(toRemove);
    }

    return toRemove * tokensPerTurn;
  }

  private trimKnowledge(mem: NonNullable<MemorySnapshot['knowledge']>, threshold: number): number {
    const before = mem.cards.length;
    mem.cards = mem.cards.filter((c) => c.relevanceScore >= threshold);
    const removed = before - mem.cards.length;
    // 每张卡片约 150 token
    return removed * 150;
  }

  private trimProject(mem: NonNullable<MemorySnapshot['project']>, maxItems: number): number {
    let saved = 0;

    if (mem.conventions.length > maxItems) {
      const removed = mem.conventions.length - maxItems;
      mem.conventions = mem.conventions.slice(0, maxItems);
      saved += removed * 80; // 每条约 80 token
    }

    if (mem.decisions.length > maxItems) {
      const removed = mem.decisions.length - maxItems;
      mem.decisions = mem.decisions.slice(0, maxItems);
      saved += removed * 60;
    }

    return saved;
  }
}

/* ===================== 各层文本构建 ===================== */

function buildProfileBlock(profile: NonNullable<MemorySnapshot['profile']>): string {
  const lines: string[] = ['## 用户画像 (Profile Memory)'];

  lines.push(`- 技能水平: ${profile.skillLevel}`);
  lines.push(`- 高频领域: ${profile.frequentDomains.join('、')}`);

  if (profile.preferences.length > 0) {
    const prefs = profile.preferences.map((p) => `${p.key}=${p.value}`).join(', ');
    lines.push(`- 偏好: ${prefs}`);
  }

  if (profile.patterns.length > 0) {
    const pats = profile.patterns
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3)
      .map((p) => p.pattern);
    lines.push(`- 行为模式: ${pats.join('; ')}`);
  }

  return lines.join('\n');
}

function buildProjectBlock(project: NonNullable<MemorySnapshot['project']>): string {
  const lines: string[] = ['## 项目知识 (Project Memory)'];

  lines.push(`- 项目: ${project.name}`);
  if (Object.keys(project.techStack).length > 0) {
    const techs = Object.entries(project.techStack)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    lines.push(`- 技术栈: ${techs}`);
  }

  if (project.conventions.length > 0) {
    lines.push('### 项目约定');
    for (const c of project.conventions.slice(0, 5)) {
      lines.push(`- ${c.name}: ${c.description}`);
    }
  }

  if (project.decisions.length > 0) {
    lines.push('### 关键决策');
    for (const d of project.decisions.slice(0, 5)) {
      lines.push(`- ${d.question} → ${d.answer}`);
    }
  }

  return lines.join('\n');
}

function buildKnowledgeBlock(
  knowledge: NonNullable<MemorySnapshot['knowledge']>,
  indexer?: KnowledgeIndexer | null,
  contextQuery?: string,
): string {
  const lines: string[] = ['## 外部知识 (Knowledge Memory)'];

  let sorted: KnowledgeCard[];

  // 若有 Indexer 且有上下文关键词则通过 indexer.search() 匹配
  if (indexer && contextQuery && contextQuery.trim().length > 0) {
    sorted = indexer.search(contextQuery, { maxResults: 3, minScore: 0.05 });
  } else {
    // 无 Indexer 时降级为按 relevanceScore 排序
    sorted = [...knowledge.cards]
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, 3);
  }

  for (const card of sorted) {
    const tags = card.tags.length > 0 ? ` [${card.tags.join(', ')}]` : '';
    lines.push(`- [${card.title}]${tags} ${card.summary}`);
  }

  return lines.join('\n');
}

function buildConversationBlock(conversation: NonNullable<MemorySnapshot['conversation']>): string {
  const lines: string[] = ['## 对话历史 (Conversation Memory)'];

  const recent = conversation.turns.slice(-conversation.windowSize);

  // 摘要格式输出（非完整原文）
  for (const turn of recent) {
    if (turn.summarized) {
      lines.push(`- [${turn.role}] (摘要) ${turn.content}`);
    } else {
      // 截断长内容
      const truncated = turn.content.length > 200 ? turn.content.slice(0, 200) + '...' : turn.content;
      lines.push(`- [${turn.role}] ${truncated}`);
    }
  }

  return lines.join('\n');
}

function buildWorkingBlock(working: NonNullable<MemorySnapshot['working']>): string {
  const lines: string[] = ['## 当前任务 (Working Memory)'];

  lines.push(`- 目标: ${working.goal}`);
  lines.push(`- 当前步骤: ${working.currentStep + 1}/${working.planSteps.length}`);
  lines.push(`- 激活工具: ${working.activeTools.join(', ') || '(无)'}`);

  if (working.pendingOutputs.length > 0) {
    lines.push(`- 待产出: ${working.pendingOutputs.length} 个片段`);
  }

  return lines.join('\n');
}
