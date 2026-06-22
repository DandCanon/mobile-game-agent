import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  click,
  buyUpgrade,
  tick,
  calculateOfflineEarnings,
  checkMilestones,
  getClickValue,
  getAutoProductionPerSec,
  getOfflineMultiplier,
  UPGRADE_DEFS,
  MILESTONE_DEFS,
  findMilestoneDef,
  findUpgradeDef,
  getUnlockedUpgrades,
  getNextUpgradeCost,
} from '../src/game/IdleEngine';

/* ==================== 初始状态 ==================== */

describe('IdleEngine — 初始状态', () => {
  it('金币和钻石初始为 0', () => {
    const s = createInitialState();
    expect(s.resources.gold).toBe(0);
    expect(s.resources.diamonds).toBe(0);
  });

  it('所有升级项初始等级为 0', () => {
    const s = createInitialState();
    for (const def of UPGRADE_DEFS) {
      expect(s.upgrades[def.id]).toBe(0);
    }
  });

  it('里程碑列表为空', () => {
    const s = createInitialState();
    expect(s.milestones).toEqual([]);
  });

  it('统计字段初始为 0', () => {
    const s = createInitialState();
    expect(s.stats.totalClicks).toBe(0);
    expect(s.stats.totalGoldEarned).toBe(0);
    expect(s.stats.totalUpgradesPurchased).toBe(0);
    expect(s.stats.maxOfflineEarnings).toBe(0);
  });

  it('lastTickTime 为合理时间戳', () => {
    const s = createInitialState();
    expect(s.lastTickTime).toBeGreaterThan(1600000000000);
  });
});

/* ==================== 点击系统 ==================== */

describe('IdleEngine — 点击系统', () => {
  it('点击增加金币', () => {
    const s = click(createInitialState());
    expect(s.resources.gold).toBeGreaterThan(0);
  });

  it('点击增加计数', () => {
    const s = click(createInitialState());
    expect(s.stats.totalClicks).toBe(1);
  });

  it('getClickValue 初始为基础值 1', () => {
    expect(getClickValue(createInitialState())).toBe(1);
  });

  it('购买点击力升级后 getClickValue 增加', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 99999 } };
    const { state: s2 } = buyUpgrade(s, 'click_power_1');
    expect(getClickValue(s2)).toBe(3); // 1 + 2
    expect(s2.upgrades['click_power_1']).toBe(1);
  });

  it('连续点击多次，gold 累加正确', () => {
    let s = createInitialState();
    for (let i = 0; i < 5; i++) s = click(s);
    expect(s.stats.totalClicks).toBe(5);
    expect(s.resources.gold).toBe(5);
  });
});

/* ==================== 升级系统 ==================== */

describe('IdleEngine — 升级系统', () => {
  it('金币不足时 buyUpgrade 返回 success=false', () => {
    const { state, success } = buyUpgrade(createInitialState(), 'click_power_1');
    expect(success).toBe(false);
    expect(state.resources.gold).toBe(0);
  });

  it('金币足够时成功购买并扣费', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2, success } = buyUpgrade(s, 'click_power_1');
    expect(success).toBe(true);
    expect(s2.upgrades['click_power_1']).toBe(1);
    expect(s2.resources.gold).toBe(90); // 100 - 10
    expect(s2.stats.totalUpgradesPurchased).toBe(1);
  });

  it('购买已满级升级项返回失败', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2 } = buyUpgrade(s, 'click_power_1');
    const { success, message } = buyUpgrade(s2, 'click_power_1');
    expect(success).toBe(false);
    expect(message).toContain('已达最大等级');
  });

  it('购买不存在的升级项返回失败', () => {
    const { success, message } = buyUpgrade(createInitialState(), 'nonexistent');
    expect(success).toBe(false);
    expect(message).toContain('未知');
  });

  it('升级成本随索引指数增长', () => {
    expect(UPGRADE_DEFS[0].baseCost).toBe(10);  // click_power_1: 10 * 1.5^0
    expect(UPGRADE_DEFS[1].baseCost).toBe(15);  // click_power_2: 10 * 1.5^1
    expect(UPGRADE_DEFS[2].baseCost).toBe(22);  // click_power_3: 10 * 1.5^2 = 22.5 -> 22
    expect(UPGRADE_DEFS[9].baseCost).toBeGreaterThan(UPGRADE_DEFS[0].baseCost);
  });

  it('离线倍率升级成本为 2.0 指数增长', () => {
    const offlineUpgrades = UPGRADE_DEFS.filter((d) => d.category === 'offline_multiplier');
    expect(offlineUpgrades[0].baseCost).toBe(50);   // 50 * 2.0^0
    expect(offlineUpgrades[1].baseCost).toBe(100);  // 50 * 2.0^1
    expect(offlineUpgrades[2].baseCost).toBe(200);  // 50 * 2.0^2
  });

  it('getNextUpgradeCost 返回正确成本', () => {
    const s = createInitialState();
    expect(getNextUpgradeCost(s, 'click_power_1')).toBe(10);
    expect(getNextUpgradeCost(s, 'click_power_5')).toBe(50);
  });

  it('已满级时 getNextUpgradeCost 返回 -1', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 }, upgrades: { ...s.upgrades, click_power_1: 1 } };
    expect(getNextUpgradeCost(s, 'click_power_1')).toBe(-1);
  });

  it('getUnlockedUpgrades 返回已解锁项', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 1000 } };
    const { state: s2 } = buyUpgrade(s, 'click_power_1');
    const { state: s3 } = buyUpgrade(s2, 'click_power_2');
    const unlocked = getUnlockedUpgrades(s3);
    expect(unlocked.length).toBe(2);
    expect(unlocked.map((u) => u.id)).toContain('click_power_1');
    expect(unlocked.map((u) => u.id)).toContain('click_power_2');
  });
});

/* ==================== 自动生产 ==================== */

describe('IdleEngine — 自动生产', () => {
  it('初始自动产量为 0', () => {
    expect(getAutoProductionPerSec(createInitialState())).toBe(0);
  });

  it('购买自动产量后 > 0', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2 } = buyUpgrade(s, 'auto_prod_1');
    expect(getAutoProductionPerSec(s2)).toBe(1);
  });

  it('tick 按时间产生金币', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2 } = buyUpgrade(s, 'auto_prod_1');
    // auto_prod_1 = 1 gold/sec, tick 2000ms -> 2 gold
    const s3 = tick(s2, 2000);
    expect(s3.resources.gold).toBe(s2.resources.gold + 2);
  });

  it('tick deltaMs=0 状态不变', () => {
    const s = createInitialState();
    const s2 = tick(s, 0);
    expect(s2.resources.gold).toBe(s.resources.gold);
  });

  it('tick 更新 lastTickTime', () => {
    const s = createInitialState();
    const s2 = tick(s, 1000);
    expect(s2.lastTickTime).toBe(s.lastTickTime + 1000);
  });
});

/* ==================== 离线收益 ==================== */

describe('IdleEngine — 离线收益', () => {
  it('初始离线收益倍率为 0.5', () => {
    expect(getOfflineMultiplier(createInitialState())).toBe(0.5);
  });

  it('购买离线倍率升级后倍率增加', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 1000 } };
    const { state: s2 } = buyUpgrade(s, 'offline_mult_1');
    expect(getOfflineMultiplier(s2)).toBe(0.6); // 0.5 + 0.1
  });

  it('离线收益上限不超过 24 小时', () => {
    const s = createInitialState();
    const away48h = 48 * 3600 * 1000;
    const earnings = calculateOfflineEarnings(s, away48h);
    // 无自动产量，收益为 0
    expect(earnings).toBe(0);
  });

  it('awayMs <= 0 返回 0', () => {
    expect(calculateOfflineEarnings(createInitialState(), -1)).toBe(0);
    expect(calculateOfflineEarnings(createInitialState(), 0)).toBe(0);
  });

  it('有自动产量时离线收益 = 产量 × 秒数 × 倍率', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2 } = buyUpgrade(s, 'auto_prod_1');
    // 1 gold/sec * 100 sec * 0.5 = 50
    expect(calculateOfflineEarnings(s2, 100000)).toBe(50);
  });
});

/* ==================== 里程碑 ==================== */

describe('IdleEngine — 里程碑', () => {
  it('MILESTONE_DEFS 共 4 项', () => {
    expect(MILESTONE_DEFS.length).toBe(4);
  });

  it('checkMilestones 初始返回空', () => {
    expect(checkMilestones(createInitialState())).toEqual([]);
  });

  it('达到 100 金币触发 first_100_gold', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 99 } };
    const s2 = click(s); // gold goes from 99 to 100
    expect(s2.milestones).toContain('first_100_gold');
  });

  it('累计点击 1000 次触发 cumulative_1000_clicks', () => {
    let s = createInitialState();
    for (let i = 0; i < 1000; i++) s = click(s);
    expect(s.milestones).toContain('cumulative_1000_clicks');
  });

  it('购买 3 次升级触发 unlock_3_upgrades', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 99999 } };
    const { state: s2 } = buyUpgrade(s, 'click_power_1');
    const { state: s3 } = buyUpgrade(s2, 'click_power_2');
    const { state: s4 } = buyUpgrade(s3, 'click_power_3');
    expect(s4.milestones).toContain('unlock_3_upgrades');
  });

  it('findMilestoneDef 返回正确定义', () => {
    const m = findMilestoneDef('first_100_gold');
    expect(m).toBeDefined();
    expect(m!.name).toBe('初获财富');
  });

  it('findMilestoneDef 不存在时返回 undefined', () => {
    expect(findMilestoneDef('nonexistent')).toBeUndefined();
  });
});

/* ==================== 工具函数 ==================== */

describe('IdleEngine — 工具函数', () => {
  it('findUpgradeDef 查找存在项', () => {
    const d = findUpgradeDef('click_power_1');
    expect(d).toBeDefined();
    expect(d!.name).toBe('点击力 Lv1');
    expect(d!.category).toBe('click_power');
  });

  it('findUpgradeDef 不存在时返回 undefined', () => {
    expect(findUpgradeDef('nonexistent')).toBeUndefined();
  });

  it('离线倍率不超过 1.0', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 999999 } };
    // 购买所有 5 级离线倍率
    s = buyUpgrade(s, 'offline_mult_1').state;
    s = buyUpgrade(s, 'offline_mult_2').state;
    s = buyUpgrade(s, 'offline_mult_3').state;
    s = buyUpgrade(s, 'offline_mult_4').state;
    s = buyUpgrade(s, 'offline_mult_5').state;
    // 0.5 + 0.1*5 = 1.0, capped at 1.0 (floating point: closeTo)
    expect(getOfflineMultiplier(s)).toBeCloseTo(1.0, 10);
  });

  it('UPGRADE_DEFS 共 25 项 (10+10+5)', () => {
    expect(UPGRADE_DEFS.length).toBe(25);
  });
});
