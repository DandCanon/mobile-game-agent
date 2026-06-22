/**
 * MemorySystem — 文件级 JSON 记忆存储（旧版兼容）
 *
 * 设计原则：
 * - 文件级存储（JSON），零外部依赖
 * - 支持 CRUD + 全文搜索 + 时间衰减
 * - 为后续接入向量检索预留接口
 *
 * 存储结构（memory/ 目录下）：
 * - index.json      → 元索引（摘要 + 时间戳）
 * - entries/         → 完整条目文件（按 ID 分片）
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

/* ===================== 类型定义 ===================== */

export interface MemoryEntry {
  /** 唯一 ID */
  id: string;
  /** 标题 */
  title: string;
  /** 内容 */
  content: string;
  /** 标签 */
  tags: string[];
  /** 关联的步骤 ID */
  stepId?: string;
  /** 关联的文件路径 */
  filePath?: string;
  /** 创建时间 (ms) */
  createdAt: number;
  /** 最后访问时间 (ms) */
  lastAccessAt: number;
  /** 访问次数 */
  accessCount: number;
  /** 重要性权重 (0-10) */
  importance: number;
  /** 是否已归档 */
  archived: boolean;
}

export interface MemoryQuery {
  /** 关键词搜索 */
  query?: string;
  /** 标签过滤 */
  tags?: string[];
  /** 步骤 ID 过滤 */
  stepId?: string;
  /** 是否需要包含已归档 */
  includeArchived?: boolean;
  /** 返回上限 */
  limit?: number;
}

export interface MemoryStats {
  total: number;
  archived: number;
  totalSizeBytes: number;
  oldestEntry: number;
  newestEntry: number;
}

/* ===================== 记忆系统 ===================== */

export class MemorySystem {
  private baseDir: string;
  private index: Map<string, MemoryEntry> = new Map();
  private initialized = false;

  constructor(projectDir: string) {
    this.baseDir = path.join(projectDir, '.memory');
  }

  /** 初始化：创建目录并加载索引 */
  async init(): Promise<void> {
    await fs.mkdir(path.join(this.baseDir, 'entries'), { recursive: true });
    await this.loadIndex();
    this.initialized = true;
  }

  /** 写入一条记忆 */
  async remember(
    title: string,
    content: string,
    options: {
      tags?: string[];
      stepId?: string;
      filePath?: string;
      importance?: number;
    } = {},
  ): Promise<MemoryEntry> {
    if (!this.initialized) await this.init();

    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: MemoryEntry = {
      id,
      title,
      content,
      tags: options.tags ?? [],
      stepId: options.stepId,
      filePath: options.filePath,
      createdAt: Date.now(),
      lastAccessAt: Date.now(),
      accessCount: 1,
      importance: Math.min(10, Math.max(0, options.importance ?? 5)),
      archived: false,
    };

    this.index.set(id, entry);
    await this.writeEntry(entry);
    await this.saveIndex();

    return entry;
  }

  /** 召回记忆 */
  async recall(query: MemoryQuery = {}): Promise<MemoryEntry[]> {
    if (!this.initialized) await this.init();

    let results = Array.from(this.index.values());

    // 过滤
    if (!query.includeArchived) {
      results = results.filter((e) => !e.archived);
    }
    if (query.tags && query.tags.length > 0) {
      results = results.filter((e) =>
        query.tags!.some((t) => e.tags.includes(t)),
      );
    }
    if (query.stepId) {
      results = results.filter((e) => e.stepId === query.stepId);
    }

    // 关键词搜索
    if (query.query) {
      const lower = query.query.toLowerCase();
      results = results.filter(
        (e) =>
          e.title.toLowerCase().includes(lower) ||
          e.content.toLowerCase().includes(lower) ||
          e.tags.some((t) => t.toLowerCase().includes(lower)),
      );
    }

    // 排序：重要性 × 时间衰减 × 访问频率
    results.sort((a, b) => {
      const now = Date.now();
      const decay = (entry: MemoryEntry) => {
        const ageDays = (now - entry.lastAccessAt) / (1000 * 60 * 60 * 24);
        return Math.exp(-ageDays / 30); // 30 天半衰期
      };
      const scoreA = a.importance * decay(a) * Math.log2(a.accessCount + 1);
      const scoreB = b.importance * decay(b) * Math.log2(b.accessCount + 1);
      return scoreB - scoreA;
    });

    const limit = query.limit ?? 20;
    const top = results.slice(0, limit);

    // 更新访问记录
    for (const entry of top) {
      entry.accessCount++;
      entry.lastAccessAt = Date.now();
    }

    return top;
  }

  /** 获取单条记忆 */
  async get(id: string): Promise<MemoryEntry | null> {
    if (!this.initialized) await this.init();

    const entry = this.index.get(id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessAt = Date.now();
    }
    return entry ?? null;
  }

  /** 更新记忆 */
  async update(
    id: string,
    patch: Partial<Pick<MemoryEntry, 'title' | 'content' | 'tags' | 'importance' | 'archived'>>,
  ): Promise<MemoryEntry | null> {
    if (!this.initialized) await this.init();

    const entry = this.index.get(id);
    if (!entry) return null;

    Object.assign(entry, patch, { lastAccessAt: Date.now() });
    await this.writeEntry(entry);
    await this.saveIndex();

    return entry;
  }

  /** 归档记忆 */
  async archive(id: string): Promise<boolean> {
    const entry = await this.update(id, { archived: true });
    return entry !== null;
  }

  /** 删除记忆（硬删除） */
  async forget(id: string): Promise<boolean> {
    if (!this.initialized) await this.init();

    if (!this.index.has(id)) return false;

    this.index.delete(id);
    await this.deleteEntryFile(id);
    await this.saveIndex();

    return true;
  }

  /** 统计信息 */
  async stats(): Promise<MemoryStats> {
    if (!this.initialized) await this.init();

    const entries = Array.from(this.index.values());
    const totalSizeBytes = entries.reduce(
      (sum, e) => sum + Buffer.byteLength(JSON.stringify(e), 'utf-8'),
      0,
    );

    return {
      total: entries.length,
      archived: entries.filter((e) => e.archived).length,
      totalSizeBytes,
      oldestEntry: entries.length > 0 ? Math.min(...entries.map((e) => e.createdAt)) : 0,
      newestEntry: entries.length > 0 ? Math.max(...entries.map((e) => e.createdAt)) : 0,
    };
  }

  /** 清空所有记忆 */
  async clear(): Promise<void> {
    if (!this.initialized) await this.init();

    this.index.clear();
    try {
      await fs.rm(path.join(this.baseDir, 'entries'), { recursive: true });
      await fs.mkdir(path.join(this.baseDir, 'entries'), { recursive: true });
      await this.saveIndex();
    } catch {
      // 目录操作失败，忽略
    }
  }

  /* ===================== 私有方法 ===================== */

  private async loadIndex(): Promise<void> {
    try {
      const indexPath = path.join(this.baseDir, 'index.json');
      const raw = await fs.readFile(indexPath, 'utf-8');
      const entries: MemoryEntry[] = JSON.parse(raw);
      for (const entry of entries) {
        this.index.set(entry.id, entry);
      }
    } catch {
      // 首次启动无索引文件
    }
  }

  private async saveIndex(): Promise<void> {
    const entries = Array.from(this.index.values());
    const indexPath = path.join(this.baseDir, 'index.json');
    await fs.writeFile(indexPath, JSON.stringify(entries, null, 2), 'utf-8');
  }

  private async writeEntry(entry: MemoryEntry): Promise<void> {
    const entryPath = path.join(this.baseDir, 'entries', `${entry.id}.json`);
    await fs.writeFile(entryPath, JSON.stringify(entry, null, 2), 'utf-8');
  }

  private async deleteEntryFile(id: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.baseDir, 'entries', `${id}.json`));
    } catch {
      // 文件不存在时忽略
    }
  }
}
