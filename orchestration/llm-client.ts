/**
 * LLMClient — 统一大模型接口
 *
 * 职责：
 * 1. 定义 LLM 调用抽象（complete / completeStream）
 * 2. 封装消息格式、工具定义、流式事件
 * 3. 提供 OpenAI 参考实现
 *
 * 设计约束：
 * - 接口不依赖任何具体 SDK，方便一键切换模型
 * - 工具调用走 function-calling 标准协议
 * - Provider 差异由工厂函数 createLLMClient 统一处理
 */

/* ===================== 通用类型 ===================== */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: LLMToolCall[];
  toolCallId?: string;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON 序列化的参数
  };
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMCompleteOptions {
  tools?: LLMToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  /** 要求返回 JSON 格式（部分 provider 支持 response_format） */
  jsonMode?: boolean;
}

export interface LLMCompleteResult {
  content: string;                                   // 模型文本回复
  toolCalls?: LLMToolCall[];                         // 工具调用请求
  usage?: { promptTokens: number; completionTokens: number };
  finishReason?: 'stop' | 'tool_calls' | 'length';
}

/* ---- 流式事件 ---- */

export type LLMStreamEvent =
  | { type: 'text-delta'; content: string }
  | { type: 'tool-call-delta'; id: string; name?: string; arguments?: string }
  | { type: 'done'; content: string; toolCalls?: LLMToolCall[] }
  | { type: 'error'; error: string };

/* ===================== LLMClient 接口 ===================== */

export interface LLMClient {
  /** 单次完成（非流式） */
  complete(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): Promise<LLMCompleteResult>;

  /** 流式完成 */
  completeStream(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): AsyncIterable<LLMStreamEvent>;

  /** 模型信息 */
  modelInfo(): LLMClientInfo;
}

export interface LLMClientInfo {
  provider: string;
  model: string;
  contextWindow: number;
}

/* ===================== Provider 配置 ===================== */

export type LLMProvider = 'openai' | 'openai-compatible' | 'claude';

export interface LLMProviderConfig {
  provider: LLMProvider;
  model?: string;
  apiKey?: string;
  baseURL?: string;
  /** 请求超时（毫秒），默认 60000 */
  timeoutMs?: number;
}

const DEFAULTS: Record<LLMProvider, { model: string; baseURL: string }> = {
  'openai': {
    model: 'gpt-4o',
    baseURL: 'https://api.openai.com/v1',
  },
  'openai-compatible': {
    model: 'qwen-plus',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  },
  'claude': {
    model: 'claude-sonnet-4-20250514',
    baseURL: 'https://api.anthropic.com/v1',
  },
};

/* ===================== OpenAI 实现 ===================== */

/**
 * OpenAI / OpenAI-compatible 协议客户端。
 * 使用 fetch 直接调 REST API，零 SDK 依赖。
 */
export class OpenAIClient implements LLMClient {
  private readonly provider: LLMProvider;
  private readonly model: string;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly timeoutMs: number;

  constructor(config: LLMProviderConfig) {
    this.provider = config.provider;
    const def = DEFAULTS[config.provider];
    this.model = config.model ?? def.model;
    this.baseURL = config.baseURL ?? def.baseURL;
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY ?? '';
    this.timeoutMs = config.timeoutMs ?? 60_000;
  }

  modelInfo(): LLMClientInfo {
    return {
      provider: this.provider,
      model: this.model,
      contextWindow: this.model.startsWith('gpt-4') ? 128_000 : 32_000,
    };
  }

  async complete(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): Promise<LLMCompleteResult> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: this.serializeMessages(messages),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
    };

    if (options?.tools?.length) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }

    if (options?.jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const res = await this.fetchWithTimeout(
      `${this.baseURL}/chat/completions`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`LLM API error ${res.status}: ${err}`);
    }

    const json = (await res.json()) as {
      choices: Array<{
        message: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: 'function';
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    const choice = json.choices?.[0];
    const toolCalls = choice?.message?.tool_calls?.map(
      (tc): LLMToolCall => ({ id: tc.id, type: 'function', function: tc.function }),
    );

    return {
      content: choice?.message?.content ?? '',
      toolCalls,
      usage: json.usage && {
        promptTokens: json.usage.prompt_tokens,
        completionTokens: json.usage.completion_tokens,
      },
      finishReason: (choice?.finish_reason as LLMCompleteResult['finishReason']) ?? 'stop',
    };
  }

  async *completeStream(
    messages: LLMMessage[],
    options?: LLMCompleteOptions,
  ): AsyncIterable<LLMStreamEvent> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: this.serializeMessages(messages),
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 4096,
      stream: true,
    };

    if (options?.tools?.length) {
      body.tools = options.tools;
      body.tool_choice = 'auto';
    }

    const res = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: { ...this.headers(), Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      yield { type: 'error', error: `LLM API error ${res.status}: ${err}` };
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'Response body is null' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedContent = '';
    let accumulatedToolCalls: Map<number, { id: string; name: string; args: string }> = new Map();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          const toolCalls: LLMToolCall[] = [...accumulatedToolCalls.values()]
            .filter(tc => tc.name)
            .map(tc => ({
              id: tc.id,
              type: 'function' as const,
              function: { name: tc.name, arguments: tc.args },
            }));
          yield { type: 'done', content: accumulatedContent, toolCalls };
          return;
        }

        try {
          const chunk = JSON.parse(data);
          const delta = chunk.choices?.[0]?.delta;

          if (delta?.content) {
            accumulatedContent += delta.content;
            yield { type: 'text-delta', content: delta.content };
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              const prev = accumulatedToolCalls.get(idx) ?? { id: '', name: '', args: '' };
              if (tc.id) prev.id = tc.id;
              if (tc.function?.name) prev.name += tc.function.name;
              if (tc.function?.arguments) prev.args += tc.function.arguments;
              accumulatedToolCalls.set(idx, prev);

              yield {
                type: 'tool-call-delta',
                id: prev.id || tc.id,
                name: tc.function?.name,
                arguments: tc.function?.arguments,
              };
            }
          }
        } catch {
          // 跳过解析失败的 chunk（某些 provider 发送注释行）
        }
      }
    }
  }

  /* ---- 内部辅助 ---- */

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };
    // Anthropic API 需要特定 header
    if (this.provider === 'claude') {
      h['anthropic-version'] = '2023-06-01';
    }
    return h;
  }

  private serializeMessages(messages: LLMMessage[]): unknown[] {
    return messages.map(m => {
      const msg: Record<string, unknown> = {
        role: m.role,
        content: m.content,
      };
      if (m.name) msg.name = m.name;
      if (m.toolCalls) msg.tool_calls = m.toolCalls;
      if (m.toolCallId) msg.tool_call_id = m.toolCallId;
      return msg;
    });
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
  }
}

/* ===================== 工厂函数 ===================== */

export function createLLMClient(config: LLMProviderConfig): LLMClient {
  switch (config.provider) {
    case 'openai':
    case 'openai-compatible':
      return new OpenAIClient(config);
    case 'claude':
      // Claude 使用相同的 OpenAI-compatible API（通过 Anthropic Messages API）
      // 如果基 URL 已经是 openai-compatible 桥接，可直接用 OpenAIClient
      return new OpenAIClient(config);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
