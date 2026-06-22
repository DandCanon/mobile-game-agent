/* ===================================================================
 * level-gen/algorithms.ts — 程序化关卡生成算法库
 *
 * 4 种经典算法：
 *   1. BSP 二叉树空间分割
 *   2. Cellular Automata 元胞自动机
 *   3. Random Walk 随机游走
 *   4. Wave Function Collapse (简化版)
 * =================================================================== */

import {
  TileType,
} from './types';
import type {
  Room,
  Corridor,
  TileID,
  Grid2D,
  WFCTileset,
  BSPOutput,
  CAOutput,
  RandomWalkOutput,
  WFCOutput,
  GeneratedLevel,
  LevelMeta,
  MapConfig,
} from './types';
import {
  DEFAULT_BSP_PARAMS,
  DEFAULT_CA_PARAMS,
  DEFAULT_RANDOMWALK_PARAMS,
  DEFAULT_WFC_PARAMS,
} from './types';

/* ==================== 简易 PRNG ==================== */

function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ===================================================================
 * 算法 1: BSP 二叉树空间分割
 * =================================================================== */

interface BSPNode {
  x: number;
  y: number;
  width: number;
  height: number;
  left?: BSPNode;
  right?: BSPNode;
  room?: Room;
  horizontal: boolean;
}

/**
 * 生成 BSP 地下城布局。
 *
 * @param config - 统一地图配置（算法='bsp'）
 * @returns GeneratedLevel (BSPOutput)
 */
export function generateBSPDungeon(config: MapConfig): GeneratedLevel {
  const seed = config.seed ?? Date.now();
  const rand = mulberry32(seed);
  const params = { ...DEFAULT_BSP_PARAMS, ...config.bsp };

  const maxDepth = Math.max(1, params.maxDepth);
  const minRoomSize = Math.max(2, params.minRoomSize);

  // 递归分割
  const root: BSPNode = {
    x: 0,
    y: 0,
    width: config.width,
    height: config.height,
    horizontal: false,
  };

  splitNode(root, 0, maxDepth, minRoomSize, rand);

  // 收集叶子节点 → 房间（先给临时 ID）
  const leaves = collectLeaves(root);
  const leafToId = new Map<BSPNode, number>();
  leaves.forEach((leaf, idx) => {
    leaf.room!.id = idx;
    leafToId.set(leaf, idx);
  });

  // 从根节点向上逐层连接兄弟节点 → 走廊（此时 room.id 已正确）
  const corridors: Corridor[] = [];
  connectSiblings(root, corridors);

  // 构建最终房间数组
  const rooms: Room[] = leaves.map((leaf) => ({
    id: leaf.room!.id,
    x: leaf.room!.x,
    y: leaf.room!.y,
    width: leaf.room!.width,
    height: leaf.room!.height,
    type: 'normal' as const,
    centerX: leaf.room!.centerX,
    centerY: leaf.room!.centerY,
  }));

  // 设置起点和 Boss 房
  if (rooms.length > 0) {
    rooms[0].type = 'start';
    if (rooms.length > 1) {
      rooms[rooms.length - 1].type = 'boss';
    }
  }

  const meta: LevelMeta = {
    algorithm: 'bsp',
    width: config.width,
    height: config.height,
    seed,
    generatedAt: Date.now(),
  };

  return {
    meta,
    data: { type: 'bsp', rooms, corridors },
  };
}

function splitNode(
  node: BSPNode,
  depth: number,
  maxDepth: number,
  minRoomSize: number,
  rand: () => number,
): void {
  const canSplitH = node.height >= minRoomSize * 2 + 1;
  const canSplitV = node.width >= minRoomSize * 2 + 1;

  if (depth >= maxDepth || (!canSplitH && !canSplitV)) {
    // 叶子 — 在区域内生成房间
    const padW = Math.max(0, Math.floor((node.width - minRoomSize) * rand() * 0.5));
    const padH = Math.max(0, Math.floor((node.height - minRoomSize) * rand() * 0.5));
    const rw = Math.max(minRoomSize, node.width - padW * 2);
    const rh = Math.max(minRoomSize, node.height - padH * 2);
    node.room = {
      id: -1,
      x: node.x + padW + Math.floor((node.width - padW * 2 - rw) * rand()),
      y: node.y + padH + Math.floor((node.height - padH * 2 - rh) * rand()),
      width: rw,
      height: rh,
      type: 'normal',
      centerX: 0,
      centerY: 0,
    };
    node.room.centerX = node.room.x + Math.floor(node.room.width / 2);
    node.room.centerY = node.room.y + Math.floor(node.room.height / 2);
    return;
  }

  // 优先沿长边分割
  const horizontal = node.height > node.width
    ? true
    : node.width > node.height
      ? false
      : rand() > 0.5;

  node.horizontal = horizontal;

  if (horizontal && canSplitH) {
    const split = Math.floor(
      node.height * (0.3 + rand() * 0.4),
    );
    node.left = {
      x: node.x,
      y: node.y,
      width: node.width,
      height: split,
      horizontal: false,
    };
    node.right = {
      x: node.x,
      y: node.y + split,
      width: node.width,
      height: node.height - split,
      horizontal: false,
    };
  } else if (!horizontal && canSplitV) {
    const split = Math.floor(
      node.width * (0.3 + rand() * 0.4),
    );
    node.left = {
      x: node.x,
      y: node.y,
      width: split,
      height: node.height,
      horizontal: false,
    };
    node.right = {
      x: node.x + split,
      y: node.y,
      width: node.width - split,
      height: node.height,
      horizontal: false,
    };
  }

  if (node.left) splitNode(node.left, depth + 1, maxDepth, minRoomSize, rand);
  if (node.right) splitNode(node.right, depth + 1, maxDepth, minRoomSize, rand);
}

function collectLeaves(node: BSPNode): BSPNode[] {
  if (node.room) return [node];
  const result: BSPNode[] = [];
  if (node.left) result.push(...collectLeaves(node.left));
  if (node.right) result.push(...collectLeaves(node.right));
  return result;
}

function connectSiblings(node: BSPNode, corridors: Corridor[]): void {
  if (!node.left || !node.right) return;

  connectSiblings(node.left, corridors);
  connectSiblings(node.right, corridors);

  const leftLeaves = collectLeaves(node.left);
  const rightLeaves = collectLeaves(node.right);

  if (leftLeaves.length === 0 || rightLeaves.length === 0) return;

  // 找中心最近的房间对
  const la = leftLeaves[leftLeaves.length - 1].room!;
  const ra = rightLeaves[0].room!;

  const lcx = la.centerX;
  const lcy = la.centerY;
  const rcx = ra.centerX;
  const rcy = ra.centerY;

  const path: { x: number; y: number }[] = [];

  // L 型走廊
  if (node.horizontal) {
    // 垂直分割 → 左右排列，水平连接
    for (let x = Math.min(lcx, rcx); x <= Math.max(lcx, rcx); x++) {
      path.push({ x, y: lcy });
    }
    for (let y = Math.min(lcy, rcy); y <= Math.max(lcy, rcy); y++) {
      path.push({ x: rcx, y });
    }
  } else {
    // 水平分割 → 上下排列，垂直连接
    for (let y = Math.min(lcy, rcy); y <= Math.max(lcy, rcy); y++) {
      path.push({ x: lcx, y });
    }
    for (let x = Math.min(lcx, rcx); x <= Math.max(lcx, rcx); x++) {
      path.push({ x, y: rcy });
    }
  }

  if (path.length > 0) {
    corridors.push({
      fromRoomId: la.id,
      toRoomId: ra.id,
      path,
    });
  }
}

/* ===================================================================
 * 算法 2: Cellular Automata 元胞自动机
 * =================================================================== */

/**
 * 使用元胞自动机生成洞穴/地形地图。
 *
 * @param config - 统一地图配置（算法='ca'）
 * @returns GeneratedLevel (CAOutput)
 */
export function generateCaveMap(config: MapConfig): GeneratedLevel {
  const seed = config.seed ?? Date.now();
  const rand = mulberry32(seed);
  const params = { ...DEFAULT_CA_PARAMS, ...config.ca };

  const { width, height } = config;
  const fillProb = params.fillProbability;
  const iters = Math.max(0, params.iterations);
  const deathLimit = params.deathLimit;
  const birthLimit = params.birthLimit;

  // 初始化随机网格
  let grid: Grid2D<TileType> = Array.from({ length: height }, () =>
    Array.from({ length: width }, () =>
      rand() < fillProb ? TileType.WALL : TileType.FLOOR,
    ),
  );

  // 边界加固为墙
  for (let y = 0; y < height; y++) {
    grid[y][0] = TileType.WALL;
    grid[y][width - 1] = TileType.WALL;
  }
  for (let x = 0; x < width; x++) {
    grid[0][x] = TileType.WALL;
    grid[height - 1][x] = TileType.WALL;
  }

  // 迭代
  for (let iter = 0; iter < iters; iter++) {
    const next: Grid2D<TileType> = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => {
        // 边界保持为墙
        if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
          return TileType.WALL;
        }
        const count = countNeighbors(grid, x, y, width, height);
        if (grid[y][x] === TileType.WALL) {
          return count < deathLimit ? TileType.FLOOR : TileType.WALL;
        } else {
          return count > birthLimit ? TileType.WALL : TileType.FLOOR;
        }
      }),
    );
    grid = next;
  }

  const meta: LevelMeta = {
    algorithm: 'ca',
    width,
    height,
    seed,
    generatedAt: Date.now(),
  };

  return { meta, data: { type: 'ca', grid } };
}

function countNeighbors(
  grid: Grid2D<TileType>,
  cx: number,
  cy: number,
  width: number,
  height: number,
): number {
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (grid[ny][nx] === TileType.WALL) count++;
      } else {
        count++; // 边界外视为墙
      }
    }
  }
  return count;
}

/* ===================================================================
 * 算法 3: Random Walk 随机游走
 * =================================================================== */

/**
 * 使用随机游走生成自然洞穴/矿道。
 *
 * @param config - 统一地图配置（算法='randomwalk'）
 * @returns GeneratedLevel (RandomWalkOutput)
 */
export function generateRandomWalk(config: MapConfig): GeneratedLevel {
  const seed = config.seed ?? Date.now();
  const rand = mulberry32(seed);
  const params = { ...DEFAULT_RANDOMWALK_PARAMS, ...config.randomwalk };

  const { width, height } = config;
  const steps = Math.max(1, params.steps);
  const turnProb = params.turnProbability;

  // 初始全墙
  const grid: Grid2D<TileType> = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => TileType.WALL),
  );

  // 起始点：中心
  let cx = params.startX ?? Math.floor(width / 2);
  let cy = params.startY ?? Math.floor(height / 2);

  // 边界保护
  cx = Math.max(1, Math.min(cx, width - 2));
  cy = Math.max(1, Math.min(cy, height - 2));

  let prevDx = 0;
  let prevDy = 0;

  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  for (let i = 0; i < steps; i++) {
    // 挖当前位置
    if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
      grid[cy][cx] = TileType.FLOOR;
    }

    // 选择方向：偏向继续直行
    let dx: number;
    let dy: number;
    if (rand() < turnProb) {
      // 继续直行
      dx = prevDx;
      dy = prevDy;
      // 如果之前没有方向，随机选一个
      if (dx === 0 && dy === 0) {
        [dx, dy] = dirs[Math.floor(rand() * 4)];
      }
    } else {
      // 随机新方向
      [dx, dy] = dirs[Math.floor(rand() * 4)];
    }

    // 边界检查：不要走出边界
    const nx = cx + dx;
    const ny = cy + dy;
    if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
      // 反弹：选相反方向
      dx = -dx;
      dy = -dy;
    }

    cx += dx;
    cy += dy;

    // 边界钳位
    cx = Math.max(0, Math.min(cx, width - 1));
    cy = Math.max(0, Math.min(cy, height - 1));

    prevDx = dx;
    prevDy = dy;
  }

  // 保证最后位置也被挖
  if (cx >= 0 && cx < width && cy >= 0 && cy < height) {
    grid[cy][cx] = TileType.FLOOR;
  }

  const meta: LevelMeta = {
    algorithm: 'randomwalk',
    width,
    height,
    seed,
    generatedAt: Date.now(),
  };

  return { meta, data: { type: 'randomwalk', grid } };
}

/* ===================================================================
 * 算法 4: Wave Function Collapse (简化版)
 * =================================================================== */

/**
 * 使用 Wave Function Collapse 算法生成瓦片地图。
 *
 * @param config - 统一地图配置（算法='wfc'）
 * @returns GeneratedLevel (WFCOutput)
 */
export function generateWFC(config: MapConfig): GeneratedLevel {
  const seed = config.seed ?? Date.now();
  const rand = mulberry32(seed);
  const params = { ...DEFAULT_WFC_PARAMS, ...config.wfc };
  const tileset = params.tileset;

  const { width, height } = config;
  const tileCount = tileset.tiles.length;

  if (tileCount === 0) {
    throw new Error('WFC tileset 至少需要 1 个瓦片');
  }

  const maxRetries = Math.max(1, params.maxRetries);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const result = tryWFC(width, height, tileset, rand);
    if (result) return result;
  }

  // 所有尝试失败 → 回退：全部填充第一个瓦片
  const failGrid: Grid2D<TileID> = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => tileset.tiles[0].id),
  );

  const meta: LevelMeta = {
    algorithm: 'wfc',
    width,
    height,
    seed,
    generatedAt: Date.now(),
  };

  return {
    meta,
    data: { type: 'wfc', grid: failGrid, tileset },
  };
}

function tryWFC(
  width: number,
  height: number,
  tileset: WFCTileset,
  rand: () => number,
): GeneratedLevel | null {
  const tileCount = tileset.tiles.length;
  const tileMap = new Map(tileset.tiles.map((t) => [t.id, t]));

  // 初始化每个格子的可能性：所有瓦片
  const possible: Set<number>[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => new Set(tileset.tiles.map((t) => t.id))),
  );

  const collapsed: (number | null)[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => null),
  );

  const totalCells = width * height;

  for (let collapsedCount = 0; collapsedCount < totalCells; collapsedCount++) {
    // 找到熵最小的未坍缩格
    let minEntropy = tileCount + 1;
    let candidates: { x: number; y: number }[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (collapsed[y][x] !== null) continue;
        const size = possible[y][x].size;
        if (size === 0) return null; // 矛盾
        if (size < minEntropy) {
          minEntropy = size;
          candidates = [{ x, y }];
        } else if (size === minEntropy) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) break;

    // 随机选一个候选格
    const { x, y } = candidates[Math.floor(rand() * candidates.length)];

    // 随机坍缩为该格可能的瓦片之一
    const options = Array.from(possible[y][x]);
    const chosen = options[Math.floor(rand() * options.length)];
    collapsed[y][x] = chosen;
    possible[y][x] = new Set([chosen]);

    // 传播约束
    const queue: { x: number; y: number }[] = [{ x, y }];
    while (queue.length > 0) {
      const { x: cx, y: cy } = queue.shift()!;
      const currentPossible = possible[cy][cx];

      // 检查四个邻居
      const neighbors: {
        nx: number;
        ny: number;
        allowedField: 'allowedNorth' | 'allowedSouth' | 'allowedEast' | 'allowedWest';
        selfField: 'allowedNorth' | 'allowedSouth' | 'allowedEast' | 'allowedWest';
      }[] = [
        { nx: cx, ny: cy - 1, allowedField: 'allowedSouth', selfField: 'allowedNorth' },
        { nx: cx, ny: cy + 1, allowedField: 'allowedNorth', selfField: 'allowedSouth' },
        { nx: cx + 1, ny: cy, allowedField: 'allowedWest', selfField: 'allowedEast' },
        { nx: cx - 1, ny: cy, allowedField: 'allowedEast', selfField: 'allowedWest' },
      ];

      for (const { nx, ny, allowedField, selfField } of neighbors) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (collapsed[ny][nx] !== null) continue;

        const neighborPossible = possible[ny][nx];
        // 收集当前格可接受的值 → 映射到允许列表
        const allowedValues = new Set<number>();
        for (const pid of currentPossible) {
          const tile = tileMap.get(pid);
          if (tile) {
            for (const aid of tile[selfField]) {
              allowedValues.add(aid);
            }
          }
        }

        // 移除邻居中不在允许列表的值
        const toRemove: number[] = [];
        for (const np of neighborPossible) {
          if (!allowedValues.has(np)) toRemove.push(np);
        }

        if (toRemove.length > 0) {
          for (const r of toRemove) neighborPossible.delete(r);
          if (neighborPossible.size === 0) return null; // 矛盾
          queue.push({ x: nx, y: ny });
        }
      }
    }
  }

  // 构建输出网格
  const grid: Grid2D<TileID> = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      if (collapsed[y][x] !== null) return collapsed[y][x]!;
      // 未坍缩格：从可能的选项中随机选
      const opts = Array.from(possible[y][x]);
      return opts.length > 0
        ? opts[Math.floor(rand() * opts.length)]
        : tileset.tiles[0].id;
    }),
  );

  const meta: LevelMeta = {
    algorithm: 'wfc',
    width,
    height,
    seed: Date.now(),
    generatedAt: Date.now(),
  };

  return { meta, data: { type: 'wfc', grid, tileset } };
}

/* ===================================================================
 * 统一生成入口
 * =================================================================== */

/**
 * 根据统一配置生成关卡。
 */
export function generateLevel(config: MapConfig): GeneratedLevel {
  switch (config.algorithm) {
    case 'bsp':
      return generateBSPDungeon(config);
    case 'ca':
      return generateCaveMap(config);
    case 'randomwalk':
      return generateRandomWalk(config);
    case 'wfc':
      return generateWFC(config);
    default: {
      const _exhaustive: never = config.algorithm;
      throw new Error(`不支持的算法类型: ${_exhaustive}`);
    }
  }
}
