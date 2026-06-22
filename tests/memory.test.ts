/**
 * 记忆系统单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemorySystem } from '../orchestration/memory-system';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('Memory System', () => {
  let memory: MemorySystem;
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `memory-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(testDir, { recursive: true });
    memory = new MemorySystem(testDir);
    await memory.init();
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true }); } catch {}
  });

  it('写入并读取单条记忆', async () => {
    const entry = await memory.remember('测试记忆', '这是一条测试内容', {
      tags: ['test', 'unit'],
      importance: 8,
    });

    expect(entry.id).toMatch(/^mem-/);
    expect(entry.title).toBe('测试记忆');
    expect(entry.tags).toEqual(['test', 'unit']);
    expect(entry.importance).toBe(8);

    const recalled = await memory.get(entry.id);
    expect(recalled).not.toBeNull();
    expect(recalled!.title).toBe('测试记忆');
  });

  it('按关键词召回记忆', async () => {
    await memory.remember('修仙体系设计', '炼气→筑基→金丹→元婴', { tags: ['设计'] });
    await memory.remember('数值平衡表', '1-100级经验曲线', { tags: ['数值'] });
    await memory.remember('技能系统', '10个主动技能+5个被动', { tags: ['设计'] });

    const results = await memory.recall({ query: '设计' });
    expect(results.length).toBe(2);
    expect(results.map(r => r.title)).toContain('修仙体系设计');
    expect(results.map(r => r.title)).toContain('技能系统');
  });

  it('按标签过滤', async () => {
    await memory.remember('A', '内容A', { tags: ['设计'] });
    await memory.remember('B', '内容B', { tags: ['数值'] });
    await memory.remember('C', '内容C', { tags: ['设计', '数值'] });

    const results = await memory.recall({ tags: ['设计'] });
    expect(results.length).toBe(2);
    expect(results.map(r => r.title)).toContain('A');
    expect(results.map(r => r.title)).toContain('C');
  });

  it('按步骤 ID 过滤', async () => {
    await memory.remember('步骤1产出', '文件A', { stepId: 'step-01' });
    await memory.remember('步骤2产出', '文件B', { stepId: 'step-02' });

    const results = await memory.recall({ stepId: 'step-01' });
    expect(results.length).toBe(1);
    expect(results[0].title).toBe('步骤1产出');
  });

  it('更新记忆', async () => {
    const entry = await memory.remember('原始标题', '原始内容');
    const updated = await memory.update(entry.id, { title: '新标题', importance: 9 });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('新标题');
    expect(updated!.importance).toBe(9);

    const recalled = await memory.get(entry.id);
    expect(recalled!.title).toBe('新标题');
  });

  it('归档记忆后默认不召回', async () => {
    const entry = await memory.remember('要归档的记忆', '内容');
    await memory.archive(entry.id);

    const results = await memory.recall();
    expect(results.length).toBe(0);

    const withArchived = await memory.recall({ includeArchived: true });
    expect(withArchived.length).toBe(1);
    expect(withArchived[0].archived).toBe(true);
  });

  it('删除记忆', async () => {
    const entry = await memory.remember('待删除', '内容');
    const deleted = await memory.forget(entry.id);

    expect(deleted).toBe(true);

    const recalled = await memory.get(entry.id);
    expect(recalled).toBeNull();
  });

  it('统计信息正确', async () => {
    await memory.remember('A', '内容A');
    await memory.remember('B', '内容B');
    const entry3 = await memory.remember('C', '内容C');
    await memory.archive(entry3.id);

    const stats = await memory.stats();
    expect(stats.total).toBe(3);
    expect(stats.archived).toBe(1);
    expect(stats.totalSizeBytes).toBeGreaterThan(0);
    expect(stats.newestEntry).toBeGreaterThan(stats.oldestEntry);
  });

  it('访问计数递增', async () => {
    const entry = await memory.remember('计数测试', '内容');
    expect(entry.accessCount).toBe(1);

    await memory.recall({ query: '计数' });
    const recalled = await memory.get(entry.id);
    expect(recalled!.accessCount).toBeGreaterThanOrEqual(2);
  });

  it('清空所有记忆', async () => {
    await memory.remember('A', '内容');
    await memory.remember('B', '内容');
    await memory.clear();

    const stats = await memory.stats();
    expect(stats.total).toBe(0);

    const results = await memory.recall();
    expect(results.length).toBe(0);
  });

  it('结果排序：高重要性优先', async () => {
    await memory.remember('低重要性', '内容', { importance: 2 });
    await memory.remember('中重要性', '内容', { importance: 5 });
    await memory.remember('高重要性', '内容', { importance: 9 });

    const results = await memory.recall({ query: '重要性' });
    expect(results.length).toBe(3);
    expect(results[0].title).toBe('高重要性');
    expect(results[2].title).toBe('低重要性');
  });

  it('记忆持久化到磁盘', async () => {
    const entry = await memory.remember('持久化测试', '内容');

    // 创建新 MemorySystem 实例指向同一目录
    const memory2 = new MemorySystem(testDir);
    await memory2.init();

    const recalled = await memory2.get(entry.id);
    expect(recalled).not.toBeNull();
    expect(recalled!.title).toBe('持久化测试');
  });
});

describe('Memory System — Empty State', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = path.join(os.tmpdir(), `memory-empty-${Date.now()}`);
  });

  afterEach(async () => {
    try { await fs.rm(testDir, { recursive: true }); } catch {}
  });

  it('空目录首次初始化不报错', async () => {
    const memory = new MemorySystem(testDir);
    await memory.init();
    const stats = await memory.stats();
    expect(stats.total).toBe(0);
  });

  it('不存在目录自动创建', async () => {
    const nonExistent = path.join(testDir, 'nested', 'deep');
    const memory = new MemorySystem(nonExistent);
    await memory.init();
    const stats = await memory.stats();
    expect(stats.total).toBe(0);
  });
});
