/**
 * MemoryManager — 记忆管理器
 *
 * 职责：
 * 1. 组合 ContextTrimmer + SummaryEngine
 * 2. 在 Executor 每轮完成后调用 maintain() 维护记忆
 * 3. 在新请求开始时提供 buildSystemPromptPrefix() 注入历史摘要
 *
 * 架构：
 *   ContextTrimmer: 步骤级滑动窗口（32K token 阈值）
 *     - 超阈值时裁出最老的 5 个步骤
 *     - 最少保留 3 个步骤（防御）
 *   SummaryEngine: 三级递归摘要
 *     - L1: 5 个 StepRecord → 100 字 StepSummary → SQLite
 *     - L2: ≥5 个 StepSummary → 200 字 MetaSummary → SQLite
 *     - L3: 注入 System Prompt 末尾
 *
 * 设计约束：
 * - 纯同步持久化（better-sqlite3），串行调用于 Executor 后
 * - 不阻塞工具调用路径
 */

import type { StepRecord, AgentError } from '../protocol/agent-protocol';
import {
  Persistence,
  type ErrorLessonRow,
  type SessionSummaryRow,
} from './persistence';
import type { Embedder } from './embedder';
import { VectorIndex, type VectorRecord, type SearchResult } from './vector-index';

/* ===================== 常量 ===================== */

/** 滑动窗口 token 上限 */
const TOKEN_THRESHOLD = 32_000;

/** 批量剪切步数 */
const TRIM_BATCH_SIZE = 5;

/** 最少保留步数 */
const MIN_KEPT_STEPS = 3;

/** Level-3 注入时最近摘要数量 */
const PREFIX_META_COUNT = 3;
const PREFIX_STEP_COUNT = 3;

/** RAG 检索默认返回条数 */
const RAG_TOP_K = 3;

/** RAG 相似度阈值（低于此值的结果不注入） */
const RAG_SIMILARITY_THRESHOLD = 0.35;

/* ===================== Token 估算 ===================== */

/**
 * 估算 StepRecord 的 token 数。
 * 仅计算可见字段：title / description / acceptanceCriteria / errors 中的 message。
 * 中文 1.5 token/字符，英文 0.3 token/字符。
 */
function estimateTokens(step: StepRecord): number {
  let chars = 0;
  let chineseChars = 0;

  const fields = [
    step.plan.title,
    step.plan.description,
    ...step.plan.acceptanceCriteria.map((ac) => ac.description),
  ];

  if (step.result?.errors) {
    fields.push(...step.result.errors.map((e) => e.message));
  }

  for (const field of fields) {
    for (const ch of field) {
      chars++;
      if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
        chineseChars++;
      }
    }
  }

  const englishChars = chars - chineseChars;
  return Math.ceil(chineseChars * 1.5 + englishChars * 0.3);
}

/**
 * 估算步骤数组的总 token 数。
 */
function estimateTotalTokens(steps: StepRecord[]): number {
  return steps.reduce((sum, s) => sum + estimateTokens(s), 0);
}

/* ===================== 摘要生成（LLM 外部注入） ===================== */

/**
 * 摘要生成器接口。
 * MemoryManager 不内置 LLM 调用，由外部注入。
 * 这样保持零 SDK 依赖，与 LLMClient 调用模式一致。
 */
export interface SummaryGenerator {
  generateStepSummary(steps: StepRecord[]): Promise<string>;
  generateMetaSummary(stepSummaries: string[]): Promise<string>;
}

/* ===================== MemoryManager ===================== */

export class MemoryManager {
  private persistence: Persistence;
  private sessionId: string;
  private summaryGen: SummaryGenerator | null = null;
  private embedder: Embedder | null = null;
  private vectorIndex: VectorIndex | null = null;

  constructor(
    persistence: Persistence,
    sessionId: string,
    summaryGen?: SummaryGenerator,
  ) {
    this.persistence = persistence;
    this.sessionId = sessionId;
    this.summaryGen = summaryGen ?? null;
  }

  /** 注入摘要生成器（LLMClient 旁路） */
  setSummaryGenerator(gen: SummaryGenerator): void {
    this.summaryGen = gen;
  }

  /* ===================== P3: RAG 向量检索 ===================== */

  /**
   * 初始化 RAG 子系统。
   * 注入 Embedder 后自动创建 VectorIndex 并从 SQLite 加载历史记录。
   */
  async initRAG(embedder: Embedder): Promise<void> {
    this.embedder = embedder;
    this.vectorIndex = new VectorIndex({
      dimensions: embedder.dimensions,
      maxSize: 10_000,
      persistence: this.persistence,
    });
    await this.vectorIndex.initFromDB();
  }

  /**
   * 对摘要文本生成嵌入并写入向量索引。
   * 在 SummaryEngine 生成 StepSummary / MetaSummary 后调用。
   */
  private async indexSummary(
    id: string,
    text: string,
    category: 'step' | 'meta',
    compressedCount: number,
  ): Promise<void> {
    if (!this.embedder || !this.vectorIndex) return;

    try {
      const vector = await this.embedder.embed(text);
      const record: VectorRecord = {
        id: `summary_${category}_${id}`,
        vector,
        text,
        category,
        priority: category === 'meta' ? 2 : 1, // MetaSummary 优先级更高
        createdAt: Date.now(),
      };
      this.vectorIndex.insert(record);
    } catch {
      // 嵌入失败不阻塞
    }
  }

  /**
   * RAG 检索：给定查询文本，返回相似的历史记忆片段。
   *
   * @param query 查询文本（通常为新任务描述或用户输入）
   * @param k 返回条数
   * @param filter 可选的过滤条件
   */
  async queryRelevant(
    query: string,
    k: number = RAG_TOP_K,
    filter?: { category?: string; minPriority?: number; maxAgeMs?: number },
  ): Promise<SearchResult[]> {
    if (!this.embedder || !this.vectorIndex) return [];

    try {
      const queryVec = await this.embedder.embed(query);
      return this.vectorIndex
        .search(queryVec, k, filter)
        .filter((r) => r.similarity >= RAG_SIMILARITY_THRESHOLD);
    } catch {
      return [];
    }
  }

  /** 向量索引中记录数 */
  vectorIndexSize(): number {
    return this.vectorIndex?.size() ?? 0;
  }

  /* ===================== 核心：记忆维护 ===================== */

  /**
   * 在 Executor 每轮完成后调用。
   * 1. 检查 token 是否超出阈值
   * 2. 超出则裁剪 → 生成摘要 → 持久化
   * 3. 提取错误教训并 upsert
   *
   * @returns 修剪后的步骤数组（用于更新 context.history）
   */
  async maintain(steps: StepRecord[]): Promise<StepRecord[]> {
    let trimmed = steps;

    // --- 上下文裁剪 ---
    const totalTokens = estimateTotalTokens(steps);
    if (totalTokens > TOKEN_THRESHOLD) {
      trimmed = await this.trimAndSummarize(steps);
    }

    // --- 错误教训提取 ---
    this.extractErrorLessons(trimmed);

    return trimmed;
  }

  /* ===================== 上下文裁剪 + 摘要 ===================== */

  private async trimAndSummarize(steps: StepRecord[]): Promise<StepRecord[]> {
    // 计算裁切点：从头裁掉 TRIM_BATCH_SIZE 个，但至少保留 MIN_KEPT_STEPS
    const cutPoint = Math.min(TRIM_BATCH_SIZE, steps.length - MIN_KEPT_STEPS);
    if (cutPoint <= 0) return steps;

    const trimmed = steps.slice(0, cutPoint);
    const kept = steps.slice(cutPoint);

    // --- Level 1: 生成 StepSummary ---
    if (this.summaryGen) {
      try {
        const stepSummary = await this.summaryGen.generateStepSummary(trimmed);
        const sourceIds = trimmed.map((s) => s.stepId);
        const insertedId = this.persistence.insertSummary(
          this.sessionId,
          'step',
          stepSummary,
          sourceIds,
          trimmed.length,
        );

        // P3: 向量索引
        this.indexSummary(
          String(insertedId),
          stepSummary,
          'step',
          trimmed.length,
        );

        // --- Level 2: 检查是否需要压缩 step summaries 为 meta ---
        await this.maybeCompressStepSummaries();
      } catch {
        // 摘要生成失败不影响主流程
      }
    }

    return kept;
  }

  /**
   * 当 StepSummary 积累 ≥5 条时，压缩为 1 条 MetaSummary。
   */
  private async maybeCompressStepSummaries(): Promise<void> {
    const count = this.persistence.countSummaries(this.sessionId, 'step');
    if (count < TRIM_BATCH_SIZE || !this.summaryGen) return;

    const stepSummaries = this.persistence.getRecentSummaries(
      this.sessionId,
      'step',
      TRIM_BATCH_SIZE,
    );

    if (stepSummaries.length < TRIM_BATCH_SIZE) return;

    try {
      const summaries = stepSummaries.map((r) => r.summary);
      const metaSummary = await this.summaryGen.generateMetaSummary(summaries);

      // 收集被压缩的 step summary ID
      const sourceIds = stepSummaries.map((r) => String(r.id));
      const insertedId = this.persistence.insertSummary(
        this.sessionId,
        'meta',
        metaSummary,
        sourceIds,
        stepSummaries.length,
      );

      // P3: 向量索引 MetaSummary
      this.indexSummary(
        String(insertedId),
        metaSummary,
        'meta',
        stepSummaries.length,
      );

      // 清理旧的 step summaries（保留最新的 20 条）
      this.persistence.deleteOldSummaries(this.sessionId, 20);
      // 清理旧的 meta summaries（保留最新的 10 条）
      // deleteOldSummaries 会按 compressed_at DESC 保留
      this.clearExcessMetaSummaries(10);
    } catch {
      // 压缩失败不阻塞
    }
  }

  private clearExcessMetaSummaries(keep: number): void {
    const metas = this.persistence.getRecentSummaries(this.sessionId, 'meta', 100);
    if (metas.length <= keep) return;

    const toDelete = metas.slice(keep);
    const db = (this.persistence as any).db;
    if (!db) return;

    const stmt = db.prepare('DELETE FROM session_summaries WHERE id = ?');
    const tx = db.transaction(() => {
      for (const m of toDelete) {
        stmt.run(m.id);
      }
    });
    tx();
  }

  /* ===================== 错误教训提取 ===================== */

  private extractErrorLessons(steps: StepRecord[]): void {
    const entries: Array<{
      errorCode: string;
      category: string;
      rootCause?: string;
      fixStrategy?: string;
    }> = [];

    for (const step of steps) {
      const errors = step.result?.errors;
      if (!errors || errors.length === 0) continue;

      for (const err of errors) {
        const category = this.categorizeError(err);
        entries.push({
          errorCode: err.code,
          category,
          rootCause: err.message,
          fixStrategy: err.suggestion,
        });
      }
    }

    if (entries.length > 0) {
      this.persistence.upsertErrorLessonBatch(entries);
    }
  }

  private categorizeError(err: AgentError): string {
    const code = err.code.toUpperCase();
    if (code.includes('TOOL') || code.includes('TIMEOUT')) return 'tool';
    if (code.includes('SAFETY') || code.includes('BLOCK')) return 'safety';
    if (code.includes('PLAN') || code.includes('PLANNER')) return 'planning';
    if (code.includes('GENERATE') || code.includes('BUILD')) return 'generation';
    return 'unknown';
  }

  /* ===================== System Prompt 注入 ===================== */

  /**
   * 构造 System Prompt 前缀（同步版，不含 RAG）。
   * 包含最近的 3 条 MetaSummary + 3 条 StepSummary。
   * 建议注入到 System Prompt 末尾（位置偏差效应）。
   */
  buildSystemPromptPrefix(): string {
    return this.buildStaticPrefix();
  }

  /**
   * 构造 System Prompt 前缀（异步版，含 RAG 检索结果）。
   *
   * @param ragQuery 如果提供，会检索向量索引，
   *                 将最相似的历史记忆注入前缀末尾。
   */
  async buildSystemPromptPrefixAsync(ragQuery?: string): Promise<string> {
    const parts = [this.buildStaticPrefix()];

    // RAG 检索
    if (ragQuery && this.vectorIndex && this.embedder) {
      const relevant = await this.queryRelevant(ragQuery);
      if (relevant.length > 0) {
        parts.push('## 相关历史记忆（RAG 检索）');
        for (let i = 0; i < relevant.length; i++) {
          parts.push(
            `[${i + 1}] 相似度=${relevant[i].similarity.toFixed(2)} ` +
            `| ${relevant[i].category ?? 'general'} ` +
            (relevant[i].priority ? `| L${relevant[i].priority} ` : '') +
            `\n${relevant[i].text}`,
          );
        }
      }
    }

    return parts.join('\n');
  }

  private buildStaticPrefix(): string {
    const parts: string[] = [];

    const metas = this.persistence.getRecentSummaries(
      this.sessionId,
      'meta',
      PREFIX_META_COUNT,
    );
    if (metas.length > 0) {
      parts.push('## 历史会话摘要');
      for (const m of metas.reverse()) {
        parts.push(`- ${m.summary}`);
      }
    }

    const steps = this.persistence.getRecentSummaries(
      this.sessionId,
      'step',
      PREFIX_STEP_COUNT,
    );
    if (steps.length > 0) {
      parts.push('## 近期步骤摘要');
      for (const s of steps.reverse()) {
        parts.push(`- ${s.summary}`);
      }
    }

    return parts.join('\n');
  }

  /* ===================== 错误教训查询 ===================== */

  /**
   * 获取高频错误教训（用于注入 System Prompt 或 Reflector 参考）。
   */
  getTopErrorLessons(minFrequency = 2, limit = 5): ErrorLessonRow[] {
    return this.persistence.getTopErrorLessons(minFrequency, limit);
  }

  /**
   * 获取特定类别的错误教训。
   */
  getErrorLessonsByCategory(category: string): ErrorLessonRow[] {
    return this.persistence.getErrorLessonsByCategory(category);
  }

  /* ===================== 用户画像 ===================== */

  setPreference(key: string, value: string): void {
    this.persistence.setProfile(key, value);
  }

  getPreference(key: string): string | null {
    return this.persistence.getProfile(key);
  }

  getAllPreferences(): Array<{ key: string; value: string }> {
    return this.persistence.getAllProfiles().map((r) => ({
      key: r.key,
      value: r.value,
    }));
  }

  /* ===================== 清理 ===================== */

  close(): void {
    this.persistence.close();
  }
}
