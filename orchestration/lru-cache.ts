/**
 * LRUCache — 通用 LRU 缓存（零外部依赖）
 *
 * 基于 ES6 Map 的插入顺序性质实现。
 * Map 的 keys() 迭代器按插入顺序排列，天然适合 LRU 驱逐。
 *
 * 设计约束：
 * - 纯同步 API，与 better-sqlite3 / ToolInvoker 调用模式一致
 * - 泛型 K/V，不绑定任何具体类型
 * - 线程不安全（Node.js 单线程模型下无关）
 */

export class LRUCache<K, V> {
  private map = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number) {
    if (maxSize <= 0) throw new Error('maxSize must be positive');
    this.maxSize = maxSize;
  }

  /** 获取值，命中时提升到队尾（最近使用） */
  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;

    // Map.delete + Map.set = 提升到队尾
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  /** 写入值，若容量超限则驱逐最久未使用的键 */
  set(key: K, value: V): void {
    if (this.map.has(key)) {
      // 更新：先删后插，保证队尾位置
      this.map.delete(key);
    } else if (this.map.size >= this.maxSize) {
      // 溢出：驱逐队首（最久未使用）
      const firstKey = this.map.keys().next().value as K;
      this.map.delete(firstKey);
    }
    this.map.set(key, value);
  }

  /** 判断键是否存在（不影响 LRU 顺序） */
  has(key: K): boolean {
    return this.map.has(key);
  }

  /** 删除指定键 */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /** 清空缓存 */
  clear(): void {
    this.map.clear();
  }

  /** 当前缓存条目数 */
  get size(): number {
    return this.map.size;
  }

  /** 返回所有键的快照（按 LRU 顺序：最旧 → 最新） */
  keys(): K[] {
    return Array.from(this.map.keys());
  }
}
