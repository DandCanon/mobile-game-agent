/* 游戏核心数据类型 */

export interface GameState {
  /** 金币（主货币） */
  gold: number;
  /** 钻石（高级货币） */
  gems: number;
  /** 总点击数 */
  totalClicks: number;
  /** 总离线收益 */
  totalOfflineEarnings: number;
  /** 升级项列表 */
  upgrades: Upgrade[];
  /** 已解锁成就 ID 列表 */
  unlockedAchievements: string[];
  /** 最后活跃时间戳（用于离线收益计算） */
  lastActiveAt: number;
  /** 游戏开始时间戳 */
  startedAt: number;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  /** 当前等级 */
  level: number;
  /** 最高等级 */
  maxLevel: number;
  /** 基础成本 */
  baseCost: number;
  /** 成本增长系数（每级 × 此值） */
  costMultiplier: number;
  /** 每次点击增加的金币（仅 click_power 类） */
  clickBonus?: number;
  /** 每秒自动产出的金币（仅 auto_income 类） */
  incomePerSec?: number;
  /** 升级类别 */
  category: 'click_power' | 'auto_income';
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  /** 达成条件检查函数名称 */
  checkFn: string;
  /** 奖励金币 */
  rewardGold: number;
  /** 奖励钻石 */
  rewardGems: number;
}

export interface OfflineEarnings {
  /** 离线秒数 */
  secondsAway: number;
  /** 离线期间总收益 */
  earnings: number;
  /** 格式化后的离线时长文本 */
  durationText: string;
}

export type SaveData = GameState;
