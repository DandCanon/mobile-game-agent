/* ===================================================================
 * src/numerics/index.ts — 数值系统模块公共导出
 *
 * 统一对外 API，供 code-generator、planner 等模块调用。
 * =================================================================== */

// 成长曲线
export { GrowthCurve } from './curves';

// 掉落系统
export { LootTable, GachaBanner } from './curves';

// 战斗数值
export { CombatMath } from './curves';

// 经济平衡
export { Economy } from './curves';

// 类型
export type {
  PiecewiseSegment,
  DropItem,
  GachaResult,
  RarityConfig,
  GachaStats,
  ArmorFormula,
  CombatWeight,
  ResourceItem,
} from './curves';

// 导出
export {
  exportGrowthTable,
  exportLootTable,
  exportGachaStats,
} from './export';

export type { LootSimStat } from './export';
