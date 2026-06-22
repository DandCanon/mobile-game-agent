/**
 * Hybrid Reflector — 确定性规则检查函数
 *
 * 每条规则接收代码字符串，返回 RuleResult。
 * 所有规则均为纯静态分析，无 IO / 无副作用。
 */

/* ===================== 类型定义 ===================== */

export interface Issue {
  /** 问题所在行号（1-based） */
  line: number;
  /** 严重级别 */
  severity: 'warning' | 'error';
  /** 问题描述 */
  message: string;
  /** 修改建议 */
  suggestion: string;
}

export interface RuleResult {
  /** 规则名称 */
  name: string;
  /** 是否通过（无 error 级别 issue 即为 passed） */
  passed: boolean;
  /** 问题列表 */
  issues: Issue[];
}

/* ===================== 辅助函数 ===================== */

function linesOf(code: string): string[] {
  // 保留空行以准确映射行号
  return code.split('\n');
}

/** 提取代码中第 line 行的内容片段（用于 suggestion 上下文） */
function lineSnippet(lines: string[], line: number, context = 1): string {
  const idx = line - 1;
  return lines.slice(Math.max(0, idx - context), idx + context + 1).join('\n');
}

/* ==================================================================
 * 规则 1: 导入路径存在性检查
 * ================================================================== */

/**
 * 检查相对导入路径是否存在。
 * 依赖调用方传入 knownFiles（已知的模块/文件路径集合）。
 */
export function checkImportPaths(
  code: string,
  knownFiles: Set<string> = new Set(),
): RuleResult {
  const issues: Issue[] = [];
  const lines = linesOf(code);

  // 匹配 import ... from './...' 或 import ... from '../...'
  const importRe = /import\s+(?:[\s\S]*?\s+from\s+)?['"](\.[^'"]+)['"]/g;
  let match: RegExpExecArray | null;

  while ((match = importRe.exec(code)) !== null) {
    const rawPath = match[1];
    if (!knownFiles.has(rawPath) && !knownFiles.has(rawPath + '.ts') && !knownFiles.has(rawPath + '.tsx')) {
      const lineNum = code.slice(0, match.index).split('\n').length;
      issues.push({
        line: lineNum,
        severity: 'warning',
        message: `导入路径 "${rawPath}" 未在已知文件列表中`,
        suggestion: `确认目标文件是否存在，或补全扩展名: ${rawPath}.ts / ${rawPath}.tsx`,
      });
    }
  }

  return { name: 'checkImportPaths', passed: issues.every((i) => i.severity !== 'error'), issues };
}

/* ==================================================================
 * 规则 2: 函数签名完整性
 * ================================================================== */

/**
 * 检查导出的函数是否具有参数类型注解和返回值类型。
 */
export function checkFunctionSignature(code: string): RuleResult {
  const issues: Issue[] = [];
  const lines = linesOf(code);

  // 匹配 export function / export const xxx = (...) 等模式
  // 只检查顶层导出的函数
  const funcRe = /export\s+(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*(:\s*\w[^{]*)?\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = funcRe.exec(code)) !== null) {
    const funcName = match[1];
    const params = match[2]?.trim() ?? '';
    const returnType = match[3]?.trim() ?? '';

    const lineNum = code.slice(0, match.index).split('\n').length;

    // 检查返回值类型
    if (!returnType) {
      issues.push({
        line: lineNum,
        severity: 'warning',
        message: `函数 "${funcName}" 缺少返回值类型注解`,
        suggestion: `为函数 "${funcName}" 添加返回值类型，例如: function ${funcName}(...): ReturnType {`,
      });
    }

    // 检查参数类型注解
    if (params && params !== '') {
      const paramList = params.split(',').map((p) => p.trim()).filter(Boolean);
      for (const param of paramList) {
        // 解构参数如 { a, b }: Props
        const isDestructured = /^\{[^}]+\}\s*:/.test(param);
        // 普通参数如 name: string
        const hasTypeAnnotation = param.includes(':') || isDestructured;
        if (!hasTypeAnnotation && param !== '') {
          issues.push({
            line: lineNum,
            severity: 'warning',
            message: `函数 "${funcName}" 的参数 "${param}" 缺少类型注解`,
            suggestion: `为参数 "${param}" 添加类型注解`,
          });
        }
      }
    }
  }

  // 也检查箭头函数导出
  const arrowRe = /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(:\s*\w[^{]*)?\s*=>/g;
  while ((match = arrowRe.exec(code)) !== null) {
    const funcName = match[1];
    const params = match[2]?.trim() ?? '';
    const returnType = match[3]?.trim() ?? '';
    const lineNum = code.slice(0, match.index).split('\n').length;

    if (!returnType) {
      issues.push({
        line: lineNum,
        severity: 'warning',
        message: `箭头函数 "${funcName}" 缺少返回值类型注解`,
        suggestion: `为箭头函数 "${funcName}" 添加返回值类型`,
      });
    }

    if (params && params !== '') {
      const paramList = params.split(',').map((p) => p.trim()).filter(Boolean);
      for (const param of paramList) {
        const isDestructured = /^\{[^}]+\}\s*:/.test(param);
        if (!param.includes(':') && !isDestructured) {
          issues.push({
            line: lineNum,
            severity: 'warning',
            message: `箭头函数 "${funcName}" 的参数 "${param}" 缺少类型注解`,
            suggestion: `为参数 "${param}" 添加类型注解`,
          });
        }
      }
    }
  }

  return { name: 'checkFunctionSignature', passed: issues.every((i) => i.severity !== 'error'), issues };
}

/* ==================================================================
 * 规则 3: 空值安全检查
 * ================================================================== */

/**
 * 检测潜在的空值访问：在已做 null-check 后仍使用 ! 断言，
 * 或访问可能为 null/undefined 的链条属性。
 */
export function checkNullSafety(code: string): RuleResult {
  const issues: Issue[] = [];
  const lines = linesOf(code);

  // 模式 1: 非空断言 (!) 使用 —— 可能是绕过空值检查的隐患
  const nonNullRe = /(\w+(?:\.\w+)*)!/g;
  let match: RegExpExecArray | null;
  while ((match = nonNullRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    // 排除注释中的
    const lineContent = lines[lineNum - 1] ?? '';
    if (lineContent.trim().startsWith('//') || lineContent.trim().startsWith('*')) continue;

    issues.push({
      line: lineNum,
      severity: 'warning',
      message: `使用了非空断言 "${match[1]}!"，可能隐藏空值风险`,
      suggestion: `使用条件检查替代非空断言，或添加显式的 null/undefined 守卫`,
    });
  }

  // 模式 2: array[index] 访问——可能越界
  const arrayIndexRe = /(\w+)\[(?!\d+\]\.)[^\]]+\]/g;
  // 忽略已知安全的数字索引
  // 实际上通用检测比较困难，我们检查一些常见模式

  // 模式 3: .find() / .filter()[0] 后直接访问属性
  const findAccessRe = /(\w+)\.find\([^)]+\)\s*!\s*\.(\w+)/g;
  while ((match = findAccessRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    issues.push({
      line: lineNum,
      severity: 'error',
      message: `.find() 结果使用非空断言直接访问属性 "${match[2]}"，可能为 undefined`,
      suggestion: `将 find 结果赋给变量后做 null 检查再访问属性`,
    });
  }

  // 模式 4: 可选链后紧跟非空断言 (矛盾模式)
  const optionalThenNonNullRe = /\?\.\s*(\w+)\s*!/g;
  while ((match = optionalThenNonNullRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    issues.push({
      line: lineNum,
      severity: 'warning',
      message: `可选链 "?." 后使用了非空断言 "!"，逻辑矛盾`,
      suggestion: `去掉其中一个：要么使用可选链处理 null，要么使用非空断言`,
    });
  }

  return { name: 'checkNullSafety', passed: issues.every((i) => i.severity !== 'error'), issues };
}

/* ==================================================================
 * 规则 4: 异步一致性检查
 * ================================================================== */

/**
 * 检查：async 函数是否包含 await，Promise 是否被正确 await。
 */
export function checkAsyncAwait(code: string): RuleResult {
  const issues: Issue[] = [];
  const lines = linesOf(code);

  // 模式 1: async 函数体内没有 await
  // [^{]* 匹配返回值类型等 { 之前的内容
  const asyncFuncRe = /(?:export\s+)?async\s+(?:function\s+(\w+)|\(([^)]*)\)\s*=>)[^{]*\{/g;
  let match: RegExpExecArray | null;

  while ((match = asyncFuncRe.exec(code)) !== null) {
    const funcName = match[1] || 'anonymous';
    const lineNum = code.slice(0, match.index).split('\n').length;

    // 找到函数体的闭合括号
    const openBrace = match.index + match[0].length - 1;
    let depth = 1;
    let closeBrace = openBrace + 1;
    for (; closeBrace < code.length && depth > 0; closeBrace++) {
      if (code[closeBrace] === '{') depth++;
      if (code[closeBrace] === '}') depth--;
    }
    const body = code.slice(openBrace + 1, closeBrace - 1);

    if (!/\bawait\b/.test(body)) {
      issues.push({
        line: lineNum,
        severity: 'warning',
        message: `async 函数 "${funcName}" 内部没有 await 表达式`,
        suggestion: `如果不需要 await，移除 async 关键字；或确认是否遗漏了 await`,
      });
    }
  }

  // 模式 2: Promise 调用未使用 await（在非 async 上下文中）
  // 检测 then() 链中可能遗漏 await 的情况
  const promiseNoAwaitRe = /^\s*(?!\/\/)\s*const\s+\w+\s*=\s*(?!await\b)(\w+(?:\.\w+)*\([^)]*\))\s*$/gm;
  while ((match = promiseNoAwaitRe.exec(code)) !== null) {
    const called = match[1];
    // 检查是否为已知返回 Promise 的模式（如 fetch、异步方法名含 Async）
    if (/\b(fetch|readFile|writeFile|query|execute|send|request|load|save)\b/.test(called)) {
      const lineNum = code.slice(0, match.index).split('\n').length;
      // 检查周围是否有 .then 或 await
      const surroundingContext = code.slice(Math.max(0, match.index - 50), match.index + match[0].length + 50);
      if (!surroundingContext.includes('.then') && !surroundingContext.includes('await')) {
        issues.push({
          line: lineNum,
          severity: 'warning',
          message: `疑似异步调用 "${called}" 未使用 await 或 .then()`,
          suggestion: `添加 await 或使用 .then() 处理异步结果`,
        });
      }
    }
  }

  // 模式 3: return await 冗余检测
  const returnAwaitRe = /return\s+await\s+/g;
  while ((match = returnAwaitRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    issues.push({
      line: lineNum,
      severity: 'warning',
      message: `"return await" 通常冗余，除非在 try-catch 中`,
      suggestion: `如果不在 try-catch 中，直接 return 即可（Promise 会自动传递）`,
    });
  }

  return { name: 'checkAsyncAwait', passed: issues.every((i) => i.severity !== 'error'), issues };
}

/* ==================================================================
 * 规则 5: 资源清理检查
 * ================================================================== */

/**
 * 检查 useEffect / addEventListener / setInterval / subscription 等
 * 是否在 teardown 中正确清理。
 */
export function checkResourceCleanup(code: string): RuleResult {
  const issues: Issue[] = [];
  const lines = linesOf(code);

  // 模式 1: useEffect 中有 setInterval / addEventListener 但没有 return cleanup
  const useEffRe = /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = useEffRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    const openBrace = match.index + match[0].length - 1;
    let depth = 1;
    let closeBrace = openBrace + 1;
    for (; closeBrace < code.length && depth > 0; closeBrace++) {
      if (code[closeBrace] === '{') depth++;
      if (code[closeBrace] === '}') depth--;
    }
    const body = code.slice(openBrace + 1, closeBrace - 1);

    const hasInterval = /\bsetInterval\b/.test(body);
    const hasListener = /\baddEventListener\b/.test(body);
    const hasSubscription = /\b(subscribe|on\(|\.on\()/.test(body);
    const hasCleanup = /\breturn\s+\(\s*\)\s*=>/.test(body) || /\breturn\s+function\s*\(\)/.test(body);

    if ((hasInterval || hasListener || hasSubscription) && !hasCleanup) {
      const resources: string[] = [];
      if (hasInterval) resources.push('setInterval');
      if (hasListener) resources.push('addEventListener');
      if (hasSubscription) resources.push('subscription');
      issues.push({
        line: lineNum,
        severity: 'error',
        message: `useEffect 中使用了 ${resources.join('/')} 但缺少清理函数`,
        suggestion: `在 useEffect 回调中 return 一个清理函数，用于 clearInterval / removeEventListener / unsubscribe`,
      });
    }
  }

  // 模式 2: 单独的 setInterval 没有对应的 clearInterval
  // 检测 setInterval 赋值给变量但没有 clearInterval
  const setIntervalAssignRe = /(\w+)\s*=\s*setInterval\s*\(/g;
  while ((match = setIntervalAssignRe.exec(code)) !== null) {
    const varName = match[1];
    const lineNum = code.slice(0, match.index).split('\n').length;
    // 在整个代码中搜索 clearInterval(varName)
    const clearRe = new RegExp(`clearInterval\\s*\\(\\s*${varName}\\s*\\)`);
    if (!clearRe.test(code)) {
      issues.push({
        line: lineNum,
        severity: 'warning',
        message: `setInterval 的返回值 "${varName}" 没有对应的 clearInterval 调用`,
        suggestion: `确保在适当的时机（如组件卸载）调用 clearInterval(${varName})`,
      });
    }
  }

  // 模式 3: setTimeout 赋值但没有 clearTimeout（仅对组件级重要）
  const setTimeoutAssignRe = /(\w+)\s*=\s*setTimeout\s*\(/g;
  while ((match = setTimeoutAssignRe.exec(code)) !== null) {
    const varName = match[1];
    const lineNum = code.slice(0, match.index).split('\n').length;
    const clearRe = new RegExp(`clearTimeout\\s*\\(\\s*${varName}\\s*\\)`);
    if (!clearRe.test(code)) {
      issues.push({
        line: lineNum,
        severity: 'warning',
        message: `setTimeout 的返回值 "${varName}" 没有对应的 clearTimeout`,
        suggestion: `在组件卸载或不再需要时调用 clearTimeout(${varName})`,
      });
    }
  }

  return { name: 'checkResourceCleanup', passed: issues.every((i) => i.severity !== 'error'), issues };
}

/* ==================================================================
 * 规则 6: 错误处理检查
 * ================================================================== */

/**
 * 检查关键路径是否有 try-catch 覆盖。
 */
export function checkErrorHandling(code: string): RuleResult {
  const issues: Issue[] = [];
  const lines = linesOf(code);

  // 模式 1: JSON.parse 没有 try-catch
  const jsonParseRe = /JSON\.parse\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = jsonParseRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    // 检查该行是否在 try 块内（简单启发式）
    const beforeCode = code.slice(0, match.index);
    const afterCode = code.slice(match.index);
    const tryCount = (beforeCode.match(/\btry\s*\{/g) || []).length;
    const catchCount = (beforeCode.match(/\bcatch\s*\(/g) || []).length;

    if (tryCount <= catchCount) {
      issues.push({
        line: lineNum,
        severity: 'error',
        message: `JSON.parse 未在 try-catch 中调用，可能抛出异常`,
        suggestion: `用 try-catch 包裹 JSON.parse，或使用安全的解析工具函数`,
      });
    }
  }

  // 模式 2: async 函数没有 try-catch
  const asyncFuncWithAwaitRe = /(?:export\s+)?async\s+(?:function\s+(\w+)|\(([^)]*)\)\s*=>)[^{]*\{/g;
  while ((match = asyncFuncWithAwaitRe.exec(code)) !== null) {
    const funcName = match[1] || 'anonymous';
    const lineNum = code.slice(0, match.index).split('\n').length;
    const openBrace = match.index + match[0].length - 1;
    let depth = 1;
    let closeBrace = openBrace + 1;
    for (; closeBrace < code.length && depth > 0; closeBrace++) {
      if (code[closeBrace] === '{') depth++;
      if (code[closeBrace] === '}') depth--;
    }
    const body = code.slice(openBrace + 1, closeBrace - 1);

    if (/\bawait\b/.test(body) && !/\btry\s*\{/.test(body)) {
      issues.push({
        line: lineNum,
        severity: 'warning',
        message: `async 函数 "${funcName}" 包含 await 但没有 try-catch`,
        suggestion: `考虑添加 try-catch 包裹 await 调用，或使用 .catch() 处理`,
      });
    }
  }

  // 模式 3: localStorage 操作没有 try-catch
  const localStorageRe = /localStorage\.(getItem|setItem|removeItem)\s*\(/g;
  while ((match = localStorageRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    const beforeCode = code.slice(0, match.index);
    const tryCount = (beforeCode.match(/\btry\s*\{/g) || []).length;
    const catchCount = (beforeCode.match(/\bcatch\s*\(/g) || []).length;
    if (tryCount <= catchCount) {
      issues.push({
        line: lineNum,
        severity: 'warning',
        message: `localStorage 操作未在 try-catch 中（隐私模式可能抛出异常）`,
        suggestion: `用 try-catch 包裹 localStorage 操作`,
      });
    }
  }

  return { name: 'checkErrorHandling', passed: issues.every((i) => i.severity !== 'error'), issues };
}

/* ==================================================================
 * 规则 7: 硬编码检测
 * ================================================================== */

/**
 * 检测魔法数字和硬编码字符串。
 */
export function checkHardcodedValues(code: string): RuleResult {
  const issues: Issue[] = [];
  const lines = linesOf(code);

  // 跳过注释行和 import 行
  const ignorableRe = /^\s*(\/\/|\*|import |export |from )/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (ignorableRe.test(line)) continue;

    // 模式 1: 魔法数字（排除 0, 1, -1, 2, 100 等常见安全值）
    const magicNumberRe = /(?<![.\w'"`])(\d{3,})(?![.\w])/g;
    let nm: RegExpExecArray | null;
    while ((nm = magicNumberRe.exec(line)) !== null) {
      const value = Number(nm[1]);
      // 排除常见安全值
      if ([100, 1000, 1024, 2048, 4096, 8192, 60, 3600].includes(value)) continue;
      // 排除简单倍数
      if (value % 1000 === 0 && value <= 10000) continue;

      issues.push({
        line: lineNum,
        severity: 'warning',
        message: `魔法数字 ${nm[1]}，应提取为命名常量`,
        suggestion: `将该数值提取为有意义的常量，如 const MAX_RETRIES = ${nm[1]}`,
      });
    }

    // 模式 2: 硬编码颜色值
    const colorRe = /['"]#[0-9a-fA-F]{3,8}['"]/g;
    let cm: RegExpExecArray | null;
    while ((cm = colorRe.exec(line)) !== null) {
      if (!line.includes('const') && !line.includes('COLOR')) {
        issues.push({
          line: lineNum,
          severity: 'warning',
          message: `硬编码颜色值 ${cm[0]}，建议提取为常量`,
          suggestion: `将颜色值定义为常量，如 const PRIMARY_COLOR = ${cm[0]}`,
        });
      }
    }

    // 模式 3: 硬编码的 URL / 文件路径字符串
    const hardcodedPathRe = /['"](?:\/[a-zA-Z][\w/.-]*\/|\\\\[a-zA-Z][\w\\\\.-]*\\)/g;
    let pm: RegExpExecArray | null;
    while ((pm = hardcodedPathRe.exec(line)) !== null) {
      if (!line.includes('import') && !line.includes('require')) {
        issues.push({
          line: lineNum,
          severity: 'warning',
          message: `硬编码路径 ${pm[0]}，建议提取为配置常量`,
          suggestion: `将路径定义为配置常量或环境变量`,
        });
      }
    }
  }

  return { name: 'checkHardcodedValues', passed: issues.every((i) => i.severity !== 'error'), issues };
}

/* ==================================================================
 * 规则 8: 类型断言安全性检查
 * ================================================================== */

/**
 * 检查 as 断言和 ! 非空断言的安全性。
 */
export function checkTypeAssertions(code: string): RuleResult {
  const issues: Issue[] = [];
  const lines = linesOf(code);

  // 模式 1: as any 使用
  const asAnyRe = /\bas\s+any\b/g;
  let match: RegExpExecArray | null;
  while ((match = asAnyRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    issues.push({
      line: lineNum,
      severity: 'error',
      message: `使用了 "as any"，完全绕过类型检查`,
      suggestion: `使用更具体的类型断言或通过类型守卫收窄类型`,
    });
  }

  // 模式 2: as unknown as TargetType 双重断言
  const doubleAssertRe = /\bas\s+unknown\s+as\s+\w+/g;
  while ((match = doubleAssertRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    issues.push({
      line: lineNum,
      severity: 'warning',
      message: `使用了双重类型断言 "as unknown as ..."`,
      suggestion: `考虑使用类型守卫或重构代码以避免双重断言`,
    });
  }

  // 模式 3: 非空断言在 .find() 或可能返回 undefined 的场景
  const findNonNullRe = /\.find\([^)]+\)\s*!/g;
  while ((match = findNonNullRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    issues.push({
      line: lineNum,
      severity: 'error',
      message: `对 .find() 结果使用非空断言，可能隐藏 undefined 风险`,
      suggestion: `将结果赋给变量后做 null 检查`,
    });
  }

  // 模式 4: document.getElementById 后直接加 !
  const getElementByIdRe = /document\.getElementById\([^)]+\)\s*!/g;
  while ((match = getElementByIdRe.exec(code)) !== null) {
    const lineNum = code.slice(0, match.index).split('\n').length;
    issues.push({
      line: lineNum,
      severity: 'warning',
      message: `对 getElementById 结果使用非空断言，元素可能不存在`,
      suggestion: `使用可选链或条件判断检查元素是否存在`,
    });
  }

  return { name: 'checkTypeAssertions', passed: issues.every((i) => i.severity !== 'error'), issues };
}

/* ==================================================================
 * 规则 9: 代码重复检测
 * ================================================================== */

/**
 * 检测相似代码块（>5 行且相似度 > 0.8）。
 * 使用简单的 token 级别 Jaccard 相似度。
 */
export function checkCodeDuplication(code: string): RuleResult {
  const issues: Issue[] = [];
  const lines = linesOf(code);

  // 以 6 行为窗口滑动，跳过空行和注释行较多的窗口
  const MIN_BLOCK_LINES = 6;
  const blocks: { startLine: number; tokens: Set<string> }[] = [];

  for (let i = 0; i <= lines.length - MIN_BLOCK_LINES; i++) {
    const windowLines = lines.slice(i, i + MIN_BLOCK_LINES);
    // 跳过空行/注释行超过一半的窗口
    const nonTrivial = windowLines.filter(
      (l) => l.trim() !== '' && !l.trim().startsWith('//') && !l.trim().startsWith('*'),
    );
    if (nonTrivial.length < 3) continue;

    // 提取 token（去掉空白差异）
    const tokens = new Set(
      windowLines
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/\s+/g, ' ')),
    );
    if (tokens.size >= 3) {
      blocks.push({ startLine: i + 1, tokens });
    }
  }

  // 两两比较
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i];
      const b = blocks[j];

      // Jaccard 相似度
      const intersection = new Set([...a.tokens].filter((t) => b.tokens.has(t)));
      const union = new Set([...a.tokens, ...b.tokens]);
      const similarity = intersection.size / union.size;

      if (similarity > 0.80 && intersection.size >= 3) {
        issues.push({
          line: b.startLine,
          severity: 'warning',
          message: `第 ${a.startLine}-${a.startLine + MIN_BLOCK_LINES - 1} 行与第 ${b.startLine}-${b.startLine + MIN_BLOCK_LINES - 1} 行高度相似 (${Math.round(similarity * 100)}%)`,
          suggestion: `考虑将重复代码提取为共享函数或常量`,
        });
        // 每组只报告一次（后出现的块）
        break; // 每个块只报告最相似的一对
      }
    }
  }

  return { name: 'checkCodeDuplication', passed: true, issues };
}

/* ==================================================================
 * 批量运行所有规则
 * ================================================================== */

export interface AllRulesOptions {
  /** 已知文件列表，用于导入路径检查 */
  knownFiles?: Set<string>;
}

/**
 * 运行全部 9 条规则，返回 RuleResult 数组。
 */
export function runAllRules(code: string, options: AllRulesOptions = {}): RuleResult[] {
  const { knownFiles } = options;
  return [
    checkImportPaths(code, knownFiles),
    checkFunctionSignature(code),
    checkNullSafety(code),
    checkAsyncAwait(code),
    checkResourceCleanup(code),
    checkErrorHandling(code),
    checkHardcodedValues(code),
    checkTypeAssertions(code),
    checkCodeDuplication(code),
  ];
}
