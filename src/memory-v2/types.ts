/**
 * Memory v2 — 五层记忆类型体系
 *
 * 层级由低到高（生命周期由短到长）：
 *   Working → Conversation → Project → Knowledge → Profile
 *
 * 设计原则：
 * - 每层独立类型，通过 MemorySnapshot 聚合成五层全量快照
 * - MemoryAccessor<T> 泛型统一读写接口
 * - T1 仅定义 schema，T3 填充 Knowledge 内容
 */

import type { StepRecord } from '../../protocol/agent-protocol';

/* ===================== 五层枚举 ===================== */

export enum MemoryLayer {
  WORKING = 'working',
  CONVERSATION = 'conversation',
  PROJECT = 'project',
  KNOWLEDGE = 'knowledge',
  PROFILE = 'profile',
}

/** 各层默认 token 预算（注入 System Prompt 时使用） */
export const LAYER_TOKEN_BUDGET: Record<MemoryLayer, number> = {
  [MemoryLayer.PROFILE]: 600,
  [MemoryLayer.WORKING]: 800,
  [MemoryLayer.PROJECT]: 1000,
  [MemoryLayer.KNOWLEDGE]: 800,
  [MemoryLayer.CONVERSATION]: 800,
};

/* ===================== OutputFragment ===================== */

/**
 * 待输出片段。WorkingMemory 中暂存尚未落地的产出物片段，
 * 由 Executor 完成后写入或丢弃。
 */
export interface OutputFragment {
  /** 片段唯一 ID */
  id: string;
  /** 类型：code / text / data / artifact */
  type: 'code' | 'text' | 'data' | 'artifact';
  /** 片段内容 */
  content: string;
  /** 目标写入路径（如有） */
  targetPath?: string;
}

/* ===================== 第 1 层：Working Memory ===================== */

export interface WorkingMemory {
  /** 当前任务 ID */
  taskId: string;
  /** 任务总体目标 */
  goal: string;
  /** 当前步骤索引（0-based） */
  currentStep: number;
  /** 计划步骤记录 */
  planSteps: StepRecord[];
  /** 当前激活的工具列表 */
  activeTools: string[];
  /** 暂存的待产出片段 */
  pendingOutputs: OutputFragment[];
}

/* ===================== 第 2 层：Conversation Memory ===================== */

export interface TurnEntry {
  /** 角色 */
  role: 'user' | 'assistant' | 'system' | 'tool';
  /** 对话内容 */
  content: string;
  /** 时间戳（ms） */
  timestamp: number;
  /** token 估计值 */
  tokens: number;
  /** 是否已被摘要压缩 */
  summarized?: boolean;
}

export interface ConversationMemory {
  /** 对话轮次 */
  turns: TurnEntry[];
  /** 滑动窗口大小（默认 20） */
  windowSize: number;
}

/* ===================== 第 3 层：Project Memory ===================== */

export interface Convention {
  /** 约定名称 */
  name: string;
  /** 约定描述 */
  description: string;
  /** 示例代码/文本片段 */
  examples: string[];
}

export interface Decision {
  /** 决策 ID */
  id: string;
  /** 决策问题 */
  question: string;
  /** 决策结论 */
  answer: string;
  /** 决策理由 */
  rationale: string;
  /** 决策时间戳 */
  date: number;
}

export interface FileHash {
  /** 文件路径 */
  path: string;
  /** 内容哈希 */
  hash: string;
  /** 最后索引时间戳 */
  lastIndexed: number;
  /** 关键符号（函数/类/导出名） */
  keySymbols: string[];
}

export interface ProjectMemory {
  /** 项目 ID */
  projectId: string;
  /** 项目名称 */
  name: string;
  /** 技术栈描述 */
  techStack: Record<string, string>;
  /** 项目约定 */
  conventions: Convention[];
  /** 关键技术决策 */
  decisions: Decision[];
  /** 文件索引 */
  fileIndex: FileHash[];
}

/* ===================== 第 4 层：Knowledge Memory ===================== */

export interface KnowledgeCard {
  /** 卡片唯一 ID */
  id: string;
  /** 来源 */
  source: 'web' | 'doc' | 'manual' | 'conversation' | 'inference';
  /** 标题 */
  title: string;
  /** 摘要 */
  summary: string;
  /** 标签 */
  tags: string[];
  /** 来源 URL */
  url?: string;
  /** 最后验证时间戳 */
  lastVerified: number;
  /** 相关性分数 [0, 1] */
  relevanceScore: number;
}

export interface KnowledgeMemory {
  /** 外部知识卡片索引 */
  cards: KnowledgeCard[];
  /** 最后更新索引时间戳 */
  lastUpdated: number;
}

/* ===================== 第 5 层：Profile Memory ===================== */

export interface Preference {
  /** 偏好键 */
  key: string;
  /** 偏好值 */
  value: string;
}

export interface BehaviorPattern {
  /** 行为模式描述 */
  pattern: string;
  /** 观察频率（次数） */
  frequency: number;
  /** 最后观察到的时间戳 */
  lastObserved: number;
}

export interface ProfileMemory {
  /** 用户唯一 ID */
  userId: string;
  /** 用户偏好 */
  preferences: Preference[];
  /** 行为模式 */
  patterns: BehaviorPattern[];
  /** 技能水平 */
  skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  /** 高频领域 */
  frequentDomains: string[];
}

/* ===================== 全量快照 ===================== */

export interface MemorySnapshot {
  working: WorkingMemory | null;
  conversation: ConversationMemory | null;
  project: ProjectMemory | null;
  knowledge: KnowledgeMemory | null;
  profile: ProfileMemory | null;
  /** 快照时间戳 */
  timestamp: number;
}

/* ===================== Token 估算 ===================== */

export interface TokenEstimate {
  /** 记忆层 */
  layer: MemoryLayer;
  /** 预估 token 数 */
  estimatedTokens: number;
}

/* ===================== 泛型访问器 ===================== */

export interface MemoryAccessor<T> {
  /** 读取当前层数据 */
  read(): T;
  /** 写入部分数据（浅合并） */
  write(data: Partial<T>): void;
  /** 清空当前层 */
  clear(): void;
}
