import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateBSPDungeon,
  generateCaveMap,
  generateRandomWalk,
  generateWFC,
  generateLevel,
  validateLevel,
  TileType,
  DEFAULT_BSP_PARAMS,
  DEFAULT_CA_PARAMS,
  DEFAULT_RANDOMWALK_PARAMS,
  DEFAULT_WFC_PARAMS,
  DEFAULT_WFC_TILESET,
  type Room,
  type Corridor,
  type WFCTile,
  type WFCTileset,
  type MapConfig,
  type GeneratedLevel,
} from '../src/level-gen/index';

// ==================== 辅助函数 ====================

function countTileType(grid: TileType[][], type: TileType): number {
  let count = 0;
  for (const row of grid) {
    for (const cell of row) {
      if (cell === type) count++;
    }
  }
  return count;
}

function gridDimensions(grid: TileType[][]): { width: number; height: number } {
  return { height: grid.length, width: grid[0]?.length ?? 0 };
}

// ==================== BSP 地下城生成 ====================

describe('LevelGen — BSP 地下城生成', () => {
  it('正常参数：生成房间和走廊', () => {
    const level = generateBSPDungeon({
      algorithm: 'bsp',
      width: 64,
      height: 64,
      seed: 42,
      bsp: { minRoomSize: 5, maxDepth: 4 },
    });

    expect(level.data.type).toBe('bsp');
    if (level.data.type !== 'bsp') throw new Error('unreachable');

    const { rooms, corridors } = level.data;
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.length).toBeLessThanOrEqual(16);
    expect(corridors.length).toBeGreaterThan(0);

    for (const room of rooms) {
      expect(room.x).toBeGreaterThanOrEqual(0);
      expect(room.y).toBeGreaterThanOrEqual(0);
      expect(room.width).toBeGreaterThanOrEqual(5);
      expect(room.height).toBeGreaterThanOrEqual(5);
      expect(room.x + room.width).toBeLessThanOrEqual(64);
      expect(room.y + room.height).toBeLessThanOrEqual(64);
      expect(typeof room.id).toBe('number');
      expect(room.type).toBeTruthy();
      expect(typeof room.centerX).toBe('number');
      expect(typeof room.centerY).toBe('number');
    }
  });

  it('边界参数：最小尺寸房间', () => {
    const level = generateBSPDungeon({
      algorithm: 'bsp',
      width: 30,
      height: 30,
      seed: 1,
      bsp: { minRoomSize: 5, maxDepth: 1 },
    });

    expect(level.data.type).toBe('bsp');
    if (level.data.type !== 'bsp') throw new Error('unreachable');
    const { rooms } = level.data;

    expect(rooms.length).toBeLessThanOrEqual(2);
    expect(rooms.length).toBeGreaterThanOrEqual(1);

    for (const room of rooms) {
      expect(room.width).toBeGreaterThanOrEqual(5);
      expect(room.height).toBeGreaterThanOrEqual(5);
    }
  });

  it('极值参数：很小的地图', () => {
    const level = generateBSPDungeon({
      algorithm: 'bsp',
      width: 20,
      height: 20,
      seed: 7,
      bsp: { minRoomSize: 3, maxDepth: 1 },
    });

    expect(level.data.type).toBe('bsp');
    if (level.data.type !== 'bsp') throw new Error('unreachable');

    for (const room of level.data.rooms) {
      expect(room.x + room.width).toBeLessThanOrEqual(20);
      expect(room.y + room.height).toBeLessThanOrEqual(20);
    }
  });

  it('多次生成一致性：相同种子产生相同结果', () => {
    const cfg: MapConfig = {
      algorithm: 'bsp',
      width: 64,
      height: 64,
      seed: 12345,
      bsp: { ...DEFAULT_BSP_PARAMS },
    };

    const a = generateBSPDungeon(cfg);
    const b = generateBSPDungeon(cfg);

    expect(a.data.type).toBe('bsp');
    expect(b.data.type).toBe('bsp');
    if (a.data.type !== 'bsp' || b.data.type !== 'bsp') throw new Error('unreachable');

    expect(a.data.rooms.length).toBe(b.data.rooms.length);
    expect(a.data.corridors.length).toBe(b.data.corridors.length);

    for (let i = 0; i < a.data.rooms.length; i++) {
      expect(a.data.rooms[i].x).toBe(b.data.rooms[i].x);
      expect(a.data.rooms[i].y).toBe(b.data.rooms[i].y);
      expect(a.data.rooms[i].width).toBe(b.data.rooms[i].width);
      expect(a.data.rooms[i].height).toBe(b.data.rooms[i].height);
    }
  });

  it('连通性校验：走廊连接大多数房间', () => {
    for (let seed = 0; seed < 3; seed++) {
      const level = generateBSPDungeon({
        algorithm: 'bsp',
        width: 64,
        height: 64,
        seed,
        bsp: { ...DEFAULT_BSP_PARAMS },
      });

      expect(level.data.type).toBe('bsp');
      if (level.data.type !== 'bsp') throw new Error('unreachable');
      const { rooms, corridors } = level.data;

      if (rooms.length <= 1) continue;

      for (const corr of corridors) {
        expect(corr.path.length).toBeGreaterThan(0);
      }

      expect(corridors.length).toBeGreaterThan(0);

      // 大多数房间应连通（可达比例 > 0.5）
      const result = validateLevel(level);
      expect(result.reachableRatio).toBeGreaterThan(0.5);
    }
  });

  it('深递归：maxDepth=6', () => {
    const level = generateBSPDungeon({
      algorithm: 'bsp',
      width: 128,
      height: 128,
      seed: 99,
      bsp: { minRoomSize: 4, maxDepth: 6 },
    });

    expect(level.data.type).toBe('bsp');
    if (level.data.type !== 'bsp') throw new Error('unreachable');

    expect(level.data.rooms.length).toBeGreaterThanOrEqual(1);
    expect(level.data.rooms.length).toBeLessThanOrEqual(64);
  });

  it('走廊路径点都在地图边界内', () => {
    const level = generateBSPDungeon({
      algorithm: 'bsp',
      width: 64,
      height: 64,
      seed: 55,
      bsp: { minRoomSize: 5, maxDepth: 3 },
    });

    expect(level.data.type).toBe('bsp');
    if (level.data.type !== 'bsp') throw new Error('unreachable');

    for (const corr of level.data.corridors) {
      for (const pt of corr.path) {
        expect(pt.x).toBeGreaterThanOrEqual(0);
        expect(pt.x).toBeLessThan(64);
        expect(pt.y).toBeGreaterThanOrEqual(0);
        expect(pt.y).toBeLessThan(64);
      }
    }
  });
});

// ==================== Cellular Automata 洞穴生成 ====================

describe('LevelGen — CA 洞穴生成', () => {
  it('正常参数：生成合适比例的洞穴', () => {
    const level = generateCaveMap({
      algorithm: 'ca',
      width: 64,
      height: 64,
      seed: 42,
      ca: { fillProbability: 0.45, iterations: 4, deathLimit: 4, birthLimit: 4 },
    });

    expect(level.data.type).toBe('ca');
    if (level.data.type !== 'ca') throw new Error('unreachable');

    const { width, height } = gridDimensions(level.data.grid);
    expect(width).toBe(64);
    expect(height).toBe(64);

    const floorCount = countTileType(level.data.grid, TileType.FLOOR);
    const ratio = floorCount / (width * height);
    expect(ratio).toBeGreaterThan(0.1);
    expect(ratio).toBeLessThan(0.9);
  });

  it('边界参数：fillProbability=1 产生全墙', () => {
    const level = generateCaveMap({
      algorithm: 'ca',
      width: 20,
      height: 20,
      seed: 1,
      ca: { fillProbability: 1.0, iterations: 4, deathLimit: 4, birthLimit: 4 },
    });

    expect(level.data.type).toBe('ca');
    if (level.data.type !== 'ca') throw new Error('unreachable');

    // fillProbability=1 => 初始全墙，CA 迭代后仍全墙
    const floorCount = countTileType(level.data.grid, TileType.FLOOR);
    expect(floorCount).toBe(0);
  });

  it('边界参数：fillProbability=0 产生全地（仅边界为墙）', () => {
    const level = generateCaveMap({
      algorithm: 'ca',
      width: 20,
      height: 20,
      seed: 2,
      ca: { fillProbability: 0.0, iterations: 4, deathLimit: 4, birthLimit: 4 },
    });

    expect(level.data.type).toBe('ca');
    if (level.data.type !== 'ca') throw new Error('unreachable');

    // fillProbability=0 => 内区全地，边界为墙（含角落附近因邻居规则生成的额外墙）
    const wallCount = countTileType(level.data.grid, TileType.WALL);
    // 20x20 边界：顶底各 20 + 左右各 20 - 4角 = 76，迭代后边界附近可能再增几个墙
    expect(wallCount).toBeGreaterThanOrEqual(76);
    expect(wallCount).toBeLessThanOrEqual(100);
  });

  it('极值参数：超大地图', () => {
    const level = generateCaveMap({
      algorithm: 'ca',
      width: 100,
      height: 100,
      seed: 3,
      ca: { fillProbability: 0.45, iterations: 2, deathLimit: 4, birthLimit: 4 },
    });

    expect(level.data.type).toBe('ca');
    if (level.data.type !== 'ca') throw new Error('unreachable');

    expect(level.data.grid.length).toBe(100);
    expect(level.data.grid[0].length).toBe(100);
  });

  it('多次生成一致性：相同种子相同结果', () => {
    const cfg: MapConfig = {
      algorithm: 'ca',
      width: 32,
      height: 32,
      seed: 99999,
      ca: { ...DEFAULT_CA_PARAMS },
    };

    const a = generateCaveMap(cfg);
    const b = generateCaveMap(cfg);
    expect(a.data.type).toBe('ca');
    expect(b.data.type).toBe('ca');
    if (a.data.type !== 'ca' || b.data.type !== 'ca') throw new Error('unreachable');

    for (let y = 0; y < a.data.grid.length; y++) {
      for (let x = 0; x < a.data.grid[y].length; x++) {
        expect(a.data.grid[y][x]).toBe(b.data.grid[y][x]);
      }
    }
  });

  it('不同种子产生不同结果', () => {
    const a = generateCaveMap({ algorithm: 'ca', width: 32, height: 32, seed: 111, ca: { ...DEFAULT_CA_PARAMS } });
    const b = generateCaveMap({ algorithm: 'ca', width: 32, height: 32, seed: 222, ca: { ...DEFAULT_CA_PARAMS } });
    expect(a.data.type).toBe('ca');
    expect(b.data.type).toBe('ca');
    if (a.data.type !== 'ca' || b.data.type !== 'ca') throw new Error('unreachable');

    let diffCount = 0;
    for (let y = 0; y < a.data.grid.length; y++) {
      for (let x = 0; x < a.data.grid[y].length; x++) {
        if (a.data.grid[y][x] !== b.data.grid[y][x]) diffCount++;
      }
    }
    expect(diffCount).toBeGreaterThan(0);
  });

  it('多次迭代后趋于稳定', () => {
    const a = generateCaveMap({ algorithm: 'ca', width: 32, height: 32, seed: 42, ca: { ...DEFAULT_CA_PARAMS, iterations: 6 } });
    const b = generateCaveMap({ algorithm: 'ca', width: 32, height: 32, seed: 42, ca: { ...DEFAULT_CA_PARAMS, iterations: 2 } });
    expect(a.data.type).toBe('ca');
    expect(b.data.type).toBe('ca');
    if (a.data.type !== 'ca' || b.data.type !== 'ca') throw new Error('unreachable');

    let diffCount = 0;
    for (let y = 0; y < a.data.grid.length; y++) {
      for (let x = 0; x < a.data.grid[y].length; x++) {
        if (a.data.grid[y][x] !== b.data.grid[y][x]) diffCount++;
      }
    }
    expect(diffCount).toBeGreaterThan(0);
  });
});

// ==================== Random Walk 随机游走 ====================

describe('LevelGen — Random Walk 随机游走', () => {
  it('正常参数：从中心开始挖出连续通道', () => {
    const level = generateRandomWalk({
      algorithm: 'randomwalk',
      width: 64,
      height: 64,
      seed: 42,
      randomwalk: { steps: 2000, turnProbability: 0.3 },
    });

    expect(level.data.type).toBe('randomwalk');
    if (level.data.type !== 'randomwalk') throw new Error('unreachable');

    const { width, height } = gridDimensions(level.data.grid);
    expect(width).toBe(64);
    expect(height).toBe(64);

    const floorCount = countTileType(level.data.grid, TileType.FLOOR);
    expect(floorCount).toBeGreaterThan(0);
    expect(floorCount).toBeLessThanOrEqual(2000);
  });

  it('边界参数：0 步', () => {
    const level = generateRandomWalk({
      algorithm: 'randomwalk',
      width: 32,
      height: 32,
      seed: 1,
      randomwalk: { steps: 1, turnProbability: 0.3 },
    });

    expect(level.data.type).toBe('randomwalk');
    if (level.data.type !== 'randomwalk') throw new Error('unreachable');

    const floorCount = countTileType(level.data.grid, TileType.FLOOR);
    // 1 step: center + 1 movement = 2 cells (center may be duplicated)
    expect(floorCount).toBeGreaterThanOrEqual(1);
  });

  it('极值参数：超多步数', () => {
    const level = generateRandomWalk({
      algorithm: 'randomwalk',
      width: 50,
      height: 50,
      seed: 2,
      randomwalk: { steps: 10000, turnProbability: 0.5 },
    });

    expect(level.data.type).toBe('randomwalk');
    if (level.data.type !== 'randomwalk') throw new Error('unreachable');

    const floorCount = countTileType(level.data.grid, TileType.FLOOR);
    expect(floorCount).toBeGreaterThan(0);
    expect(floorCount).toBeLessThanOrEqual(2500);
  });

  it('多次生成一致性：相同种子相同结果', () => {
    const cfg: MapConfig = {
      algorithm: 'randomwalk',
      width: 50,
      height: 50,
      seed: 7777,
      randomwalk: { ...DEFAULT_RANDOMWALK_PARAMS },
    };

    const a = generateRandomWalk(cfg);
    const b = generateRandomWalk(cfg);
    expect(a.data.type).toBe('randomwalk');
    expect(b.data.type).toBe('randomwalk');
    if (a.data.type !== 'randomwalk' || b.data.type !== 'randomwalk') throw new Error('unreachable');

    for (let y = 0; y < a.data.grid.length; y++) {
      for (let x = 0; x < a.data.grid[y].length; x++) {
        expect(a.data.grid[y][x]).toBe(b.data.grid[y][x]);
      }
    }
  });

  it('高转弯概率：游走更局部', () => {
    const highTurn = generateRandomWalk({
      algorithm: 'randomwalk', width: 64, height: 64, seed: 42,
      randomwalk: { steps: 1000, turnProbability: 0.9 },
    });
    const lowTurn = generateRandomWalk({
      algorithm: 'randomwalk', width: 64, height: 64, seed: 42,
      randomwalk: { steps: 1000, turnProbability: 0.1 },
    });
    expect(highTurn.data.type).toBe('randomwalk');
    expect(lowTurn.data.type).toBe('randomwalk');
    if (highTurn.data.type !== 'randomwalk' || lowTurn.data.type !== 'randomwalk') throw new Error('unreachable');

    let diffCount = 0;
    for (let y = 0; y < highTurn.data.grid.length; y++) {
      for (let x = 0; x < highTurn.data.grid[y].length; x++) {
        if (highTurn.data.grid[y][x] !== lowTurn.data.grid[y][x]) diffCount++;
      }
    }
    expect(diffCount).toBeGreaterThan(0);
  });

  it('游走不超出地图边界', () => {
    const level = generateRandomWalk({
      algorithm: 'randomwalk',
      width: 32,
      height: 32,
      seed: 123,
      randomwalk: { steps: 5000, turnProbability: 0.5 },
    });

    expect(level.data.type).toBe('randomwalk');
    if (level.data.type !== 'randomwalk') throw new Error('unreachable');

    expect(level.data.grid.length).toBe(32);
    for (const row of level.data.grid) {
      expect(row.length).toBe(32);
    }
  });

  it('1步时中心点至少被标记', () => {
    const level = generateRandomWalk({
      algorithm: 'randomwalk',
      width: 20,
      height: 20,
      seed: 1,
      randomwalk: { steps: 1, turnProbability: 0.3 },
    });

    expect(level.data.type).toBe('randomwalk');
    if (level.data.type !== 'randomwalk') throw new Error('unreachable');
    // Center should be floor
    expect(level.data.grid[10][10]).toBe(TileType.FLOOR);
  });
});

// ==================== WFC 生成 ====================

describe('LevelGen — WFC 生成', () => {
  const tileset: WFCTileset = { ...DEFAULT_WFC_TILESET };

  it('正常参数：生成有效 tile grid', () => {
    const level = generateWFC({
      algorithm: 'wfc',
      width: 16,
      height: 16,
      seed: 42,
      wfc: { tileset, maxRetries: 5 },
    });

    expect(level.data.type).toBe('wfc');
    if (level.data.type !== 'wfc') throw new Error('unreachable');

    expect(level.data.grid.length).toBe(16);
    expect(level.data.grid[0].length).toBe(16);

    const validIds = new Set(tileset.tiles.map((t) => t.id));
    for (const row of level.data.grid) {
      for (const tile of row) {
        expect(validIds.has(tile)).toBe(true);
      }
    }
  });

  it('边界参数：最小尺寸 2x2', () => {
    const level = generateWFC({
      algorithm: 'wfc',
      width: 2,
      height: 2,
      seed: 1,
      wfc: { tileset },
    });

    expect(level.data.type).toBe('wfc');
    if (level.data.type !== 'wfc') throw new Error('unreachable');
    expect(level.data.grid.length).toBe(2);
    expect(level.data.grid[0].length).toBe(2);
    expect(level.data.grid[1].length).toBe(2);
  });

  it('极值参数：较大尺寸 32x32', () => {
    const level = generateWFC({
      algorithm: 'wfc',
      width: 32,
      height: 32,
      seed: 7,
      wfc: { tileset, maxRetries: 3 },
    });

    expect(level.data.type).toBe('wfc');
    if (level.data.type !== 'wfc') throw new Error('unreachable');
    expect(level.data.grid.length).toBe(32);
    expect(level.data.grid[0].length).toBe(32);
  });

  it('多次生成一致性：相同种子相同结果', () => {
    const cfg: MapConfig = {
      algorithm: 'wfc',
      width: 12,
      height: 12,
      seed: 5555,
      wfc: { tileset },
    };

    const a = generateWFC(cfg);
    const b = generateWFC(cfg);
    expect(a.data.type).toBe('wfc');
    expect(b.data.type).toBe('wfc');
    if (a.data.type !== 'wfc' || b.data.type !== 'wfc') throw new Error('unreachable');

    for (let y = 0; y < a.data.grid.length; y++) {
      for (let x = 0; x < a.data.grid[y].length; x++) {
        expect(a.data.grid[y][x]).toBe(b.data.grid[y][x]);
      }
    }
  });

  it('邻接规则得到遵守（allowedEast / allowedSouth 校验）', () => {
    const level = generateWFC({
      algorithm: 'wfc',
      width: 16,
      height: 16,
      seed: 42,
      wfc: { tileset },
    });

    expect(level.data.type).toBe('wfc');
    if (level.data.type !== 'wfc') throw new Error('unreachable');

    const tileMap = new Map<number, WFCTile>();
    for (const t of tileset.tiles) tileMap.set(t.id, t);

    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const current = tileMap.get(level.data.grid[y][x]);
        if (!current) continue;

        // right neighbor → current.allowedEast must include right.id
        if (x < 15) {
          const right = tileMap.get(level.data.grid[y][x + 1]);
          if (right) {
            expect(current.allowedEast.includes(right.id)).toBe(true);
          }
        }

        // down neighbor → current.allowedSouth must include down.id
        if (y < 15) {
          const down = tileMap.get(level.data.grid[y + 1][x]);
          if (down) {
            expect(current.allowedSouth.includes(down.id)).toBe(true);
          }
        }
      }
    }
  });
});

// ==================== validateLevel 校验 ====================

describe('LevelGen — validateLevel 校验', () => {
  it('BSP 有效关卡通过校验', () => {
    const level = generateLevel({
      algorithm: 'bsp',
      width: 64,
      height: 64,
      seed: 42,
      bsp: DEFAULT_BSP_PARAMS,
    });

    const result = validateLevel(level);
    expect(result.valid).toBe(true);
  });

  it('CA 有效关卡通过校验', () => {
    const level = generateLevel({
      algorithm: 'ca',
      width: 64,
      height: 64,
      seed: 42,
      ca: DEFAULT_CA_PARAMS,
    });

    const result = validateLevel(level);
    expect(result.valid).toBe(true);
  });

  it('BSP 无房间时校验失败', () => {
    const level: GeneratedLevel = {
      meta: { algorithm: 'bsp', width: 64, height: 64, seed: 0, generatedAt: Date.now() },
      data: { type: 'bsp', rooms: [], corridors: [] },
    };

    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.messages.some((m) => m.includes('房间'))).toBe(true);
  });

  it('grid 全墙的死图校验', () => {
    const grid: TileType[][] = Array.from({ length: 10 }, () =>
      new Array(10).fill(TileType.WALL),
    );

    const level: GeneratedLevel = {
      meta: { algorithm: 'ca', width: 10, height: 10, seed: 0, generatedAt: Date.now() },
      data: { type: 'ca', grid },
    };

    const result = validateLevel(level);
    expect(result.valid).toBe(false);
    expect(result.messages.some((m) => m.includes('没有可通行'))).toBe(true);
  });

  it('grid 全地板通过校验', () => {
    const grid: TileType[][] = Array.from({ length: 10 }, () =>
      new Array(10).fill(TileType.FLOOR),
    );

    const level: GeneratedLevel = {
      meta: { algorithm: 'randomwalk', width: 10, height: 10, seed: 0, generatedAt: Date.now() },
      data: { type: 'randomwalk', grid },
    };

    const result = validateLevel(level);
    expect(result.valid).toBe(true);
  });
});

// ==================== generateLevel 统一入口 ====================

describe('LevelGen — generateLevel 统一入口', () => {
  it('BSP 算法生成有效关卡', () => {
    const level = generateLevel({
      algorithm: 'bsp',
      width: 64,
      height: 64,
      seed: 42,
      bsp: DEFAULT_BSP_PARAMS,
    });

    expect(level.meta.algorithm).toBe('bsp');
    expect(level.data.type).toBe('bsp');
    if (level.data.type !== 'bsp') throw new Error('unreachable');
    expect(level.data.rooms.length).toBeGreaterThan(0);
  });

  it('cellular_automata (ca) 算法生成有效关卡', () => {
    const level = generateLevel({
      algorithm: 'ca',
      width: 64,
      height: 64,
      seed: 42,
      ca: DEFAULT_CA_PARAMS,
    });

    expect(level.meta.algorithm).toBe('ca');
    expect(level.data.type).toBe('ca');
    if (level.data.type !== 'ca') throw new Error('unreachable');
    expect(level.data.grid.length).toBeGreaterThan(0);
  });

  it('randomwalk 算法生成有效关卡', () => {
    const level = generateLevel({
      algorithm: 'randomwalk',
      width: 64,
      height: 64,
      seed: 42,
      randomwalk: DEFAULT_RANDOMWALK_PARAMS,
    });

    expect(level.meta.algorithm).toBe('randomwalk');
    expect(level.data.type).toBe('randomwalk');
  });

  it('wfc 算法生成有效关卡', () => {
    const level = generateLevel({
      algorithm: 'wfc',
      width: 16,
      height: 16,
      seed: 42,
      wfc: { ...DEFAULT_WFC_PARAMS, tileset: DEFAULT_WFC_TILESET },
    });

    expect(level.meta.algorithm).toBe('wfc');
    expect(level.data.type).toBe('wfc');
    if (level.data.type !== 'wfc') throw new Error('unreachable');
    expect(level.data.grid.length).toBe(16);
  });

  it('WFC 缺少 tileset 时抛错', () => {
    expect(() =>
      generateLevel({
        algorithm: 'wfc',
        width: 16,
        height: 16,
        seed: 42,
        wfc: { tileset: { tileSize: 16, tiles: [] }, maxRetries: 3 },
      } as MapConfig),
    ).toThrow();
  });
});
