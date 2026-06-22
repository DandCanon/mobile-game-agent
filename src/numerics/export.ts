/* ===================================================================
 * src/numerics/export.ts — 数值可视化导出
 *
 * 将数值模型数据导出为 CSV 格式，支持 Excel/Google Sheets 直接导入。
 * =================================================================== */

import { GrowthCurve, LootTable, GachaBanner } from './curves';
import type { DropItem, GachaStats } from './curves';

/* ==================== 成长曲线 CSV 导出 ==================== */

/**
 * 导出成长曲线为 CSV 格式。
 * @param curveFn 成长曲线函数 (level) => value
 * @param levels 等级范围 [min, max]（包含两端）
 * @returns CSV 字符串
 */
export function exportGrowthTable(
  curveFn: (level: number) => number,
  levels: [number, number],
): string {
  const [minLevel, maxLevel] = levels;
  const rows: string[] = ['Level,Value'];
  for (let lv = minLevel; lv <= maxLevel; lv++) {
    const value = curveFn(lv);
    rows.push(`${lv},${value}`);
  }
  return rows.join('\n') + '\n';
}

/* ==================== 掉落表蒙特卡洛模拟导出 ==================== */

/** 掉落模拟统计项 */
export interface LootSimStat {
  item: string;
  count: number;
  frequency: number;
  avgQuantity: number;
}

/**
 * 蒙特卡洛模拟掉落分布并导出统计 CSV。
 * @param table 掉落表
 * @param simulations 模拟次数
 * @returns CSV 字符串
 */
export function exportLootTable<T extends string>(
  table: LootTable<T>,
  simulations: number,
): string {
  if (simulations <= 0) throw new RangeError('simulations must be > 0');

  // 聚合统计
  const stats = new Map<string, { count: number; totalQty: number }>();

  for (let i = 0; i < simulations; i++) {
    const results = table.roll(1);
    for (const r of results) {
      const existing = stats.get(r.item) ?? { count: 0, totalQty: 0 };
      existing.count++;
      existing.totalQty += r.quantity;
      stats.set(r.item, existing);
    }
  }

  const rows: string[] = ['Item,Count,Frequency,AvgQuantity'];
  for (const [item, stat] of stats) {
    const freq = stat.count / simulations;
    const avgQty = stat.totalQty / stat.count;
    rows.push(`${item},${stat.count},${freq.toFixed(6)},${avgQty.toFixed(4)}`);
  }

  return rows.join('\n') + '\n';
}

/* ==================== 抽卡统计导出 ==================== */

/**
 * 导出抽卡统计数据为 CSV。
 * @param banner 抽卡卡池
 * @param pulls 模拟抽卡次数
 * @returns CSV 字符串
 */
export function exportGachaStats(
  banner: GachaBanner,
  pulls: number,
): string {
  if (pulls <= 0) throw new RangeError('pulls must be > 0');

  const rarityCount: Record<string, number> = {};
  let pityTriggerCount = 0;
  let totalSSR = 0;
  let totalSRPlus = 0;

  banner.resetPity();
  const results = banner.pull(pulls);

  for (const r of results) {
    rarityCount[r.rarity] = (rarityCount[r.rarity] ?? 0) + 1;
    if (r.pityTriggered) pityTriggerCount++;
    if (r.rarity === 'SSR') totalSSR++;
    if (r.rarity === 'SR' || r.rarity === 'SSR') totalSRPlus++;
  }

  const stats: GachaStats = {
    totalPulls: pulls,
    rarityDistribution: rarityCount,
    pityTriggerCount,
    averagePullsPerSSR: totalSSR > 0 ? pulls / totalSSR : Infinity,
    averagePullsPerSRPlus: totalSRPlus > 0 ? pulls / totalSRPlus : Infinity,
  };

  // 生成 CSV
  const lines: string[] = [];
  lines.push('Metric,Value');
  lines.push(`Total Pulls,${stats.totalPulls}`);
  lines.push(`Pity Trigger Count,${stats.pityTriggerCount}`);
  lines.push(`Avg Pulls Per SSR,${Number.isFinite(stats.averagePullsPerSSR) ? stats.averagePullsPerSSR.toFixed(2) : 'N/A'}`);
  lines.push(`Avg Pulls Per SR+,${Number.isFinite(stats.averagePullsPerSRPlus) ? stats.averagePullsPerSRPlus.toFixed(2) : 'N/A'}`);
  lines.push('');

  lines.push('Rarity,Count,Percentage');
  const rarityOrder = ['N', 'R', 'SR', 'SSR'];
  for (const rarity of rarityOrder) {
    const count = stats.rarityDistribution[rarity] ?? 0;
    const pct = ((count / pulls) * 100).toFixed(2);
    lines.push(`${rarity},${count},${pct}%`);
  }

  return lines.join('\n') + '\n';
}
