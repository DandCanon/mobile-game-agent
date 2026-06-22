/**
 * Hybrid Reflector — Rule Based 优先、LLM 兜底的双层代码审查
 *
 * 流程：
 * 1. 先跑 9 条确定性规则 → 收集 issue 列表
 * 2. 零 issue → 跳过 LLM (mode: 'rule-only')
 * 3. 仅有 warning → 返回 issues，跳过 LLM (mode: 'rule-only')
 * 4. 有 error → 调用 LLM 补充审查 (mode: 'hybrid')
 *
 * Token 节省目标：60-90%（大部分代码仅靠规则即可通过）
 */

import {
  type RuleResult,
  type Issue,
  type AllRulesOptions,
  runAllRules,
} from './rules';

/* ===================== 类型定义 ===================== */

export type ReflectMode = 'rule-only' | 'hybrid';

export interface HybridReflectResult {
  /** 是否通过审查 */
  passed: boolean;
  /** 所有 issue（规则 + LLM 合并） */
  issues: Issue[];
  /** 审查模式 */
  mode: ReflectMode;
  /** 本轮的规则检查详情 */
  ruleResults: RuleResult[];
  /** LLM 的补充 issue（仅 hybrid 模式） */
  llmIssues?: Issue[];
  /** 本轮是否跳过了 LLM 调用 */
  llmSkipped: boolean;
  /** 节省的 tokens（估算） */
  tokensSaved: number;
}

export interface HybridReflectStats {
  /** 总审查次数 */
  totalReflections: number;
  /** 纯规则通过次数（跳过 LLM） */
  ruleOnlyCount: number;
  /** hybrid 模式次数（调用了 LLM） */
  hybridCount: number;
  /** 累计 token 节省量（估算） */
  totalTokensSaved: number;
}

export interface HybridReflectorConfig {
  /** LLM 审查回调（接收代码和 issue 列表，返回补充 issue） */
  llmReview?: (code: string, ruleIssues: Issue[]) => Promise<Issue[]>;
  /** 每次 LLM 调用的估算 token 消耗 */
  estimatedLlmTokensPerCall?: number;
}

/** 规则检查产生的 tokens 估算（几乎为 0，因为无网络/无 LLM） */
const RULE_ONLY_TOKEN_COST = 50;

/* ===================== HybridReflector ===================== */

export class HybridReflector {
  private stats: HybridReflectStats = {
    totalReflections: 0,
    ruleOnlyCount: 0,
    hybridCount: 0,
    totalTokensSaved: 0,
  };

  private config: HybridReflectorConfig;

  constructor(config: HybridReflectorConfig = {}) {
    this.config = {
      estimatedLlmTokensPerCall: 2000,
      ...config,
    };
  }

  /**
   * 对代码进行审查。
   */
  async reflect(
    code: string,
    context?: AllRulesOptions,
  ): Promise<HybridReflectResult> {
    this.stats.totalReflections++;

    // 阶段 1: 运行全部确定性规则
    const ruleResults = runAllRules(code, context);
    const allRuleIssues = ruleResults.flatMap((r) => r.issues);
    const hasError = allRuleIssues.some((i) => i.severity === 'error');
    const hasWarning = allRuleIssues.some((i) => i.severity === 'warning');

    // 阶段 2: 决策
    if (!hasError && !hasWarning) {
      // 零 issue → 跳过 LLM
      const saved = this.config.estimatedLlmTokensPerCall! - RULE_ONLY_TOKEN_COST;
      this.stats.ruleOnlyCount++;
      this.stats.totalTokensSaved += Math.max(0, saved);

      return {
        passed: true,
        issues: [],
        mode: 'rule-only',
        ruleResults,
        llmSkipped: true,
        tokensSaved: Math.max(0, saved),
      };
    }

    if (!hasError) {
      // 仅有 warning → 返回，跳过 LLM
      const saved = this.config.estimatedLlmTokensPerCall! - RULE_ONLY_TOKEN_COST;
      this.stats.ruleOnlyCount++;
      this.stats.totalTokensSaved += Math.max(0, saved);

      return {
        passed: true,
        issues: allRuleIssues,
        mode: 'rule-only',
        ruleResults,
        llmSkipped: true,
        tokensSaved: Math.max(0, saved),
      };
    }

    // 存在 error → 调用 LLM 补充审查
    this.stats.hybridCount++;
    // hybrid 模式下 token 不节省（反而增加了）
    this.stats.totalTokensSaved += -RULE_ONLY_TOKEN_COST;

    let llmIssues: Issue[] = [];
    if (this.config.llmReview) {
      try {
        llmIssues = await this.config.llmReview(code, allRuleIssues);
      } catch {
        // LLM 调用失败：降级为仅规则结果
        llmIssues = [];
      }
    }

    // 合并规则 issue 和 LLM issue（去重：相同行+相同消息）
    const mergedIssues = mergeIssues(allRuleIssues, llmIssues);
    const stillHasError = mergedIssues.some((i) => i.severity === 'error');

    return {
      passed: !stillHasError,
      issues: mergedIssues,
      mode: 'hybrid',
      ruleResults,
      llmIssues,
      llmSkipped: false,
      tokensSaved: 0,
    };
  }

  /**
   * 同步版本的 reflect，不调用 LLM（直接返回规则结果）。
   * 用于不需要 LLM 兜底的场景。
   */
  reflectSync(code: string, context?: AllRulesOptions): HybridReflectResult {
    this.stats.totalReflections++;
    const ruleResults = runAllRules(code, context);
    const allRuleIssues = ruleResults.flatMap((r) => r.issues);
    const saved = this.config.estimatedLlmTokensPerCall! - RULE_ONLY_TOKEN_COST;

    this.stats.ruleOnlyCount++;
    this.stats.totalTokensSaved += Math.max(0, saved);

    const hasError = allRuleIssues.some((i) => i.severity === 'error');

    return {
      passed: !hasError,
      issues: allRuleIssues,
      mode: 'rule-only',
      ruleResults,
      llmSkipped: true,
      tokensSaved: Math.max(0, saved),
    };
  }

  /**
   * 获取统计信息。
   */
  getStats(): HybridReflectStats {
    return { ...this.stats };
  }

  /**
   * 重置统计。
   */
  resetStats(): void {
    this.stats = {
      totalReflections: 0,
      ruleOnlyCount: 0,
      hybridCount: 0,
      totalTokensSaved: 0,
    };
  }

  /**
   * 设置 LLM 审查回调。
   */
  setLLMReview(llmReview: (code: string, ruleIssues: Issue[]) => Promise<Issue[]>): void {
    this.config.llmReview = llmReview;
  }
}

/* ===================== 辅助函数 ===================== */

/**
 * 合并两个 issue 列表，按 (line + message) 去重。
 */
function mergeIssues(ruleIssues: Issue[], llmIssues: Issue[]): Issue[] {
  const seen = new Set<string>();
  const result: Issue[] = [];

  for (const issue of ruleIssues) {
    const key = `${issue.line}|${issue.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(issue);
    }
  }

  for (const issue of llmIssues) {
    const key = `${issue.line}|${issue.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(issue);
    }
  }

  return result;
}

// 重新导出规则相关类型，方便外部使用
export { type RuleResult, type Issue, type AllRulesOptions, runAllRules } from './rules';
