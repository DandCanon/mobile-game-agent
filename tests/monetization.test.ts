/**
 * monetization.test.ts — 商业化系统单元测试
 *
 * 覆盖：商店 / IAP / 货币 / 通行证 / 礼包 / 广告
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StoreCatalog,
  PurchaseValidator,
  IAPValidator,
  CurrencyManager,
  PRICE_TIERS,
  getPrice,
} from '../src/monetization/store';
import type {
  Product,
  ProductType,
  PriceTierLevel,
  PurchaseCondition,
  IAPReceipt,
  CurrencyKind,
} from '../src/monetization/store';
import { BattlePass } from '../src/monetization/battle-pass';
import type { SeasonConfig, PassReward } from '../src/monetization/battle-pass';
import { BundleManager } from '../src/monetization/bundles';
import type { Bundle, LimitedTimeOffer, OfferTrigger } from '../src/monetization/bundles';
import { AdManager } from '../src/monetization/ads';
import type { AdType, AdPlacement } from '../src/monetization/ads';

/* ================================================================
 * 1. Store — 商品系统
 * ================================================================ */

describe('StoreCatalog', () => {
  let catalog: StoreCatalog;
  let sword: Product;
  let shield: Product;
  let vipPass: Product;

  beforeEach(() => {
    catalog = new StoreCatalog();
    sword = {
      id: 'sword_01',
      type: 'consumable',
      priceTier: 'T1',
      currency: 'USD',
      displayName: 'Iron Sword',
      icon: 'sword.png',
      rewards: { sword: 1 },
    };
    shield = {
      id: 'shield_perm',
      type: 'non-consumable',
      priceTier: 'T3',
      currency: 'CNY',
      displayName: 'Permanent Shield',
      icon: 'shield.png',
      rewards: { shield: 1 },
    };
    vipPass = {
      id: 'vip_monthly',
      type: 'subscription',
      priceTier: 'T4',
      currency: 'USD',
      displayName: 'VIP Monthly',
      icon: 'vip.png',
      rewards: { vip_days: 30 },
    };
  });

  it('addProduct adds a product', () => {
    catalog.addProduct(sword);
    expect(catalog.getProduct('sword_01')).toEqual(sword);
  });

  it('removeProduct removes existing product', () => {
    catalog.addProduct(sword);
    expect(catalog.removeProduct('sword_01')).toBe(true);
    expect(catalog.getProduct('sword_01')).toBeUndefined();
  });

  it('removeProduct returns false for non-existent product', () => {
    expect(catalog.removeProduct('no_such')).toBe(false);
  });

  it('getProductsByType filters correctly', () => {
    catalog.addProduct(sword);
    catalog.addProduct(shield);
    catalog.addProduct(vipPass);

    expect(catalog.getProductsByType('consumable')).toEqual([sword]);
    expect(catalog.getProductsByType('non-consumable')).toEqual([shield]);
    expect(catalog.getProductsByType('subscription')).toEqual([vipPass]);
  });

  it('getAllProducts returns all', () => {
    catalog.addProduct(sword);
    catalog.addProduct(shield);
    expect(catalog.getAllProducts()).toHaveLength(2);
  });

  it('recordPurchase and getPurchaseCount work', () => {
    catalog.addProduct(sword);
    catalog.recordPurchase({ userId: 'u1', productId: 'sword_01', timestamp: 1000, receipt: 'rec1' });
    catalog.recordPurchase({ userId: 'u1', productId: 'sword_01', timestamp: 2000, receipt: 'rec2' });
    catalog.recordPurchase({ userId: 'u2', productId: 'sword_01', timestamp: 3000, receipt: 'rec3' });

    expect(catalog.getPurchaseCount('u1', 'sword_01')).toBe(2);
    expect(catalog.getPurchaseCount('u2', 'sword_01')).toBe(1);
  });

  it('getUserPurchases returns user-specific purchases', () => {
    catalog.addProduct(sword);
    catalog.recordPurchase({ userId: 'u1', productId: 'sword_01', timestamp: 1000, receipt: 'r1' });
    catalog.recordPurchase({ userId: 'u2', productId: 'sword_01', timestamp: 2000, receipt: 'r2' });
    expect(catalog.getUserPurchases('u1')).toHaveLength(1);
  });
});

/* ================================================================
 * 1b. Price Tiers
 * ================================================================ */

describe('PRICE_TIERS', () => {
  it('has 6 tiers', () => {
    const tiers = Object.keys(PRICE_TIERS);
    expect(tiers).toHaveLength(6);
    expect(tiers).toContain('T1');
    expect(tiers).toContain('T6');
  });

  it('T1 is $0.99 / ¥6', () => {
    expect(getPrice('T1', 'USD')).toBe(0.99);
    expect(getPrice('T1', 'CNY')).toBe(6);
  });

  it('T6 is $99.99 / ¥648', () => {
    expect(getPrice('T6', 'USD')).toBe(99.99);
    expect(getPrice('T6', 'CNY')).toBe(648);
  });

  it('unknown currency falls back to USD', () => {
    expect(getPrice('T3', 'soft' as any)).toBe(9.99);
  });
});

/* ================================================================
 * 1c. PurchaseValidator
 * ================================================================ */

describe('PurchaseValidator', () => {
  let validator: PurchaseValidator;
  let catalog: StoreCatalog;
  let conditions: Map<string, PurchaseCondition>;
  let product: Product;

  beforeEach(() => {
    validator = new PurchaseValidator();
    catalog = new StoreCatalog();
    conditions = new Map();
    product = {
      id: 'gems_1000',
      type: 'consumable',
      priceTier: 'T2',
      currency: 'USD',
      displayName: '1000 Gems',
      icon: 'gem.png',
      rewards: { gem: 1000 },
    };
    catalog.addProduct(product);
  });

  it('passes validation without conditions', () => {
    const result = validator.validate(product, 'u1', 1, 0, catalog);
    expect(result.valid).toBe(true);
  });

  it('fails when level too low', () => {
    validator.setCondition('gems_1000', { minLevel: 10 }, conditions);
    const origGetCondition = validator.getCondition.bind(validator);
    validator.getCondition = () => conditions.get('gems_1000') ?? {};
    const result = validator.validate(product, 'u1', 5, 0, catalog);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('等级');
  });

  it('fails when VIP level too low', () => {
    validator.getCondition = () => ({ minVipLevel: 3 });
    const result = validator.validate(product, 'u1', 10, 1, catalog);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('VIP');
  });

  it('fails when max purchase limit reached', () => {
    catalog.recordPurchase({ userId: 'u1', productId: 'gems_1000', timestamp: 1000, receipt: 'r1' });
    catalog.recordPurchase({ userId: 'u1', productId: 'gems_1000', timestamp: 2000, receipt: 'r2' });
    validator.getCondition = () => ({ maxPurchases: 2 });
    const result = validator.validate(product, 'u1', 10, 5, catalog);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('限购');
  });

  it('fails when sale has ended', () => {
    const pastEnd = Date.now() - 1000;
    validator.getCondition = () => ({ saleEndTime: pastEnd });
    const result = validator.validate(product, 'u1', 10, 5, catalog);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('限时售卖已结束');
  });
});

/* ================================================================
 * 2. IAP Validator
 * ================================================================ */

describe('IAPValidator', () => {
  let receipt: IAPReceipt;

  beforeEach(() => {
    receipt = {
      productId: 'gems_1000',
      transactionId: 'txn_001',
      purchaseDate: Date.now(),
      payload: 'test_payload',
      signature: 'sig_abc',
    };
  });

  it('validateReceipt succeeds with matching product and valid signature', () => {
    IAPValidator.setVerifier(() => true);
    const result = IAPValidator.validateReceipt(receipt, 'gems_1000');
    expect(result.valid).toBe(true);
    expect(result.transactionId).toBe('txn_001');
  });

  it('validateReceipt fails with product ID mismatch', () => {
    const result = IAPValidator.validateReceipt(receipt, 'other_product');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('不匹配');
  });

  it('validateReceipt fails with invalid signature', () => {
    IAPValidator.setVerifier(() => false);
    const result = IAPValidator.validateReceipt(receipt, 'gems_1000');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('签名验证失败');
  });

  it('grantReward invokes custom granter', () => {
    let grantedProduct = '';
    let grantedUser = '';
    IAPValidator.setGranter((pid, uid) => {
      grantedProduct = pid;
      grantedUser = uid;
    });
    IAPValidator.grantReward('gems_1000', 'player_7');
    expect(grantedProduct).toBe('gems_1000');
    expect(grantedUser).toBe('player_7');
  });

  it('restorePurchases returns non-consumable and subscription only', () => {
    const types = new Map<string, ProductType>();
    types.set('consumable_1', 'consumable');
    types.set('shield_perm', 'non-consumable');
    types.set('vip_monthly', 'subscription');

    const restored = IAPValidator.restorePurchases('u1', ['consumable_1', 'shield_perm', 'vip_monthly'], types);
    expect(restored).toEqual(['shield_perm', 'vip_monthly']);
  });
});

/* ================================================================
 * 3. CurrencyManager
 * ================================================================ */

describe('CurrencyManager', () => {
  let mgr: CurrencyManager;

  beforeEach(() => {
    mgr = new CurrencyManager();
  });

  it('starts with zero balance', () => {
    expect(mgr.getBalance('soft')).toBe(0);
    expect(mgr.getBalance('hard')).toBe(0);
  });

  it('earn adds soft currency', () => {
    const tx = mgr.earn('soft', 500, 'daily_login');
    expect(mgr.getBalance('soft')).toBe(500);
    expect(tx.amount).toBe(500);
    expect(tx.type).toBe('earn');
    expect(tx.source).toBe('daily_login');
    expect(tx.balanceAfter).toBe(500);
  });

  it('earn adds hard currency', () => {
    mgr.earn('hard', 100, 'quest_reward');
    expect(mgr.getBalance('hard')).toBe(100);
  });

  it('spend deducts currency', () => {
    mgr.earn('soft', 1000, 'level_up');
    const tx = mgr.spend('soft', 300, 'buy_item');
    expect(mgr.getBalance('soft')).toBe(700);
    expect(tx).not.toBeNull();
    expect(tx!.amount).toBe(300);
    expect(tx!.type).toBe('spend');
    expect(tx!.balanceAfter).toBe(700);
  });

  it('spend returns null when insufficient', () => {
    mgr.earn('soft', 100, 'login');
    const tx = mgr.spend('soft', 200, 'over_spend');
    expect(tx).toBeNull();
    expect(mgr.getBalance('soft')).toBe(100);
  });

  it('spend returns null for zero/negative amount', () => {
    expect(mgr.spend('soft', 0, 'zero')).toBeNull();
    expect(mgr.spend('soft', -5, 'negative')).toBeNull();
  });

  it('canAfford checks balance', () => {
    mgr.earn('soft', 500, 'reward');
    expect(mgr.canAfford('soft', 300)).toBe(true);
    expect(mgr.canAfford('soft', 600)).toBe(false);
    expect(mgr.canAfford('hard', 1)).toBe(false);
  });

  it('exchangeSoftToHard works with exact rate', () => {
    mgr.earn('soft', 2000, 'reward');
    const result = mgr.exchangeSoftToHard(2000);
    expect(result.success).toBe(true);
    expect(result.hardReceived).toBe(2);
    expect(mgr.getBalance('soft')).toBe(0);
    expect(mgr.getBalance('hard')).toBe(2);
  });

  it('exchangeSoftToHard rounds down', () => {
    mgr.earn('soft', 2499, 'reward');
    const result = mgr.exchangeSoftToHard(2499);
    expect(result.success).toBe(true);
    expect(result.hardReceived).toBe(2);
    expect(mgr.getBalance('soft')).toBe(499);
  });

  it('exchangeSoftToHard fails below minimum', () => {
    mgr.earn('soft', 500, 'reward');
    const result = mgr.exchangeSoftToHard(500);
    expect(result.success).toBe(false);
    expect(result.error).toContain('至少需要');
  });

  it('getAllBalances snapshot', () => {
    mgr.earn('soft', 100, 'a');
    mgr.earn('hard', 10, 'b');
    expect(mgr.getAllBalances()).toEqual({ soft: 100, hard: 10 });
  });

  it('getTransactions returns all', () => {
    mgr.earn('soft', 100, 'login');
    mgr.earn('hard', 5, 'quest');
    expect(mgr.getTransactions()).toHaveLength(2);
  });

  it('getTransactionsByType filters', () => {
    mgr.earn('soft', 100, 'reward');
    mgr.earn('soft', 200, 'login');
    mgr.spend('soft', 50, 'shop');
    expect(mgr.getTransactionsByType('earn')).toHaveLength(2);
    expect(mgr.getTransactionsByType('spend')).toHaveLength(1);
  });

  it('setExchangeRate updates rate', () => {
    mgr.setExchangeRate(500);
    mgr.earn('soft', 1000, 'reward');
    const result = mgr.exchangeSoftToHard(1000);
    expect(result.hardReceived).toBe(2);
  });

  it('serialization roundtrip', () => {
    mgr.earn('soft', 500, 'reward');
    mgr.earn('hard', 10, 'quest');
    mgr.spend('soft', 100, 'shop');
    const json = mgr.toJSON();
    const restored = CurrencyManager.fromJSON(json);
    expect(restored.getBalance('soft')).toBe(400);
    expect(restored.getBalance('hard')).toBe(10);
    expect(restored.getTransactionCount()).toBe(3);
    expect(restored.exchangeRate).toBe(1000);
  });
});

/* ================================================================
 * 4. BattlePass
 * ================================================================ */

const makeSeason = (overrides?: Partial<SeasonConfig>): SeasonConfig => ({
  seasonId: 's1',
  name: 'Season 1',
  theme: 'Dragon',
  startTime: Date.now() - 86400_000,
  endTime: Date.now() + 30 * 86400_000,
  maxLevel: 30,
  premiumPrice: 980,
  premiumCurrency: 'hard',
  baseXP: 100,
  xpIncrement: 50,
  ...overrides,
});

describe('BattlePass', () => {
  let bp: BattlePass;

  beforeEach(() => {
    bp = new BattlePass(makeSeason());
  });

  it('isActive during the season', () => {
    expect(bp.isActive()).toBe(true);
  });

  it('returns upcoming before start', () => {
    const upcoming = new BattlePass(makeSeason({ startTime: Date.now() + 86400_000 }));
    expect(upcoming.getSeasonStatus()).toBe('upcoming');
    expect(upcoming.isActive()).toBe(false);
  });

  it('returns ended after end', () => {
    const ended = new BattlePass(makeSeason({ endTime: Date.now() - 1000 }));
    expect(ended.getSeasonStatus()).toBe('ended');
    expect(ended.isActive()).toBe(false);
  });

  it('starts at level 0', () => {
    expect(bp.getLevel('u1')).toBe(0);
  });

  it('addXP increases level', () => {
    const prog = bp.addXP('u1', 250);
    expect(prog.currentLevel).toBe(2);
    expect(bp.getLevel('u1')).toBe(2);
  });

  it('addXP does not exceed max level', () => {
    const maxXP = bp.getCumulativeXP(30);
    bp.addXP('u1', maxXP * 2);
    expect(bp.getLevel('u1')).toBe(30);
  });

  it('addXP returns without progress during inactive season', () => {
    const ended = new BattlePass(makeSeason({ endTime: Date.now() - 1000 }));
    const prog = ended.addXP('u1', 1000);
    expect(prog.currentLevel).toBe(0);
  });

  it('claimReward on free track works', () => {
    bp.addXP('u1', 250);
    const result = bp.claimReward('u1', 'free', 1);
    expect(result.success).toBe(true);
    expect(result.rewards).toBeDefined();
    expect(result.rewards!.length).toBeGreaterThan(0);
  });

  it('claimReward fails for unowned premium', () => {
    const result = bp.claimReward('u1', 'premium', 1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Premium');
  });

  it('claimReward fails for unreached level', () => {
    const result = bp.claimReward('u1', 'free', 5);
    expect(result.success).toBe(false);
    expect(result.error).toContain('未达到');
  });

  it('claimReward fails for already claimed', () => {
    bp.addXP('u1', 250);
    bp.claimReward('u1', 'free', 1);
    const second = bp.claimReward('u1', 'free', 1);
    expect(second.success).toBe(false);
    expect(second.error).toContain('已领取');
  });

  it('isRewardClaimed returns correct state', () => {
    bp.addXP('u1', 250);
    expect(bp.isRewardClaimed('u1', 'free', 1)).toBe(false);
    bp.claimReward('u1', 'free', 1);
    expect(bp.isRewardClaimed('u1', 'free', 1)).toBe(true);
  });

  it('purchasePremium enables premium rewards', () => {
    bp.addXP('u1', 500);
    const purchase = bp.purchasePremium('u1');
    expect(purchase.success).toBe(true);
    expect(bp.hasPremium('u1')).toBe(true);

    const premiumReward = bp.claimReward('u1', 'premium', 1);
    expect(premiumReward.success).toBe(true);
  });

  it('purchasePremium fails if already owned', () => {
    bp.purchasePremium('u1');
    const second = bp.purchasePremium('u1');
    expect(second.success).toBe(false);
    expect(second.error).toContain('已拥有');
  });

  it('purchasePremium fails outside active season', () => {
    const ended = new BattlePass(makeSeason({ endTime: Date.now() - 1000 }));
    const result = ended.purchasePremium('u1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('赛季未开启或已结束');
  });

  it('getClaimableRewards lists unclaimed rewards', () => {
    bp.addXP('u1', 500);
    bp.purchasePremium('u1');
    const claimable = bp.getClaimableRewards('u1');
    expect(claimable.length).toBeGreaterThan(0);
    expect(claimable.some(c => c.track === 'free')).toBe(true);
    expect(claimable.some(c => c.track === 'premium')).toBe(true);
  });

  it('getAllLevelRewards returns all 30 levels', () => {
    expect(bp.getAllLevelRewards()).toHaveLength(30);
  });

  it('getTotalRewardCount returns correct counts', () => {
    const counts = bp.getTotalRewardCount();
    expect(counts.free).toBeGreaterThan(0);
    expect(counts.premium).toBeGreaterThan(0);
  });

  it('getLevelXP returns per-level XP cost', () => {
    expect(bp.getLevelXP(1)).toBe(100);
    expect(bp.getLevelXP(2)).toBe(150);
  });
});

/* ================================================================
 * 5. BundleManager
 * ================================================================ */

describe('BundleManager', () => {
  let bm: BundleManager;
  let activeBundle: Bundle;
  let expiredBundle: Bundle;

  beforeEach(() => {
    bm = new BundleManager();
    activeBundle = {
      id: 'starter_pack',
      name: 'Starter Pack',
      description: 'Begin here',
      products: ['sword_01', 'shield_perm'],
      discountPercent: 50,
      originalPrice: 49.98,
      finalPrice: 24.99,
      validUntil: Date.now() + 86400_000,
      purchaseLimit: 100,
    };
    expiredBundle = {
      id: 'old_pack',
      name: 'Old Pack',
      products: ['sword_01'],
      discountPercent: 20,
      originalPrice: 9.99,
      finalPrice: 7.99,
      validUntil: Date.now() - 1000,
      purchaseLimit: 50,
    };
  });

  it('addBundle / getBundle / removeBundle', () => {
    bm.addBundle(activeBundle);
    expect(bm.getBundle('starter_pack')).toEqual(activeBundle);
    expect(bm.removeBundle('starter_pack')).toBe(true);
    expect(bm.getBundle('starter_pack')).toBeUndefined();
  });

  it('getActiveBundles filters expired', () => {
    bm.addBundle(activeBundle);
    bm.addBundle(expiredBundle);
    const active = bm.getActiveBundles();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('starter_pack');
  });

  it('getActiveBundles filters out sold-out bundles', () => {
    const limitedBundle: Bundle = {
      id: 'limited',
      name: 'Limited',
      products: ['gem_pack'],
      discountPercent: 30,
      originalPrice: 30,
      finalPrice: 21,
      validUntil: Date.now() + 86400_000,
      purchaseLimit: 1,
    };
    bm.addBundle(limitedBundle);
    bm.purchaseBundle('limited', 'u1');
    expect(bm.getActiveBundles()).toHaveLength(0);
  });

  it('purchaseBundle succeeds', () => {
    bm.addBundle(activeBundle);
    const result = bm.purchaseBundle('starter_pack', 'u1');
    expect(result.success).toBe(true);
    expect(result.bundle).toEqual(activeBundle);
  });

  it('purchaseBundle fails for expired', () => {
    bm.addBundle(expiredBundle);
    const result = bm.purchaseBundle('old_pack', 'u1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('过期');
  });

  it('purchaseBundle fails when user hit limit', () => {
    const limited: Bundle = {
      id: 'once',
      name: 'Once Only',
      products: ['gem'],
      discountPercent: 10,
      originalPrice: 10,
      finalPrice: 9,
      validUntil: Date.now() + 86400_000,
      purchaseLimit: 1,
    };
    bm.addBundle(limited);
    bm.purchaseBundle('once', 'u1');
    const result = bm.purchaseBundle('once', 'u1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('购买上限');
  });

  it('getSavings calculates correctly', () => {
    bm.addBundle(activeBundle);
    expect(bm.getSavings('starter_pack')).toBe(24.99);
  });

  it('getExpiringSoonBundles returns bundles expiring within the window', () => {
    const soon: Bundle = {
      id: 'flash_sale',
      name: 'Flash Sale',
      products: ['gem'],
      discountPercent: 70,
      originalPrice: 100,
      finalPrice: 30,
      validUntil: Date.now() + 1800_000, // 30 min
      purchaseLimit: 0,
    };
    bm.addBundle(soon);
    bm.addBundle(activeBundle);
    const expiring = bm.getExpiringSoonBundles(3600_000);
    expect(expiring).toHaveLength(1);
    expect(expiring[0].id).toBe('flash_sale');
  });

  it('getUserPurchasedBundles returns bundle IDs', () => {
    bm.addBundle(activeBundle);
    bm.purchaseBundle('starter_pack', 'u1');
    expect(bm.getUserPurchasedBundles('u1')).toEqual(['starter_pack']);
  });

  describe('LimitedTimeOffer triggers', () => {
    it('triggers welcome offer on first login', () => {
      const offer: LimitedTimeOffer = {
        id: 'welcome_1',
        name: 'Welcome Gift',
        description: 'Welcome!',
        trigger: { type: 'welcome', firstLogin: true },
        bundleId: 'starter_pack',
        durationMs: 86400_000,
      };
      bm.addBundle(activeBundle);
      bm.addOffer(offer);
      const triggered = bm.getTriggeredOffers('u1', {
        isFirstLogin: true,
        daysSinceLastLogin: 0,
        now: new Date(),
      });
      expect(triggered).toHaveLength(1);
      expect(triggered[0].id).toBe('welcome_1');
    });

    it('does not trigger welcome offer if not first login', () => {
      const offer: LimitedTimeOffer = {
        id: 'welcome_1',
        name: 'Welcome Gift',
        description: 'Welcome!',
        trigger: { type: 'welcome', firstLogin: true },
        bundleId: 'starter_pack',
        durationMs: 86400_000,
      };
      bm.addBundle(activeBundle);
      bm.addOffer(offer);
      const triggered = bm.getTriggeredOffers('u1', {
        isFirstLogin: false,
        daysSinceLastLogin: 1,
        now: new Date(),
      });
      expect(triggered).toHaveLength(0);
    });

    it('triggers return offer after enough days away', () => {
      const offer: LimitedTimeOffer = {
        id: 'return_1',
        name: 'Welcome Back',
        description: 'Returning hero!',
        trigger: { type: 'return', returnAfterDays: 7 },
        bundleId: 'starter_pack',
        durationMs: 172800_000,
      };
      bm.addBundle(activeBundle);
      bm.addOffer(offer);
      const triggered = bm.getTriggeredOffers('u1', {
        isFirstLogin: false,
        daysSinceLastLogin: 10,
        now: new Date(),
      });
      expect(triggered).toHaveLength(1);
    });

    it('triggers festival offer on matching date', () => {
      const now = new Date('2026-01-01T12:00:00');
      const offer: LimitedTimeOffer = {
        id: 'ny_offer',
        name: 'New Year Sale',
        description: 'Happy New Year!',
        trigger: { type: 'festival', festivalDate: '01-01' },
        bundleId: 'starter_pack',
        durationMs: 86400_000,
      };
      bm.addBundle(activeBundle);
      bm.addOffer(offer);
      const triggered = bm.getTriggeredOffers('u1', {
        isFirstLogin: false,
        daysSinceLastLogin: 0,
        now,
      });
      expect(triggered).toHaveLength(1);
    });

    it('respects cooldown for offers', () => {
      const offer: LimitedTimeOffer = {
        id: 'welcome_1',
        name: 'Welcome Gift',
        description: 'Welcome!',
        trigger: { type: 'welcome', firstLogin: true },
        bundleId: 'starter_pack',
        durationMs: 86400_000,
        cooldownMs: 3600_000,
      };
      bm.addBundle(activeBundle);
      bm.addOffer(offer);
      bm.recordOfferShown('u1', 'welcome_1');

      const triggered = bm.getTriggeredOffers('u1', {
        isFirstLogin: true,
        daysSinceLastLogin: 0,
        now: new Date(),
      });
      expect(triggered).toHaveLength(0);
    });
  });
});

/* ================================================================
 * 6. AdManager
 * ================================================================ */

describe('AdManager', () => {
  let ads: AdManager;

  beforeEach(() => {
    ads = new AdManager();
  });

  it('showAd succeeds for valid placement', () => {
    const result = ads.showAd('rewarded', 'level_complete');
    expect(result.success).toBe(true);
  });

  it('showAd succeeds for interstitial', () => {
    const result = ads.showAd('interstitial', 'pause_menu');
    expect(result.success).toBe(true);
  });

  it('showAd succeeds for banner', () => {
    const result = ads.showAd('banner', 'home_banner');
    expect(result.success).toBe(true);
  });

  it('showAd fails within minInterval', () => {
    ads.showAd('rewarded', 'level_complete');
    const result = ads.showAd('rewarded', 'daily_bonus');
    expect(result.success).toBe(false);
    expect(result.error).toContain('冷却');
  });

  it('showAd allows different type within interval', () => {
    ads.showAd('rewarded', 'level_complete');
    const result = ads.showAd('interstitial', 'pause_menu');
    expect(result.success).toBe(true);
  });

  it('respects daily limit', () => {
    const limitedAds = new AdManager({ dailyLimitPerType: 3 });
    for (let i = 0; i < 3; i++) {
      // Simulate time passing
      const now = Date.now() + i * 31000;
      const result = limitedAds.showAd('rewarded', 'level_complete', now);
      expect(result.success).toBe(true);
    }
    const now = Date.now() + 4 * 31000;
    const overLimit = limitedAds.showAd('rewarded', 'daily_bonus', now);
    expect(overLimit.success).toBe(false);
    expect(overLimit.error).toContain('上限');
  });

  it('onAdWatched fires callbacks', () => {
    let fired = false;
    let firedPlacement = '';
    ads.onAdWatchedCallback((placement) => {
      fired = true;
      firedPlacement = placement;
    });
    ads.showAd('rewarded', 'level_complete');
    ads.onAdWatched('level_complete');
    expect(fired).toBe(true);
    expect(firedPlacement).toBe('level_complete');
  });

  it('removeAds works with correct product ID', () => {
    const result = ads.removeAds('remove_ads');
    expect(result.success).toBe(true);
    expect(ads.isAdsRemoved()).toBe(true);
  });

  it('removeAds rejects invalid product ID', () => {
    const result = ads.removeAds('wrong_id');
    expect(result.success).toBe(false);
    expect(result.error).toContain('无效');
  });

  it('showAd fails after ads removed', () => {
    ads.removeAds('remove_ads');
    const result = ads.showAd('rewarded', 'level_complete');
    expect(result.success).toBe(false);
    expect(result.error).toContain('去广告');
  });

  it('getTodayImpressions counts correctly', () => {
    const now = Date.now();
    ads.showAd('rewarded', 'level_complete', now);
    ads.showAd('rewarded', 'daily_bonus', now + 31000);
    expect(ads.getTodayImpressions('rewarded')).toBe(2);
  });

  it('getRemainingToday shows correct counts', () => {
    const now = Date.now();
    ads.showAd('rewarded', 'level_complete', now);
    expect(ads.getRemainingToday('rewarded')).toBe(19);
  });

  it('getStats returns summary', () => {
    ads.showAd('rewarded', 'level_complete');
    const stats = ads.getStats();
    expect(stats.total).toBe(1);
    expect(stats.byType.rewarded).toBe(1);
    expect(stats.byType.interstitial).toBe(0);
    expect(stats.remainingToday.rewarded).toBe(19);
  });

  it('canShow returns true when available', () => {
    expect(ads.canShow('rewarded')).toBe(true);
  });

  it('canShow returns false after removal', () => {
    ads.removeAds('remove_ads');
    expect(ads.canShow('rewarded')).toBe(false);
  });

  it('updateFrequency changes config', () => {
    ads.updateFrequency({ dailyLimitPerType: 10 });
    expect(ads.getFrequencyConfig().dailyLimitPerType).toBe(10);
  });

  it('removeCallback works', () => {
    let count = 0;
    const cb = () => { count++; };
    ads.onAdWatchedCallback(cb);
    ads.removeCallback(cb);
    ads.showAd('rewarded', 'level_complete');
    ads.onAdWatched('level_complete');
    expect(count).toBe(0);
  });
});
