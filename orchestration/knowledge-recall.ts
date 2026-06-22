/**
 * Knowledge Recall — public-safe knowledge card recall.
 *
 * This module intentionally contains only generic design heuristics authored for
 * this project. Do not embed proprietary APK analysis, private reference
 * data, raw asset paths, or reverse-engineering notes here.
 */

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
}

export interface RecallResult {
  cards: KnowledgeCard[];
  compactPrompt: string;
}

interface KeywordCategory {
  keywords: string[];
  cardIds: string[];
  priority: 'High' | 'Medium' | 'Low';
}

const KEYWORD_CATEGORIES: KeywordCategory[] = [
  {
    keywords: ['修仙', '仙侠', '修真', '放置', '挂机', 'RPG', '刷宝', 'ARPG'],
    cardIds: ['generic-xianxia-001', 'generic-xianxia-002', 'generic-xianxia-003'],
    priority: 'High',
  },
  {
    keywords: ['境界', '突破', '修炼', '渡劫', '飞升', '等级', '天赋'],
    cardIds: ['generic-xianxia-001'],
    priority: 'High',
  },
  {
    keywords: ['UI', '界面', '动效', '特效', '视觉', '美术', '原画', '场景'],
    cardIds: ['generic-xianxia-002', 'generic-xianxia-004'],
    priority: 'High',
  },
  {
    keywords: ['商店', '商城', '付费', '礼包', '战令', '抽卡', '抽奖'],
    cardIds: ['generic-xianxia-003'],
    priority: 'Medium',
  },
  {
    keywords: ['配置', '数值', '奖励', '掉落', '表格'],
    cardIds: ['generic-xianxia-005'],
    priority: 'Medium',
  },
];

const CARD_REGISTRY: KnowledgeCard[] = [
  {
    id: 'generic-xianxia-001',
    type: 'KnowledgeCard',
    source: 'mgai-public-heuristics',
    title: 'Cultivation progression loop',
    tags: ['xianxia', 'progression', 'idle-rpg', 'systems-design'],
    summary:
      'A cultivation idle game benefits from a layered loop: gather resources, cultivate, break through realms, unlock systems, and reset/ascend for long-term growth.',
    applicability: 'Use when planning xianxia, cultivation, idle RPG, or loot-driven progression.',
    designInsights: [
      'Keep the first loop understandable: cultivate, claim reward, upgrade, break through.',
      'Introduce new systems by realm tier rather than all at once.',
      'Separate permanent growth from temporary buffs to keep economy readable.',
    ],
    mgaiUsage:
      'Generate a RealmProgressionSpec with realm tiers, breakthrough costs, failure protection, unlock schedule, and idle reward curve.',
    confidence: 0.8,
  },
  {
    id: 'generic-xianxia-002',
    type: 'KnowledgeCard',
    source: 'mgai-public-heuristics',
    title: 'Mobile RPG UI information architecture',
    tags: ['xianxia', 'ui', 'mobile-game', 'window-system'],
    summary:
      'Large mobile RPGs should split UI into feature windows, shared components, resource displays, feedback effects, and notification states.',
    applicability: 'Use when generating UI architecture for mobile RPG or idle games.',
    designInsights: [
      'Create reusable panels for rewards, inventory items, upgrade rows, and currency bars.',
      'Keep red-dot/notification state as a first-class data model.',
      'Design high-frequency screens for scanning and repeated actions.',
    ],
    mgaiUsage:
      'Generate WindowSpec, SharedComponentSpec, NotificationSpec, and ResourceDisplaySpec for each major feature.',
    confidence: 0.75,
  },
  {
    id: 'generic-xianxia-003',
    type: 'KnowledgeCard',
    source: 'mgai-public-heuristics',
    title: 'Live-ops monetization structure',
    tags: ['liveops', 'monetization', 'battle-pass', 'shop', 'idle-rpg'],
    summary:
      'Monetized idle RPG systems should separate direct purchase, limited bundles, battle pass, event rewards, and cosmetic offers.',
    applicability: 'Use when planning shop, battle pass, cosmetics, or live-ops reward systems.',
    designInsights: [
      'Make ownership state, preview state, price state, and claim state explicit.',
      'Avoid coupling progression power and cosmetic presentation too tightly.',
      'Use event-specific entry points and clear expiration copy.',
    ],
    mgaiUsage:
      'Generate OfferSpec with channel, preview, price display, ownership state, reward reveal, and claim rules.',
    confidence: 0.7,
  },
  {
    id: 'generic-xianxia-004',
    type: 'KnowledgeCard',
    source: 'mgai-public-heuristics',
    title: 'Game-feel and VFX staging',
    tags: ['combat', 'vfx', 'game-feel', 'mobile-game', 'feedback'],
    summary:
      'Combat and reward feedback should be staged into anticipation, action, impact, result, and reward confirmation.',
    applicability: 'Use when generating skill, reward, breakthrough, or upgrade feedback.',
    designInsights: [
      'Keep mobile effects readable and short for repeated actions.',
      'Use stronger effects only for rare milestones, breakthroughs, and premium rewards.',
      'Separate combat feedback from UI reward feedback.',
    ],
    mgaiUsage:
      'Generate FeedbackSpec with anticipation, active, impact, number feedback, sound hook, and duration budget.',
    confidence: 0.7,
  },
  {
    id: 'generic-xianxia-005',
    type: 'KnowledgeCard',
    source: 'mgai-public-heuristics',
    title: 'Scalable config and reward data',
    tags: ['config', 'data-model', 'reward', 'liveops', 'rpg'],
    summary:
      'Long-running RPGs need typed configs, stable IDs, reward tables, and domain-specific partitions to avoid brittle content updates.',
    applicability: 'Use when generating data models and content pipelines.',
    designInsights: [
      'Use stable IDs and typed schemas for every content table.',
      'Partition high-volume content by domain such as realm, reward, item, event, and shop.',
      'Define validation rules before adding authoring tools.',
    ],
    mgaiUsage:
      'Generate ConfigManifest with table names, schema types, ID rules, validation rules, and merge strategy.',
    confidence: 0.75,
  },
];

function extractKeywordCategories(query: string): KeywordCategory[] {
  return KEYWORD_CATEGORIES.filter((cat) =>
    cat.keywords.some((kw) => query.includes(kw)),
  );
}

function scoreCards(
  cardIds: string[],
  matchedCategories: KeywordCategory[],
): KnowledgeCard[] {
  const cardCounts = new Map<string, number>();
  for (const cat of matchedCategories) {
    for (const id of cat.cardIds) {
      cardCounts.set(id, (cardCounts.get(id) ?? 0) + 1);
    }
  }

  const cards = cardIds
    .map((id) => CARD_REGISTRY.find((c) => c.id === id))
    .filter((c): c is KnowledgeCard => c != null);

  return cards.sort((a, b) => {
    const scoreA =
      (cardCounts.get(a.id) ?? 0) * 0.6 + a.confidence * 0.4;
    const scoreB =
      (cardCounts.get(b.id) ?? 0) * 0.6 + b.confidence * 0.4;
    return scoreB - scoreA;
  });
}

function compactCards(cards: KnowledgeCard[]): string {
  if (cards.length === 0) return '';

  const lines: string[] = ['## 参考知识卡 (public-safe generic heuristics)'];
  for (const card of cards) {
    const insightText =
      card.designInsights.length > 0
        ? card.designInsights.slice(0, 2).join('; ')
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

  const matchedCategories = extractKeywordCategories(userQuery);

  if (matchedCategories.length === 0) {
    recallLogger.info('未命中任何关键词类别');
    return { cards: [], compactPrompt: '' };
  }

  const allIds = new Set<string>();
  for (const cat of matchedCategories) {
    for (const id of cat.cardIds) {
      allIds.add(id);
    }
  }

  const scored = scoreCards([...allIds], matchedCategories);
  const top = scored.slice(0, Math.min(maxCards, 5));
  const compactPrompt = compactCards(top);

  recallLogger.info(
    `召回 ${top.length} 张卡片: ${top.map((c) => c.id).join(', ')}`,
  );

  return { cards: top, compactPrompt };
}

export function isXianxiaRelated(query: string): boolean {
  const allKeywords = KEYWORD_CATEGORIES.flatMap((c) => c.keywords);
  return allKeywords.some((kw) => query.includes(kw));
}
