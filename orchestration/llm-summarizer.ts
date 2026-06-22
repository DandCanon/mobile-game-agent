/**
 * LLMSummarizer — 基于 LLMClient 的摘要生成器
 *
 * 职责：
 * 1. 实现 SummaryGenerator 接口
 * 2. 调用 LLMClient.complete() 生成 StepSummary / MetaSummary
 * 3. 低温度（0.1）、短 token 上限，确保摘要紧凑
 *
 * 设计约束：
 * - 零额外依赖，复用 LLMClient
 * - 失败时返回降级摘要（不阻塞主流程）
 */

import type { LLMClient, LLMMessage } from './llm-client';
import type { SummaryGenerator } from './memory-manager';
import type { StepRecord } from '../protocol/agent-protocol';

/* ===================== Prompt 模板 ===================== */

const STEP_SUMMARY_PROMPT = `你是一个开发步骤摘要器。将以下一组步骤记录压缩为 100 字以内的中文摘要。
只输出摘要文本，不要加任何前缀或 Markdown 格式。

要求：
- 只写做了什么和结果如何
- 不写步骤编号和 ID
- 不写耗时和工具名称`;

const META_SUMMARY_PROMPT = `你是一个高层摘要器。将以下多条步骤摘要压缩为 200 字以内的中文元摘要。
只输出摘要文本，不要加任何前缀或 Markdown 格式。

要求：
- 概括整体进展和关键决策
- 提及遇到的阻塞和如何解决的
- 不列举具体步骤编号`;

/* ===================== 降级摘要 ===================== */

/**
 * 当 LLM 不可用时，用规则生成降级摘要。
 * 拼接步骤标题 + 状态，保证 MemoryManager 不因 LLM 故障而中断。
 */
function fallbackStepSummary(steps: StepRecord[]): string {
  const completed = steps.filter((s) => s.status === 'completed').length;
  const failed = steps.filter((s) => s.status === 'failed').length;
  const titles = steps
    .slice(0, 3)
    .map((s) => s.plan.title)
    .join('、');

  const suffix = steps.length > 3 ? `等 ${steps.length} 个步骤` : '';
  const parts: string[] = [`完成了 ${titles}${suffix}`];
  if (completed > 0) parts.push(`${completed} 步成功`);
  if (failed > 0) parts.push(`${failed} 步失败`);

  return parts.join('，') + '。';
}

function fallbackMetaSummary(stepSummaries: string[]): string {
  const count = stepSummaries.length;
  const first = stepSummaries[0]?.slice(0, 80) ?? '无摘要';
  return `最近 ${count} 批步骤摘要：${first}...`;
}

/* ===================== LLMSummarizer ===================== */

export class LLMSummarizer implements SummaryGenerator {
  private client: LLMClient;

  constructor(client: LLMClient) {
    this.client = client;
  }

  async generateStepSummary(steps: StepRecord[]): Promise<string> {
    const stepText = steps
      .map((s) => {
        const status = s.status;
        const errors = s.result?.errors?.map((e) => e.message).join('; ') ?? '';
        const errSuffix = errors ? ` [错误: ${errors}]` : '';
        return `${s.plan.title}(${status})${errSuffix}`;
      })
      .join('\n');

    try {
      const messages: LLMMessage[] = [
        { role: 'system', content: STEP_SUMMARY_PROMPT },
        { role: 'user', content: stepText },
      ];

      const result = await this.client.complete(messages, {
        temperature: 0.1,
        maxTokens: 256,
      });

      const summary = result.content.trim();
      return summary || fallbackStepSummary(steps);
    } catch {
      return fallbackStepSummary(steps);
    }
  }

  async generateMetaSummary(stepSummaries: string[]): Promise<string> {
    const combined = stepSummaries.map((s, i) => `[${i + 1}] ${s}`).join('\n');

    try {
      const messages: LLMMessage[] = [
        { role: 'system', content: META_SUMMARY_PROMPT },
        { role: 'user', content: combined },
      ];

      const result = await this.client.complete(messages, {
        temperature: 0.1,
        maxTokens: 384,
      });

      const summary = result.content.trim();
      return summary || fallbackMetaSummary(stepSummaries);
    } catch {
      return fallbackMetaSummary(stepSummaries);
    }
  }
}
