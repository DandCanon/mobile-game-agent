/* ===================================================================
 * level-gen/index.ts — 关卡生成模块公共导出
 *
 * 统一对外 API，供 code-generator 等模块调用。
 * =================================================================== */

// 算法
export {
  generateBSPDungeon,
  generateCaveMap,
  generateRandomWalk,
  generateWFC,
  generateLevel,
} from './algorithms';

// 类型
export {
  TileType,
  DEFAULT_BSP_PARAMS,
  DEFAULT_CA_PARAMS,
  DEFAULT_RANDOMWALK_PARAMS,
  DEFAULT_WFC_TILESET,
  DEFAULT_WFC_PARAMS,
  validateLevel,
} from './types';

export type {
  Room,
  Corridor,
  TileID,
  Grid2D,
  WFCTile,
  WFCTileset,
  MapConfig,
  AlgorithmType,
  BSPParams,
  CAParams,
  RandomWalkParams,
  WFCParams,
  BSPOutput,
  CAOutput,
  RandomWalkOutput,
  WFCOutput,
  LevelData,
  LevelMeta,
  GeneratedLevel,
  LevelValidationResult,
} from './types';
