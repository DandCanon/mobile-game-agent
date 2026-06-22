/**
 * ToolCache — ToolInvoker 缓存拦截器
 *
 * 职责：
 * 1. 包装原始 ToolInvoker，对读操作添加 LRU 缓存
 * 2. 写操作绕过缓存，并主动失效相关读缓存
 * 3. 支持按工具类型配置不同 TTL
 *
 * 缓存策略：
 * - read_file / read_text     → TTL 30s（文件内容短期不变）
 * - shell_executor（只读命令） → TTL 120s（系统状态变化较慢）
 * - write_file / edit_file    → 不缓存 + 失效相关条目
 * - shell_executor（写命令）   → 不缓存
 *
 * 设计约束：
 * - 异步 API，与 ToolInvoker 签名完全兼容（即插即用）
 * - 写操作通过路径前缀匹配失效读缓存
 * - JSON.stringify(hash) 作为缓存键，避免大对象 key
 */

import { LRUCache } from './lru-cache';
import type { ToolInvoker } from './executor';

/* ===================== 配置 ===================== */

/** 缓存条目 */
interface CacheEntry {
  value: { success: boolean; output: unknown; error?: string };
  cachedAt: number;
}

/** 工具 TTL 规则：正则匹配 toolName → TTL（ms），-1 表示不缓存 */
interface CacheRule {
  pattern: RegExp;
  ttlMs: number; // -1 = 不缓存
}

const DEFAULT_RULES: CacheRule[] = [
  { pattern: /^read_file$|^read_text$/,    ttlMs: 30_000 },
  { pattern: /^shell_executor$/,           ttlMs: 120_000 },
  { pattern: /^analyze_image$/,            ttlMs: -1 },  // 图片分析不缓存（成本高但结果多变）
  { pattern: /^web_search$|^web_fetch$/,   ttlMs: -1 },  // 网络请求不缓存
];

/** 写操作正则：触发相关读缓存失效 */
const WRITE_PATTERNS: RegExp[] = [
  /^write_file$/,
  /^edit_file$/,
  /^delete$/,
  /^dispatch_task$/,   // Sub Agent 可能产生文件
];

/** 缓存容量上限 */
const DEFAULT_MAX_SIZE = 200;

/* ===================== 哈希函数 ===================== */

/** djb2 哈希（确定性、短输出、无碰撞概率低） */
function hashKey(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) + str.charCodeAt(i); // h * 33 + c
  }
  return (h >>> 0).toString(36);
}

/** 构造缓存键：工具名 + 参数哈希 */
function cacheKey(toolName: string, input: Record<string, unknown>): string {
  // 只对影响结果的参数做哈希（跳过无关字段）
  const relevant: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    // 跳过 StepRecord 对象（体积大且不影响缓存命中判断）
    if (k === 'planStep' || k === 'step' || k === 'context') continue;
    relevant[k] = v;
  }
  const hash = hashKey(JSON.stringify(relevant));
  return `${toolName}::${hash}`;
}

/* ===================== ToolCache ===================== */

export class ToolCache {
  private cache: LRUCache<string, CacheEntry>;
  private rules: CacheRule[];
  private writePatterns: RegExp[];

  constructor(
    maxSize = DEFAULT_MAX_SIZE,
    rules?: CacheRule[],
    writePatterns?: RegExp[],
  ) {
    this.cache = new LRUCache(maxSize);
    this.rules = rules ?? DEFAULT_RULES;
    this.writePatterns = writePatterns ?? WRITE_PATTERNS;
  }

  /**
   * 包装 ToolInvoker，返回带缓存的版本。
   * 与原始 ToolInvoker 签名完全兼容，调用方可即插即用。
   */
  wrap(invokeTool: ToolInvoker): ToolInvoker {
    return async (toolName, input) => {
      const ttl = this.getTTL(toolName);

      // 写操作：不缓存 + 失效相关读缓存
      if (this.isWrite(toolName)) {
        const result = await invokeTool(toolName, input);
        this.invalidateRelated(toolName, input);
        return result;
      }

      // 不缓存规则：直通
      if (ttl === -1) {
        return invokeTool(toolName, input);
      }

      // 读操作：查缓存
      const key = cacheKey(toolName, input);
      const entry = this.cache.get(key);
      if (entry && Date.now() - entry.cachedAt < ttl) {
        return entry.value;
      }

      // 未命中：执行并缓存
      const result = await invokeTool(toolName, input);
      this.cache.set(key, { value: result, cachedAt: Date.now() });
      return result;
    };
  }

  /** 清空全部缓存 */
  clear(): void {
    this.cache.clear();
  }

  /** 缓存统计 */
  stats(): { size: number; rules: string[] } {
    return {
      size: this.cache.size,
      rules: this.rules.map((r) => `${r.pattern}: ${r.ttlMs === -1 ? 'skip' : `${r.ttlMs}ms`}`),
    };
  }

  /* ===================== 私有方法 ===================== */

  private getTTL(toolName: string): number {
    for (const rule of this.rules) {
      if (rule.pattern.test(toolName)) return rule.ttlMs;
    }
    return -1; // 默认不缓存
  }

  private isWrite(toolName: string): boolean {
    return this.writePatterns.some((p) => p.test(toolName));
  }

  /**
   * 失效相关读缓存。
   * 当写操作涉及某个文件路径时，遍历缓存键中包含该路径的条目并清除。
   */
  private invalidateRelated(toolName: string, input: Record<string, unknown>): void {
    // 提取输入中的文件路径
    const paths = this.extractFilePaths(input);
    if (paths.length === 0) return;

    for (const key of this.cache.keys()) {
      for (const p of paths) {
        if (key.includes(p)) {
          this.cache.delete(key);
          break;
        }
      }
    }
  }

  private extractFilePaths(input: Record<string, unknown>): string[] {
    const paths: string[] = [];

    // file_path / file_paths 字段
    if (typeof input.file_path === 'string') paths.push(input.file_path);
    if (Array.isArray(input.file_paths)) {
      for (const fp of input.file_paths) {
        if (typeof fp === 'string') paths.push(fp);
      }
    }

    return paths;
  }

  addRule(pattern: RegExp, ttlMs: number): void {
    this.rules.push({ pattern, ttlMs });
  }

  addWritePattern(pattern: RegExp): void {
    this.writePatterns.push(pattern);
  }
}
