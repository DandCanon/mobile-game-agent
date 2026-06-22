/**
 * Native Loader — ESM 安全的原生模块加载器
 *
 * 项目使用 "type": "module" + tsx 运行，ESM 作用域内 require 不可用。
 * 本模块通过 createRequire 创建项目级 CommonJS require，安全加载原生模块。
 *
 * 用法：
 *   import { loadBetterSqlite3, resolveBetterSqlite3 } from './native-loader.js';
 *   const DB = loadBetterSqlite3(projectRoot);
 */

import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * 为指定项目根目录创建 CommonJS require 函数
 */
export function createProjectRequire(projectRoot: string): NodeRequire {
  const pkgPath = path.join(projectRoot, 'package.json');
  return createRequire(pkgPath);
}

/**
 * 加载 better-sqlite3 原生模块
 * @returns Database 构造器，失败时返回 null
 */
export function loadBetterSqlite3(projectRoot: string): any | null {
  try {
    const projectRequire = createProjectRequire(projectRoot);
    return projectRequire('better-sqlite3');
  } catch {
    return null;
  }
}

/**
 * 解析 better-sqlite3 模块路径
 * @returns 模块文件路径，失败时返回 null
 */
export function resolveBetterSqlite3(projectRoot: string): string | null {
  try {
    const projectRequire = createProjectRequire(projectRoot);
    return projectRequire.resolve('better-sqlite3');
  } catch {
    return null;
  }
}

/**
 * 尝试加载 better-sqlite3，返回完整的加载结果
 */
export interface Sqlite3LoadResult {
  loaded: boolean;
  Database: any | null;
  resolvedPath: string | null;
  error: string | null;
}

export function tryLoadBetterSqlite3(projectRoot: string): Sqlite3LoadResult {
  try {
    const projectRequire = createProjectRequire(projectRoot);
    const resolvedPath = projectRequire.resolve('better-sqlite3');
    const Database = projectRequire('better-sqlite3');
    return {
      loaded: true,
      Database,
      resolvedPath,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      loaded: false,
      Database: null,
      resolvedPath: null,
      error,
    };
  }
}
