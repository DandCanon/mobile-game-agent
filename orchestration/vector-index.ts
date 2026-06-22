/**
 * VectorIndex — 零依赖内存向量索引
 *
 * 职责：
 * 1. 存储 (id, vector, metadata) 三元组
 * 2. 提供 top-K 余弦相似度检索
 * 3. 持久化到 SQLite（通过 Persistence 层）
 *
 * 设计约束：
 * - 零新增依赖：纯 TS brute-force k-NN
 * - 容量上限 10K 条（超出自动淘汰最早条目）
 * - 持久化字段：id TEXT, summary TEXT, category TEXT, priority INT, embedding BLOB
 */

import type { Persistence } from './persistence';

/* ===================== 类型 ===================== */

export interface VectorRecord {
  id: string;           // 唯一标识（如 summary_1718000000_abc123）
  vector: Float32Array; // 嵌入向量
  text: string;         // 原始文本（用于 RAG 注入）
  category?: string;    // 分类标签
  priority?: number;    // 优先级（越大越重要）
  createdAt: number;    // 创建时间戳 ms
}

export interface SearchResult {
  id: string;
  text: string;
  category?: string;
  similarity: number;   // 余弦相似度 [0, 1]
  priority?: number;
  createdAt: number;
}

/* ===================== 实现 ===================== */

export class VectorIndex {
  private records: VectorRecord[] = [];
  private dimensions: number;
  private maxSize: number;
  private db: Persistence | null = null;

  constructor(opts?: { dimensions?: number; maxSize?: number; persistence?: Persistence }) {
    this.dimensions = opts?.dimensions ?? 1536;
    this.maxSize = opts?.maxSize ?? 10_000;
    this.db = opts?.persistence ?? null;

    // 从 SQLite 恢复数据
    if (this.db) this.loadFromDB();
  }

  /* ===================== 写入 ===================== */

  /**
   * 插入或更新一条记录。
   * id 已存在时覆盖向量和元数据。
   * 超出容量上限时淘汰最早记录。
   */
  insert(record: VectorRecord): void {
    // 校验维度
    if (record.vector.length !== this.dimensions) {
      throw new Error(
        `VectorIndex: 维度不匹配，期望 ${this.dimensions}，实际 ${record.vector.length}`
      );
    }

    const idx = this.records.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      this.records[idx] = { ...record };
    } else {
      this.records.push({ ...record });
    }

    // 容量控制
    while (this.records.length > this.maxSize) {
      this.records.shift();
    }

    // 持久化
    this.saveToDB(record);
  }

  /** 批量插入 */
  insertBatch(records: VectorRecord[]): void {
    for (const r of records) this.insert(r);
  }

  /** 删除指定 id */
  remove(id: string): void {
    this.records = this.records.filter((r) => r.id !== id);
  }

  /* ===================== 检索 ===================== */

  /**
   * 余弦相似度检索，返回 top-K 结果。
   *
   * @param queryVector 查询向量
   * @param k 返回条数
   * @param filter 可选的过滤条件
   */
  search(
    queryVector: Float32Array,
    k: number = 5,
    filter?: { category?: string; minPriority?: number; maxAgeMs?: number },
  ): SearchResult[] {
    if (this.records.length === 0) return [];

    const now = Date.now();
    const scored: Array<{ score: number; idx: number }> = [];

    for (let i = 0; i < this.records.length; i++) {
      const r = this.records[i];

      // 过滤
      if (filter?.category && r.category !== filter.category) continue;
      if (filter?.minPriority != null && (r.priority ?? 0) < filter.minPriority) continue;
      if (filter?.maxAgeMs != null && (now - r.createdAt) > filter.maxAgeMs) continue;

      const sim = this.cosineSimilarity(queryVector, r.vector);
      scored.push({ score: sim, idx: i });
    }

    // 按相似度降序 + 优先级加成
    scored.sort((a, b) => {
      const scoreA = a.score + (this.records[a.idx].priority ?? 0) * 0.01;
      const scoreB = b.score + (this.records[b.idx].priority ?? 0) * 0.01;
      return scoreB - scoreA;
    });

    return scored.slice(0, k).map((s) => {
      const r = this.records[s.idx];
      return {
        id: r.id,
        text: r.text,
        category: r.category,
        similarity: s.score,
        priority: r.priority,
        createdAt: r.createdAt,
      };
    });
  }

  /* ===================== 统计 ===================== */

  size(): number {
    return this.records.length;
  }

  clear(): void {
    this.records = [];
  }

  /* ===================== 私有: 相似度 ===================== */

  private cosineSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /* ===================== 私有: 持久化 ===================== */

  private loadFromDB(): void {
    if (!this.db) return;
    // 延迟加载：等待 Persistence 初始化完成后从 DB 读取
    // 由 MemoryManager 调用 initFromDB() 显式加载
  }

  async initFromDB(): Promise<void> {
    if (!this.db) return;
    const rows = this.db.getAllVectorRecords?.() ?? [];
    for (const row of rows) {
      this.records.push({
        id: row.id,
        vector: new Float32Array(row.embedding),
        text: row.text,
        category: row.category ?? undefined,
        priority: row.priority ?? undefined,
        createdAt: row.created_at ?? Date.now(),
      });
    }
  }

  private saveToDB(record: VectorRecord): void {
    if (!this.db) return;
    this.db.upsertVectorRecord?.({
      id: record.id,
      text: record.text,
      category: record.category ?? null,
      priority: record.priority ?? null,
      embedding: Array.from(record.vector),
      created_at: record.createdAt,
    });
  }
}
