/* ===================================================================
 * IdleEngine — 放置类游戏纯逻辑引擎
 *
 * 设计原则：
 *  - 所有函数为纯函数，接收 state 返回新 state
 *  - 不依赖任何 UI 框架或浏览器 API
 *  - 状态结构扁平化，便于序列化/反序列化
 * =================================================================== */

/* ==================== 类型定义 ==================== */

export interface IdleResources {
  gold: number;
  diamonds: number;
}

export interface IdleStats {
  totalClicks: number;
  totalGoldEarned: number;
  totalUpgradesPurchased: number;
  maxOfflineEarnings: number;
}

export interface IdleState {
  resources: IdleResources;
  upgrades: Record<string, number>;
  milestones: string[];
  stats: IdleStats;
  lastTickTime: number;
}

export type UpgradeCategory = 'click_power' | 'auto_production' | 'offline_multiplier';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  category: UpgradeCategory;
  effectValue: number;
}

export interface MilestoneDef {
  id: string;
  name: string;
  description: string;
  check: (state: IdleState) => boolean;
}

export interface BuyUpgradeResult {
  state: IdleState;
  success: boolean;
  message?: string;
}

/* ==================== 升级项定义 ==================== */

/** 点击力：Lv1-10，每级增加点击收益，成本指数增长 */
const clickPowerUpgrades: UpgradeDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: 'click_power_' + (i + 1),
  name: '点击力 Lv' + (i + 1),
  description: '每次点击额外获得金币',
  baseCost: Math.floor(10 * Math.pow(1.5, i)),
  costMultiplier: 1,
  maxLevel: 1,
  category: 'click_power' as const,
  effectValue: (i + 1) * 2,
}));

/** 自动产量：Lv1-10，每级增加每秒产出，成本指数增长 */
const autoProdUpgrades: UpgradeDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: 'auto_prod_' + (i + 1),
  name: '自动产量 Lv' + (i + 1),
  description: '每秒自动获得金币',
  baseCost: Math.floor(25 * Math.pow(1.6, i)),
  costMultiplier: 1,
  maxLevel: 1,
  category: 'auto_production' as const,
  effectValue: (i + 1) * 1,
}));

/** 离线倍率：Lv1-5，每级增加 0.1x 离线收益，成本指数增长 */
const offlineMultiplierUpgrades: UpgradeDef[] = Array.from({ length: 5 }, (_, i) => ({
  id: 'offline_mult_' + (i + 1),
  name: '离线倍率 Lv' + (i + 1),
  description: '离线收益倍率提升',
  baseCost: Math.floor(50 * Math.pow(2.0, i)),
  costMultiplier: 1,
  maxLevel: 1,
  category: 'offline_multiplier' as const,
  effectValue: 0.1,
}));

export const UPGRADE_DEFS: UpgradeDef[] = [
  ...clickPowerUpgrades,
  ...autoProdUpgrades,
  ...offlineMultiplierUpgrades,
];

/* ==================== 里程碑定义 ==================== */

export const MILESTONE_DEFS: MilestoneDef[] = [
  {
    id: 'first_100_gold',
    name: '初获财富',
    description: '首次达到 100 金币',
    check: (s: IdleState) => s.resources.gold >= 100,
  },
  {
    id: 'cumulative_1000_clicks',
    name: '勤勉修炼',
    description: '累计点击 1000 次',
    check: (s: IdleState) => s.stats.totalClicks >= 1000,
  },
  {
    id: 'unlock_3_upgrades',
    name: '初窥门径',
    description: '解锁 3 个升级项',
    check: (s: IdleState) => s.stats.totalUpgradesPurchased >= 3,
  },
  {
    id: 'offline_earnings_1000',
    name: '离线富翁',
    description: '单次离线收益超过 1000 金币',
    check: (s: IdleState) => s.stats.maxOfflineEarnings >= 1000,
  },
];

/* ==================== 基础常量 ==================== */

const BASE_CLICK_GOLD = 1;
const BASE_OFFLINE_MULTIPLIER = 0.5;
const MAX_OFFLINE_HOURS = 24;

/* ==================== 引擎函数 ==================== */

/** 创建默认初始状态 */
export function createInitialState(): IdleState {
  const upgrades: Record<string, number> = {};
  for (const def of UPGRADE_DEFS) {
    upgrades[def.id] = 0;
  }
  return {
    resources: { gold: 0, diamonds: 0 },
    upgrades,
    milestones: [],
    stats: {
      totalClicks: 0,
      totalGoldEarned: 0,
      totalUpgradesPurchased: 0,
      maxOfflineEarnings: 0,
    },
    lastTickTime: Date.now(),
  };
}

/** 计算点击收益（基础值 + 所有已解锁点击力升级的加成） */
export function getClickValue(state: IdleState): number {
  let value = BASE_CLICK_GOLD;
  for (const def of UPGRADE_DEFS) {
    if (def.category === 'click_power' && state.upgrades[def.id] > 0) {
      value += def.effectValue;
    }
  }
  return value;
}

/** 计算每秒自动收益 */
export function getAutoProductionPerSec(state: IdleState): number {
  let value = 0;
  for (const def of UPGRADE_DEFS) {
    if (def.category === 'auto_production' && state.upgrades[def.id] > 0) {
      value += def.effectValue;
    }
  }
  return value;
}

/** 计算离线收益倍率 */
export function getOfflineMultiplier(state: IdleState): number {
  let multiplier = BASE_OFFLINE_MULTIPLIER;
  for (const def of UPGRADE_DEFS) {
    if (def.category === 'offline_multiplier' && state.upgrades[def.id] > 0) {
      multiplier += def.effectValue;
    }
  }
  return Math.min(multiplier, 1.0);
}

/** 执行一次点击 */
export function click(state: IdleState): IdleState {
  const clickValue = getClickValue(state);
  const next: IdleState = {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold + clickValue,
    },
    stats: {
      ...state.stats,
      totalClicks: state.stats.totalClicks + 1,
      totalGoldEarned: state.stats.totalGoldEarned + clickValue,
    },
  };
  return applyMilestones(next);
}

/** 购买升级项 */
export function buyUpgrade(state: IdleState, upgradeId: string): BuyUpgradeResult {
  const def = UPGRADE_DEFS.find((d) => d.id === upgradeId);
  if (!def) {
    return { state, success: false, message: '未知升级项: ' + upgradeId };
  }

  const currentLevel = state.upgrades[upgradeId] ?? 0;
  if (currentLevel >= def.maxLevel) {
    return { state, success: false, message: def.name + ' 已达最大等级' };
  }

  if (state.resources.gold < def.baseCost) {
    return { state, success: false, message: '金币不足 (需要 ' + def.baseCost + ')' };
  }

  const next: IdleState = {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold - def.baseCost,
    },
    upgrades: {
      ...state.upgrades,
      [upgradeId]: currentLevel + 1,
    },
    stats: {
      ...state.stats,
      totalUpgradesPurchased: state.stats.totalUpgradesPurchased + 1,
    },
  };

  return { state: applyMilestones(next), success: true };
}

/** 时间推进（用于游戏循环 tick） */
export function tick(state: IdleState, deltaMs: number): IdleState {
  if (deltaMs <= 0) return state;

  const seconds = deltaMs / 1000;
  const autoGold = Math.floor(getAutoProductionPerSec(state) * seconds);
  if (autoGold <= 0) {
    return { ...state, lastTickTime: state.lastTickTime + deltaMs };
  }

  const next: IdleState = {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold + autoGold,
    },
    stats: {
      ...state.stats,
      totalGoldEarned: state.stats.totalGoldEarned + autoGold,
    },
    lastTickTime: state.lastTickTime + deltaMs,
  };
  return applyMilestones(next);
}

/** 计算离线收益（不修改状态） */
export function calculateOfflineEarnings(state: IdleState, awayMs: number): number {
  if (awayMs <= 0) return 0;

  const maxAwayMs = MAX_OFFLINE_HOURS * 3600 * 1000;
  const cappedMs = Math.min(awayMs, maxAwayMs);
  const seconds = cappedMs / 1000;
  const multiplier = getOfflineMultiplier(state);

  return Math.floor(getAutoProductionPerSec(state) * seconds * multiplier);
}

/** 检查当前未解锁的里程碑 */
export function checkMilestones(state: IdleState): string[] {
  return MILESTONE_DEFS
    .filter((m) => !state.milestones.includes(m.id) && m.check(state))
    .map((m) => m.id);
}

/** 应用里程碑检测 */
function applyMilestones(state: IdleState): IdleState {
  const newIds = checkMilestones(state);
  if (newIds.length === 0) return state;

  const updatedStats = { ...state.stats };

  return {
    ...state,
    milestones: [...state.milestones, ...newIds],
    stats: updatedStats,
  };
}

/** 查找里程碑定义 */
export function findMilestoneDef(id: string): MilestoneDef | undefined {
  return MILESTONE_DEFS.find((m) => m.id === id);
}

/** 查找升级项定义 */
export function findUpgradeDef(id: string): UpgradeDef | undefined {
  return UPGRADE_DEFS.find((d) => d.id === id);
}

/** 获取已解锁升级项列表 */
export function getUnlockedUpgrades(state: IdleState): UpgradeDef[] {
  return UPGRADE_DEFS.filter((d) => state.upgrades[d.id] > 0);
}

/** 计算升级项的下一个成本（已满级返回 -1） */
export function getNextUpgradeCost(state: IdleState, upgradeId: string): number {
  const def = UPGRADE_DEFS.find((d) => d.id === upgradeId);
  if (!def) return -1;

  const currentLevel = state.upgrades[upgradeId] ?? 0;
  if (currentLevel >= def.maxLevel) return -1;

  return def.baseCost;
}
