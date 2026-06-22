/**
 * 二进制守卫（Binary Guard）
 *
 * 在 MCP Server / CLI 启动时执行自检，确保运行环境完整性。
 *
 * 检查项：
 * 1. better-sqlite3 原生模块是否可正常加载
 * 2. package.json 版本与 INSTALL.md 版本是否一致
 * 3. dist/ 产物 mtime 是否不早于 src/ 源码（同步性检查）
 *
 * 提供 runStartupChecks() 统一入口，返回 CheckResult[]。
 */

import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { tryLoadBetterSqlite3 } from './native-loader.js';

/* ===================== 类型定义 ===================== */

export interface CheckResult {
  /** 检查项名称 */
  name: string;
  /** 是否通过 */
  passed: boolean;
  /** 检查详情 */
  detail: string;
  /** 耗时（ms） */
  durationMs: number;
}

/* ===================== 检查项实现 ===================== */

/**
 * 检查 better-sqlite3 原生模块是否可加载
 */
function checkBetterSqlite3(projectRoot: string): CheckResult {
  const start = Date.now();
  const result = tryLoadBetterSqlite3(projectRoot);

  if (result.loaded) {
    return {
      name: 'better-sqlite3',
      passed: true,
      detail: `better-sqlite3 原生模块可加载 (路径: ${result.resolvedPath})`,
      durationMs: Date.now() - start,
    };
  }

  return {
    name: 'better-sqlite3',
    passed: false,
    detail: `better-sqlite3 原生模块加载失败: ${result.error}`,
    durationMs: Date.now() - start,
  };
}

/**
 * 检查 package.json 版本与 INSTALL.md 版本是否一致
 */
function checkVersionConsistency(projectRoot: string): CheckResult {
  const start = Date.now();

  // 读取 package.json 版本
  let pkgVersion: string | null = null;
  try {
    const pkgPath = path.join(projectRoot, 'package.json');
    if (!existsSync(pkgPath)) {
      return {
        name: 'version-consistency',
        passed: false,
        detail: 'package.json 缺失',
        durationMs: Date.now() - start,
      };
    }
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    pkgVersion = pkg.version ?? null;
    if (!pkgVersion) {
      return {
        name: 'version-consistency',
        passed: false,
        detail: 'package.json 中未找到 version 字段',
        durationMs: Date.now() - start,
      };
    }
  } catch (err) {
    return {
      name: 'version-consistency',
      passed: false,
      detail: `读取 package.json 失败: ${String(err)}`,
      durationMs: Date.now() - start,
    };
  }

  // 读取 INSTALL.md 版本（格式：> 版本 X.Y.Z）
  let installVersion: string | null = null;
  try {
    const installPath = path.join(projectRoot, 'INSTALL.md');
    if (!existsSync(installPath)) {
      return {
        name: 'version-consistency',
        passed: false,
        detail: 'INSTALL.md 缺失',
        durationMs: Date.now() - start,
      };
    }
    const content = readFileSync(installPath, 'utf-8');
    const match = content.match(/>\s*版本\s+(\d+\.\d+\.\d+)/);
    if (match) {
      installVersion = match[1];
    }
  } catch (err) {
    return {
      name: 'version-consistency',
      passed: false,
      detail: `读取 INSTALL.md 失败: ${String(err)}`,
      durationMs: Date.now() - start,
    };
  }

  if (!installVersion) {
    return {
      name: 'version-consistency',
      passed: true,
      detail: `package.json 版本 ${pkgVersion} (INSTALL.md 中未找到版本声明，跳过比对)`,
      durationMs: Date.now() - start,
    };
  }

  if (pkgVersion === installVersion) {
    return {
      name: 'version-consistency',
      passed: true,
      detail: `版本一致: ${pkgVersion}`,
      durationMs: Date.now() - start,
    };
  }

  return {
    name: 'version-consistency',
    passed: false,
    detail: `版本不一致: package.json(${pkgVersion}) vs INSTALL.md(${installVersion})`,
    durationMs: Date.now() - start,
  };
}

/**
 * 检查 dist/ 产物是否与 src/ 源码同步（通过比较 mtime）
 *
 * 策略：遍历 dist/ 中所有 .js 文件，检查是否存在对应 src/ .ts 文件，
 * 且 src 的 mtime 不晚于 dist（即 dist 是最新的或至少与 src 同步）。
 * 仅当 dist/ 存在时才进行此检查。
 */
function checkBuildSync(projectRoot: string): CheckResult {
  const start = Date.now();
  const distDir = path.join(projectRoot, 'dist');
  const srcDir = path.join(projectRoot, 'src');

  if (!existsSync(distDir)) {
    return {
      name: 'build-sync',
      passed: true,
      detail: 'dist/ 目录不存在，跳过构建同步检查',
      durationMs: Date.now() - start,
    };
  }

  const staleFiles: string[] = [];

  try {
    const distFiles = collectFiles(distDir, '.js');
    let checkedCount = 0;

    for (const distFile of distFiles) {
      // 推导对应的 src 路径：dist/foo/bar.js → src/foo/bar.ts
      const relativePath = path.relative(distDir, distFile);
      const tsPath = path.join(srcDir, relativePath.replace(/\.js$/, '.ts'));

      if (!existsSync(tsPath)) {
        // 可能不是 TypeScript 源文件（如纯 JS 文件），跳过
        continue;
      }

      checkedCount++;
      const distStat = statSync(distFile);
      const srcStat = statSync(tsPath);

      // 如果源码修改时间晚于产物 → 产物过期
      if (srcStat.mtimeMs > distStat.mtimeMs) {
        staleFiles.push(relativePath);
      }
    }

    if (staleFiles.length === 0) {
      return {
        name: 'build-sync',
        passed: true,
        detail: checkedCount > 0
          ? `检查 ${checkedCount} 个文件，dist/ 与 src/ 同步`
          : 'dist/ 中无可比对文件',
        durationMs: Date.now() - start,
      };
    }

    const preview = staleFiles.slice(0, 3).join(', ');
    const suffix = staleFiles.length > 3 ? ` 等 ${staleFiles.length} 个文件` : '';
    return {
      name: 'build-sync',
      passed: false,
      detail: `dist/ 产物过期: ${preview}${suffix}，请重新构建 (npx tsc)`,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      name: 'build-sync',
      passed: false,
      detail: `构建同步检查异常: ${String(err)}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 递归收集指定后缀的文件
 */
function collectFiles(dir: string, suffix: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...collectFiles(fullPath, suffix));
      } else if (entry.isFile() && entry.name.endsWith(suffix)) {
        results.push(fullPath);
      }
    }
  } catch {
    // 无权访问或目录不存在，静默跳过
  }
  return results;
}

/* ===================== 统一入口 ===================== */

/**
 * 执行所有启动检查，返回结果列表。
 *
 * @param projectRoot 项目根目录绝对路径
 * @returns 各检查项的结果
 */
export function runStartupChecks(projectRoot: string): CheckResult[] {
  const results: CheckResult[] = [];

  results.push(checkBetterSqlite3(projectRoot));
  results.push(checkVersionConsistency(projectRoot));
  results.push(checkBuildSync(projectRoot));

  return results;
}

/**
 * 汇总检查结果，返回便于日志输出的文本
 */
export function summarizeChecks(results: CheckResult[]): string {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const lines = [
    `启动自检完成: ${passed}/${results.length} 通过`,
    ...results.map(
      (r) => `  [${r.passed ? 'PASS' : 'FAIL'}] ${r.name}: ${r.detail}`,
    ),
  ];

  if (failed > 0) {
    lines.push(`⚠ ${failed} 项检查未通过，部分功能可能不可用`);
  }

  return lines.join('\n');
}
