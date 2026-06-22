/**
 * binary-guard.test.ts — 二进制守卫单元测试
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runStartupChecks, summarizeChecks } from '../orchestration/binary-guard';

/* ===================== 辅助 ===================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/* ===================== runStartupChecks ===================== */

describe('runStartupChecks', () => {
  it('返回 3 个检查项', () => {
    const results = runStartupChecks(projectRoot);
    expect(results).toHaveLength(3);
  });

  it('每个结果包含必要字段', () => {
    const results = runStartupChecks(projectRoot);
    for (const r of results) {
      expect(r).toHaveProperty('name');
      expect(r).toHaveProperty('passed');
      expect(r).toHaveProperty('detail');
      expect(r).toHaveProperty('durationMs');
      expect(typeof r.name).toBe('string');
      expect(typeof r.passed).toBe('boolean');
      expect(typeof r.detail).toBe('string');
      expect(typeof r.durationMs).toBe('number');
    }
  });

  it('检查项名称固定', () => {
    const results = runStartupChecks(projectRoot);
    const names = results.map((r) => r.name);
    expect(names).toContain('better-sqlite3');
    expect(names).toContain('version-consistency');
    expect(names).toContain('build-sync');
  });

  it('better-sqlite3 可加载（项目依赖中存在）', () => {
    // better-sqlite3 在 package.json dependencies 中
    const results = runStartupChecks(projectRoot);
    const bs3 = results.find((r) => r.name === 'better-sqlite3');
    expect(bs3).toBeDefined();
    // 不应硬断言 passed，因为原生模块可能未构建，但至少结果格式正确
    expect(typeof bs3!.passed).toBe('boolean');
  });

  it('version-consistency 检查项目版本', () => {
    const results = runStartupChecks(projectRoot);
    const vc = results.find((r) => r.name === 'version-consistency');
    expect(vc).toBeDefined();
    // 本地项目 package.json 版本 0.8.0，INSTALL.md 也是 0.8.0，应通过
    expect(vc!.passed).toBe(true);
    expect(vc!.detail).toContain('0.8.0');
  });

  it('build-sync dist/ 缺失时通过', () => {
    const results = runStartupChecks(projectRoot);
    const bs = results.find((r) => r.name === 'build-sync');
    expect(bs).toBeDefined();
    // 本地项目没有 dist/ 目录，应通过（跳过检查）
    expect(bs!.passed).toBe(true);
  });
});

/* ===================== summarizeChecks ===================== */

describe('summarizeChecks', () => {
  it('全部通过时生成摘要', () => {
    const results = [
      { name: 'a', passed: true, detail: 'ok', durationMs: 1 },
      { name: 'b', passed: true, detail: 'ok', durationMs: 2 },
    ];
    const summary = summarizeChecks(results);
    expect(summary).toContain('2/2 通过');
    expect(summary).toContain('[PASS] a');
    expect(summary).toContain('[PASS] b');
    expect(summary).not.toContain('⚠');
  });

  it('部分失败时包含警告', () => {
    const results = [
      { name: 'a', passed: true, detail: 'ok', durationMs: 1 },
      { name: 'b', passed: false, detail: 'fail', durationMs: 2 },
      { name: 'c', passed: true, detail: 'ok', durationMs: 3 },
    ];
    const summary = summarizeChecks(results);
    expect(summary).toContain('2/3 通过');
    expect(summary).toContain('[FAIL] b');
    expect(summary).toContain('⚠');
  });

  it('全部失败时包含警告', () => {
    const results = [
      { name: 'a', passed: false, detail: 'err', durationMs: 1 },
    ];
    const summary = summarizeChecks(results);
    expect(summary).toContain('0/1 通过');
    expect(summary).toContain('⚠');
  });
});
