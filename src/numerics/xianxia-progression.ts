/**
 * Xianxia Progression Numerics — 修仙放置数值模型
 *
 * 提供通用数值曲线生成和平衡性验证，不包含任何第三方原始数值。
 * 所有公式均为公开通用数学公式，可安全用于任何修仙放置游戏。
 */

export interface ProgressionConfig {
  /** 境界数量 */
  realmCount: number;
  /** 成长曲线模式 */
  curveMode: 'linear' | 'exponential' | 'logarithmic' | 'piecewise';
  /** 基础修为值 */
  baseXp: number;
  /** 成长因子 */
  growthFactor: number;
  /** 分段模式下，前 M 个境界用线性 */
  linearRealmCount?: number;
  /** 基础在线产出率（修为/秒） */
  baseOnlineRate: number;
  /** 离线效率基础值 */
  offlineEfficiency: number;
  /** 离线衰减系数 */
  decayFactor: number;
  /** 突破基础消耗（修为） */
  baseBreakthroughCost: number;
  /** 突破风险因子 */
  riskFactor: number;
  /** 最低成功率 */
  minSuccessRate: number;
  /** 失败概率增量 */
  failIncrement: number;
  /** 基础掉落率 */
  baseDropRate: number;
  /** 稀有度衰减系数 */
  rarityDecay: number;
  /** 保底计数值 */
  pityThreshold: number;
  /** 基础战力值 */
  basePower: number;
  /** 战力成长率 */
  powerGrowthRate: number;
  /** 装备乘数 */
  equipmentMultiplier: number;
}

export interface ProgressionOutput {
  /** 数值规格文档内容（Markdown 格式） */
  specContent: string;
  /** 境界曲线数据点 */
  realmCurve: Array<{ realm: number; xpRequired: number }>;
  /** 在线/离线产出曲线 */
  incomeCurve: Array<{ realm: number; onlineRate: number; offlineRate: number }>;
  /** 突破消耗曲线 */
  breakthroughCurve: Array<{ realm: number; cost: number; successRate: number }>;
  /** 掉落概率曲线（5 个稀有度等级） */
  dropRates: Array<{ rarity: number; label: string; rate: number }>;
  /** 公平性检查结果 */
  fairnessChecks: string[];
  /** P2W 风险列表 */
  p2wRisks: string[];
}

/* ===================== 数值公式 ===================== */

/**
 * 境界经验需求: XP(n) 其中 n 为境界序号（1-based）
 */
function calcRealmXp(n: number, config: ProgressionConfig): number {
  const { baseXp, growthFactor, curveMode, linearRealmCount = 5 } = config;

  switch (curveMode) {
    case 'linear':
      return Math.round(baseXp * (1 + (n - 1) * growthFactor));
    case 'exponential':
      return Math.round(baseXp * Math.pow(growthFactor, n - 1));
    case 'logarithmic':
      return Math.round(baseXp * Math.log(n + 1) * growthFactor);
    case 'piecewise':
      if (n <= linearRealmCount) {
        return Math.round(baseXp * (1 + (n - 1) * growthFactor));
      }
      // 线性段后接指数段
      const linearXp = baseXp * (1 + (linearRealmCount - 1) * growthFactor);
      return Math.round(linearXp * Math.pow(growthFactor, n - linearRealmCount));
    default:
      return baseXp;
  }
}

/**
 * 在线产出率: onlineRate(n) = baseOnlineRate * (1 + n * growthFactor)
 */
function calcOnlineRate(n: number, config: ProgressionConfig): number {
  return config.baseOnlineRate * (1 + n * config.growthFactor);
}

/**
 * 离线产出率: 在线产出率 × 离线效率（有上限保护）
 */
function calcOfflineRate(n: number, config: ProgressionConfig): number {
  return calcOnlineRate(n, config) * Math.min(config.offlineEfficiency, 0.8);
}

/**
 * 离线收益衰减: 根据离线时长（小时）返回衰减系数
 */
function calcOfflineDecay(hoursOffline: number, config: ProgressionConfig): number {
  const { decayFactor } = config;
  if (hoursOffline <= 1) return 1.0;
  if (hoursOffline <= 4) return 1.0 - (hoursOffline - 1) * decayFactor * 0.05;
  if (hoursOffline <= 12) return 0.85 - (hoursOffline - 4) * decayFactor * 0.025;
  return 0.65;
}

/**
 * 突破消耗
 */
function calcBreakthroughCost(n: number, config: ProgressionConfig): number {
  return Math.round(config.baseBreakthroughCost * Math.pow(config.riskFactor, n - 1));
}

/**
 * 突破成功率
 */
function calcBreakthroughSuccessRate(n: number, config: ProgressionConfig): number {
  return Math.max(config.minSuccessRate, 1.0 - (n - 1) * config.failIncrement);
}

/**
 * 掉落概率（5 个稀有度等级: 0=普通, 1=非凡, 2=稀有, 3=史诗, 4=传说）
 */
function calcDropRates(config: ProgressionConfig): Array<{ rarity: number; label: string; rate: number }> {
  const labels = ['普通', '非凡', '稀有', '史诗', '传说'];
  const decayed: number[] = [];
  for (let r = 0; r < 5; r++) {
    decayed.push(config.baseDropRate * Math.pow(config.rarityDecay, r));
  }
  // 归一化
  const total = decayed.reduce((a, b) => a + b, 0);
  return labels.map((label, r) => ({
    rarity: r,
    label,
    rate: Number(((decayed[r] / total) * 100).toFixed(2)),
  }));
}

/**
 * 战力成长: power(level) = basePower * growthRate^(level-1) * equipmentMultiplier
 */
function calcPower(level: number, config: ProgressionConfig): number {
  return Math.round(
    config.basePower *
    Math.pow(config.powerGrowthRate, level - 1) *
    config.equipmentMultiplier
  );
}

/* ===================== 玩家模拟 ===================== */

interface PlayerSim {
  label: string;
  onlineHoursPerDay: number;
  xpMultiplier: number;
  offlineMultiplier: number;
}

/**
 * 计算三种玩家类型达到各境界所需天数
 */
function simulatePlayerProgression(
  player: PlayerSim,
  config: ProgressionConfig,
): number[] {
  const days: number[] = [];
  const dailyOfflineHours = 24 - player.onlineHoursPerDay;

  for (let n = 1; n <= config.realmCount; n++) {
    const xpNeeded = calcRealmXp(n, config);
    const onlineRate = calcOnlineRate(n, config) * player.xpMultiplier;
    const offlineRate = calcOfflineRate(n, config) * player.offlineMultiplier;

    // 日修为产出 = 在线小时 * 3600s * 在线率 + 离线小时 * 3600s * 离线率
    const dailyXp =
      player.onlineHoursPerDay * 3600 * onlineRate +
      dailyOfflineHours * 3600 * offlineRate;

    days.push(Number((xpNeeded / dailyXp).toFixed(1)));
  }

  return days;
}

/* ===================== 文档生成 ===================== */

function generateMarkdown(config: ProgressionConfig): string {
  const dropRates = calcDropRates(config);

  // 境界曲线表
  const realmTableRows: string[] = [];
  for (let n = 1; n <= config.realmCount; n++) {
    const xp = calcRealmXp(n, config);
    const onlineRate = calcOnlineRate(n, config);
    const offlineRate = calcOfflineRate(n, config);
    const cost = calcBreakthroughCost(n, config);
    const sr = calcBreakthroughSuccessRate(n, config);
    realmTableRows.push(
      `| ${n} | ${xp.toLocaleString()} | ${onlineRate.toFixed(1)} | ${offlineRate.toFixed(1)} | ${cost.toLocaleString()} | ${(sr * 100).toFixed(1)}% |`
    );
  }

  // 掉落率表
  const dropTableRows = dropRates
    .map((d) => `| ${d.label} | ${d.rate}% |`)
    .join('\n');

  // 公平性检查
  const f2p: PlayerSim = { label: '免费', onlineHoursPerDay: 3, xpMultiplier: 1.0, offlineMultiplier: 1.0 };
  const dolphin: PlayerSim = { label: '微氪', onlineHoursPerDay: 3, xpMultiplier: 1.5, offlineMultiplier: 1.2 };
  const whale: PlayerSim = { label: '重氪', onlineHoursPerDay: 5, xpMultiplier: 4.0, offlineMultiplier: 2.0 };

  const f2pDays = simulatePlayerProgression(f2p, config);
  const dolphinDays = simulatePlayerProgression(dolphin, config);
  const whaleDays = simulatePlayerProgression(whale, config);

  const lastRealm = config.realmCount - 1;
  const f2pTotal = f2pDays[lastRealm];
  const dolphinTotal = dolphinDays[lastRealm];
  const whaleTotal = whaleDays[lastRealm];

  const ratioDolphinF2p = f2pTotal > 0 ? (dolphinTotal / f2pTotal).toFixed(2) : 'N/A';
  const ratioWhaleF2p = f2pTotal > 0 ? (whaleTotal / f2pTotal).toFixed(2) : 'N/A';

  // 公平性判定
  const fairnessWarnings: string[] = [];
  if (Number(ratioWhaleF2p) < 0.2) fairnessWarnings.push('重氪/免费时间比 < 0.2，付费加速过于明显');
  if (Number(ratioDolphinF2p) > 0.9) fairnessWarnings.push('微氪/免费时间比 > 0.9，付费感知太弱');
  if (config.failIncrement > 0.1) fairnessWarnings.push('突破风险递增过快，后期境界可能对免费玩家不公平');

  const riskItems: string[] = [];
  if (Number(ratioWhaleF2p) < 0.3) riskItems.push('`重氪/免费时间比低于 0.3` — 付费优势过大，可能导致免费玩家流失。建议调整 `growthFactor` 或 `xpMultiplier`。');
  if (config.offlineEfficiency > 0.8) riskItems.push('`离线效率过高` — 可能导致挂机收益超过活跃玩家，违背"活跃优先"原则。');
  if (config.minSuccessRate < 0.3) riskItems.push('`最低成功率过低` — 后期突破失败率高，玩家挫败感强。建议 >= 0.3。');
  riskItems.push('`付费专属数值道具` — 确保所有数值道具存在免费获取路径（时间更长但可达）。');
  riskItems.push('`VIP 等级战力加成` — 建议改为外观/便捷特权，而非直接战力加成。');
  riskItems.push('`抽卡无保底` — 建议设 pity timer，确保期望值内的玩家体验。');

  return `# Progression Balance Spec — 修仙放置数值模型

> 成长曲线模式：${config.curveMode} | 境界数量：${config.realmCount}
> 生成时间：${new Date().toISOString().split('T')[0]}

## 境界成长曲线

| 境界 | 修为需求 | 在线产出(/s) | 离线产出(/s) | 突破消耗 | 成功率 |
|------|----------|-------------|-------------|----------|--------|
${realmTableRows.join('\n')}

**公式**：
\`\`\`
XP(n) = ${
  config.curveMode === 'linear'
    ? `baseXp * (1 + (n-1) * growthFactor)`
    : config.curveMode === 'exponential'
    ? `baseXp * growthFactor^(n-1)`
    : config.curveMode === 'logarithmic'
    ? `baseXp * log(n+1) * growthFactor`
    : `前 ${config.linearRealmCount} 线性 + 后 ${config.realmCount - (config.linearRealmCount ?? 5)} 指数`
}
\`\`\`

## 掉落概率

| 稀有度 | 概率 |
|--------|------|
${dropTableRows}

保底机制：连续 ${config.pityThreshold} 次未出稀有 → 第 ${config.pityThreshold + 1} 次必出。

## 离线收益衰减

| 离线时长 | 衰减系数 |
|----------|----------|
| ≤ 1h | 1.00 |
| 1h ~ 4h | 1.00 → 0.85 |
| 4h ~ 12h | 0.85 → 0.65 |
| > 12h | 0.65 |

## 免费/微氪/重氪模拟

| 玩家类型 | 日在线 | 修为倍率 | 离线倍率 | 到第 ${config.realmCount} 境天数 |
|----------|--------|----------|----------|${'─'.repeat(18)}|
| 免费玩家 | 3h | 1.0x | 1.0x | ${f2pTotal.toFixed(0)} |
| 微氪玩家 | 3h | 1.5x | 1.2x | ${dolphinTotal.toFixed(0)} |
| 重氪玩家 | 5h | 4.0x | 2.0x | ${whaleTotal.toFixed(0)} |

**公平性指标**：
- 微氪/免费时间比：${ratioDolphinF2p}（建议 ≥ 0.6）
- 重氪/免费时间比：${ratioWhaleF2p}（建议 ≥ 0.3）

## 公平性检查

${fairnessWarnings.length > 0 ? fairnessWarnings.map(w => `- ⚠️ ${w}`).join('\n') : '- 当前配置通过所有公平性检查'}

## P2W 风险提示

${riskItems.map(r => `- ${r}`).join('\n')}
`;
}

/* ===================== 公开 API ===================== */

const DEFAULT_CONFIG: ProgressionConfig = {
  realmCount: 10,
  curveMode: 'piecewise',
  baseXp: 1000,
  growthFactor: 1.5,
  linearRealmCount: 5,
  baseOnlineRate: 10,
  offlineEfficiency: 0.6,
  decayFactor: 1.0,
  baseBreakthroughCost: 500,
  riskFactor: 1.8,
  minSuccessRate: 0.3,
  failIncrement: 0.05,
  baseDropRate: 1.0,
  rarityDecay: 0.3,
  pityThreshold: 50,
  basePower: 100,
  powerGrowthRate: 1.15,
  equipmentMultiplier: 1.0,
};

/**
 * 生成数值规格文档 PROGRESSION_BALANCE_SPEC.md
 */
export function generateProgressionSpec(
  overrides?: Partial<ProgressionConfig>,
): ProgressionOutput {
  const config: ProgressionConfig = { ...DEFAULT_CONFIG, ...overrides };

  // 曲线数据
  const realmCurve: Array<{ realm: number; xpRequired: number }> = [];
  const incomeCurve: Array<{ realm: number; onlineRate: number; offlineRate: number }> = [];
  const breakthroughCurve: Array<{ realm: number; cost: number; successRate: number }> = [];

  for (let n = 1; n <= config.realmCount; n++) {
    realmCurve.push({ realm: n, xpRequired: calcRealmXp(n, config) });
    incomeCurve.push({
      realm: n,
      onlineRate: calcOnlineRate(n, config),
      offlineRate: calcOfflineRate(n, config),
    });
    breakthroughCurve.push({
      realm: n,
      cost: calcBreakthroughCost(n, config),
      successRate: calcBreakthroughSuccessRate(n, config),
    });
  }

  const dropRates = calcDropRates(config);

  const fairnessChecks: string[] = [];
  const f2p: PlayerSim = { label: '免费', onlineHoursPerDay: 3, xpMultiplier: 1.0, offlineMultiplier: 1.0 };
  const dolphin: PlayerSim = { label: '微氪', onlineHoursPerDay: 3, xpMultiplier: 1.5, offlineMultiplier: 1.2 };
  const whale: PlayerSim = { label: '重氪', onlineHoursPerDay: 5, xpMultiplier: 4.0, offlineMultiplier: 2.0 };

  const f2pDays = simulatePlayerProgression(f2p, config);
  const dolphinDays = simulatePlayerProgression(dolphin, config);
  const whaleDays = simulatePlayerProgression(whale, config);
  const lastIdx = config.realmCount - 1;
  const ratioWhaleF2p = whaleDays[lastIdx] / f2pDays[lastIdx];

  if (ratioWhaleF2p < 0.3) fairnessChecks.push('重氪/免费时间比 < 0.3，付费优势过大');
  if (config.offlineEfficiency > 0.8) fairnessChecks.push('离线效率超过 0.8，可能违背活跃优先原则');
  if (config.minSuccessRate < 0.3) fairnessChecks.push('最低成功率 < 30%，后期挫败感强');

  const p2wRisks: string[] = [
    '付费专属数值道具：确保所有数值道具存在免费获取路径',
    'VIP 等级战力加成：建议改为外观/便捷特权',
    '抽卡无保底：建议设 pity timer',
    '限时付费独占：活动结束后加入常驻兑换',
    '新服付费玩家快速拉开差距：设赛季追赶机制',
  ];

  return {
    specContent: generateMarkdown(config),
    realmCurve,
    incomeCurve,
    breakthroughCurve,
    dropRates,
    fairnessChecks,
    p2wRisks,
  };
}

/**
 * 便捷入口：直接输出 Markdown 字符串
 */
export function generateProgressionSpecMarkdown(
  overrides?: Partial<ProgressionConfig>,
): string {
  return generateProgressionSpec(overrides).specContent;
}

export { DEFAULT_CONFIG };
