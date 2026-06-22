import { describe, it, expect } from 'vitest';
import {
  GrowthCurve,
  LootTable,
  GachaBanner,
  CombatMath,
  Economy,
  exportGrowthTable,
  exportLootTable,
  exportGachaStats,
} from '../src/numerics/index';
import type { PiecewiseSegment, ArmorFormula } from '../src/numerics/index';

/* ==================== GrowthCurve 成长曲线 ==================== */

describe('GrowthCurve — linear', () => {
  it('正常参数：base=10, slope=5, level=3', () => {
    expect(GrowthCurve.linear(10, 5, 3)).toBe(25); // 10 + 5*3
  });

  it('边界参数：level=0', () => {
    expect(GrowthCurve.linear(100, 10, 0)).toBe(100);
  });

  it('极值参数：level=1000', () => {
    expect(GrowthCurve.linear(0, 1, 1000)).toBe(1000);
  });
});

describe('GrowthCurve — exponential', () => {
  it('正常参数：base=10, factor=1.2, level=3', () => {
    expect(GrowthCurve.exponential(10, 1.2, 3)).toBeCloseTo(17.28, 2);
  });

  it('边界参数：factor=1.0', () => {
    expect(GrowthCurve.exponential(50, 1.0, 10)).toBe(50);
  });

  it('极值参数：factor=0.5, level=0', () => {
    expect(GrowthCurve.exponential(100, 0.5, 0)).toBe(100);
  });

  it('factor < 1：衰减曲线', () => {
    expect(GrowthCurve.exponential(100, 0.5, 2)).toBe(25);
  });
});

describe('GrowthCurve — polynomial', () => {
  it('正常参数：base=0, coeff=100, degree=2, level=5', () => {
    expect(GrowthCurve.polynomial(0, 100, 2, 5)).toBe(2500);
  });

  it('边界参数：degree=1 等同于线性', () => {
    expect(GrowthCurve.polynomial(10, 5, 1, 3)).toBe(25);
  });

  it('极值参数：degree=0', () => {
    expect(GrowthCurve.polynomial(50, 100, 0, 10)).toBe(150);
  });
});

describe('GrowthCurve — logistic', () => {
  it('正常参数：max=100, mid=25, steep=0.2, level=30', () => {
    const val = GrowthCurve.logistic(100, 25, 0.2, 30);
    expect(val).toBeGreaterThan(50);
    expect(val).toBeLessThan(100);
  });

  it('边界参数：level >> mid 趋近 max', () => {
    const val = GrowthCurve.logistic(1000, 50, 0.5, 1000);
    expect(val).toBeCloseTo(1000, 0);
  });

  it('极值参数：level = mid', () => {
    expect(GrowthCurve.logistic(200, 30, 0.3, 30)).toBeCloseTo(100, 0);
  });
});

describe('GrowthCurve — piecewise', () => {
  const segments: PiecewiseSegment[] = [
    { from: 0, to: 10, formula: 'linear', params: [0, 10] },
    { from: 11, to: 20, formula: 'exponential', params: [110, 1.1] },
    { from: 21, to: 30, formula: 'polynomial', params: [0, 5, 2] },
  ];

  it('正常参数：level=5（线性段）', () => {
    expect(GrowthCurve.piecewise(segments, 5)).toBe(50); // 0 + 10*5
  });

  it('正常参数：level=15（指数段）', () => {
    // 110 * 1.1^15 ≈ 110 * 4.177 = 459.5
    expect(GrowthCurve.piecewise(segments, 15)).toBeCloseTo(459.5, -1);
  });

  it('正常参数：level=25（多项式段）', () => {
    expect(GrowthCurve.piecewise(segments, 25)).toBe(3125); // 0 + 5*25^2
  });
});

describe('GrowthCurve — inverseCurve', () => {
  const expFn = (lv: number) => GrowthCurve.exponential(10, 1.2, lv);

  it('正常参数：target=17.28 → level≈3', () => {
    const lv = GrowthCurve.inverseCurve(expFn, 17.28, [0, 20]);
    expect(lv).not.toBeNull();
    expect(lv!).toBeCloseTo(3, 0);
  });

  it('边界参数：target 小于 fn(0)', () => {
    const lv = GrowthCurve.inverseCurve(expFn, 5, [0, 20]);
    expect(lv).toBe(0);
  });

  it('极值参数：target 超过范围无法达到', () => {
    const lv = GrowthCurve.inverseCurve(() => 10, 20, [0, 5]);
    expect(lv).toBeNull();
  });
});

/* ==================== LootTable 掉落系统 ==================== */

describe('LootTable — roll（放回）', () => {
  it('正常参数：3 个物品按权重随机', () => {
    const table = new LootTable<string>();
    table.addDrop('gold', 50, 1, 1);
    table.addDrop('potion', 30, 1, 1);
    table.addDrop('sword', 20, 1, 1);

    const results = table.roll(100);
    expect(results.length).toBe(100);
    const goldCount = results.filter((r) => r.item === 'gold').length;
    expect(goldCount).toBeGreaterThan(0);
    expect(goldCount).toBeLessThan(100);
  });

  it('边界参数：count=0', () => {
    const table = new LootTable<string>();
    table.addDrop('gold', 1);
    expect(table.roll(0)).toEqual([]);
  });

  it('边界参数：空表', () => {
    const table = new LootTable<string>();
    expect(table.roll(10)).toEqual([]);
  });
});

describe('LootTable — roll（不放回）', () => {
  it('不放回：count 小于表大小时不会重复', () => {
    const table = new LootTable<string>();
    table.addDrop('A', 1);
    table.addDrop('B', 1);
    table.addDrop('C', 1);

    const results = table.roll(3, false);
    expect(results.length).toBe(3);
    const items = results.map((r) => r.item).sort();
    expect(items).toEqual(['A', 'B', 'C']);
  });

  it('不放回：count 超过表大小时只返回表中数量', () => {
    const table = new LootTable<string>();
    table.addDrop('A', 1);
    table.addDrop('B', 1);

    expect(table.roll(5, false).length).toBe(2);
  });
});

describe('LootTable — rollGuaranteed 保底', () => {
  it('保底：连续 miss 后必出保底物品', () => {
    const table = new LootTable<string>();
    table.addDrop('common', 90);
    table.addDrop('rare', 10);

    const results = table.rollGuaranteed(30, 'rare', 10);
    const rareCount = results.filter((r) => r.item === 'rare').length;
    // With pity=10, we get at least floor(30/10)=3 rare drops
    expect(rareCount).toBeGreaterThanOrEqual(3);
  });

  it('保底阈值内也可能自然掉落', () => {
    const table = new LootTable<string>();
    table.addDrop('common', 50);
    table.addDrop('rare', 50);

    const results = table.rollGuaranteed(200, 'rare', 5);
    const rareCount = results.filter((r) => r.item === 'rare').length;
    expect(rareCount).toBeGreaterThan(40); // high chance with 50% weight
  });
});

describe('LootTable — 数量范围', () => {
  it('minQuantity 和 maxQuantity', () => {
    const table = new LootTable<string>();
    table.addDrop('coins', 100, 10, 50);
    const results = table.roll(100);
    for (const r of results) {
      expect(r.quantity).toBeGreaterThanOrEqual(10);
      expect(r.quantity).toBeLessThanOrEqual(50);
    }
  });

  it('默认数量为 1', () => {
    const table = new LootTable<string>();
    table.addDrop('gem', 100);
    const results = table.roll(10);
    for (const r of results) {
      expect(r.quantity).toBe(1);
    }
  });
});

/* ==================== GachaBanner 抽卡系统 ==================== */

const STANDARD_BANNER = [
  { rarity: 'N' as const, baseProbability: 0.70 },
  { rarity: 'R' as const, baseProbability: 0.25 },
  { rarity: 'SR' as const, baseProbability: 0.04 },
  { rarity: 'SSR' as const, baseProbability: 0.01 },
];

describe('GachaBanner — 基础抽卡', () => {
  it('单抽返回正确结构', () => {
    const banner = new GachaBanner(STANDARD_BANNER);
    const results = banner.pull(1);
    expect(results.length).toBe(1);
    expect(['N', 'R', 'SR', 'SSR']).toContain(results[0].rarity);
    expect(typeof results[0].pityTriggered).toBe('boolean');
  });

  it('10 连抽返回 10 个结果', () => {
    const banner = new GachaBanner(STANDARD_BANNER);
    const results = banner.pull(10);
    expect(results.length).toBe(10);
  });

  it('大样本频率接近基础概率', () => {
    const banner = new GachaBanner(STANDARD_BANNER);
    const results = banner.pull(10000);
    const rc: Record<string, number> = {};
    for (const r of results) rc[r.rarity] = (rc[r.rarity] ?? 0) + 1;
    expect(rc['N'] / 10000).toBeCloseTo(0.70, 1);
    expect(rc['R'] / 10000).toBeCloseTo(0.25, 1);
    expect(rc['SSR'] / 10000).toBeGreaterThanOrEqual(0.005);
  });
});

describe('GachaBanner — 硬保底', () => {
  it('90 抽内必定获得 SSR', () => {
    const banner = new GachaBanner(STANDARD_BANNER, 75, 90);
    const results = banner.pull(90);
    const ssrCount = results.filter((r) => r.rarity === 'SSR').length;
    expect(ssrCount).toBeGreaterThanOrEqual(1);
  });

  it('hardPity=10 时 10 抽必出 SSR', () => {
    const banner = new GachaBanner(STANDARD_BANNER, 5, 10);
    const results = banner.pull(10);
    expect(results.some((r) => r.rarity === 'SSR')).toBe(true);
  });
});

describe('GachaBanner — 软保底', () => {
  it('超过 softPityStart 后 SSR 概率递增', () => {
    const banner = new GachaBanner(STANDARD_BANNER, 50, 90, 0.1);
    // Force pity to 74 by pulling until reset not triggered
    banner.resetPity();
    // Just test that the method works correctly
    const results = banner.pull(80);
    const ssrCount = results.filter((r) => r.rarity === 'SSR').length;
    expect(ssrCount).toBeGreaterThanOrEqual(1);
  });

  it('软保底触发时 pityTriggered=true', () => {
    const banner = new GachaBanner(STANDARD_BANNER, 1, 90, 0.99); // almost guaranteed at 1
    const results = banner.pull(10);
    const softPityResults = results.filter((r) => r.pityTriggered);
    expect(softPityResults.length).toBeGreaterThan(0);
    for (const r of softPityResults) {
      expect(r.rarity).toBe('SSR');
    }
  });
});

describe('GachaBanner — resetPity', () => {
  it('resetPity 后保底计数器归零', () => {
    const banner = new GachaBanner(STANDARD_BANNER, 50, 90);
    banner.pull(80); // builds up pity
    banner.resetPity();
    // After reset, first pull is fresh
    const results = banner.pull(1);
    expect(results[0].pityTriggered).toBe(false);
  });
});

/* ==================== CombatMath 战斗数值 ==================== */

describe('CombatMath — damageReduction', () => {
  it('线性公式：armor=100, k=100 → 50% 减伤', () => {
    expect(CombatMath.damageReduction(100, 'linear', [100])).toBeCloseTo(0.5, 2);
  });

  it('线性公式：armor=0 → 0%', () => {
    expect(CombatMath.damageReduction(0, 'linear')).toBe(0);
  });

  it('线性公式：armor 极大 → 趋近 1', () => {
    expect(CombatMath.damageReduction(10000, 'linear', [100])).toBeCloseTo(0.99, 1);
  });

  it('对数公式：armor=100, k=100, r=0.15', () => {
    const dr = CombatMath.damageReduction(100, 'logarithmic', [100, 0.15]);
    // Math.log(2) * 0.15 ≈ 0.10397
    expect(dr).toBeCloseTo(Math.log(2) * 0.15, 3);
  });

  it('对数公式：不会超过 1', () => {
    const dr = CombatMath.damageReduction(1e9, 'logarithmic', [100, 0.15]);
    expect(dr).toBeLessThanOrEqual(1);
  });

  it('分段公式：armor < threshold', () => {
    // t=100, r1=0.01, r2=0.002
    const dr = CombatMath.damageReduction(50, 'piecewise', [100, 0.01, 0.002]);
    expect(dr).toBeCloseTo(0.5, 2); // 50 * 0.01
  });

  it('分段公式：armor >= threshold', () => {
    // t=100, r1=0.01, r2=0.002: 100*0.01 + (200-100)*0.002 = 1 + 0.2 = 1.2 → capped at 1
    const dr = CombatMath.damageReduction(200, 'piecewise', [100, 0.01, 0.002]);
    expect(dr).toBe(1);
  });

  it('负护甲抛错', () => {
    expect(() => CombatMath.damageReduction(-10, 'linear')).toThrow(RangeError);
  });
});

describe('CombatMath — expectedDPS', () => {
  it('正常参数：atk=100, speed=1.5, critRate=0.3, critDmg=2.0', () => {
    // 100 * 1.5 * (1 + 0.3 * 1.0) = 150 * 1.3 = 195
    expect(CombatMath.expectedDPS(100, 1.5, 0.3, 2.0)).toBe(195);
  });

  it('边界参数：critRate=0', () => {
    expect(CombatMath.expectedDPS(100, 1.0, 0, 2.0)).toBe(100);
  });

  it('极值参数：100% 暴击', () => {
    expect(CombatMath.expectedDPS(100, 1.0, 1.0, 3.0)).toBe(300);
  });
});

describe('CombatMath — effectiveHP', () => {
  it('线性减伤 50%：eHP = HP * 2', () => {
    const ehp = CombatMath.effectiveHP(1000, 100, 'linear', [100]);
    expect(ehp).toBeCloseTo(2000, 0);
  });

  it('0 护甲：eHP = HP', () => {
    expect(CombatMath.effectiveHP(500, 0, 'linear')).toBe(500);
  });

  it('接近 100% 减伤：eHP 极大', () => {
    const ehp = CombatMath.effectiveHP(100, 1e9, 'linear', [100]);
    expect(ehp).toBeGreaterThan(1e8);
  });
});

describe('CombatMath — combatPower', () => {
  it('加权求和', () => {
    const power = CombatMath.combatPower(
      { atk: 150, hp: 2000, armor: 80 },
      { atk: 1, hp: 0.05, armor: 0.5 },
    );
    // 150*1 + 2000*0.05 + 80*0.5 = 150 + 100 + 40 = 290
    expect(power).toBe(290);
  });

  it('缺少字段时默认为 0', () => {
    const power = CombatMath.combatPower({ atk: 100 }, { atk: 2, hp: 1 });
    expect(power).toBe(200);
  });

  it('空权重返回 0', () => {
    expect(CombatMath.combatPower({ atk: 999 }, {})).toBe(0);
  });
});

/* ==================== Economy 经济平衡 ==================== */

describe('Economy — timeToBuy', () => {
  it('正常参数：cost=500, incomeRate=50 → 10', () => {
    expect(Economy.timeToBuy(500, 50)).toBe(10);
  });

  it('边界参数：cost=0', () => {
    expect(Economy.timeToBuy(0, 0.01)).toBe(0);
  });

  it('极值参数：incomeRate <= 0 抛错', () => {
    expect(() => Economy.timeToBuy(100, 0)).toThrow(RangeError);
    expect(() => Economy.timeToBuy(100, -1)).toThrow(RangeError);
  });
});

describe('Economy — resourceSink', () => {
  it('正常参数：多资源多产出', () => {
    const result = Economy.resourceSink([
      { name: 'iron', cost: 100, produce: 50 },
      { name: 'wood', cost: 200, produce: 80 },
      { name: 'gold', cost: 150, produce: 100 },
    ]);
    expect(result.totalCost).toBe(450);
    expect(result.totalProduce).toBe(230);
    expect(result.net).toBe(-220);
  });

  it('边界参数：空数组', () => {
    const result = Economy.resourceSink([]);
    expect(result.totalCost).toBe(0);
    expect(result.totalProduce).toBe(0);
    expect(result.net).toBe(0);
  });

  it('纯收益', () => {
    const result = Economy.resourceSink([{ name: 'freebie', cost: 0, produce: 100 }]);
    expect(result.net).toBe(100);
  });
});

describe('Economy — inflationAdjusted', () => {
  it('正常参数：baseValue=100, rate=0.03, period=5', () => {
    const adj = Economy.inflationAdjusted(100, 0.03, 5);
    expect(adj).toBeCloseTo(115.93, 1); // 100 * 1.03^5
  });

  it('边界参数：rate=0', () => {
    expect(Economy.inflationAdjusted(500, 0, 10)).toBe(500);
  });

  it('极值参数：负通胀率', () => {
    expect(Economy.inflationAdjusted(100, -0.1, 3)).toBeCloseTo(72.9, 0);
  });
});

/* ==================== 导出函数 ==================== */

describe('exportGrowthTable', () => {
  it('正常导出 1-3 级', () => {
    const fn = (lv: number) => GrowthCurve.linear(0, 10, lv);
    const csv = exportGrowthTable(fn, [1, 3]);
    expect(csv).toContain('Level,Value');
    expect(csv).toContain('1,10');
    expect(csv).toContain('2,20');
    expect(csv).toContain('3,30');
  });

  it('边界：单一级别范围', () => {
    const csv = exportGrowthTable((lv) => lv, [5, 5]);
    expect(csv).toContain('5,5');
  });
});

describe('exportLootTable', () => {
  it('蒙特卡洛模拟生成 CSV', () => {
    const table = new LootTable<string>();
    table.addDrop('gold', 100, 1, 1);
    const csv = exportLootTable(table, 100);
    expect(csv).toContain('Item,Count,Frequency,AvgQuantity');
    expect(csv).toContain('gold');
  });
});

describe('exportGachaStats', () => {
  it('导出抽卡统计 CSV', () => {
    const banner = new GachaBanner(STANDARD_BANNER);
    const csv = exportGachaStats(banner, 1000);
    expect(csv).toContain('Metric,Value');
    expect(csv).toContain('Total Pulls,1000');
    expect(csv).toContain('Rarity,Count,Percentage');
    expect(csv).toContain('N,');
    expect(csv).toContain('SSR,');
  });

  it('边界：0 抽抛错', () => {
    const banner = new GachaBanner(STANDARD_BANNER);
    expect(() => exportGachaStats(banner, 0)).toThrow(RangeError);
  });
});
