/**
 * BattlePass — 通行证系统
 *
 * 双轨制（Free + Premium），含等级推进、奖励领取、赛季配置。
 */

/* ================================================================
 * 类型定义
 * ================================================================ */

/** 通行证轨道 */
export type PassTrack = 'free' | 'premium';

/** 奖励类型 */
export type RewardType = 'currency' | 'item' | 'skin' | 'title';

/** 奖励定义 */
export interface PassReward {
  type: RewardType;
  id: string;
  name: string;
  amount: number;
  icon?: string;
}

/** 等级奖励配置 */
export interface LevelReward {
  level: number;
  freeRewards: PassReward[];
  premiumRewards: PassReward[];
  /** 该等级所需 XP */
  xpRequired: number;
}

/** 赛季配置 */
export interface SeasonConfig {
  seasonId: string;
  name: string;
  theme: string;
  startTime: number;
  endTime: number;
  maxLevel: number;
  premiumPrice: number;   // 购买 Premium 所需货币
  premiumCurrency: 'soft' | 'hard';
  /** Base XP + 每级增量 XP 公式参数 */
  baseXP: number;
  xpIncrement: number;
}

/** 用户通行证进度 */
export interface PassProgress {
  userId: string;
  seasonId: string;
  currentXP: number;
  currentLevel: number;
  hasPremium: boolean;
  claimedRewards: Set<string>; // "track:level" 格式
}

/** 赛季状态 */
export type SeasonStatus = 'upcoming' | 'active' | 'ended';

/* ================================================================
 * 奖励模板库
 * ================================================================ */

/** 默认奖励模板：按等级区间生成 */
function generateDefaultLevelRewards(maxLevel: number): LevelReward[] {
  const rewards: LevelReward[] = [];
  const baseXP = 100;
  const xpInc = 50;

  for (let lv = 1; lv <= maxLevel; lv++) {
    const xpRequired = baseXP + (lv - 1) * xpInc;
    const freeRewards: PassReward[] = [];
    const premiumRewards: PassReward[] = [];

    // 每 5 级给一次较好的奖励
    if (lv % 10 === 0) {
      freeRewards.push({ type: 'currency', id: 'gold', name: '金币', amount: 500 + lv * 50 });
      premiumRewards.push({ type: 'currency', id: 'diamond', name: '钻石', amount: 100 + lv * 10 });
      premiumRewards.push({ type: 'skin', id: `skin_season_lv${lv}`, name: `限定皮肤 Lv${lv}`, amount: 1 });
    } else if (lv % 5 === 0) {
      freeRewards.push({ type: 'currency', id: 'gold', name: '金币', amount: 200 + lv * 20 });
      premiumRewards.push({ type: 'currency', id: 'diamond', name: '钻石', amount: 50 + lv * 5 });
    } else if (lv % 3 === 0) {
      freeRewards.push({ type: 'item', id: `boost_${lv}`, name: `经验加成道具`, amount: 2 });
      premiumRewards.push({ type: 'item', id: `rare_item_${lv}`, name: `稀有道具 x${lv}`, amount: 3 });
    } else {
      freeRewards.push({ type: 'currency', id: 'gold', name: '金币', amount: 100 + lv * 10 });
      premiumRewards.push({ type: 'currency', id: 'diamond', name: '钻石', amount: 25 + lv * 3 });
    }

    // Premium 顶级奖励：满级称号
    if (lv === maxLevel) {
      premiumRewards.push({ type: 'title', id: `title_max_${lv}`, name: '赛季王者', amount: 1 });
    }

    rewards.push({ level: lv, freeRewards, premiumRewards, xpRequired });
  }

  return rewards;
}

/* ================================================================
 * BattlePass 类
 * ================================================================ */

export class BattlePass {
  readonly config: SeasonConfig;
  private levelRewards: LevelReward[];
  private progress = new Map<string, PassProgress>(); // userId → progress

  constructor(config: SeasonConfig, levelRewards?: LevelReward[]) {
    this.config = config;
    this.levelRewards = levelRewards ?? generateDefaultLevelRewards(config.maxLevel);
  }

  /* ---- 赛季状态 ---- */

  getSeasonStatus(now: number = Date.now()): SeasonStatus {
    if (now < this.config.startTime) return 'upcoming';
    if (now > this.config.endTime) return 'ended';
    return 'active';
  }

  isActive(now: number = Date.now()): boolean {
    return this.getSeasonStatus(now) === 'active';
  }

  /* ---- 用户进度 ---- */

  /** 获取或创建用户进度 */
  getOrCreateProgress(userId: string): PassProgress {
    if (!this.progress.has(userId)) {
      this.progress.set(userId, {
        userId,
        seasonId: this.config.seasonId,
        currentXP: 0,
        currentLevel: 0,
        hasPremium: false,
        claimedRewards: new Set(),
      });
    }
    return this.progress.get(userId)!;
  }

  /** 获取用户进度（只读） */
  getProgress(userId: string): PassProgress | undefined {
    return this.progress.get(userId);
  }

  /* ---- XP 与升级 ---- */

  /** 添加经验值 */
  addXP(userId: string, amount: number): PassProgress {
    const p = this.getOrCreateProgress(userId);
    if (!this.isActive()) return p;

    p.currentXP += amount;

    // 检查升级
    let leveledUp = 0;
    for (const lr of this.levelRewards) {
      if (lr.level > p.currentLevel && p.currentXP >= this.getCumulativeXP(lr.level)) {
        p.currentLevel = lr.level;
        leveledUp++;
      }
    }

    // 不超过最大等级
    p.currentLevel = Math.min(p.currentLevel, this.config.maxLevel);

    this.progress.set(userId, p);
    return p;
  }

  /** 获取当前等级 */
  getLevel(userId: string): number {
    return this.getOrCreateProgress(userId).currentLevel;
  }

  /** 获取当前 XP */
  getXP(userId: string): number {
    return this.getOrCreateProgress(userId).currentXP;
  }

  /** 获取指定等级累计所需 XP */
  getCumulativeXP(level: number): number {
    let total = 0;
    for (const lr of this.levelRewards) {
      if (lr.level <= level) total += lr.xpRequired;
    }
    return total;
  }

  /** 获取指定等级区间的 XP 要求 */
  getLevelXP(level: number): number {
    const lr = this.levelRewards.find((r) => r.level === level);
    return lr?.xpRequired ?? 0;
  }

  /* ---- 奖励领取 ---- */

  /** 领取奖励 */
  claimReward(
    userId: string,
    track: PassTrack,
    level: number,
  ): { success: boolean; rewards?: PassReward[]; error?: string } {
    const p = this.getOrCreateProgress(userId);

    // Premium 轨需要先购买
    if (track === 'premium' && !p.hasPremium) {
      return { success: false, error: '需要购买 Premium 通行证' };
    }

    // 等级未达到
    if (level > p.currentLevel) {
      return { success: false, error: `未达到等级 ${level}（当前 ${p.currentLevel}）` };
    }

    // 已领取
    const claimKey = `${track}:${level}`;
    if (p.claimedRewards.has(claimKey)) {
      return { success: false, error: `等级 ${level} 的 ${track} 奖励已领取` };
    }

    // 获取奖励
    const lr = this.levelRewards.find((r) => r.level === level);
    if (!lr) {
      return { success: false, error: `等级 ${level} 不存在` };
    }

    p.claimedRewards.add(claimKey);
    this.progress.set(userId, p);

    const rewards = track === 'free' ? lr.freeRewards : lr.premiumRewards;
    return { success: true, rewards };
  }

  /** 检查奖励是否已领取 */
  isRewardClaimed(userId: string, track: PassTrack, level: number): boolean {
    const p = this.getProgress(userId);
    if (!p) return false;
    return p.claimedRewards.has(`${track}:${level}`);
  }

  /** 获取可领取的奖励列表 */
  getClaimableRewards(userId: string): { level: number; track: PassTrack; rewards: PassReward[] }[] {
    const p = this.getOrCreateProgress(userId);
    const result: { level: number; track: PassTrack; rewards: PassReward[] }[] = [];

    for (const lr of this.levelRewards) {
      if (lr.level > p.currentLevel) break;

      if (!p.claimedRewards.has(`free:${lr.level}`)) {
        result.push({ level: lr.level, track: 'free', rewards: lr.freeRewards });
      }
      if (p.hasPremium && !p.claimedRewards.has(`premium:${lr.level}`)) {
        result.push({ level: lr.level, track: 'premium', rewards: lr.premiumRewards });
      }
    }

    return result;
  }

  /* ---- Premium 购买 ---- */

  /** 购买 Premium 通行证 */
  purchasePremium(userId: string): { success: boolean; error?: string } {
    const p = this.getOrCreateProgress(userId);

    if (p.hasPremium) {
      return { success: false, error: '已拥有 Premium 通行证' };
    }

    if (!this.isActive()) {
      return { success: false, error: '赛季未开启或已结束' };
    }

    p.hasPremium = true;
    this.progress.set(userId, p);
    return { success: true };
  }

  /** 检查是否拥有 Premium */
  hasPremium(userId: string): boolean {
    return this.getOrCreateProgress(userId).hasPremium;
  }

  /* ---- 等级奖励配置 ---- */

  /** 获取指定等级的所有奖励信息 */
  getLevelRewards(level: number): LevelReward | undefined {
    return this.levelRewards.find((r) => r.level === level);
  }

  /** 获取全部等级奖励配置 */
  getAllLevelRewards(): LevelReward[] {
    return [...this.levelRewards];
  }

  /** 获取奖励总数 */
  getTotalRewardCount(): { free: number; premium: number } {
    let free = 0, premium = 0;
    for (const lr of this.levelRewards) {
      free += lr.freeRewards.length;
      premium += lr.premiumRewards.length;
    }
    return { free, premium };
  }
}
