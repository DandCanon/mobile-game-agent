/**
 * 技术选型决策引擎
 *
 * 根据项目特征（游戏类型、团队规模、热更需求等）
 * 输出推荐技术栈及排名，供 Planner 在步骤规划前调用。
 *
 * 设计原则：
 * - 规则引擎保证下限（可解释、可预测）
 * - LLM 推理保证上限（处理规则覆盖不到的边缘情况）
 * - 所有权重可调，不硬编码
 */

import type {
  TechSelectionInput,
  TechSelectionOutput,
  TechMatrixEntry,
  TechStack,
} from '../protocol/agent-protocol';
import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ===================== JSON 数据源路径 ===================== */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ENGINE_MATRIX_JSON_PATH = path.resolve(
  __dirname,
  '..',
  'public',
  'data',
  'engine-matrix.json',
);

/* ===================== 硬编码降级数据 ===================== */

/** 当 JSON 文件缺失或解析失败时使用的内联降级矩阵 */
const FALLBACK_TECH_MATRIX: TechMatrixEntry[] = [
  {
    engine: 'react-vite-tailwind',
    displayName: 'React + Vite + Tailwind CSS',
    dimensions: {
      gameTypeFit: '放置/卡牌/休闲/文字冒险/轻度策略',
      bundleSize: 5,
      hotUpdate: 10,
      crossPlatform: 8,
      performance: 5,
      learningCurve: 9,
      aiGeneration: 10,
      ecosystemSize: 10,
      teamSizeFit: '1-3人',
      apkPackaging: 'Capacitor/Cordova',
    },
    tags: ['轻量', '热更新', '前端友好', '快速迭代'],
  },
  {
    engine: 'godot',
    displayName: 'Godot 4.x',
    dimensions: {
      gameTypeFit: '2D通用/2.5D/轻3D/像素/平台跳跃',
      bundleSize: 25,
      hotUpdate: 4,
      crossPlatform: 9,
      performance: 8,
      learningCurve: 6,
      aiGeneration: 7,
      ecosystemSize: 6,
      teamSizeFit: '1-5人',
      apkPackaging: '原生导出',
    },
    tags: ['开源', '2D优先', '轻量引擎', '跨平台'],
  },
  {
    engine: 'unity',
    displayName: 'Unity',
    dimensions: {
      gameTypeFit: '3D/重度/动作/射击/开放世界',
      bundleSize: 50,
      hotUpdate: 4,
      crossPlatform: 10,
      performance: 10,
      learningCurve: 3,
      aiGeneration: 5,
      ecosystemSize: 10,
      teamSizeFit: '3-20人',
      apkPackaging: '原生导出',
    },
    tags: ['3D', '重度游戏', '企业级', '最成熟'],
  },
];

interface DimensionWeight {
  key: string;
  weight: number;
  higherIsBetter: boolean;
}

const FALLBACK_WEIGHTS: DimensionWeight[] = [
  { key: 'gameTypeFitWeight', weight: 25, higherIsBetter: true },
  { key: 'bundleSize', weight: 8, higherIsBetter: false },
  { key: 'hotUpdate', weight: 12, higherIsBetter: true },
  { key: 'crossPlatform', weight: 5, higherIsBetter: true },
  { key: 'performance', weight: 10, higherIsBetter: true },
  { key: 'learningCurve', weight: 10, higherIsBetter: true },
  { key: 'aiGeneration', weight: 15, higherIsBetter: true },
  { key: 'ecosystemSize', weight: 8, higherIsBetter: true },
  { key: 'teamSizeFitScore', weight: 7, higherIsBetter: true },
];

const FALLBACK_GAME_TYPE_MAP: Record<string, Record<string, number>> = {
  idle: { 'react-vite-tailwind': 10, godot: 5, unity: 3 },
  card: { 'react-vite-tailwind': 9, godot: 6, unity: 5 },
  casual: { 'react-vite-tailwind': 8, godot: 7, unity: 5 },
  'text-adventure': { 'react-vite-tailwind': 10, godot: 4, unity: 2 },
  roguelike: { 'react-vite-tailwind': 5, godot: 9, unity: 7 },
  platformer: { 'react-vite-tailwind': 4, godot: 10, unity: 8 },
  '2d-game': { 'react-vite-tailwind': 4, godot: 10, unity: 7 },
  '2d-platformer': { 'react-vite-tailwind': 3, godot: 10, unity: 8 },
  '3d-game': { 'react-vite-tailwind': 1, godot: 7, unity: 10 },
  action: { 'react-vite-tailwind': 2, godot: 7, unity: 10 },
  shooter: { 'react-vite-tailwind': 1, godot: 6, unity: 10 },
  rpg: { 'react-vite-tailwind': 3, godot: 8, unity: 9 },
};

/* ===================== 数据加载 ===================== */

interface EngineMatrixData {
  version: string;
  matrix: TechMatrixEntry[];
  weights: DimensionWeight[];
  gameTypeMap: Record<string, Record<string, number>>;
}

let cachedMatrixData: EngineMatrixData | null = null;

function loadEngineMatrixData(): EngineMatrixData {
  if (cachedMatrixData) return cachedMatrixData;

  try {
    if (!existsSync(ENGINE_MATRIX_JSON_PATH)) {
      console.warn(
        `[tech-selector] JSON 矩阵文件缺失: ${ENGINE_MATRIX_JSON_PATH}，使用硬编码降级数据`,
      );
      return buildFallbackData();
    }

    const raw = readFileSync(ENGINE_MATRIX_JSON_PATH, 'utf-8');
    const parsed = JSON.parse(raw);

    // 校验关键字段存在性
    if (!Array.isArray(parsed.matrix) || parsed.matrix.length === 0) {
      throw new Error('matrix 字段缺失或为空');
    }
    if (!Array.isArray(parsed.weights) || parsed.weights.length === 0) {
      throw new Error('weights 字段缺失或为空');
    }
    if (!parsed.gameTypeMap || typeof parsed.gameTypeMap !== 'object') {
      throw new Error('gameTypeMap 字段缺失或格式错误');
    }

    cachedMatrixData = {
      version: parsed.version ?? 'unknown',
      matrix: parsed.matrix as TechMatrixEntry[],
      weights: parsed.weights as DimensionWeight[],
      gameTypeMap: parsed.gameTypeMap as Record<string, Record<string, number>>,
    };

    return cachedMatrixData;
  } catch (err) {
    console.warn(
      `[tech-selector] JSON 矩阵加载失败: ${String(err)}，使用硬编码降级数据`,
    );
    return buildFallbackData();
  }
}

function buildFallbackData(): EngineMatrixData {
  return {
    version: 'fallback',
    matrix: FALLBACK_TECH_MATRIX,
    weights: FALLBACK_WEIGHTS,
    gameTypeMap: FALLBACK_GAME_TYPE_MAP,
  };
}

/**
 * 获取当前使用的矩阵数据（导出供测试/诊断使用）
 */
export function getEngineMatrixData(): EngineMatrixData {
  return loadEngineMatrixData();
}

/**
 * 重置缓存（测试用）
 */
export function resetMatrixCache(): void {
  cachedMatrixData = null;
}

/* ===================== 延迟加载 ===================== */

const getTECH_MATRIX = (): TechMatrixEntry[] => loadEngineMatrixData().matrix;
const getDEFAULT_WEIGHTS = (): DimensionWeight[] => loadEngineMatrixData().weights;
const getGAME_TYPE_MAP = (): Record<string, Record<string, number>> => loadEngineMatrixData().gameTypeMap;

/* ===================== 决策引擎 ===================== */

/**
 * 根据输入输出推荐技术栈。
 * 当前为规则引擎版本，未来可接入 LLM 做增强推理。
 */
export function selectTechStack(input: TechSelectionInput): TechSelectionOutput {
  const matrix = getTECH_MATRIX();
  const gameTypeMap = getGAME_TYPE_MAP();
  const scores: Record<string, number> = {};

  for (const entry of matrix) {
    let score = 0;

    // 1. 游戏类型适配（最高权重）
    const typeKey = normalizeGameType(input.gameType);
    const typeScore = gameTypeMap[typeKey]?.[entry.engine] ?? 5;
    score += typeScore * 2.5; // 类型适配加权

    // 2. 热更新需求
    if (input.needHotUpdate) {
      score += (entry.dimensions.hotUpdate as number) * 1.2;
    }

    // 3. 性能需求
    const perfMap = { low: 0.5, medium: 1.0, high: 2.0 };
    const perfWeight = perfMap[input.performanceLevel];
    score += (entry.dimensions.performance as number) * perfWeight;

    // 4. 团队规模
    const teamFit = entry.dimensions.teamSizeFit as string;
    const [minTeam, maxTeam] = parseTeamSize(teamFit);
    if (input.teamSize >= minTeam && input.teamSize <= maxTeam) {
      score += 7;
    } else if (input.teamSize < minTeam) {
      score += 3; // 引擎对更小团队偏重
    }

    // 5. 学习曲线（团队越小越重要）
    if (input.teamSize <= 2) {
      score += (entry.dimensions.learningCurve as number) * 1.5;
    } else {
      score += (entry.dimensions.learningCurve as number) * 0.8;
    }

    // 6. AI 生成友好度（始终重要）
    score += (entry.dimensions.aiGeneration as number) * 1.5;

    // 7. 开发者背景加成
    if (input.developerExperience) {
      if (
        entry.engine === 'react-vite-tailwind' &&
        /javascript|typescript|react|vue|前端|web|html/i.test(input.developerExperience)
      ) {
        score += 12;
      }
      if (
        entry.engine === 'godot' &&
        /python|gdscript|c#|游戏引擎/i.test(input.developerExperience)
      ) {
        score += 10;
      }
      if (
        entry.engine === 'unity' &&
        /c#|unity|游戏引擎|3d/i.test(input.developerExperience)
      ) {
        score += 12;
      }
    }

    scores[entry.engine] = Math.round(score * 100) / 100;
  }

  // 排名
  const ranking = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .map(([engine, score]) => ({
      engine: engine as TechStack['engine'],
      score,
    }));

  const top = matrix.find((e) => e.engine === ranking[0].engine)!;

  // 生成推荐
  const recommendation: TechStack = {
    engine: ranking[0].engine as TechStack['engine'],
    reason: buildReason(input, top, ranking),
    alternatives: ranking.slice(1).map((r) => r.engine as TechStack['engine']),
    pros: top.tags,
    cons: buildCons(ranking[0].engine as TechStack['engine'], input),
  };

  return {
    recommendation,
    matrix: matrix.map((e) => ({
      engine: e.displayName,
      ...e.dimensions,
      score: scores[e.engine],
    })),
    ranking,
    caveats: buildCaveats(input),
  };
}

/* ===================== 辅助函数 ===================== */

function normalizeGameType(input: string): string {
  const lower = input.toLowerCase();
  const map: Record<string, string> = {
    '放置': 'idle', 'idle': 'idle', '挂机': 'idle', 'clicker': 'idle',
    '卡牌': 'card', 'card': 'card', '抽卡': 'card', 'tcg': 'card',
    '休闲': 'casual', 'casual': 'casual',
    '文字冒险': 'text-adventure', 'visual novel': 'text-adventure', 'avg': 'text-adventure',
    '肉鸽': 'roguelike', 'roguelike': 'roguelike', 'rogue': 'roguelike',
    '平台跳跃': 'platformer', 'platformer': 'platformer',
    '动作': 'action', 'action': 'action',
    '射击': 'shooter', 'shooter': 'shooter', 'fps': 'shooter',
    'rpg': 'rpg', '角色扮演': 'rpg',
    '2d游戏': '2d-game', '2d game': '2d-game', '2d': '2d-game',
    '3d游戏': '3d-game', '3d game': '3d-game', '3d': '3d-game',
    '2d平台': '2d-platformer', '2d platformer': '2d-platformer',
  };
  return map[lower] ?? lower;
}

function parseTeamSize(fit: string): [number, number] {
  const match = fit.match(/(\d+)-(\d+)/);
  if (match) return [Number(match[1]), Number(match[2])];
  return [1, 3];
}

function buildReason(
  input: TechSelectionInput,
  top: TechMatrixEntry,
  ranking: { engine: string; score: number }[],
): string {
  const gap = ranking.length > 1 ? Math.round(ranking[0].score - ranking[1].score) : 0;

  let reason = `基于你的项目特征——${input.gameType}类手游、${input.teamSize}人团队`;
  if (input.needHotUpdate) reason += '、需要热更新';
  reason += `——首选推荐 **${top.displayName}**`;

  if (gap > 10) {
    reason += `（领先第二名 ${gap} 分）。`;
  } else {
    reason += `（与第二名差距仅 ${gap} 分，可视具体情况调整）。`;
  }

  reason += ` 核心优势：${top.tags.join('、')}。`;
  return reason;
}

function buildCons(engine: TechStack['engine'], input: TechSelectionInput): string[] {
  const cons: Record<string, string[]> = {
    'react-vite-tailwind': ['性能受 WebView 限制，不适合重度 3D', '原生功能需通过插件桥接'],
    godot: ['热更新需自建方案', '3D 渲染不如 Unity 成熟', '社区资源总量仍小于 Unity'],
    unity: ['包体较大（50MB+）', '学习曲线陡峭', 'AI 代码生成质量相对较低'],
  };

  const base = cons[engine] ?? [];
  // 根据用户场景过滤
  if (input.performanceLevel === 'high' && engine === 'react-vite-tailwind') {
    base.unshift('⚠️ 你的性能需求较高，WebView 可能成为瓶颈');
  }
  return base;
}

function buildCaveats(input: TechSelectionInput): string[] {
  const caveats: string[] = [];
  if (input.performanceLevel === 'high' && input.gameType.toLowerCase().includes('放置')) {
    caveats.push('放置类游戏通常不需要高性能引擎，建议重新评估性能需求等级');
  }
  if (input.teamSize > 10 && input.budget === 'zero') {
    caveats.push('10 人以上团队建议配置一定预算用于引擎授权和云服务');
  }
  return caveats;
}

/* ===================== 便捷别名 ===================== */

import type { Context } from '../protocol/agent-protocol';

/**
 * 简化的技术选型入口：从游戏类型和上下文中直接推断。
 * 供 Gateway 等上层调用，无需构造完整的 TechSelectionInput。
 */
export function selectTech(
  gameType: string,
  context: Context,
): { recommended: string; reason: string; scores: Record<string, number> } {
  const input: TechSelectionInput = {
    gameType,
    teamSize: context.preferences.teamSize ?? 1,
    needHotUpdate: true,
    performanceLevel: 'low',
    targetPlatforms: ['Android', 'iOS', 'Web'],
    budget: 'zero',
    developerExperience: context.preferences.developerExperience ?? 'web',
  };

  const output = selectTechStack(input);
  return {
    recommended: output.recommendation.engine,
    reason: output.recommendation.reason,
    scores: Object.fromEntries(output.ranking.map((r) => [r.engine, r.score])),
  };
}
