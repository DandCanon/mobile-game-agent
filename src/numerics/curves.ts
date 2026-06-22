/* ===================================================================
 * src/numerics/curves.ts — 手游核心数值工具库
 *
 * 提供成长曲线、掉落系统、战斗数值、经济平衡四大模块。
 * =================================================================== */

/* ==================== 通用工具类型 ==================== */

/** 分段曲线定义：等级区间 [from, to] 内使用指定公式与参数 */
export interface PiecewiseSegment {
  from: number;
  to: number;
  formula: 'linear' | 'exponential' | 'polynomial';
  /** 公式参数，语义由 formula 决定 */
  params: number[];
}

/** 掉落项定义 */
export interface DropItem<T = string> {
  item: T;
  weight: number;
  minQuantity?: number;
  maxQuantity?: number;
  /** 掉落条件函数，返回 false 则该掉落项本次不参与随机 */
  conditions?: () => boolean;
}

/** 抽卡结果 */
export interface GachaResult {
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  /** 本次是否触发保底 */
  pityTriggered: boolean;
  /** 是否为新卡（占位，默认 true） */
  newCard: boolean;
}

/** 稀有度配置 */
export interface RarityConfig {
  rarity: 'N' | 'R' | 'SR' | 'SSR';
  baseProbability: number;
}

/** 抽卡统计 */
export interface GachaStats {
  totalPulls: number;
  rarityDistribution: Record<string, number>;
  pityTriggerCount: number;
  averagePullsPerSSR: number;
  averagePullsPerSRPlus: number;
}

/** 战斗公式枚举 */
export type ArmorFormula = 'linear' | 'logarithmic' | 'piecewise';

/** 战力权重 */
export interface CombatWeight {
  atk?: number;
  hp?: number;
  armor?: number;
  speed?: number;
  critRate?: number;
  critDamage?: number;
}

/** 资源项 */
export interface ResourceItem {
  name: string;
  cost: number;
  produce: number;
}

/* ==================== 1. 成长曲线 ==================== */

export class GrowthCurve {
  /** 线性成长：base + slope * level */
  static linear(base: number, slope: number, level: number): number {
    if (level < 0) throw new RangeError('level must be >= 0');
    return base + slope * level;
  }

  /** 指数成长：base * factor^level */
  static exponential(base: number, factor: number, level: number): number {
    if (level < 0) throw new RangeError('level must be >= 0');
    if (factor < 0) throw new RangeError('factor must be >= 0');
    return base * Math.pow(factor, level);
  }

  /** 多项式：base + coefficient * level^degree */
  static polynomial(base: number, coefficient: number, degree: number, level: number): number {
    if (level < 0) throw new RangeError('level must be >= 0');
    if (degree < 0) throw new RangeError('degree must be >= 0');
    return base + coefficient * Math.pow(level, degree);
  }

  /** S 型曲线（Logistic）：max / (1 + e^(-steepness * (level - midpoint))) */
  static logistic(max: number, midpoint: number, steepness: number, level: number): number {
    if (level < 0) throw new RangeError('level must be >= 0');
    if (max <= 0) throw new RangeError('max must be > 0');
    if (steepness <= 0) throw new RangeError('steepness must be > 0');
    return max / (1 + Math.exp(-steepness * (level - midpoint)));
  }

  /** 分段曲线：不同等级区间使用不同公式 */
  static piecewise(segments: PiecewiseSegment[], level: number): number {
    if (level < 0) throw new RangeError('level must be >= 0');
    for (const seg of segments) {
      if (level >= seg.from && level <= seg.to) {
        const [p0, p1, p2] = seg.params;
        switch (seg.formula) {
          case 'linear':
            return GrowthCurve.linear(p0, p1, level);
          case 'exponential':
            return GrowthCurve.exponential(p0, p1, level);
          case 'polynomial':
            return GrowthCurve.polynomial(p0, p1, p2 ?? 2, level);
        }
      }
    }
    // 超出所有分段时使用最后一个段的终值
    const last = segments[segments.length - 1];
    if (level > last.to) {
      const [p0, p1, p2] = last.params;
      switch (last.formula) {
        case 'linear': return GrowthCurve.linear(p0, p1, last.to);
        case 'exponential': return GrowthCurve.exponential(p0, p1, last.to);
        case 'polynomial': return GrowthCurve.polynomial(p0, p1, p2 ?? 2, last.to);
      }
    }
    return 0;
  }

  /**
   * 反查：给定目标值，推算所需等级。
   * 使用二分搜索在 levelRange 内找到第一个使 curve(level) >= target 的等级。
   * @param curveFn 成长函数，接收 level 返回数值
   * @param target 目标值
   * @param levelRange [minLevel, maxLevel] 搜索范围
   * @param tolerance 容差，默认 0.01
   */
  static inverseCurve(
    curveFn: (level: number) => number,
    target: number,
    levelRange: [number, number],
    tolerance: number = 0.01,
  ): number | null {
    const [lo, hi] = levelRange;
    if (lo > hi) throw new RangeError('levelRange: lo must be <= hi');

    // 检查是否在可达范围内
    if (curveFn(lo) >= target) return lo;
    if (curveFn(hi) < target) return null;

    let low = lo;
    let high = hi;
    while (high - low > tolerance) {
      const mid = (low + high) / 2;
      if (curveFn(mid) < target) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return Math.ceil(high * 100) / 100;
  }
}

/* ==================== 2. 掉落系统 ==================== */

/** 加权随机掉落表 */
export class LootTable<T = string> {
  private drops: DropItem<T>[] = [];
  private totalWeight: number = 0;

  /** 添加掉落项 */
  addDrop(item: T, weight: number, minQuantity?: number, maxQuantity?: number, conditions?: () => boolean): void {
    if (weight <= 0) throw new RangeError('weight must be > 0');
    this.drops.push({ item, weight, minQuantity, maxQuantity, conditions });
    this.totalWeight += weight;
  }

  /** 移除所有掉落项 */
  clear(): void {
    this.drops = [];
    this.totalWeight = 0;
  }

  /**
   * 按权重随机抽取。
   * @param count 抽取次数，默认 1
   * @param withReplacement 是否放回，默认 true
   */
  roll(count: number = 1, withReplacement: boolean = true): { item: T; quantity: number }[] {
    if (count < 0) throw new RangeError('count must be >= 0');
    const results: { item: T; quantity: number }[] = [];

    const activeDrops = this.drops.filter(
      (d) => d.conditions === undefined || d.conditions(),
    );
    if (activeDrops.length === 0) return results;

    if (withReplacement) {
      // 放回：每次独立抽取
      const totalW = activeDrops.reduce((s, d) => s + d.weight, 0);
      if (totalW <= 0) return results;
      for (let i = 0; i < count; i++) {
        let roll = Math.random() * totalW;
        for (const drop of activeDrops) {
          roll -= drop.weight;
          if (roll <= 0) {
            const qty = this.randomQuantity(drop);
            results.push({ item: drop.item, quantity: qty });
            break;
          }
        }
      }
    } else {
      // 不放回：每次抽取后将该项权重设为 0
      const remaining = activeDrops.map((d) => ({ ...d }));
      const actual = Math.min(count, remaining.length);
      for (let i = 0; i < actual; i++) {
        const totalW = remaining.reduce((s, d) => s + d.weight, 0);
        if (totalW <= 0) break;
        let roll = Math.random() * totalW;
        let idx = 0;
        for (let j = 0; j < remaining.length; j++) {
          roll -= remaining[j].weight;
          if (roll <= 0) {
            idx = j;
            break;
          }
        }
        const drop = remaining[idx];
        const qty = this.randomQuantity(drop);
        results.push({ item: drop.item, quantity: qty });
        remaining.splice(idx, 1);
      }
    }

    return results;
  }

  /**
   * 伪随机保底抽取（Pity System）。
   * 在 count 次抽取中，若连续未命中"稀有"掉落，触发保底必定命中。
   * @param count 抽取次数
   * @param rareItem 稀有掉落项标识
   * @param pityThreshold 保底阈值（连续未命中此次数后触发）
   */
  rollGuaranteed(count: number, rareItem: T, pityThreshold: number): { item: T; quantity: number }[] {
    if (count < 0) throw new RangeError('count must be >= 0');
    const results: { item: T; quantity: number }[] = [];
    let missStreak = 0;

    for (let i = 0; i < count; i++) {
      // 检查是否触发保底
      if (missStreak >= pityThreshold - 1) {
        const rareDrop = this.drops.find((d) => d.item === rareItem);
        if (rareDrop) {
          results.push({ item: rareDrop.item, quantity: this.randomQuantity(rareDrop) });
          missStreak = 0;
          continue;
        }
      }

      // 正常抽取
      const activeDrops = this.drops.filter(
        (d) => d.conditions === undefined || d.conditions(),
      );
      if (activeDrops.length === 0) break;

      const totalW = activeDrops.reduce((s, d) => s + d.weight, 0);
      let roll = Math.random() * totalW;
      let chosen: DropItem<T> | null = null;
      for (const drop of activeDrops) {
        roll -= drop.weight;
        if (roll <= 0) {
          chosen = drop;
          break;
        }
      }
      if (chosen) {
        results.push({ item: chosen.item, quantity: this.randomQuantity(chosen) });
        if (chosen.item === rareItem) {
          missStreak = 0;
        } else {
          missStreak++;
        }
      }
    }

    return results;
  }

  private randomQuantity(drop: DropItem<T>): number {
    const min = drop.minQuantity ?? 1;
    const max = drop.maxQuantity ?? min;
    if (min === max) return min;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}

/** 抽卡系统 */
export class GachaBanner {
  /** 稀有度配置（从低到高排列） */
  readonly rarities: RarityConfig[];
  /** 软保底起始抽数 */
  readonly softPityStart: number;
  /** 硬保底抽数 */
  readonly hardPity: number;
  /** 软保底每抽概率增量 */
  readonly softPityIncrement: number;

  private pityCounter: number = 0;

  /**
   * @param rarities 稀有度配置数组（如 N/R/SR/SSR），按稀有度升序排列，各概率之和应为 1
   * @param softPityStart 软保底起始抽数（从此抽开始概率递增）
   * @param hardPity 硬保底抽数（此抽必定出货）
   * @param softPityIncrement 软保底每抽概率增量（加到最高稀有度上）
   */
  constructor(
    rarities: RarityConfig[],
    softPityStart: number = 75,
    hardPity: number = 90,
    softPityIncrement: number = 0.06,
  ) {
    if (rarities.length === 0) throw new RangeError('rarities must not be empty');
    this.rarities = [...rarities];
    this.softPityStart = softPityStart;
    this.hardPity = hardPity;
    this.softPityIncrement = softPityIncrement;
  }

  /** 重置保底计数器 */
  resetPity(): void {
    this.pityCounter = 0;
  }

  /**
   * 执行抽卡。
   * @param count 抽取次数
   * @returns 抽卡结果列表
   */
  pull(count: number = 1): GachaResult[] {
    if (count < 0) throw new RangeError('count must be >= 0');
    const results: GachaResult[] = [];

    for (let i = 0; i < count; i++) {
      this.pityCounter++;
      const highestRarity = this.rarities[this.rarities.length - 1];
      let effectiveProb = highestRarity.baseProbability;

      // 硬保底必定出货
      if (this.pityCounter >= this.hardPity) {
        results.push({ rarity: highestRarity.rarity, pityTriggered: true, newCard: true });
        this.pityCounter = 0;
        continue;
      }

      // 软保底概率递增
      if (this.pityCounter >= this.softPityStart) {
        effectiveProb += this.softPityIncrement * (this.pityCounter - this.softPityStart + 1);
        effectiveProb = Math.min(effectiveProb, 1);
      }

      // 调整稀有度概率：最高稀有度使用 effectiveProb，其余按比例缩放
      const adjustedRarities = this.rarities.map((r) => {
        if (r.rarity === highestRarity.rarity) {
          return { ...r, baseProbability: effectiveProb };
        }
        return { ...r, baseProbability: r.baseProbability * ((1 - effectiveProb) / (1 - highestRarity.baseProbability)) };
      });

      const roll = Math.random();
      let cumulative = 0;
      let selectedRarity: RarityConfig = adjustedRarities[0];

      for (const r of adjustedRarities) {
        cumulative += r.baseProbability;
        if (roll <= cumulative) {
          selectedRarity = r;
          break;
        }
      }

      const isHighest = selectedRarity.rarity === highestRarity.rarity;
      results.push({
        rarity: selectedRarity.rarity,
        pityTriggered: isHighest && this.pityCounter >= this.softPityStart,
        newCard: true,
      });

      if (isHighest) {
        this.pityCounter = 0;
      }
    }

    return results;
  }
}

/* ==================== 3. 战斗数值 ==================== */

export namespace CombatMath {
  /**
   * 护甲减伤率。
   * @param armor 护甲值
   * @param formula 公式类型
   * @param params 公式参数（linear: [k]; logarithmic: [k]; piecewise: [threshold, ratio1, ratio2]）
   * @returns 减伤率 (0~1)
   */
  export function damageReduction(
    armor: number,
    formula: ArmorFormula,
    params: number[] = [],
  ): number {
    if (armor < 0) throw new RangeError('armor must be >= 0');

    switch (formula) {
      case 'linear': {
        // 线性：armor / (armor + k)，k 默认 100
        const k = params[0] ?? 100;
        if (k <= 0) throw new RangeError('k must be > 0');
        return armor / (armor + k);
      }
      case 'logarithmic': {
        // 对数：min(1, ln(1 + armor/k) * ratio)，默认 k=100, ratio=0.15
        const k = params[0] ?? 100;
        const ratio = params[1] ?? 0.15;
        if (k <= 0) throw new RangeError('k must be > 0');
        return Math.min(1, Math.log(1 + armor / k) * ratio);
      }
      case 'piecewise': {
        // 分段：armor < threshold 用线性，>= threshold 用 ratio2 衰减
        const threshold = params[0] ?? 100;
        const ratio1 = params[1] ?? 0.01;
        const ratio2 = params[2] ?? 0.002;
        if (armor < threshold) {
          return Math.min(1, armor * ratio1);
        }
        return Math.min(1, threshold * ratio1 + (armor - threshold) * ratio2);
      }
    }
  }

  /**
   * 期望秒伤（Expected DPS）。
   * @param atk 攻击力
   * @param speed 攻速（次/秒）
   * @param critRate 暴击率 (0~1)
   * @param critDamage 暴击伤害倍率（如 1.5 表示暴击 150% 伤害）
   */
  export function expectedDPS(
    atk: number,
    speed: number,
    critRate: number,
    critDamage: number,
  ): number {
    if (atk < 0) throw new RangeError('atk must be >= 0');
    if (speed < 0) throw new RangeError('speed must be >= 0');
    if (critRate < 0 || critRate > 1) throw new RangeError('critRate must be 0~1');
    if (critDamage < 0) throw new RangeError('critDamage must be >= 0');
    return atk * speed * (1 + critRate * (critDamage - 1));
  }

  /**
   * 有效生命值（Effective HP）。
   * @param hp 生命值
   * @param armor 护甲值
   * @param formula 减伤公式
   * @param params 公式参数
   */
  export function effectiveHP(
    hp: number,
    armor: number,
    formula: ArmorFormula,
    params: number[] = [],
  ): number {
    if (hp < 0) throw new RangeError('hp must be >= 0');
    const dr = damageReduction(armor, formula, params);
    return dr >= 1 ? Infinity : hp / (1 - dr);
  }

  /**
   * 战力评分（加权求和）。
   * @param stats 各属性值
   * @param weights 各属性权重（缺失的权重默认为 0）
   */
  export function combatPower(
    stats: Record<string, number>,
    weights: CombatWeight,
  ): number {
    let power = 0;
    if (weights.atk) power += (stats.atk ?? 0) * weights.atk;
    if (weights.hp) power += (stats.hp ?? 0) * weights.hp;
    if (weights.armor) power += (stats.armor ?? 0) * weights.armor;
    if (weights.speed) power += (stats.speed ?? 0) * weights.speed;
    if (weights.critRate) power += (stats.critRate ?? 0) * weights.critRate;
    if (weights.critDamage) power += (stats.critDamage ?? 0) * weights.critDamage;
    return Math.round(power * 100) / 100;
  }
}

/* ==================== 4. 经济平衡 ==================== */

export namespace Economy {
  /**
   * 购买时间预估。
   * @param cost 物品价格
   * @param incomeRate 收入速率（单位/秒）
   * @returns 所需秒数
   */
  export function timeToBuy(cost: number, incomeRate: number): number {
    if (cost < 0) throw new RangeError('cost must be >= 0');
    if (incomeRate <= 0) throw new RangeError('incomeRate must be > 0');
    return cost / incomeRate;
  }

  /**
   * 资源消耗表：计算净产出。
   * @param items 资源项列表
   * @returns { totalCost, totalProduce, net }
   */
  export function resourceSink(items: ResourceItem[]): {
    totalCost: number;
    totalProduce: number;
    net: number;
  } {
    let totalCost = 0;
    let totalProduce = 0;
    for (const item of items) {
      totalCost += item.cost;
      totalProduce += item.produce;
    }
    return { totalCost, totalProduce, net: totalProduce - totalCost };
  }

  /**
   * 通胀调整：将基础价值按通胀率和期数调整。
   * @param baseValue 基础价值
   * @param rate 通胀率（如 0.05 = 5%）
   * @param period 期数
   * @returns 调整后价值
   */
  export function inflationAdjusted(baseValue: number, rate: number, period: number): number {
    if (baseValue < 0) throw new RangeError('baseValue must be >= 0');
    if (period < 0) throw new RangeError('period must be >= 0');
    return baseValue * Math.pow(1 + rate, period);
  }
}
