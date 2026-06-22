/**
 * Store — 商品系统 & IAP 验证 & 虚拟货币
 *
 * 设计原则：
 *  - 所有价格与货币操作为纯逻辑计算
 *  - 不依赖任何平台特定 API（iOS/Android 沙盒回调由外部注入）
 *  - 状态可通过 JSON 序列化/反序列化
 */

/* ================================================================
 * 商品系统
 * ================================================================ */

/** 商品类型 */
export type ProductType = 'consumable' | 'non-consumable' | 'subscription';

/** 商品定义 */
export interface Product {
  id: string;
  type: ProductType;
  priceTier: PriceTierLevel;
  currency: CurrencyType;
  displayName: string;
  icon: string;
  /** 出货内容：物品 ID → 数量 */
  rewards: Record<string, number>;
}

/** 价格阶梯等级 */
export type PriceTierLevel = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

/** 货币类型 */
export type CurrencyType = 'USD' | 'CNY' | 'soft' | 'hard';

/**
 * PriceTier — 价格阶梯
 *
 * T1 - T6 对应常见美元档位（$0.99 - $99.99）
 */
export const PRICE_TIERS: Record<PriceTierLevel, { usd: number; cny: number }> = {
  T1: { usd: 0.99, cny: 6 },
  T2: { usd: 4.99, cny: 30 },
  T3: { usd: 9.99, cny: 68 },
  T4: { usd: 19.99, cny: 128 },
  T5: { usd: 49.99, cny: 328 },
  T6: { usd: 99.99, cny: 648 },
};

/** 根据阶梯获取价格 */
export function getPrice(tier: PriceTierLevel, currency: CurrencyType): number {
  const t = PRICE_TIERS[tier];
  if (currency === 'USD') return t.usd;
  if (currency === 'CNY') return t.cny;
  return t.usd; // fallback
}

/** 购买条件 */
export interface PurchaseCondition {
  /** 最低等级要求 */
  minLevel?: number;
  /** VIP 等级要求 */
  minVipLevel?: number;
  /** 限购次数（-1 无限） */
  maxPurchases?: number;
  /** 限时售卖截止时间戳（0 表示不限） */
  saleEndTime?: number;
}

/** 购买记录 */
export interface PurchaseRecord {
  userId: string;
  productId: string;
  timestamp: number;
  receipt: string;
}

/**
 * StoreCatalog — 商品目录管理
 */
export class StoreCatalog {
  private products = new Map<string, Product>();
  private purchases: PurchaseRecord[] = [];

  /** 添加商品 */
  addProduct(product: Product): void {
    this.products.set(product.id, product);
  }

  /** 移除商品 */
  removeProduct(id: string): boolean {
    return this.products.delete(id);
  }

  /** 获取商品 */
  getProduct(id: string): Product | undefined {
    return this.products.get(id);
  }

  /** 按类型获取商品列表 */
  getProductsByType(type: ProductType): Product[] {
    return [...this.products.values()].filter((p) => p.type === type);
  }

  /** 获取全部商品 */
  getAllProducts(): Product[] {
    return [...this.products.values()];
  }

  /** 记录购买 */
  recordPurchase(record: PurchaseRecord): void {
    this.purchases.push(record);
  }

  /** 获取用户对某商品的购买次数 */
  getPurchaseCount(userId: string, productId: string): number {
    return this.purchases.filter((r) => r.userId === userId && r.productId === productId).length;
  }

  /** 获取用户所有购买记录 */
  getUserPurchases(userId: string): PurchaseRecord[] {
    return this.purchases.filter((r) => r.userId === userId);
  }
}

/**
 * PurchaseValidator — 购买前置校验
 */
export class PurchaseValidator {
  /**
   * 校验购买条件
   * @returns { valid: boolean, reason?: string }
   */
  validate(
    product: Product,
    userId: string,
    userLevel: number,
    vipLevel: number,
    catalog: StoreCatalog,
    now: number = Date.now(),
  ): { valid: boolean; reason?: string } {
    // 限时售卖
    const condition = this.getCondition(product, userId, catalog);
    if (condition.saleEndTime && condition.saleEndTime > 0 && now > condition.saleEndTime) {
      return { valid: false, reason: '该商品限时售卖已结束' };
    }

    // 等级限制
    if (condition.minLevel && userLevel < condition.minLevel) {
      return { valid: false, reason: `需要等级 ${condition.minLevel}（当前 ${userLevel}）` };
    }

    // VIP 限制
    if (condition.minVipLevel && vipLevel < condition.minVipLevel) {
      return { valid: false, reason: `需要 VIP${condition.minVipLevel}（当前 VIP${vipLevel}）` };
    }

    // 限购次数
    if (condition.maxPurchases && condition.maxPurchases > 0) {
      const count = catalog.getPurchaseCount(userId, product.id);
      if (count >= condition.maxPurchases) {
        return { valid: false, reason: `限购 ${condition.maxPurchases} 次（已购 ${count} 次）` };
      }
    }

    return { valid: true };
  }

  /** 获取综合购买条件（从商品和系统默认合并） */
  getCondition(_product: Product, _userId: string, _catalog: StoreCatalog): PurchaseCondition {
    // 实际项目中可从配置/远程拉取，此处使用商品上的元信息
    // 为简化，直接返回默认值（无限制）
    return {};
  }

  /** 设置商品的购买条件 */
  setCondition(productId: string, condition: PurchaseCondition, conditions: Map<string, PurchaseCondition>): void {
    conditions.set(productId, condition);
  }
}

/* ================================================================
 * IAP 验证命名空间
 * ================================================================ */

export interface IAPReceipt {
  productId: string;
  transactionId: string;
  purchaseDate: number;
  payload: string;
  signature: string;
}

export interface IAPValidationResult {
  valid: boolean;
  error?: string;
  transactionId?: string;
}

/** 回调类型：平台签名验证 */
export type SignatureVerifier = (payload: string, signature: string) => boolean;

/** 回调类型：发货 */
export type RewardGranter = (productId: string, userId: string) => void;

export namespace IAPValidator {
  let signatureVerifier: SignatureVerifier = () => true; // 默认通过（测试用）
  let rewardGranter: RewardGranter = () => {};

  /** 注册签名验证器 */
  export function setVerifier(fn: SignatureVerifier): void {
    signatureVerifier = fn;
  }

  /** 注册发货回调 */
  export function setGranter(fn: RewardGranter): void {
    rewardGranter = fn;
  }

  /** 票据校验流程 */
  export function validateReceipt(receipt: IAPReceipt, productId: string): IAPValidationResult {
    // 1. 验证 productId 一致性
    if (receipt.productId !== productId) {
      return { valid: false, error: `票据商品 ID 不匹配：${receipt.productId} vs ${productId}` };
    }

    // 2. 签名验证
    if (!verifySignature(receipt.payload, receipt.signature)) {
      return { valid: false, error: '签名验证失败' };
    }

    return { valid: true, transactionId: receipt.transactionId };
  }

  /** 签名校验 */
  export function verifySignature(payload: string, signature: string): boolean {
    return signatureVerifier(payload, signature);
  }

  /** 发货逻辑 */
  export function grantReward(productId: string, userId: string): void {
    rewardGranter(productId, userId);
  }

  /** 恢复购买 */
  export function restorePurchases(
    userId: string,
    productIds: string[],
    productTypes: Map<string, ProductType>,
  ): string[] {
    // 仅恢复非消耗品和订阅
    return productIds.filter((id) => {
      const type = productTypes.get(id);
      return type === 'non-consumable' || type === 'subscription';
    });
  }
}

/* ================================================================
 * 虚拟货币系统
 * ================================================================ */

/** 货币种类 */
export type CurrencyKind = 'soft' | 'hard';

/** 交易记录 */
export interface Transaction {
  id: string;
  timestamp: number;
  kind: CurrencyKind;
  amount: number;
  balanceAfter: number;
  type: 'earn' | 'spend';
  source: string; // earn 来源 / spend 原因
}

/**
 * CurrencyManager — 双货币模型管理
 *
 * - 软货币（金币）：游戏内大量产出，用于基础消费
 * - 硬货币（钻石）：稀缺产出，常用于付费获取
 */
export class CurrencyManager {
  private balances: Record<CurrencyKind, number> = { soft: 0, hard: 0 };
  private transactions: Transaction[] = [];
  private nextTxId = 1;
  private softToHardRate = 1000; // 1000 金币 = 1 钻石

  /** 获取余额 */
  getBalance(kind: CurrencyKind): number {
    return this.balances[kind];
  }

  /** 获取所有余额 */
  getAllBalances(): Record<CurrencyKind, number> {
    return { ...this.balances };
  }

  /** 获取货币 */
  earn(kind: CurrencyKind, amount: number, source: string): Transaction {
    if (amount <= 0) {
      return this.makeTx(kind, 0, this.balances[kind], 'earn', source);
    }
    this.balances[kind] += amount;
    return this.makeTx(kind, amount, this.balances[kind], 'earn', source);
  }

  /** 消费货币 */
  spend(kind: CurrencyKind, amount: number, reason: string): Transaction | null {
    if (amount <= 0) return null;
    if (this.balances[kind] < amount) return null;
    this.balances[kind] -= amount;
    return this.makeTx(kind, amount, this.balances[kind], 'spend', reason);
  }

  /** 是否可以支付 */
  canAfford(kind: CurrencyKind, amount: number): boolean {
    return amount > 0 && this.balances[kind] >= amount;
  }

  /** 获取交易记录 */
  getTransactions(): Transaction[] {
    return [...this.transactions];
  }

  /** 按类型获取交易记录 */
  getTransactionsByType(type: 'earn' | 'spend'): Transaction[] {
    return this.transactions.filter((t) => t.type === type);
  }

  /** 获取历史记录总数 */
  getTransactionCount(): number {
    return this.transactions.length;
  }

  /** 软硬货币兑换率 */
  get exchangeRate(): number {
    return this.softToHardRate;
  }

  /** 设置兑换率 */
  setExchangeRate(rate: number): void {
    if (rate > 0) this.softToHardRate = rate;
  }

  /** 软货币兑换为硬货币 */
  exchangeSoftToHard(softAmount: number): { success: boolean; hardReceived?: number; error?: string } {
    if (softAmount <= 0) return { success: false, error: '兑换数量必须大于 0' };
    if (softAmount < this.softToHardRate) {
      return { success: false, error: `至少需要 ${this.softToHardRate} 金币兑换 1 钻石` };
    }
    const hard = Math.floor(softAmount / this.softToHardRate);
    if (hard === 0) return { success: false, error: '兑换数量不足' };
    const convertibleAmount = hard * this.softToHardRate;
    if (this.balances.soft < convertibleAmount) return { success: false, error: '金币不足' };

    this.balances.soft -= convertibleAmount;
    this.balances.hard += hard;
    this.makeTx('soft', convertibleAmount, this.balances.soft, 'spend', 'currency_exchange');
    this.makeTx('hard', hard, this.balances.hard, 'earn', 'currency_exchange');

    return { success: true, hardReceived: hard };
  }

  /** 序列化为 JSON */
  toJSON(): string {
    return JSON.stringify({
      balances: { ...this.balances },
      transactions: this.transactions,
      nextTxId: this.nextTxId,
      softToHardRate: this.softToHardRate,
    });
  }

  /** 从 JSON 恢复 */
  static fromJSON(json: string): CurrencyManager {
    const data = JSON.parse(json);
    const mgr = new CurrencyManager();
    mgr.balances = { ...data.balances };
    mgr.transactions = data.transactions ?? [];
    mgr.nextTxId = data.nextTxId ?? 1;
    mgr.softToHardRate = data.softToHardRate ?? 1000;
    return mgr;
  }

  private makeTx(
    kind: CurrencyKind,
    amount: number,
    balanceAfter: number,
    type: 'earn' | 'spend',
    source: string,
  ): Transaction {
    const tx: Transaction = {
      id: `tx_${this.nextTxId++}`,
      timestamp: Date.now(),
      kind,
      amount,
      balanceAfter,
      type,
      source,
    };
    this.transactions.push(tx);
    return tx;
  }
}
