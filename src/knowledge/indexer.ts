/**
 * Knowledge Indexer — T3-M1
 *
 * 职责：
 * 1. 管理 KnowledgeCard 索引（添加/检索/导入导出）
 * 2. 简易 TF-IDF 关键词+标签搜索
 * 3. 按标签 / 来源检索
 *
 * 卡片类型复用 memory-v2/types.ts 中的 KnowledgeCard 定义。
 */

import type { KnowledgeCard } from '../memory-v2/types';

/* ===================== 搜索选项 ===================== */

export interface SearchOptions {
  /** 最大返回结果数（默认 10） */
  maxResults?: number;
  /** 最低相关性阈值（默认 0.05） */
  minScore?: number;
}

/* ===================== 分词工具 ===================== */

/**
 * 简易中文+英文混合分词。
 *   - 连续英文字母/数字作为整体词元
 *   - 单个中文字符作为独立词元
 *   - 长度 ≤1 的无意义词元丢弃
 *   - 全部转为小写
 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let buf = '';

  const flush = () => {
    const t = buf.trim().toLowerCase();
    if (t.length > 1) tokens.push(t);
    else if (t.length === 1 && /[a-z0-9]/.test(t)) tokens.push(t);
    buf = '';
  };

  for (const ch of text) {
    if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
      flush();
      tokens.push(ch.toLowerCase());
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      buf += ch;
    } else {
      flush();
    }
  }
  flush();

  return tokens;
}

/* ===================== KnowledgeIndexer ===================== */

export class KnowledgeIndexer {
  /** 卡片存储：id → card */
  private cards: Map<string, KnowledgeCard> = new Map();

  /* ============ CRUD ============ */

  /** 添加单张知识卡片 */
  addCard(card: KnowledgeCard): void {
    this.cards.set(card.id, card);
  }

  /** 当前卡片数量 */
  get size(): number {
    return this.cards.size;
  }

  /* ============ 搜索 ============ */

  /**
   * 关键词+标签搜索（简易 TF-IDF）。
   *
   * 流程：
   * 1. 对 query 分词
   * 2. 对每张卡片计算 relevanceScore
   * 3. 按分数降序排列，应用 maxResults / minScore 过滤
   */
  search(query: string, options: SearchOptions = {}): KnowledgeCard[] {
    const { maxResults = 10, minScore = 0.05 } = options;

    if (!query || query.trim().length === 0) {
      return this.allCardsByRelevance(maxResults);
    }

    const allCards = Array.from(this.cards.values());
    const scored = allCards.map((card) => ({
      card,
      score: this.relevanceScore(card, query),
    }));

    return scored
      .filter((s) => s.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map((s) => s.card);
  }

  /** 按标签精确检索 */
  getByTag(tag: string): KnowledgeCard[] {
    const normalized = tag.toLowerCase().trim();
    return Array.from(this.cards.values()).filter(
      (c) => c.tags.some((t) => t.toLowerCase().trim() === normalized),
    );
  }

  /** 按来源精确检索 */
  getBySource(source: string): KnowledgeCard[] {
    const normalized = source.toLowerCase().trim();
    return Array.from(this.cards.values()).filter(
      (c) => c.source.toLowerCase() === normalized,
    );
  }

  /* ============ 导入导出 ============ */

  /** 导出全量索引（按 id 排序） */
  exportIndex(): KnowledgeCard[] {
    return Array.from(this.cards.values()).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
  }

  /** 批量导入卡片（已存在的 id 会覆盖） */
  importIndex(cards: KnowledgeCard[]): void {
    for (const card of cards) {
      this.cards.set(card.id, card);
    }
  }

  /* ============ 相关性计算 ============ */

  /**
   * 计算单张卡片与查询的相关性分数（简易 TF-IDF）。
   *
   * 策略：
   *   1. 构建卡片文本：title + summary + tags 拼接
   *   2. 对 query 和卡片文本分别分词
   *   3. 对每个查询词元：
   *      TF  = 该词在卡片文本中出现的次数 / 卡片总词元数
   *      IDF = log(N / 包含该词的卡片数)，N 为总卡片数
   *   4. 标签命中额外加分（每个匹配标签 +0.1）
   *   5. 标题命中额外加分（每个匹配词元 +0.15）
   *
   * @returns [0, 1] 区间的相关性分数
   */
  relevanceScore(card: KnowledgeCard, query: string): number {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return card.relevanceScore;

    // 卡片文本
    const cardText = `${card.title} ${card.summary} ${card.tags.join(' ')}`;
    const cardTokens = tokenize(cardText);

    const totalCards = this.cards.size;
    if (totalCards === 0) return 0;

    let score = 0;
    const uniqueQueryTokens = new Set(queryTokens);

    for (const qt of uniqueQueryTokens) {
      // TF: 词元在卡片中出现的频率
      const tfCount = cardTokens.filter((t) => t === qt).length;
      if (tfCount === 0) continue;
      const tf = tfCount / Math.max(1, cardTokens.length);

      // IDF: 逆文档频率
      let docCount = 0;
      for (const [, c] of this.cards) {
        const cTokens = tokenize(`${c.title} ${c.summary} ${c.tags.join(' ')}`);
        if (cTokens.some((t) => t === qt)) docCount++;
      }
      const idf = Math.log(totalCards / Math.max(1, docCount));

      score += tf * idf;
    }

    // 标签命中加分
    const lowerTags = card.tags.map((t) => t.toLowerCase());
    for (const qt of uniqueQueryTokens) {
      if (lowerTags.some((t) => t === qt || t.includes(qt))) {
        score += 0.1;
      }
    }

    // 标题命中加分
    const titleTokens = tokenize(card.title);
    for (const qt of uniqueQueryTokens) {
      if (titleTokens.some((t) => t === qt)) {
        score += 0.15;
      }
    }

    // 归一化到 [0, 1]
    const normalized = Math.min(1, score / Math.max(1, queryTokens.length));
    return Math.round(normalized * 1000) / 1000;
  }

  /* ============ 内部 ============ */

  /** 按 relevanceScore 降序返回所有卡片 */
  private allCardsByRelevance(maxResults: number): KnowledgeCard[] {
    return Array.from(this.cards.values())
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }
}
