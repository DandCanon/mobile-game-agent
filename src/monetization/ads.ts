/**
 * Ads — 广告系统
 *
 * 支持激励视频、插屏、横幅三种广告类型；
 * 含频控、每日上限、去广告（关联 IAP）功能。
 */

/* ================================================================
 * 类型定义
 * ================================================================ */

/** 广告类型 */
export type AdType = 'rewarded' | 'interstitial' | 'banner';

/** 广告展示位置 */
export type AdPlacement =
  | 'level_complete'
  | 'daily_bonus'
  | 'revive'
  | 'get_reward'
  | 'pause_menu'
  | 'shop'
  | 'home_banner';

/** 广告展示结果 */
export interface AdShowResult {
  success: boolean;
  error?: string;
  /** 用户是否完整观看了广告（仅 rewarded 有效） */
  watched?: boolean;
}

/** 广告展示记录 */
export interface AdImpression {
  type: AdType;
  placement: AdPlacement;
  timestamp: number;
  watched: boolean;
}

/** 频控配置 */
export interface AdFrequencyConfig {
  /** 最小展示间隔（ms） */
  minInterval: number;
  /** 每日每类广告上限 */
  dailyLimitPerType: number;
}

/** 广告回调 */
export type AdWatchedCallback = (placement: AdPlacement) => void;

/** 默认频控配置 */
export const DEFAULT_AD_FREQUENCY: AdFrequencyConfig = {
  minInterval: 30_000,       // 30s 最小间隔
  dailyLimitPerType: 20,     // 每日每类最多 20 次
};

/* ================================================================
 * AdManager
 * ================================================================ */

export class AdManager {
  private frequency: AdFrequencyConfig;
  private impressions: AdImpression[] = [];
  private watchedCallbacks: AdWatchedCallback[] = [];
  private adsRemoved = false;
  /** 记录各类型上次展示时间 */
  private lastShownTime = new Map<AdType, number>();
  /** 关联的去广告 IAP 商品 ID */
  private removeAdsProductId: string;

  constructor(config?: Partial<AdFrequencyConfig>, removeAdsProductId = 'remove_ads') {
    this.frequency = { ...DEFAULT_AD_FREQUENCY, ...config };
    this.removeAdsProductId = removeAdsProductId;
  }

  /* ---- 广告展示 ---- */

  /** 展示广告 */
  showAd(type: AdType, placement: AdPlacement, now: number = Date.now()): AdShowResult {
    // 去广告已购买
    if (this.adsRemoved) {
      return { success: false, error: '已购买去广告，不再展示广告' };
    }

    // 频控：最小间隔检查
    const lastTime = this.lastShownTime.get(type);
    if (lastTime && now - lastTime < this.frequency.minInterval) {
      const remaining = Math.ceil((this.frequency.minInterval - (now - lastTime)) / 1000);
      return { success: false, error: `广告冷却中，请 ${remaining} 秒后再试` };
    }

    // 每日上限检查
    const todayStart = this.getTodayStart(now);
    const todayCount = this.impressions.filter(
      (imp) => imp.type === type && imp.timestamp >= todayStart,
    ).length;
    if (todayCount >= this.frequency.dailyLimitPerType) {
      return { success: false, error: `今日${type}广告已达上限（${this.frequency.dailyLimitPerType}次）` };
    }

    // 记录展示
    this.lastShownTime.set(type, now);
    const impression: AdImpression = {
      type,
      placement,
      timestamp: now,
      watched: false,
    };
    this.impressions.push(impression);

    return { success: true };
  }

  /** 标记激励视频观看完成 */
  onAdWatched(placement: AdPlacement, now: number = Date.now()): void {
    // 更新最近一条 rewarded 记录的 watched 标记
    const lastRewarded = [...this.impressions]
      .reverse()
      .find((imp) => imp.type === 'rewarded' && !imp.watched);

    if (lastRewarded) {
      lastRewarded.watched = true;
      lastRewarded.timestamp = now;
    }

    // 触发回调
    for (const cb of this.watchedCallbacks) {
      try { cb(placement); } catch { /* 忽略回调异常 */ }
    }
  }

  /** 注册激励视频观看回调 */
  onAdWatchedCallback(callback: AdWatchedCallback): void {
    this.watchedCallbacks.push(callback);
  }

  /** 移除回调 */
  removeCallback(callback: AdWatchedCallback): void {
    this.watchedCallbacks = this.watchedCallbacks.filter((cb) => cb !== callback);
  }

  /* ---- 去广告 ---- */

  /** 购买去广告 */
  removeAds(purchaseId: string): { success: boolean; error?: string } {
    if (purchaseId === this.removeAdsProductId) {
      this.adsRemoved = true;
      return { success: true };
    }
    return { success: false, error: `无效的去广告商品 ID：${purchaseId}` };
  }

  /** 是否已去广告 */
  isAdsRemoved(): boolean {
    return this.adsRemoved;
  }

  /* ---- 频控与统计 ---- */

  /** 获取频控配置 */
  getFrequencyConfig(): AdFrequencyConfig {
    return { ...this.frequency };
  }

  /** 更新频控配置 */
  updateFrequency(config: Partial<AdFrequencyConfig>): void {
    this.frequency = { ...this.frequency, ...config };
  }

  /** 获取今日某类广告展示次数 */
  getTodayImpressions(type: AdType, now: number = Date.now()): number {
    const todayStart = this.getTodayStart(now);
    return this.impressions.filter(
      (imp) => imp.type === type && imp.timestamp >= todayStart,
    ).length;
  }

  /** 获取今日某类广告剩余可用次数 */
  getRemainingToday(type: AdType, now: number = Date.now()): number {
    const used = this.getTodayImpressions(type, now);
    return Math.max(0, this.frequency.dailyLimitPerType - used);
  }

  /** 获取全部展示记录 */
  getImpressions(): AdImpression[] {
    return [...this.impressions];
  }

  /** 获取展示统计 */
  getStats(): {
    total: number;
    byType: Record<AdType, number>;
    watched: number;
    remainingToday: Record<AdType, number>;
  } {
    const byType: Record<AdType, number> = { rewarded: 0, interstitial: 0, banner: 0 };
    for (const imp of this.impressions) {
      byType[imp.type]++;
    }

    const now = Date.now();
    const remainingToday: Record<AdType, number> = {
      rewarded: this.getRemainingToday('rewarded', now),
      interstitial: this.getRemainingToday('interstitial', now),
      banner: this.getRemainingToday('banner', now),
    };

    return {
      total: this.impressions.length,
      byType,
      watched: this.impressions.filter((imp) => imp.watched).length,
      remainingToday,
    };
  }

  /** 检查某广告类型是否可展示 */
  canShow(type: AdType, now: number = Date.now()): boolean {
    if (this.adsRemoved) return false;

    const lastTime = this.lastShownTime.get(type);
    if (lastTime && now - lastTime < this.frequency.minInterval) return false;

    const todayStart = this.getTodayStart(now);
    const todayCount = this.impressions.filter(
      (imp) => imp.type === type && imp.timestamp >= todayStart,
    ).length;
    return todayCount < this.frequency.dailyLimitPerType;
  }

  /* ---- 内部工具 ---- */

  private getTodayStart(now: number): number {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
}
