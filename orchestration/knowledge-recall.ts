/**
 * Knowledge Recall — public/private knowledge-layer bridge.
 *
 * Public layer:
 * - Loads public-safe heuristic packs from knowledge/public/*.json.
 * - Contains only generalized design principles, schemas, and original examples.
 *
 * Private layer:
 * - Optionally loads local-only cards from MGAI_PRIVATE_KNOWLEDGE_ROOT.
 * - Keep proprietary package notes, runtime memory, and local analysis output
 *   outside Git and outside the repository tree.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Logger } from './logger';

const recallLogger = new Logger('KnowledgeRecall');

export interface KnowledgeCard {
  id: string;
  type: string;
  source: string;
  title: string;
  tags: string[];
  summary: string;
  designInsights: string[];
  mgaiUsage: string;
  confidence: number;
  applicability?: string;
  sourcePolicy?: string;
  schema?: Record<string, unknown>;
}

export interface RecallResult {
  cards: KnowledgeCard[];
  compactPrompt: string;
}

interface PublicKnowledgePack {
  packId?: string;
  sourcePolicy?: string;
  cards?: PublicKnowledgeCard[];
}

interface PublicKnowledgeCard {
  id?: string;
  type?: string;
  title: string;
  tags?: string[];
  summary: string;
  designRules?: string[];
  mgaiUsage?: string;
  applicability?: string;
  confidence?: number;
  sourcePolicy?: string;
  schema?: Record<string, unknown>;
}

const PUBLIC_PACK_DIR = path.join(
  process.env.MGAI_PROJECT_ROOT || process.cwd(),
  'knowledge',
  'public',
);

const XIANXIA_KEYWORDS = [
  '修仙',
  '仙侠',
  '修真',
  '时装',
  '法宝',
  '灵宝',
  'ui',
  'UI',
  '界面',
  '动效',
  '特效',
  '视觉',
  '美术',
  '放置',
  '挂机',
  'rpg',
  'RPG',
];

const blockedPublicTerms = [
  ['a', 'pk'].join(''),
  ['di', 'still'].join(''),
  ['di', 'stillation'].join(''),
  ['reverse', 'analysis'].join('-'),
  ['Sprite', 'Atlas'].join(''),
  ['Pre', 'fab'].join(''),
  ['L', 'ua'].join(''),
];
const androidPackageExt = ['a', 'pk'].join('');

const blockedPublicCjkTerms = [
  ['蒸', '馏'].join(''),
  ['缩略', '图'].join(''),
  ['原始', '报告'].join(''),
  ['资源', '路径'].join(''),
];

const PUBLIC_BLOCKED_TEXT_PATTERNS: RegExp[] = [
  new RegExp(['xian', 'M\\d+'].join('_'), 'i'),
  new RegExp(['xian', 'M'].join('_'), 'i'),
  new RegExp(`\\b[\\w.-]+\\.${androidPackageExt}\\b`, 'i'),
  new RegExp(`\\b(?:${blockedPublicTerms.join('|')})\\b`, 'i'),
  new RegExp(blockedPublicCjkTerms.join('|')),
  /\b[\w.-]+\.(?:png|jpe?g|webp|gif|atlas|prefab|lua|bytes|asset|csv|xlsx)\b/i,
  /\b(?:assets?|resources?|res|prefabs?|textures?|sprites?|lua|tables?)[\\/][\w.-]+/i,
  /\b\d+\s*(?:assets?|resources?|files?|sprites?|prefabs?|lua|tables?|images?)\b/i,
];

let cardCache: KnowledgeCard[] | null = null;

function readJsonFile(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function normalizeCard(
  card: PublicKnowledgeCard,
  fallbackSource: string,
  index: number,
): KnowledgeCard {
  return {
    id: card.id ?? `${fallbackSource}-${index + 1}`,
    type: card.type ?? 'public-art-heuristic',
    source: fallbackSource,
    title: card.title,
    tags: card.tags ?? [],
    summary: card.summary,
    designInsights: card.designRules ?? [],
    mgaiUsage: card.mgaiUsage ?? card.summary,
    confidence: card.confidence ?? 0.7,
    applicability: card.applicability,
    sourcePolicy: card.sourcePolicy,
    schema: card.schema,
  };
}

function isPublicSafeCard(card: KnowledgeCard): boolean {
  const searchable = JSON.stringify(card);
  return !PUBLIC_BLOCKED_TEXT_PATTERNS.some((pattern) => pattern.test(searchable));
}

function loadCardsFromDir(
  dir: string,
  fallbackSource: string,
  options: { publicSafe?: boolean } = {},
): KnowledgeCard[] {
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => path.join(dir, entry.name))
    .sort();

  const cards: KnowledgeCard[] = [];
  for (const filePath of files) {
    try {
      const raw = readJsonFile(filePath);
      const pack = Array.isArray(raw)
        ? { cards: raw as PublicKnowledgeCard[] }
        : (raw as PublicKnowledgePack);
      const packSource = pack.packId ?? fallbackSource;
      const sourcePolicy = pack.sourcePolicy;

      for (const [index, card] of (pack.cards ?? []).entries()) {
        const normalized = {
          ...normalizeCard(card, packSource, index),
          sourcePolicy: card.sourcePolicy ?? sourcePolicy,
        };

        if (options.publicSafe && !isPublicSafeCard(normalized)) {
          recallLogger.warn(`Skipped unsafe public knowledge card: ${normalized.id}`);
          continue;
        }

        cards.push(normalized);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      recallLogger.warn(`知识包加载失败: ${filePath}`, { error: message });
    }
  }

  return cards;
}

function loadAllCards(): KnowledgeCard[] {
  if (cardCache) return cardCache;

  const publicCards = loadCardsFromDir(PUBLIC_PACK_DIR, 'mgai-public-knowledge', {
    publicSafe: true,
  });
  const privateRoot = process.env.MGAI_PRIVATE_KNOWLEDGE_ROOT;
  const privateCards = privateRoot
    ? loadCardsFromDir(privateRoot, 'mgai-private-knowledge')
    : [];

  cardCache = [...publicCards, ...privateCards];
  return cardCache;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,，、。；;:：/\\|()[\]{}"'`]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function scoreCard(card: KnowledgeCard, query: string, queryTokens: string[]): number {
  const haystack = [
    card.title,
    card.summary,
    card.tags.join(' '),
    card.designInsights.join(' '),
    card.applicability ?? '',
    card.mgaiUsage,
  ].join(' ').toLowerCase();

  let score = card.confidence * 0.2;
  for (const token of queryTokens) {
    if (haystack.includes(token)) score += 1;
  }
  for (const tag of card.tags) {
    if (query.includes(tag)) score += 1.5;
  }
  return score;
}

function compactCards(cards: KnowledgeCard[]): string {
  if (cards.length === 0) return '';

  const lines: string[] = ['## 参考知识卡 (public/private layered recall)'];
  for (const card of cards) {
    const insightText =
      card.designInsights.length > 0
        ? card.designInsights.slice(0, 3).join('; ')
        : card.summary;

    lines.push(
      `- [${card.id}] ${card.title}: ${insightText}. mgai用法: ${card.mgaiUsage}`,
    );
  }

  return lines.join('\n');
}

export function recallKnowledgeCards(
  userQuery: string,
  maxCards: number = 5,
): RecallResult {
  recallLogger.info(
    `recallKnowledgeCards 入口: query="${userQuery.substring(0, 60)}..."`,
  );

  const cards = loadAllCards();
  const queryTokens = tokenize(userQuery);
  const scored = cards
    .map((card) => ({ card, score: scoreCard(card, userQuery, queryTokens) }))
    .filter((entry) => entry.score > 0.2)
    .sort((a, b) => b.score - a.score || b.card.confidence - a.card.confidence)
    .slice(0, Math.min(maxCards, 5))
    .map((entry) => entry.card);

  recallLogger.info(
    `召回 ${scored.length} 张卡片: ${scored.map((c) => c.id).join(', ')}`,
  );

  return {
    cards: scored,
    compactPrompt: compactCards(scored),
  };
}

export function isXianxiaRelated(query: string): boolean {
  return XIANXIA_KEYWORDS.some((kw) => query.includes(kw));
}

export function resetKnowledgeRecallCache(): void {
  cardCache = null;
}
