/**
 * 安全护栏（Safety Guardrails）
 *
 * 在任务入口和代码生成出口插入安全检查链。
 *
 * 架构：
 * - Guardrail 基类：支持注册规则链，逐条评估
 * - InputGuard：用户输入进入 Planner 之前做检查
 *   - 注入检测（prompt injection）
 *   - 越狱检测（jailbreak）
 *   - 超长截断（overflow）
 * - OutputGuard：LLM 输出写入文件之前做检查
 *   - 危险代码模式检测（rm -rf / eval / child_process.exec 等）
 *
 * 每条规则返回 { passed: boolean; reason?: string }
 */

/* ===================== 类型定义 ===================== */

/** 单条规则检查结果 */
export interface GuardResult {
  /** 是否通过检查 */
  passed: boolean;
  /** 未通过时的原因说明 */
  reason?: string;
}

/** 规则函数签名 */
export type GuardRule = (content: string) => GuardResult;

/** 汇总后的检查报告 */
export interface GuardReport {
  /** 是否全部通过 */
  passed: boolean;
  /** 触发的阻断列表 */
  violations: Array<{ ruleName: string; reason: string }>;
  /** 检查耗时（ms） */
  durationMs: number;
}

/* ===================== Guardrail 基类 ===================== */

interface RegisteredRule {
  name: string;
  rule: GuardRule;
}

export class Guardrail {
  private rules: RegisteredRule[] = [];

  /** 注册一条检查规则 */
  register(name: string, rule: GuardRule): this {
    this.rules.push({ name, rule });
    return this;
  }

  /** 注销指定名称的规则 */
  unregister(name: string): void {
    this.rules = this.rules.filter((r) => r.name !== name);
  }

  /** 列出所有已注册规则名称 */
  listRules(): string[] {
    return this.rules.map((r) => r.name);
  }

  /** 遍历规则链，任一未通过即停止并返回 */
  evaluate(content: string): GuardReport {
    const start = Date.now();
    const violations: GuardReport['violations'] = [];

    for (const { name, rule } of this.rules) {
      const result = rule(content);
      if (!result.passed) {
        violations.push({ ruleName: name, reason: result.reason ?? '未指定原因' });
        // 安全优先：任一规则阻断即停止后续检查
        break;
      }
    }

    return {
      passed: violations.length === 0,
      violations,
      durationMs: Date.now() - start,
    };
  }
}

/* ===================== 内置规则工厂 ===================== */

/** ========== Input 规则 ========== */

/**
 * 注入检测：识别试图覆盖系统指令、角色扮演越狱等模式
 */
export function createInjectionRule(): GuardRule {
  const INJECTION_PATTERNS: RegExp[] = [
    /ignore\s+(all\s+)?(previous|above)\s+(instructions?|prompts?|rules?)/i,
    /you\s+are\s+now\s+(DAN|jailbroken|in\s+developer\s+mode)/i,
    /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|another)/i,
    /bypass\s+(the\s+)?(filter|restriction|safety)/i,
    /system\s*:\s*override/i,
    /\[SYSTEM\]/i,
    /<\|im_start\|>/i,
  ];

  return (content: string): GuardResult => {
    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(content)) {
        return { passed: false, reason: `检测到注入模式: ${pattern.source.slice(0, 60)}` };
      }
    }
    return { passed: true };
  };
}

/**
 * 越狱检测：识别试图突破安全护栏的提示词
 */
export function createJailbreakRule(): GuardRule {
  const JAILBREAK_PATTERNS: RegExp[] = [
    /你.*(没有|不受|超越|突破).*(限制|规则|约束|护栏)/,
    /disregard\s+(all\s+)?(safety|security|ethical)/i,
    /act\s+as\s+if\s+you\s+have\s+no\s+(restrictions?|limitations?|rules?)/i,
    /you\s+must\s+(not|never)\s+(refuse|deny|reject)/i,
    /输出.*(system\s*prompt|系统提示|核心规则|原始指令)/,
    /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|rules?)/i,
    /tell\s+me\s+(your\s+)?(system\s+)?(prompt|instructions?)/i,
  ];

  return (content: string): GuardResult => {
    for (const pattern of JAILBREAK_PATTERNS) {
      if (pattern.test(content)) {
        return { passed: false, reason: `检测到越狱尝试: ${pattern.source.slice(0, 60)}` };
      }
    }
    return { passed: true };
  };
}

/**
 * 超长截断：超过指定字符数的输入直接阻断
 */
export function createTruncationRule(maxLength: number = 10000): GuardRule {
  return (content: string): GuardResult => {
    if (content.length > maxLength) {
      return {
        passed: false,
        reason: `输入长度 ${content.length} 超过上限 ${maxLength} 字符`,
      };
    }
    return { passed: true };
  };
}

/** ========== Output 规则 ========== */

/**
 * 危险代码模式检测：识别生成的代码中包含的高危操作
 */
export function createDangerousCodeRule(): GuardRule {
  const DANGEROUS_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\brm\s+-rf\b/, label: '递归强制删除 (rm -rf)' },
    { pattern: /rmdir\s+\/s\s+C:\\Windows|rd\s+\/s\s+C:\\Windows/i, label: '删除系统目录' },
    { pattern: /\bformat\s+[A-Z]:/, label: '格式化磁盘' },
    { pattern: /\beval\s*\(/, label: '动态代码执行 (eval)' },
    { pattern: /\bexec\s*\(/, label: '命令执行 (exec)' },
    { pattern: /\bchild_process\s*\.\s*exec\s*\(/, label: '子进程命令执行' },
    { pattern: /\bchild_process\s*\.\s*spawn\s*\(/, label: '子进程 spawn' },
    { pattern: /os\s*\.\s*system\s*\(/, label: '系统命令调用 (os.system)' },
    { pattern: /subprocess\s*\.\s*call\s*\(/, label: '子进程调用' },
    { pattern: /\bimport\s+os\b.*\bos\.remove\b/s, label: '文件删除 (os.remove 与 os 引用同现)' },
    { pattern: /\bdel\s+\/f\s+\/s\b/i, label: 'Windows 强制删除 (del /f /s)' },
    { pattern: /fs\s*\.\s*rmdirSync\s*\(/, label: '同步递归删除目录' },
    { pattern: /fs\s*\.\s*unlinkSync\s*\(/, label: '同步删除文件' },
    { pattern: /\bchmod\s+777\b/, label: '权限全开 (chmod 777)' },
    { pattern: /require\s*\(\s*['"]child_process['"]\s*\)/, label: '引入 child_process 模块' },
  ];

  return (content: string): GuardResult => {
    for (const { pattern, label } of DANGEROUS_PATTERNS) {
      if (pattern.test(content)) {
        return { passed: false, reason: `危险代码模式: ${label}` };
      }
    }
    return { passed: true };
  };
}

/**
 * 敏感文件路径检测：防止生成代码写入系统关键路径
 */
export function createSensitivePathRule(): GuardRule {
  const SENSITIVE_PATHS: RegExp[] = [
    /C:\\Windows\\/i,
    /C:\\Program\s+Files\\/i,
    /C:\\ProgramData\\/i,
    /\/etc\/(passwd|shadow|sudoers)/,
    /\/System\/Library\//,
    /~\/\.ssh\//,
    /~\/\.aws\//,
    /~\/\.kube\//,
  ];

  return (content: string): GuardResult => {
    for (const pattern of SENSITIVE_PATHS) {
      if (pattern.test(content)) {
        return { passed: false, reason: `敏感文件路径: ${pattern.source}` };
      }
    }
    return { passed: true };
  };
}

/* ===================== 预设 Guard 实例 ===================== */

/**
 * 创建标准 InputGuard 实例（含注入/越狱/截断检测）
 */
export function createInputGuard(maxLength: number = 10000): Guardrail {
  return new Guardrail()
    .register('injection', createInjectionRule())
    .register('jailbreak', createJailbreakRule())
    .register('truncation', createTruncationRule(maxLength));
}

/**
 * 创建标准 OutputGuard 实例（含危险代码/敏感路径检测）
 */
export function createOutputGuard(): Guardrail {
  return new Guardrail()
    .register('dangerous-code', createDangerousCodeRule())
    .register('sensitive-path', createSensitivePathRule());
}

/* ===================== 便捷函数 ===================== */

/**
 * 快速输入检查（不保留 Guard 实例）
 */
export function checkInput(
  content: string,
  maxLength: number = 10000,
): GuardReport {
  return createInputGuard(maxLength).evaluate(content);
}

/**
 * 快速输出检查（不保留 Guard 实例）
 */
export function checkOutput(content: string): GuardReport {
  return createOutputGuard().evaluate(content);
}
