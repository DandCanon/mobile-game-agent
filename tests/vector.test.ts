/**
 * VectorIndex + Embedder 单元测试
 *
 * 覆盖：
 * - RuleEmbedder 嵌入维度/归一化/批量
 * - VectorIndex insert/search/容量控制/过滤/删除
 * - 余弦相似度正确性
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RuleEmbedder } from '../orchestration/embedder';
import { VectorIndex } from '../orchestration/vector-index';

/* ================================================================
 * RuleEmbedder
 * ================================================================ */

describe('RuleEmbedder', () => {
  const embedder = new RuleEmbedder();

  it('输出维度为 384', async () => {
    const vec = await embedder.embed('测试');
    expect(vec.length).toBe(384);
  });

  it('向量 L2 归一化', async () => {
    const vec = await embedder.embed('Hello World 你好世界');
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it('空字符串返回零向量', async () => {
    const vec = await embedder.embed('');
    const sum = vec.reduce((s, v) => s + Math.abs(v), 0);
    expect(sum).toBe(0);
  });

  it('相同文本产生相同向量', async () => {
    const v1 = await embedder.embed('实现背包系统');
    const v2 = await embedder.embed('实现背包系统');
    for (let i = 0; i < 384; i++) {
      expect(v1[i]).toBeCloseTo(v2[i], 5);
    }
  });

  it('相似文本余弦相似度高于不相关文本', async () => {
    const vA = await embedder.embed('实现背包系统，支持道具堆叠');
    const vB = await embedder.embed('开发玩家背包，道具可叠加');
    const vC = await embedder.embed('调整UI按钮颜色和圆角半径');

    const simAB = cosineSim(vA, vB);
    const simAC = cosineSim(vA, vC);

    // 相似文本的相似度应该明显更高
    expect(simAB).toBeGreaterThan(simAC);
  });

  it('embedBatch 批量嵌入', async () => {
    const vecs = await embedder.embedBatch(['A', 'B', 'C']);
    expect(vecs.length).toBe(3);
    expect(vecs[0].length).toBe(384);
  });
});

/* ================================================================
 * VectorIndex
 * ================================================================ */

describe('VectorIndex', () => {
  let index: VectorIndex;
  const dim = 4; // 小维度方便手算

  beforeEach(() => {
    index = new VectorIndex({ dimensions: dim, maxSize: 100 });
  });

  it('空索引检索返回空数组', () => {
    const q = new Float32Array([1, 0, 0, 0]);
    expect(index.search(q, 5)).toEqual([]);
  });

  it('单条记录完美匹配', () => {
    index.insert({
      id: 'r1', vector: new Float32Array([1, 0, 0, 0]),
      text: '背包系统', category: 'step', priority: 1, createdAt: Date.now(),
    });

    const q = new Float32Array([1, 0, 0, 0]);
    const results = index.search(q, 5);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('r1');
    expect(results[0].similarity).toBeCloseTo(1.0, 5);
  });

  it('多条记录按相似度排序', () => {
    // 使用不同的方向向量，确保余弦相似度可区分
    // query=[1,0,0,0]: cosSim([1,0.1,0,0])≈0.995, [1,0.5,0,0])≈0.894, [1,1,0,0])≈0.707
    index.insert({ id: 'low',  vector: new Float32Array([1, 1.0, 0, 0]), text: 'low', createdAt: Date.now() });
    index.insert({ id: 'high', vector: new Float32Array([1, 0.1, 0, 0]), text: 'high', createdAt: Date.now() });
    index.insert({ id: 'mid',  vector: new Float32Array([1, 0.5, 0, 0]), text: 'mid', createdAt: Date.now() });

    const q = new Float32Array([1, 0, 0, 0]);
    const results = index.search(q, 5);
    expect(results.length).toBe(3);
    expect(results[0].id).toBe('high');
    expect(results[1].id).toBe('mid');
    expect(results[2].id).toBe('low');
  });

  it('k 限制返回数量', () => {
    for (let i = 0; i < 5; i++) {
      index.insert({
        id: `r${i}`, vector: new Float32Array([1, 0, 0, 0]),
        text: `text${i}`, createdAt: Date.now(),
      });
    }
    const q = new Float32Array([1, 0, 0, 0]);
    expect(index.search(q, 2).length).toBe(2);
  });

  it('category 过滤', () => {
    index.insert({ id: 's1', vector: new Float32Array([1, 0, 0, 0]), text: 'step1', category: 'step', createdAt: Date.now() });
    index.insert({ id: 'm1', vector: new Float32Array([1, 0, 0, 0]), text: 'meta1', category: 'meta', createdAt: Date.now() });

    const q = new Float32Array([1, 0, 0, 0]);
    const filtered = index.search(q, 5, { category: 'meta' });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('m1');
  });

  it('minPriority 过滤', () => {
    index.insert({ id: 'p1', vector: new Float32Array([1, 0, 0, 0]), text: 'p1', priority: 1, createdAt: Date.now() });
    index.insert({ id: 'p5', vector: new Float32Array([1, 0, 0, 0]), text: 'p5', priority: 5, createdAt: Date.now() });

    const q = new Float32Array([1, 0, 0, 0]);
    const filtered = index.search(q, 5, { minPriority: 3 });
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('p5');
  });

  it('insert 覆盖已有 id', () => {
    index.insert({ id: 'dup', vector: new Float32Array([1, 0, 0, 0]), text: '旧', createdAt: Date.now() });
    index.insert({ id: 'dup', vector: new Float32Array([0, 1, 0, 0]), text: '新', createdAt: Date.now() });

    expect(index.size()).toBe(1);
    const q1 = new Float32Array([1, 0, 0, 0]);
    const q2 = new Float32Array([0, 1, 0, 0]);
    expect(index.search(q1, 5)[0].similarity).toBeCloseTo(0, 5);
    expect(index.search(q2, 5)[0].similarity).toBeCloseTo(1.0, 5);
  });

  it('remove 删除记录', () => {
    index.insert({ id: 'rm', vector: new Float32Array([1, 0, 0, 0]), text: 'x', createdAt: Date.now() });
    expect(index.size()).toBe(1);
    index.remove('rm');
    expect(index.size()).toBe(0);
  });

  it('clear 清空索引', () => {
    index.insert({ id: 'c1', vector: new Float32Array([1, 0, 0, 0]), text: 'x', createdAt: Date.now() });
    index.insert({ id: 'c2', vector: new Float32Array([0, 1, 0, 0]), text: 'y', createdAt: Date.now() });
    index.clear();
    expect(index.size()).toBe(0);
  });

  it('容量上限自动淘汰最早记录', () => {
    const small = new VectorIndex({ dimensions: dim, maxSize: 3 });
    for (let i = 0; i < 5; i++) {
      small.insert({
        id: `s${i}`, vector: new Float32Array([1, 0, 0, 0]),
        text: `t${i}`, createdAt: i * 1000,
      });
    }
    expect(small.size()).toBe(3);
  });

  it('维度不匹配抛错', () => {
    expect(() => {
      index.insert({
        id: 'bad', vector: new Float32Array([1, 2, 3]), // 3 ≠ 4
        text: 'x', createdAt: Date.now(),
      });
    }).toThrow('维度不匹配');
  });
});

/* ================================================================
 * 辅助
 * ================================================================ */

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}
