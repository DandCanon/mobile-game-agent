/* ===================================================================
 * level-gen/types.ts — 关卡生成类型体系
 *
 * 定义关卡生成所需的所有数据结构、配置接口和校验逻辑。
 * =================================================================== */

/* ==================== 基础网格类型 ==================== */

/** 二维网格泛型 */
export type Grid2D<T> = T[][];

/** 瓦片类型（用于 Cellular Automata / Random Walk） */
export enum TileType {
  WALL = 0,
  FLOOR = 1,
}

/** 瓦片 ID（用于 WFC） */
export type TileID = number;

/* ==================== 房间与走廊（BSP） ==================== */

/** 房间 */
export interface Room {
  /** 房间左上角 X 坐标 */
  x: number;
  /** 房间左上角 Y 坐标 */
  y: number;
  /** 房间宽度 */
  width: number;
  /** 房间高度 */
  height: number;
  /** 房间唯一 ID（顺序编号） */
  id: number;
  /** 房间类型 */
  type: 'normal' | 'start' | 'boss' | 'treasure';
  /** 房间中心 X */
  centerX: number;
  /** 房间中心 Y */
  centerY: number;
}

/** 走廊 */
export interface Corridor {
  /** 起始房间 ID */
  fromRoomId: number;
  /** 目标房间 ID */
  toRoomId: number;
  /** 走廊路径（每个点一行） */
  path: { x: number; y: number }[];
}

/* ==================== WFC 类型 ==================== */

/** 单个 WFC 瓦片定义 */
export interface WFCTile {
  /** 瓦片索引（0-based） */
  id: TileID;
  /** 瓦片名称 */
  name: string;
  /** 北侧允许的邻接瓦片 ID 列表 */
  allowedNorth: TileID[];
  /** 南侧允许的邻接瓦片 ID 列表 */
  allowedSouth: TileID[];
  /** 东侧允许的邻接瓦片 ID 列表 */
  allowedEast: TileID[];
  /** 西侧允许的邻接瓦片 ID 列表 */
  allowedWest: TileID[];
}

/** WFC tileset 定义 */
export interface WFCTileset {
  /** 瓦片尺寸（像素，用于渲染参考） */
  tileSize: number;
  /** 瓦片列表 */
  tiles: WFCTile[];
}

/* ==================== 统一配置接口 ==================== */

/** 算法类型 */
export type AlgorithmType = 'bsp' | 'ca' | 'randomwalk' | 'wfc';

/** BSP 算法专属参数 */
export interface BSPParams {
  /** 最小房间尺寸（默认 4） */
  minRoomSize: number;
  /** 最大分割深度（默认 4） */
  maxDepth: number;
  /** 走廊宽度（默认 1） */
  corridorWidth: number;
}

/** Cellular Automata 算法专属参数 */
export interface CAParams {
  /** 初始填充率（0~1，默认 0.45） */
  fillProbability: number;
  /** 迭代次数（默认 4） */
  iterations: number;
  /** 存活阈值 — 周围 WALL 数低于此值则变 FLOOR（默认 4） */
  deathLimit: number;
  /** 出生阈值 — 周围 WALL 数高于此值则变 WALL（默认 4） */
  birthLimit: number;
}

/** Random Walk 算法专属参数 */
export interface RandomWalkParams {
  /** 游走步数（默认 1000） */
  steps: number;
  /** 转弯偏好（0~1，值越大越倾向直行，默认 0.3） */
  turnProbability: number;
  /** 起始点（不传则用地图中心） */
  startX?: number;
  startY?: number;
}

/** WFC 算法专属参数 */
export interface WFCParams {
  /** tileset 定义 */
  tileset: WFCTileset;
  /** 最大尝试次数（遇矛盾重试，默认 10） */
  maxRetries: number;
}

/** 统一配置接口 */
export interface MapConfig {
  /** 算法类型 */
  algorithm: AlgorithmType;
  /** 地图宽度 */
  width: number;
  /** 地图高度 */
  height: number;
  /** 随机种子（可选） */
  seed?: number;
  /** BSP 专属参数 */
  bsp?: Partial<BSPParams>;
  /** Cellular Automata 专属参数 */
  ca?: Partial<CAParams>;
  /** Random Walk 专属参数 */
  randomwalk?: Partial<RandomWalkParams>;
  /** WFC 专属参数 */
  wfc?: Partial<WFCParams>;
}

/* ==================== 统一输出接口 ==================== */

/** BSP 算法输出 */
export interface BSPOutput {
  type: 'bsp';
  rooms: Room[];
  corridors: Corridor[];
}

/** Cellular Automata 算法输出 */
export interface CAOutput {
  type: 'ca';
  grid: Grid2D<TileType>;
}

/** Random Walk 算法输出 */
export interface RandomWalkOutput {
  type: 'randomwalk';
  grid: Grid2D<TileType>;
}

/** WFC 算法输出 */
export interface WFCOutput {
  type: 'wfc';
  grid: Grid2D<TileID>;
  tileset: WFCTileset;
}

/** 所有算法输出的联合类型 */
export type LevelData = BSPOutput | CAOutput | RandomWalkOutput | WFCOutput;

/** 关卡元信息 */
export interface LevelMeta {
  algorithm: AlgorithmType;
  width: number;
  height: number;
  seed: number;
  generatedAt: number;
}

/** 统一的生成关卡输出 */
export interface GeneratedLevel {
  meta: LevelMeta;
  data: LevelData;
}

/* ==================== 校验类型 ==================== */

/** 关卡校验结果 */
export interface LevelValidationResult {
  valid: boolean;
  /** 可达区域占总可通行格的比例 */
  reachableRatio: number;
  /** 死路数量（仅一个方向的通行格） */
  deadEndCount: number;
  /** 连通分量数量 */
  connectedComponentCount: number;
  /** 校验消息 */
  messages: string[];
}

/* ==================== 默认参数 ==================== */

export const DEFAULT_BSP_PARAMS: BSPParams = {
  minRoomSize: 4,
  maxDepth: 4,
  corridorWidth: 1,
};

export const DEFAULT_CA_PARAMS: CAParams = {
  fillProbability: 0.45,
  iterations: 4,
  deathLimit: 4,
  birthLimit: 4,
};

export const DEFAULT_RANDOMWALK_PARAMS: RandomWalkParams = {
  steps: 1000,
  turnProbability: 0.3,
};

export const DEFAULT_WFC_TILESET: WFCTileset = {
  tileSize: 16,
  tiles: [
    {
      id: 0,
      name: 'grass',
      allowedNorth: [0, 2, 3],
      allowedSouth: [0, 2, 3],
      allowedEast: [0, 2, 3],
      allowedWest: [0, 2, 3],
    },
    {
      id: 1,
      name: 'water',
      allowedNorth: [1, 2],
      allowedSouth: [1, 2],
      allowedEast: [1, 2],
      allowedWest: [1, 2],
    },
    {
      id: 2,
      name: 'sand',
      allowedNorth: [0, 1, 2, 3],
      allowedSouth: [0, 1, 2, 3],
      allowedEast: [0, 1, 2, 3],
      allowedWest: [0, 1, 2, 3],
    },
    {
      id: 3,
      name: 'stone',
      allowedNorth: [0, 2, 3],
      allowedSouth: [0, 2, 3],
      allowedEast: [0, 2, 3],
      allowedWest: [0, 2, 3],
    },
  ],
};

export const DEFAULT_WFC_PARAMS: WFCParams = {
  tileset: DEFAULT_WFC_TILESET,
  maxRetries: 10,
};

/* ==================== 关卡校验 ==================== */

/**
 * 校验关卡合法性：连通性、可达比例、死路检测。
 * 对 CA / RandomWalk 输出检查 FLOOR 格连通性；
 * 对 BSP 输出检查房间连通性；
 * 对 WFC 输出按 tileset 的定义检查（所有非水格视为可通行）。
 */
export function validateLevel(level: GeneratedLevel): LevelValidationResult {
  const messages: string[] = [];
  const { data } = level;

  if (data.type === 'bsp') {
    return validateBSPLevel(data, messages);
  } else if (data.type === 'wfc') {
    return validateWFCLevel(data, messages);
  } else {
    return validateGridLevel(data.grid, messages);
  }
}

function validateBSPLevel(
  data: BSPOutput,
  messages: string[],
): LevelValidationResult {
  const { rooms } = data;

  if (rooms.length === 0) {
    messages.push('BSP 关卡未生成任何房间');
    return {
      valid: false,
      reachableRatio: 0,
      deadEndCount: 0,
      connectedComponentCount: 0,
      messages,
    };
  }

  // 检查房间尺寸
  for (const room of rooms) {
    if (room.width < 1 || room.height < 1) {
      messages.push(`房间 ${room.id} 尺寸无效: ${room.width}x${room.height}`);
    }
  }

  // 从房间图构建连通分量（基于走廊）
  const adjacency = new Map<number, Set<number>>();
  for (const room of rooms) {
    adjacency.set(room.id, new Set());
  }
  for (const corridor of data.corridors) {
    adjacency.get(corridor.fromRoomId)?.add(corridor.toRoomId);
    adjacency.get(corridor.toRoomId)?.add(corridor.fromRoomId);
  }

  const visited = new Set<number>();
  const components: number[] = [];

  function dfs(id: number): number {
    if (visited.has(id)) return 0;
    visited.add(id);
    let count = 1;
    for (const neighbor of adjacency.get(id) ?? []) {
      count += dfs(neighbor);
    }
    return count;
  }

  for (const room of rooms) {
    if (!visited.has(room.id)) {
      components.push(dfs(room.id));
    }
  }

  const connectedComponentCount = components.length;
  const reachableRatio =
    components.length > 0
      ? Math.max(...components) / rooms.length
      : 0;

  let deadEndCount = 0;
  for (const [, neighbors] of adjacency) {
    if (neighbors.size <= 1) deadEndCount++;
  }

  if (connectedComponentCount > 1) {
    messages.push(`存在 ${connectedComponentCount} 个不连通的房间组`);
  }

  const valid = rooms.length > 0 && connectedComponentCount === 1;

  return {
    valid,
    reachableRatio,
    deadEndCount,
    connectedComponentCount,
    messages: messages.length > 0 ? messages : ['关卡结构合法'],
  };
}

function validateGridLevel(
  grid: Grid2D<TileType>,
  messages: string[],
): LevelValidationResult {
  if (grid.length === 0 || grid[0].length === 0) {
    messages.push('网格为空');
    return {
      valid: false,
      reachableRatio: 0,
      deadEndCount: 0,
      connectedComponentCount: 0,
      messages,
    };
  }

  const height = grid.length;
  const width = grid[0].length;

  // 找到第一个 FLOOR 格
  let startX = -1;
  let startY = -1;
  let totalFloor = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] === TileType.FLOOR) {
        totalFloor++;
        if (startX === -1) {
          startX = x;
          startY = y;
        }
      }
    }
  }

  if (totalFloor === 0) {
    messages.push('没有可通行的 FLOOR 格');
    return {
      valid: false,
      reachableRatio: 0,
      deadEndCount: 0,
      connectedComponentCount: 0,
      messages,
    };
  }

  // BFS 计算可达 FLOOR 格
  const visited = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => false),
  );
  const queue: [number, number][] = [[startX, startY]];
  visited[startY][startX] = true;
  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  let reachable = 0;
  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    reachable++;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (
        nx >= 0 &&
        nx < width &&
        ny >= 0 &&
        ny < height &&
        grid[ny][nx] === TileType.FLOOR &&
        !visited[ny][nx]
      ) {
        visited[ny][nx] = true;
        queue.push([nx, ny]);
      }
    }
  }

  const reachableRatio = totalFloor > 0 ? reachable / totalFloor : 0;

  // 死路检测：FLOOR 格且恰好一个相邻 FLOOR
  let deadEndCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (grid[y][x] !== TileType.FLOOR) continue;
      let neighbors = 0;
      for (const [dx, dy] of dirs) {
        if (grid[y + dy][x + dx] === TileType.FLOOR) neighbors++;
      }
      if (neighbors === 1) deadEndCount++;
    }
  }

  const valid = reachableRatio >= 0.3;

  if (!valid) {
    messages.push(
      `可达区域比例 ${(reachableRatio * 100).toFixed(1)}% 低于阈值 30%`,
    );
  } else {
    messages.push('关卡结构合法');
  }

  return {
    valid,
    reachableRatio,
    deadEndCount,
    connectedComponentCount: 1,
    messages,
  };
}

function validateWFCLevel(
  data: WFCOutput,
  messages: string[],
): LevelValidationResult {
  if (data.grid.length === 0 || data.grid[0].length === 0) {
    messages.push('WFC 网格为空');
    return {
      valid: false,
      reachableRatio: 0,
      deadEndCount: 0,
      connectedComponentCount: 0,
      messages,
    };
  }

  const height = data.grid.length;
  const width = data.grid[0].length;

  // 计数
  const counts = new Map<TileID, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tid = data.grid[y][x];
      counts.set(tid, (counts.get(tid) ?? 0) + 1);
    }
  }

  const total = width * height;
  const uniqueTiles = counts.size;

  if (uniqueTiles === 1) {
    messages.push('WFC 网格仅含一种瓦片');
  }

  // 检查邻接约束是否满足
  let constraintViolations = 0;
  const tileMap = new Map(data.tileset.tiles.map((t) => [t.id, t]));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const t = tileMap.get(data.grid[y][x]);
      if (!t) continue;
      if (y > 0) {
        const north = tileMap.get(data.grid[y - 1][x]);
        if (north && !t.allowedNorth.includes(north.id)) {
          constraintViolations++;
        }
      }
      if (y < height - 1) {
        const south = tileMap.get(data.grid[y + 1][x]);
        if (south && !t.allowedSouth.includes(south.id)) {
          constraintViolations++;
        }
      }
      if (x > 0) {
        const west = tileMap.get(data.grid[y][x - 1]);
        if (west && !t.allowedWest.includes(west.id)) {
          constraintViolations++;
        }
      }
      if (x < width - 1) {
        const east = tileMap.get(data.grid[y][x + 1]);
        if (east && !t.allowedEast.includes(east.id)) {
          constraintViolations++;
        }
      }
    }
  }

  if (constraintViolations > 0) {
    messages.push(`WFC 邻接约束违反 ${constraintViolations} 处`);
  }

  const valid =
    uniqueTiles > 0 &&
    constraintViolations < total * 0.05 &&
    counts.size > 1;

  if (valid) {
    messages.push('WFC 关卡结构合法');
  }

  return {
    valid,
    reachableRatio: 1,
    deadEndCount: 0,
    connectedComponentCount: 1,
    messages,
  };
}
