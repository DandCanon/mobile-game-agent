/**
 * Bundles — 礼包与限时商店
 *
 * 含 Bundle 管理、活跃礼包筛选、限时弹窗模板。
 */

/* ================================================================
 * 类型定义
 * ================================================================ */

/** 礼包定义 */
export interface Bundle {
  id: string;
  name: string;
  description?: string;
  /** 包含的商品 ID 列表 */
  products: string[];
  /** 折扣百分比 (0-100)，如 30 表示 7 折 */
  discountPercent: number;
  /** 原始总价 */
  originalPrice: number;
  /** 折后价格 */
  finalPrice: number;
  /** 有效期截止时间戳（0 表示永久） */
  validUntil: number;
  /** 限购次数（0 表示无限） */
  purchaseLimit: number;
  /** 礼包图标 */
  icon?: string;
  /** 标签（如 "热门"、"新人"） */
  tags?: string[];
}

/** 限时弹窗类型 */
export type OfferType = 'welcome' | 'return' | 'festival';

/** 限时弹窗触发条件 */
export interface OfferTrigger {
  /** 触发类型 */
  type: OfferType;
  /** 首次登录触发 */
  firstLogin?: boolean;
  /** 回归触发：离开天数阈值 */
  returnAfterDays?: number;
  /** 节日日期（MM-DD 格式） */
  festivalDate?: string;
}

/** 限时弹窗定义 */
export interface LimitedTimeOffer {
  id: string;
  name: string;
  description: string;
  trigger: OfferTrigger;
  /** 弹窗关联的礼包 ID */
  bundleId: string;
  /** 弹窗有效时长（ms），超时自动关闭 */
  durationMs: number;
  /** 冷却时间（ms），弹出后 N 天内不再弹出 */
  cooldownMs?: number;
}

/** 预设模板 */
export interface OfferTemplate {
  name: string;
  description: string;
  discountPercent: number;
  durationMs: number;
  cooldownMs: number;
}

/** WelcomeOffer 预设 */
export const WELCOME_OFFER_TEMPLATE: OfferTemplate = {
  name: '新人礼包',
  description: '欢迎来到游戏！限时特惠，仅此一次！',
  discountPercent: 80,
  durationMs: 72 * 3600 * 1000, // 72h
  cooldownMs: 0, // 永不再弹出
};

/** ReturnOffer 预设 */
export const RETURN_OFFER_TEMPLATE: OfferTemplate = {
  name: '回归礼包',
  description: '英雄归来！专属回归福利等你领取！',
  discountPercent: 60,
  durationMs: 48 * 3600 * 1000, // 48h
  cooldownMs: 7 * 24 * 3600 * 1000, // 7 天冷却
};

/** FestivalOffer 预设 */
export const FESTIVAL_OFFER_TEMPLATE: OfferTemplate = {
  name: '节日礼包',
  description: '节日限定！错过再等一年！',
  discountPercent: 50,
  durationMs: 24 * 3600 * 1000, // 24h
  cooldownMs: 24 * 3600 * 1000, // 每日
};

/* ================================================================
 * BundleManager
 * ================================================================ */

export interface BundlePurchaseRecord {
  userId: string;
  bundleId: string;
  timestamp: number;
}

export class BundleManager {
  private bundles = new Map<string, Bundle>();
  private purchases: BundlePurchaseRecord[] = [];
  private offers = new Map<string, LimitedTimeOffer>();
  /** 用户最近一次弹窗时间 */
  private offerLastShown = new Map<string, Map<string, number>>();

  /* ---- Bundle CRUD ---- */

  addBundle(bundle: Bundle): void {
    this.bundles.set(bundle.id, bundle);
  }

  removeBundle(id: string): boolean {
    return this.bundles.delete(id);
  }

  getBundle(id: string): Bundle | undefined {
    return this.bundles.get(id);
  }

  /** 获取当前有效的礼包（未过期 + 未售罄） */
  getActiveBundles(now: number = Date.now()): Bundle[] {
    return [...this.bundles.values()].filter((b) => {
      // 有效期检查
      if (b.validUntil > 0 && now > b.validUntil) return false;
      // 限购检查
      if (b.purchaseLimit > 0) {
        const sold = this.getPurchaseCount(b.id);
        if (sold >= b.purchaseLimit) return false;
      }
      return true;
    });
  }

  /** 获取所有礼包 */
  getAllBundles(): Bundle[] {
    return [...this.bundles.values()];
  }

  /* ---- 购买 ---- */

  /** 购买礼包 */
  purchaseBundle(
    bundleId: string,
    userId: string,
    now: number = Date.now(),
  ): { success: boolean; bundle?: Bundle; error?: string } {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) return { success: false, error: '礼包不存在' };

    // 有效期检查
    if (bundle.validUntil > 0 && now > bundle.validUntil) {
      return { success: false, error: '该礼包已过期' };
    }

    // 限购检查
    if (bundle.purchaseLimit > 0) {
      const userCount = this.getUserPurchaseCount(userId, bundleId);
      if (userCount >= bundle.purchaseLimit) {
        return { success: false, error: '已达到购买上限' };
      }
      const totalSold = this.getPurchaseCount(bundleId);
      if (totalSold >= bundle.purchaseLimit) {
        return { success: false, error: '该礼包已售罄' };
      }
    }

    this.purchases.push({ userId, bundleId, timestamp: now });
    return { success: true, bundle };
  }

  /** 获取礼包购买次数（全局） */
  getPurchaseCount(bundleId: string): number {
    return this.purchases.filter((p) => p.bundleId === bundleId).length;
  }

  /** 获取用户对某礼包的购买次数 */
  getUserPurchaseCount(userId: string, bundleId: string): number {
    return this.purchases.filter((p) => p.userId === userId && p.bundleId === bundleId).length;
  }

  /** 获取用户已购礼包列表 */
  getUserPurchasedBundles(userId: string): string[] {
    return this.purchases.filter((p) => p.userId === userId).map((p) => p.bundleId);
  }

  /* ---- 限时弹窗 ---- */

  addOffer(offer: LimitedTimeOffer): void {
    this.offers.set(offer.id, offer);
  }

  removeOffer(id: string): boolean {
    return this.offers.delete(id);
  }

  getOffer(id: string): LimitedTimeOffer | undefined {
    return this.offers.get(id);
  }

  /** 获取应触发的限时弹窗 */
  getTriggeredOffers(
    userId: string,
    context: {
      isFirstLogin: boolean;
      daysSinceLastLogin: number;
      now: Date;
    },
  ): LimitedTimeOffer[] {
    const triggered: LimitedTimeOffer[] = [];
    const now = context.now;

    for (const offer of this.offers.values()) {
      // 检查冷却
      if (offer.cooldownMs) {
        const lastShown = this.getLastShownTime(userId, offer.id);
        if (lastShown && now.getTime() - lastShown < offer.cooldownMs) {
          continue;
        }
      }

      // 检查触发条件
      const t = offer.trigger;
      switch (t.type) {
        case 'welcome':
          if (t.firstLogin && context.isFirstLogin) triggered.push(offer);
          break;
        case 'return':
          if (t.returnAfterDays && context.daysSinceLastLogin >= t.returnAfterDays) {
            triggered.push(offer);
          }
          break;
        case 'festival':
          if (t.festivalDate) {
            const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            if (mmdd === t.festivalDate) triggered.push(offer);
          }
          break;
      }
    }

    return triggered;
  }

  /** 记录弹窗展示 */
  recordOfferShown(userId: string, offerId: string): void {
    if (!this.offerLastShown.has(userId)) {
      this.offerLastShown.set(userId, new Map());
    }
    this.offerLastShown.get(userId)!.set(offerId, Date.now());
  }

  /** 获取上次弹窗时间 */
  getLastShownTime(userId: string, offerId: string): number | undefined {
    return this.offerLastShown.get(userId)?.get(offerId);
  }

  /* ---- 工具 ---- */

  /** 计算礼包节省金额 */
  getSavings(bundleId: string): number {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) return 0;
    return bundle.originalPrice - bundle.finalPrice;
  }

  /** 检查礼包是否即将过期 */
  getExpiringSoonBundles(withinMs: number = 3600_000, now: number = Date.now()): Bundle[] {
    return this.getActiveBundles(now).filter((b) => {
      return b.validUntil > 0 && b.validUntil - now <= withinMs && b.validUntil > now;
    });
  }
}
