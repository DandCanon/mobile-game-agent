import type { GameState, Upgrade, OfflineEarnings, Achievement } from './types';

/* ===================== 常量 ===================== */

const INITIAL_UPGRADES: Upgrade[] = [
  {
    id: 'click_1',
    name: '点击强化',
    description: '每次点击获得更多金币',
    level: 0,
    maxLevel: 100,
    baseCost: 10,
    costMultiplier: 1.15,
    clickBonus: 1,
    category: 'click_power',
  },
  {
    id: 'click_2',
    name: '双击连击',
    description: '大幅提升点击收益',
    level: 0,
    maxLevel: 80,
    baseCost: 100,
    costMultiplier: 1.25,
    clickBonus: 5,
    category: 'click_power',
  },
  {
    id: 'auto_1',
    name: '自动矿工',
    description: '每秒自动产出金币',
    level: 0,
    maxLevel: 100,
    baseCost: 15,
    costMultiplier: 1.12,
    incomePerSec: 0.5,
    category: 'auto_income',
  },
  {
    id: 'auto_2',
    name: '炼金工坊',
    description: '大幅提升自动产量',
    level: 0,
    maxLevel: 80,
    baseCost: 150,
    costMultiplier: 1.22,
    incomePerSec: 3,
    category: 'auto_income',
  },
  {
    id: 'auto_3',
    name: '金矿脉',
    description: '开启深层矿脉',
    level: 0,
    maxLevel: 60,
    baseCost: 2000,
    costMultiplier: 1.3,
    incomePerSec: 15,
    category: 'auto_income',
  },
];

const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_click', name: '初次点击', description: '完成第 1 次点击', checkFn: 'totalClicks_1', rewardGold: 10, rewardGems: 0 },
  { id: 'click_100', name: '点击新手', description: '累计点击 100 次', checkFn: 'totalClicks_100', rewardGold: 100, rewardGems: 1 },
  { id: 'click_1000', name: '点击达人', description: '累计点击 1000 次', checkFn: 'totalClicks_1000', rewardGold: 1000, rewardGems: 5 },
  { id: 'click_10000', name: '点击大师', description: '累计点击 10000 次', checkFn: 'totalClicks_10000', rewardGold: 10000, rewardGems: 20 },
  { id: 'gold_1000', name: '第一桶金', description: '金币达到 1000', checkFn: 'gold_1000', rewardGold: 200, rewardGems: 2 },
  { id: 'gold_100k', name: '万元户', description: '金币达到 100,000', checkFn: 'gold_100000', rewardGold: 5000, rewardGems: 10 },
  { id: 'gold_1m', name: '百万富翁', description: '金币达到 1,000,000', checkFn: 'gold_1000000', rewardGold: 50000, rewardGems: 50 },
];

const SAVE_KEY = 'idle_game_save';
const OFFLINE_EARNINGS_CAP_SEC = 8 * 3600; // 最多累积 8 小时离线收益

/* ===================== 初始状态 ===================== */

export function createInitialState(): GameState {
  const now = Date.now();
  return {
    gold: 0,
    gems: 0,
    totalClicks: 0,
    totalOfflineEarnings: 0,
    upgrades: INITIAL_UPGRADES.map((u) => ({ ...u })),
    unlockedAchievements: [],
    lastActiveAt: now,
    startedAt: now,
  };
}

/* ===================== 存档管理 ===================== */

export function saveGame(state: GameState): void {
  const data: GameState = { ...state, lastActiveAt: Date.now() };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

/* ===================== 核心计算 ===================== */

/** 计算单项升级的当前成本 */
export function getUpgradeCost(upgrade: Upgrade): number {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level));
}

/** 计算每次点击获得的金币（不含基础 1） */
export function getClickValue(state: GameState): number {
  let bonus = 0;
  for (const up of state.upgrades) {
    if (up.category === 'click_power' && up.clickBonus) {
      bonus += up.clickBonus * up.level;
    }
  }
  return 1 + bonus;
}

/** 计算每秒自动收益 */
export function getIncomePerSec(state: GameState): number {
  let total = 0;
  for (const up of state.upgrades) {
    if (up.category === 'auto_income' && up.incomePerSec) {
      total += up.incomePerSec * up.level;
    }
  }
  return total;
}

/** 执行点击 */
export function performClick(state: GameState): GameState {
  const value = getClickValue(state);
  return {
    ...state,
    gold: state.gold + value,
    totalClicks: state.totalClicks + 1,
  };
}

/**
 * 计算自上次活跃以来的时间推进收益。
 * 返回：更新后的状态 + 离线收益信息
 */
export function calculateTimeAdvance(state: GameState, now: number): { state: GameState; offline: OfflineEarnings } {
  const elapsedSec = Math.floor((now - state.lastActiveAt) / 1000);
  if (elapsedSec < 1) return { state, offline: { secondsAway: 0, earnings: 0, durationText: '0 秒' } };

  const cappedSec = Math.min(elapsedSec, OFFLINE_EARNINGS_CAP_SEC);
  const incomePerSec = getIncomePerSec(state);
  const earnings = Math.floor(incomePerSec * cappedSec);

  return {
    state: {
      ...state,
      gold: state.gold + earnings,
      totalOfflineEarnings: state.totalOfflineEarnings + earnings,
      lastActiveAt: now,
    },
    offline: {
      secondsAway: elapsedSec,
      earnings,
      durationText: formatDuration(elapsedSec),
    },
  };
}

/** 购买升级 */
export function buyUpgrade(state: GameState, upgradeId: string): { state: GameState; success: boolean } {
  const idx = state.upgrades.findIndex((u) => u.id === upgradeId);
  if (idx === -1) return { state, success: false };

  const upgrade = state.upgrades[idx];
  if (upgrade.level >= upgrade.maxLevel) return { state, success: false };

  const cost = getUpgradeCost(upgrade);
  if (state.gold < cost) return { state, success: false };

  const newUpgrades = [...state.upgrades];
  newUpgrades[idx] = { ...upgrade, level: upgrade.level + 1 };

  return {
    state: { ...state, gold: state.gold - cost, upgrades: newUpgrades },
    success: true,
  };
}

/** 批量购买升级（快速升级 N 级） */
export function buyUpgradeBatch(state: GameState, upgradeId: string, count: number): { state: GameState; spent: number; levels: number } {
  let current = state;
  let spent = 0;
  let levels = 0;

  for (let i = 0; i < count; i++) {
    const result = buyUpgrade(current, upgradeId);
    if (!result.success) break;
    spent += getUpgradeCost(current.upgrades.find((u) => u.id === upgradeId)!);
    current = result.state;
    levels++;
  }

  return { state: current, spent, levels };
}

/** 检查并解锁成就 */
export function checkAchievements(state: GameState): { state: GameState; newAchievements: Achievement[] } {
  const newAchievements: Achievement[] = [];
  let current = state;

  for (const ach of ACHIEVEMENTS) {
    if (current.unlockedAchievements.includes(ach.id)) continue;
    if (evaluateAchievement(current, ach)) {
      current = {
        ...current,
        unlockedAchievements: [...current.unlockedAchievements, ach.id],
        gold: current.gold + ach.rewardGold,
        gems: current.gems + ach.rewardGems,
      };
      newAchievements.push(ach);
    }
  }

  return { state: current, newAchievements };
}

/* ===================== 辅助函数 ===================== */

function evaluateAchievement(state: GameState, ach: Achievement): boolean {
  const [key, valStr] = ach.checkFn.split('_');
  const val = Number(valStr);
  if (isNaN(val)) return false;

  switch (key) {
    case 'totalClicks':
      return state.totalClicks >= val;
    case 'gold':
      return state.gold >= val;
    default:
      return false;
  }
}

function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec} 秒`;
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (hours > 0) return `${hours} 小时 ${mins} 分钟`;
  return `${mins} 分钟`;
}

export { ACHIEVEMENTS, INITIAL_UPGRADES, OFFLINE_EARNINGS_CAP_SEC };
