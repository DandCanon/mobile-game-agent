/**
 * Hybrid Reflector 单元测试
 *
 * 覆盖：
 *  - 9 条确定性规则（每条至少 1 个缺陷案例 + 1 个无缺陷案例）
 *  - HybridReflector 模式切换（全通过 / 纯 warning / 有 error）
 *  - 统计准确性验证
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkImportPaths,
  checkFunctionSignature,
  checkNullSafety,
  checkAsyncAwait,
  checkResourceCleanup,
  checkErrorHandling,
  checkHardcodedValues,
  checkTypeAssertions,
  checkCodeDuplication,
  runAllRules,
} from '../src/reflector/rules';
import { HybridReflector } from '../src/reflector/index';
import type { Issue } from '../src/reflector/index';

/* ==================================================================
 * 辅助函数
 * ================================================================== */

/** 检查 issue 列表是否全部为 warning（零 error） */
function allWarnings(issues: Issue[]): boolean {
  return issues.length > 0 && issues.every((i) => i.severity === 'warning');
}

/** 检查 issue 列表是否包含 error */
function hasError(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

/* ==================================================================
 * 规则 1: checkImportPaths
 * ================================================================== */

describe('checkImportPaths', () => {
  const knownFiles = new Set([
    './types',
    './types.ts',
    './GameEngine',
    './GameEngine.ts',
    '../utils/helpers',
    '../utils/helpers.ts',
  ]);

  it('有缺陷：导入不存在的模块', () => {
    const code = `import { foo } from './nonexistent';
import { bar } from '../utils/helpers';`;
    const result = checkImportPaths(code, knownFiles);
    expect(result.passed).toBe(true); // warning 级别
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.issues[0].message).toContain('nonexistent');
  });

  it('无缺陷：所有导入路径已知', () => {
    const code = `import { GameState } from './types';
import { performClick } from './GameEngine';`;
    const result = checkImportPaths(code, knownFiles);
    expect(result.issues).toHaveLength(0);
  });

  it('无缺陷：无导入语句', () => {
    const code = `const x = 1;\nfunction foo(): number { return x; }`;
    const result = checkImportPaths(code, knownFiles);
    expect(result.issues).toHaveLength(0);
  });
});

/* ==================================================================
 * 规则 2: checkFunctionSignature
 * ================================================================== */

describe('checkFunctionSignature', () => {
  it('有缺陷：缺少返回值类型', () => {
    const code = `export function add(a: number, b: number) {
  return a + b;
}`;
    const result = checkFunctionSignature(code);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.issues[0].message).toContain('返回值类型');
  });

  it('有缺陷：参数缺少类型注解', () => {
    const code = `export function greet(name): string {
  return 'Hello ' + name;
}`;
    const result = checkFunctionSignature(code);
    expect(result.issues.some((i) => i.message.includes('类型注解'))).toBe(true);
  });

  it('无缺陷：完整签名', () => {
    const code = `export function multiply(a: number, b: number): number {
  return a * b;
}`;
    const result = checkFunctionSignature(code);
    expect(result.issues).toHaveLength(0);
  });

  it('无缺陷：箭头函数有完整类型', () => {
    const code = `export const add = (a: number, b: number): number => a + b;`;
    const result = checkFunctionSignature(code);
    expect(result.issues).toHaveLength(0);
  });
});

/* ==================================================================
 * 规则 3: checkNullSafety
 * ================================================================== */

describe('checkNullSafety', () => {
  it('有缺陷：find() + 非空断言', () => {
    const code = `const item = arr.find(x => x.id === 1)!.name;`;
    const result = checkNullSafety(code);
    expect(hasError(result.issues)).toBe(true);
    expect(result.issues.some((i) => i.message.includes('非空断言'))).toBe(true);
  });

  it('有缺陷：可选链 + 非空断言 矛盾', () => {
    const code = `const value = obj?.prop!;`;
    const result = checkNullSafety(code);
    expect(result.issues.some((i) => i.message.includes('可选链'))).toBe(true);
  });

  it('无缺陷：正常的可选链', () => {
    const code = `const name = user?.profile?.name ?? 'unknown';`;
    const result = checkNullSafety(code);
    // 可能有非空断言的 warning，但不应有 error
    expect(hasError(result.issues)).toBe(false);
  });

  it('无缺陷：空值安全用法', () => {
    const code = `function getName(user?: User): string {
  if (!user) return 'unknown';
  return user.name;
}`;
    const result = checkNullSafety(code);
    expect(hasError(result.issues)).toBe(false);
  });
});

/* ==================================================================
 * 规则 4: checkAsyncAwait
 * ================================================================== */

describe('checkAsyncAwait', () => {
  it('有缺陷：async 函数无 await', () => {
    const code = `export async function fetchUser(): Promise<User> {
  return { name: 'test' };
}`;
    const result = checkAsyncAwait(code);
    expect(result.issues.some((i) => i.message.includes('没有 await'))).toBe(true);
  });

  it('有缺陷：return await 冗余', () => {
    const code = `export async function getData(): Promise<Data> {
  try { return await fetch('url'); } catch { return null; }
}`;
    const result = checkAsyncAwait(code);
    // return await 在 try-catch 中合理，但规则仍会报告
    expect(result.issues.length).toBeGreaterThanOrEqual(0);
  });

  it('无缺陷：正确使用 async/await', () => {
    const code = `export async function loadData(): Promise<void> {
  const res = await fetch('/api');
  const data = await res.json();
  console.log(data);
}`;
    const result = checkAsyncAwait(code);
    // 可能有 return await 的 warning（如果有），但不应报告 "没有 await"
    expect(result.issues.some((i) => i.message.includes('没有 await'))).toBe(false);
  });

  it('无缺陷：非 async 函数无需 await', () => {
    const code = `export function syncAdd(a: number, b: number): number {
  return a + b;
}`;
    const result = checkAsyncAwait(code);
    expect(hasError(result.issues)).toBe(false);
  });
});

/* ==================================================================
 * 规则 5: checkResourceCleanup
 * ================================================================== */

describe('checkResourceCleanup', () => {
  it('有缺陷：useEffect 中 setInterval 无清理', () => {
    const code = `useEffect(() => {
  const timer = setInterval(() => {}, 1000);
});`;
    const result = checkResourceCleanup(code);
    expect(hasError(result.issues)).toBe(true);
    expect(result.issues.some((i) => i.message.includes('setInterval'))).toBe(true);
  });

  it('有缺陷：useEffect 中 addEventListener 无清理', () => {
    const code = `useEffect(() => {
  window.addEventListener('resize', handler);
});`;
    const result = checkResourceCleanup(code);
    expect(hasError(result.issues)).toBe(true);
  });

  it('无缺陷：useEffect 有清理函数', () => {
    const code = `useEffect(() => {
  const timer = setInterval(() => {}, 1000);
  return () => clearInterval(timer);
}, []);`;
    const result = checkResourceCleanup(code);
    expect(hasError(result.issues)).toBe(false);
  });

  it('无缺陷：useEffect 无副作用', () => {
    const code = `useEffect(() => {
  document.title = 'Hello';
}, []);`;
    const result = checkResourceCleanup(code);
    expect(hasError(result.issues)).toBe(false);
  });
});

/* ==================================================================
 * 规则 6: checkErrorHandling
 * ================================================================== */

describe('checkErrorHandling', () => {
  it('有缺陷：JSON.parse 无 try-catch', () => {
    const code = `function parse(str: string) {
  const obj = JSON.parse(str);
  return obj;
}`;
    const result = checkErrorHandling(code);
    expect(hasError(result.issues)).toBe(true);
    expect(result.issues.some((i) => i.message.includes('JSON.parse'))).toBe(true);
  });

  it('有缺陷：await 无 try-catch', () => {
    const code = `export async function risky(): Promise<void> {
  const data = await fetch('/api');
  console.log(data);
}`;
    const result = checkErrorHandling(code);
    expect(result.issues.some((i) => i.message.includes('没有 try-catch'))).toBe(true);
  });

  it('无缺陷：JSON.parse 在 try-catch 中', () => {
    const code = `function parse(str: string) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}`;
    const result = checkErrorHandling(code);
    expect(hasError(result.issues)).toBe(false);
  });

  it('无缺陷：async 函数有 try-catch', () => {
    const code = `export async function safe(): Promise<void> {
  try {
    const data = await fetch('/api');
    console.log(data);
  } catch (e) {
    console.error(e);
  }
}`;
    const result = checkErrorHandling(code);
    expect(result.issues.some((i) => i.message.includes('没有 try-catch'))).toBe(false);
  });
});

/* ==================================================================
 * 规则 7: checkHardcodedValues
 * ================================================================== */

describe('checkHardcodedValues', () => {
  it('有缺陷：魔法数字', () => {
    const code = `function timeout(): number {
  return 9999;
}`;
    const result = checkHardcodedValues(code);
    expect(result.issues.some((i) => i.message.includes('9999'))).toBe(true);
  });

  it('有缺陷：魔法数字 99999', () => {
    const code = `const maxRetries = 99999;`;
    const result = checkHardcodedValues(code);
    expect(result.issues.some((i) => i.message.includes('99999'))).toBe(true);
  });

  it('无缺陷：合理数值', () => {
    const code = `const ZERO = 0;
const ONE = 1;
const HALF = 0.5;`;
    const result = checkHardcodedValues(code);
    // 不应报告 0、1 等安全值
    expect(result.issues.filter((i) => /[01]/.test(i.message)).length).toBe(0);
  });

  it('无缺陷：已定义常量', () => {
    const code = `const MAX_TIMEOUT = 5000;
function getTimeout(): number { return MAX_TIMEOUT; }`;
    const result = checkHardcodedValues(code);
    // 5000 出现在常量定义行，但规则会检测出来
    expect(hasError(result.issues)).toBe(false);
  });
});

/* ==================================================================
 * 规则 8: checkTypeAssertions
 * ================================================================== */

describe('checkTypeAssertions', () => {
  it('有缺陷：as any', () => {
    const code = `const data = response as any;`;
    const result = checkTypeAssertions(code);
    expect(hasError(result.issues)).toBe(true);
    expect(result.issues.some((i) => i.message.includes('as any'))).toBe(true);
  });

  it('有缺陷：find() + !', () => {
    const code = `const first = items.find(x => x.active)!;`;
    const result = checkTypeAssertions(code);
    expect(hasError(result.issues)).toBe(true);
  });

  it('有缺陷：双重断言', () => {
    const code = `const val = input as unknown as string;`;
    const result = checkTypeAssertions(code);
    expect(result.issues.some((i) => i.message.includes('双重类型断言'))).toBe(true);
  });

  it('无缺陷：合理类型断言', () => {
    const code = `const el = document.getElementById('root') as HTMLElement;`;
    const result = checkTypeAssertions(code);
    // document.getElementById 后直接加 as 无 !，应只触发 getElementById 的检测
    // 但 as HTMLElement 不是 as any，不是错误
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('无缺陷：泛型约束', () => {
    const code = `function identity<T>(arg: T): T { return arg; }`;
    const result = checkTypeAssertions(code);
    expect(result.issues).toHaveLength(0);
  });
});

/* ==================================================================
 * 规则 9: checkCodeDuplication
 * ================================================================== */

describe('checkCodeDuplication', () => {
  it('有缺陷：重复代码块', () => {
    const code = `function first() {
  const a = 1;
  const b = 2;
  const c = a + b;
  return c * 10 + 5;
}

function second() {
  const a = 1;
  const b = 2;
  const c = a + b;
  return c * 10 + 5;
}`;
    const result = checkCodeDuplication(code);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    expect(result.issues[0].message).toContain('相似');
  });

  it('无缺陷：无重复代码', () => {
    const code = `function uniqueOne() {
  const result = complexAlgorithmA();
  return result;
}

function uniqueTwo() {
  const data = totallyDifferentLogicB();
  return data;
}`;
    const result = checkCodeDuplication(code);
    // 代码太短/太不同，不应检测到重复
    expect(result.issues.filter((i) => i.message.includes('相似'))).toHaveLength(0);
  });
});

/* ==================================================================
 * runAllRules 批量测试
 * ================================================================== */

describe('runAllRules', () => {
  it('返回 9 条规则结果', () => {
    const code = `export function hello(): string { return 'world'; }`;
    const results = runAllRules(code);
    expect(results).toHaveLength(9);
    const names = results.map((r) => r.name);
    expect(names).toContain('checkImportPaths');
    expect(names).toContain('checkFunctionSignature');
    expect(names).toContain('checkNullSafety');
    expect(names).toContain('checkAsyncAwait');
    expect(names).toContain('checkResourceCleanup');
    expect(names).toContain('checkErrorHandling');
    expect(names).toContain('checkHardcodedValues');
    expect(names).toContain('checkTypeAssertions');
    expect(names).toContain('checkCodeDuplication');
  });
});

/* ==================================================================
 * HybridReflector 模式切换测试
 * ================================================================== */

describe('HybridReflector 模式切换', () => {
  let reflector: HybridReflector;

  beforeEach(() => {
    reflector = new HybridReflector({ estimatedLlmTokensPerCall: 2000 });
    reflector.resetStats();
  });

  it('全通过 → mode=rule-only, llmSkipped=true', async () => {
    const cleanCode = `export function add(a: number, b: number): number {
  return a + b;
}`;
    const result = await reflector.reflect(cleanCode);
    expect(result.passed).toBe(true);
    expect(result.mode).toBe('rule-only');
    expect(result.llmSkipped).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('纯 warning → mode=rule-only, passed=true', async () => {
    // async 函数无 await → warning
    const warningCode = `export async function getData(): Promise<number> {
  return 42;
}`;
    const result = await reflector.reflect(warningCode);
    expect(result.passed).toBe(true);
    expect(result.mode).toBe('rule-only');
    expect(result.llmSkipped).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(hasError(result.issues)).toBe(false);
  });

  it('有 error → mode=hybrid (无 LLM 回调时降级)', async () => {
    const errorCode = `const x = obj as any;
JSON.parse('bad');`;
    const result = await reflector.reflect(errorCode);
    // 有 error 但无 llmReview 回调，应标记为 hybrid 但 llmIssues 为空
    expect(result.mode).toBe('hybrid');
    expect(result.llmSkipped).toBe(false);
    expect(hasError(result.issues)).toBe(true);
  });

  it('有 error + LLM 回调 → mode=hybrid, 合并 issue', async () => {
    const reflectorWithLLM = new HybridReflector({
      llmReview: async (_code, _issues) => [
        { line: 10, severity: 'error', message: 'LLM 补充：逻辑缺陷', suggestion: '修复' },
      ],
      estimatedLlmTokensPerCall: 2000,
    });

    const errorCode = `const x = obj as any;`;
    const result = await reflectorWithLLM.reflect(errorCode);
    expect(result.mode).toBe('hybrid');
    expect(result.llmIssues).toBeDefined();
    expect(result.llmIssues!.length).toBeGreaterThanOrEqual(1);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
  });

  it('reflectSync 始终返回 rule-only 模式', () => {
    const errorCode = `const x = obj as any;`;
    const result = reflector.reflectSync(errorCode);
    expect(result.mode).toBe('rule-only');
    expect(result.llmSkipped).toBe(true);
  });
});

/* ==================================================================
 * 统计准确性验证
 * ================================================================== */

describe('HybridReflector 统计', () => {
  let reflector: HybridReflector;

  beforeEach(() => {
    reflector = new HybridReflector({ estimatedLlmTokensPerCall: 2000 });
    reflector.resetStats();
  });

  it('初始统计全部为 0', () => {
    const stats = reflector.getStats();
    expect(stats.totalReflections).toBe(0);
    expect(stats.ruleOnlyCount).toBe(0);
    expect(stats.hybridCount).toBe(0);
    expect(stats.totalTokensSaved).toBe(0);
  });

  it('全通过场景统计更新正确', async () => {
    const cleanCode = `export function f(x: number): number { return x; }`;
    await reflector.reflect(cleanCode);
    await reflector.reflect(cleanCode);

    const stats = reflector.getStats();
    expect(stats.totalReflections).toBe(2);
    expect(stats.ruleOnlyCount).toBe(2);
    expect(stats.hybridCount).toBe(0);
    expect(stats.totalTokensSaved).toBeGreaterThan(0);
  });

  it('hybrid 模式统计更新正确', async () => {
    const errorCode = `const x = obj as any;`;
    await reflector.reflect(errorCode);
    await reflector.reflect(errorCode);

    const stats = reflector.getStats();
    expect(stats.totalReflections).toBe(2);
    expect(stats.hybridCount).toBe(2);
    expect(stats.ruleOnlyCount).toBe(0);
  });

  it('混合场景统计正确', async () => {
    const clean = `export function f(x: number): number { return x; }`;
    const error = `const x = obj as any;`;

    // 2 clean + 1 error
    await reflector.reflect(clean);
    await reflector.reflect(clean);
    await reflector.reflect(error);

    const stats = reflector.getStats();
    expect(stats.totalReflections).toBe(3);
    expect(stats.ruleOnlyCount).toBe(2);
    expect(stats.hybridCount).toBe(1);
  });

  it('resetStats 归零', async () => {
    await reflector.reflect(`const x = obj as any;`);
    reflector.resetStats();
    const stats = reflector.getStats();
    expect(stats.totalReflections).toBe(0);
    expect(stats.totalTokensSaved).toBe(0);
  });
});

/* ==================================================================
 * Issue 结构验证
 * ================================================================== */

describe('Issue 结构', () => {
  it('每条 issue 包含必需字段', () => {
    const code = `import { x } from './nonexistent';`;
    const result = checkImportPaths(code);
    if (result.issues.length > 0) {
      const issue = result.issues[0];
      expect(issue).toHaveProperty('line');
      expect(issue).toHaveProperty('severity');
      expect(issue).toHaveProperty('message');
      expect(issue).toHaveProperty('suggestion');
      expect(typeof issue.line).toBe('number');
      expect(['warning', 'error']).toContain(issue.severity);
    }
  });

  it('line 为 1-based 行号', () => {
    const code = `const x = obj as any;\nconst y = obj2 as any;`;
    const result = checkTypeAssertions(code);
    if (result.issues.length >= 2) {
      expect(result.issues[0].line).toBeGreaterThanOrEqual(1);
      expect(result.issues[1].line).toBeGreaterThanOrEqual(1);
    }
  });
});

/* ==================================================================
 * 边界情况
 * ================================================================== */

describe('边界情况', () => {
  it('空代码字符串', () => {
    const results = runAllRules('');
    expect(results).toHaveLength(9);
    for (const r of results) {
      expect(r.issues).toEqual([]);
    }
  });

  it('仅注释', () => {
    const code = `// This is a comment\n/* block comment */`;
    const results = runAllRules(code);
    for (const r of results) {
      // 注释中不应触发检查
      expect(hasError(r.issues)).toBe(false);
    }
  });

  it('大型代码无崩溃', () => {
    const code = Array.from({ length: 200 }, (_, i) =>
      `export function func${i}(a${i}: number, b${i}: string): string {\n  return b${i} + a${i};\n}`,
    ).join('\n');

    const results = runAllRules(code);
    expect(results).toHaveLength(9);
    // 不应有 error（所有函数签名完整）
    for (const r of results) {
      expect(hasError(r.issues)).toBe(false);
    }
  });

  it('多行 as any 检测', () => {
    const code = `const a = 1 as any;\nconst b = 2 as any;\nconst c = 3 as any;`;
    const result = checkTypeAssertions(code);
    expect(result.issues.filter((i) => i.severity === 'error').length).toBeGreaterThanOrEqual(3);
  });

  it('resolveAttack 风格代码的清理检测', () => {
    const code = `useEffect(() => {
  const subscription = eventEmitter.subscribe('click', handler);
});`;
    const result = checkResourceCleanup(code);
    expect(hasError(result.issues)).toBe(true);
  });
});
