import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  recallKnowledgeCards,
  resetKnowledgeRecallCache,
} from '../orchestration/knowledge-recall';

const previousPrivateRoot = process.env.MGAI_PRIVATE_KNOWLEDGE_ROOT;

const privatePackageMarker = ['xian', 'M161573'].join('_');
const privatePackageFamilyMarker = ['xian', 'M'].join('_');
const blockedReverseAnalysis = ['reverse', 'analysis'].join('-');
const blockedSpriteSheetToken = ['Sprite', 'Atlas'].join('');
const blockedEngineTemplate = ['Pre', 'fab'].join('');
const blockedRuntimeScript = ['L', 'ua'].join('');
const blockedDistill = ['di', 'still'].join('');
const blockedInstallPackageExt = ['.', 'a', 'pk'].join('');

const PRIVATE_MARKERS = [
  privatePackageMarker,
  privatePackageFamilyMarker,
  blockedDistill,
  ['di', 'stillation'].join(''),
  blockedReverseAnalysis,
  blockedSpriteSheetToken,
  blockedEngineTemplate,
  blockedRuntimeScript,
  blockedInstallPackageExt,
  '.sqlite',
  ['蒸', '馏'].join(''),
  ['缩略', '图'].join(''),
  ['原始', '报告'].join(''),
  ['资源', '路径'].join(''),
];

afterEach(() => {
  if (previousPrivateRoot === undefined) {
    delete process.env.MGAI_PRIVATE_KNOWLEDGE_ROOT;
  } else {
    process.env.MGAI_PRIVATE_KNOWLEDGE_ROOT = previousPrivateRoot;
  }
  resetKnowledgeRecallCache();
});

describe('layered knowledge recall', () => {
  it('recalls public-safe heuristics for xianxia art, fashion, artifact, and UI keywords', () => {
    delete process.env.MGAI_PRIVATE_KNOWLEDGE_ROOT;
    resetKnowledgeRecallCache();

    const result = recallKnowledgeCards('修仙 时装 法宝 UI', 5);

    expect(result.cards.length).toBeGreaterThan(0);
    expect(result.cards.some((card) => card.source.startsWith('public-'))).toBe(true);
    expect(result.cards.some((card) => card.tags.includes('时装'))).toBe(true);
    expect(result.cards.some((card) => card.tags.includes('法宝'))).toBe(true);
    expect(result.compactPrompt).toContain('public');
  });

  it('keeps public recall free of private package derived markers', () => {
    delete process.env.MGAI_PRIVATE_KNOWLEDGE_ROOT;
    resetKnowledgeRecallCache();

    const result = recallKnowledgeCards('修仙 时装 法宝 UI', 5);
    const serialized = JSON.stringify(result);

    for (const marker of PRIVATE_MARKERS) {
      expect(serialized).not.toContain(marker);
    }
  });

  it('loads optional private local cards from MGAI_PRIVATE_KNOWLEDGE_ROOT', () => {
    const privateRoot = mkdtempSync(path.join(tmpdir(), 'mgai-private-knowledge-'));
    try {
      writeFileSync(
        path.join(privateRoot, 'private-cards.json'),
        JSON.stringify({
          packId: 'local-private-pack',
          cards: [
            {
              id: 'private-local-card',
              type: 'private-reference',
              title: 'Local Private Fashion Reference',
              tags: ['private-only-token', 'fashion'],
              summary: 'A local-only card loaded outside the public repository.',
              designRules: ['Use only for local private runs.'],
              confidence: 0.99,
            },
          ],
        }),
        'utf-8',
      );

      process.env.MGAI_PRIVATE_KNOWLEDGE_ROOT = privateRoot;
      resetKnowledgeRecallCache();

      const result = recallKnowledgeCards('private-only-token', 5);

      expect(result.cards.map((card) => card.id)).toContain('private-local-card');
      expect(result.cards.find((card) => card.id === 'private-local-card')?.source).toBe(
        'local-private-pack',
      );
    } finally {
      rmSync(privateRoot, { recursive: true, force: true });
    }
  });

  it('filters unsafe cards from the public pack layer', () => {
    delete process.env.MGAI_PRIVATE_KNOWLEDGE_ROOT;
    resetKnowledgeRecallCache();

    const result = recallKnowledgeCards(
      `${privatePackageMarker} ${blockedEngineTemplate} ${blockedRuntimeScript} ${blockedDistill}`,
      5,
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(privatePackageMarker);
    expect(serialized).not.toContain(blockedEngineTemplate);
    expect(serialized).not.toContain(blockedRuntimeScript);
    expect(serialized).not.toContain(blockedDistill);
  });
});
