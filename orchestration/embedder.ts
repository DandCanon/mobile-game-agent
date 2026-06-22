/**
 * Embedder — 文本嵌入接口
 *
 * 职责：
 * 1. 定义 Embedder 抽象接口
 * 2. 提供基于 LLMClient 的默认实现（零新依赖，复用已有 OpenAI-compatible 端点）
 * 3. 预留本地模型接口（@xenova/transformers）
 *
 * 设计约束：
 * - 接口与具体后端解耦
 * - 默认维度 384（all-MiniLM-L6-v2 兼容），可配置
 * - 失败返回零向量（不阻塞主流程）
 */

import type { LLMClient, LLMMessage } from './llm-client';
import { LRUCache } from './lru-cache';

/* ===================== 接口 ===================== */

export interface Embedder {
  /** 嵌入单条文本 */
  embed(text: string): Promise<Float32Array>;

  /** 批量嵌入（可覆盖以利用批量 API） */
  embedBatch(texts: string[]): Promise<Float32Array[]>;

  /** 输出维度 */
  readonly dimensions: number;
}

/* ===================== LLM Embedder ===================== */

export interface LLMEmbedderConfig {
  /** embedding 模型名（默认 text-embedding-3-small：1536 维） */
  model?: string;
  /** 批量大小，避免单次请求过大 */
  batchSize?: number;
  /** 嵌入缓存容量 */
  cacheSize?: number;
}

/**
 * 基于 LLMClient 的嵌入器。
 * 调用 OpenAI-compatible embedding 端点获取向量。
 * 内置 LRU 缓存避免重复嵌入。
 */
export class LLMEmbedder implements Embedder {
  readonly dimensions: number;
  private client: LLMClient;
  private model: string;
  private batchSize: number;
  private cache: LRUCache<string, Float32Array>;

  constructor(client: LLMClient, config: LLMEmbedderConfig = {}) {
    this.client = client;
    this.model = config.model ?? 'text-embedding-3-small';
    this.batchSize = config.batchSize ?? 20;
    this.cache = new LRUCache(config.cacheSize ?? 500);

    // 按模型推断维度
    // text-embedding-3-small → 1536, text-embedding-ada-002 → 1536
    // all-MiniLM-L6-v2 → 384
    this.dimensions = config.model?.includes('MiniLM')
      ? 384
      : 1536;
  }

  async embed(text: string): Promise<Float32Array> {
    // 缓存命中
    const cached = this.cache.get(text);
    if (cached) return cached;

    try {
      const messages: LLMMessage[] = [
        { role: 'user', content: text },
      ];

      const result = await this.client.complete(messages, {
        maxTokens: 1, // embedding 不需要生成 token
      });

      // embedding API 走 /v1/embeddings 而非 /v1/chat/completions，
      // 但 LLMClient 的 complete() 走的是 chat 端点。
      // 这里我们需要一个特殊路径：通过 OpenAI-compatible embeddings 端点。
      // 鉴于当前 LLMClient 只支持 chat completions，
      // 我们使用客户端的内部 fetch 能力来调用 embeddings 端点。
      const embedding = await this.callEmbeddingAPI(text);
      if (embedding) {
        this.cache.set(text, embedding);
        return embedding;
      }
    } catch {
      // 降级：零向量
    }

    return new Float32Array(this.dimensions);
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const embeddings = await Promise.all(batch.map((t) => this.embed(t)));
      results.push(...embeddings);
    }
    return results;
  }

  /* ---- 私有：直接调 embedding API ---- */

  private async callEmbeddingAPI(text: string): Promise<Float32Array | null> {
    // 通过 client 的 provider 信息推断 baseURL
    // OpenAIClient 内部存储 baseURL，但接口未暴露。
    // 我们通过反射获取或使用环境变量。
    const baseURL = (this.client as any)?.baseURL
      ?? process.env.OPENAI_BASE_URL
      ?? 'https://api.openai.com';

    const apiKey = (this.client as any)?.apiKey
      ?? process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // 无可用的 API key，跳过
      return null;
    }

    try {
      const url = `${baseURL.replace(/\/+$/, '')}/v1/embeddings`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: text,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!resp.ok) return null;

      const json = await resp.json() as {
        data: Array<{ embedding: number[] }>;
      };

      const vec = json.data?.[0]?.embedding;
      if (!vec || vec.length === 0) return null;

      return new Float32Array(vec);
    } catch {
      return null;
    }
  }
}

/* ===================== 规则嵌入器（降级方案） ===================== */

/**
 * 无 LLM 时的降级嵌入器。
 * 基于规则生成稀疏向量（BM25-like TF 编码），
 * 维度固定为 384，支持退化场景下的 RAG。
 *
 * 分词策略：提取 1-3 字中文 n-gram + 英文单词。
 * 向量化：Unicode 码位取模映射到 384 维。
 */
export class RuleEmbedder implements Embedder {
  readonly dimensions = 384;

  async embed(text: string): Promise<Float32Array> {
    const vec = new Float32Array(this.dimensions);

    // 中文 n-gram（1-3 字）
    for (let i = 0; i < text.length; i++) {
      for (let n = 1; n <= 3 && i + n <= text.length; n++) {
        const gram = text.slice(i, i + n);
        let hash = 0;
        for (let j = 0; j < gram.length; j++) {
          hash = ((hash << 5) - hash) + gram.charCodeAt(j);
          hash |= 0;
        }
        const idx = Math.abs(hash) % this.dimensions;
        vec[idx] += 1;
      }
    }

    // 英文单词
    const words = text.match(/[a-zA-Z]+/g) ?? [];
    for (const w of words) {
      let hash = 0;
      for (let j = 0; j < w.length; j++) {
        hash = ((hash << 5) - hash) + w.charCodeAt(j);
        hash |= 0;
      }
      const idx = Math.abs(hash) % this.dimensions;
      vec[idx] += 1;
    }

    // L2 归一化
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vec[i] /= norm;
      }
    }

    return vec;
  }

  async embedBatch(texts: string[]): Promise<Float32Array[]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }
}
