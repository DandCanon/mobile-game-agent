/**
 * 房间与匹配系统
 */

/* ================================================================
 * Room — 房间状态管理
 * ================================================================ */

/** 房间状态 */
export enum RoomState {
  WAITING = 'WAITING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
}

/** 房间配置 */
export interface RoomConfig {
  /** 最大玩家数 */
  capacity: number;
  /** 房间密码（空字符串表示无密码） */
  password: string;
  /** 自定义属性 */
  properties: Record<string, string>;
}

/** 房间内玩家信息 */
export interface RoomPlayer {
  playerId: string;
  ready: boolean;
  joinedAt: number;
}

/** 房间数据结构 */
export interface RoomData {
  roomId: string;
  state: RoomState;
  config: RoomConfig;
  players: RoomPlayer[];
  createdAt: number;
}

/**
 * 房间状态管理
 *
 * 生命周期：WAITING → READY → PLAYING → FINISHED
 */
export class Room {
  private rooms: Map<string, RoomData> = new Map();

  /**
   * 创建房间
   */
  createRoom(config: RoomConfig): RoomData {
    const roomId = _generateId('room');
    const room: RoomData = {
      roomId,
      state: RoomState.WAITING,
      config: {
        capacity: Math.max(2, config.capacity),
        password: config.password ?? '',
        properties: config.properties ?? {},
      },
      players: [],
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    return { ...room };
  }

  /**
   * 加入房间
   * @returns 更新后的房间数据，若失败返回错误信息
   */
  joinRoom(roomId: string, playerId: string): { success: true; room: RoomData } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: `房间 ${roomId} 不存在` };
    }
    if (room.state !== RoomState.WAITING && room.state !== RoomState.READY) {
      return { success: false, error: `房间 ${roomId} 已开始游戏，无法加入` };
    }
    if (room.players.length >= room.config.capacity) {
      return { success: false, error: `房间 ${roomId} 已满 (${room.config.capacity}/${room.config.capacity})` };
    }
    if (room.players.some((p) => p.playerId === playerId)) {
      return { success: false, error: `玩家 ${playerId} 已在房间中` };
    }

    room.players.push({
      playerId,
      ready: false,
      joinedAt: Date.now(),
    });

    return { success: true, room: { ...room } };
  }

  /**
   * 离开房间
   */
  leaveRoom(roomId: string, playerId: string): { success: true; room: RoomData } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: `房间 ${roomId} 不存在` };
    }

    const idx = room.players.findIndex((p) => p.playerId === playerId);
    if (idx === -1) {
      return { success: false, error: `玩家 ${playerId} 不在房间中` };
    }

    room.players.splice(idx, 1);

    // 如果房间空了，删除房间
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return { success: true, room: { ...room } };
    }

    return { success: true, room: { ...room } };
  }

  /**
   * 设置准备状态
   */
  setReady(playerId: string, ready: boolean): { success: true; room: RoomData } | { success: false; error: string } {
    // 遍历所有房间找到该玩家
    for (const [roomId, room] of this.rooms) {
      const player = room.players.find((p) => p.playerId === playerId);
      if (player) {
        player.ready = ready;
        return { success: true, room: { ...room } };
      }
    }
    return { success: false, error: `玩家 ${playerId} 不在任何房间中` };
  }

  /**
   * 开始游戏 — 所有玩家就绪后调用
   */
  startGame(roomId: string): { success: true; room: RoomData } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: `房间 ${roomId} 不存在` };
    }
    if (room.state !== RoomState.WAITING && room.state !== RoomState.READY) {
      return { success: false, error: `房间 ${roomId} 状态不正确 (${room.state})` };
    }
    if (room.players.length < 2) {
      return { success: false, error: `至少需要 2 名玩家才能开始` };
    }
    if (!room.players.every((p) => p.ready)) {
      return { success: false, error: '还有玩家未准备' };
    }

    room.state = RoomState.PLAYING;
    return { success: true, room: { ...room } };
  }

  /**
   * 结束游戏
   */
  finishGame(roomId: string): { success: true; room: RoomData } | { success: false; error: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { success: false, error: `房间 ${roomId} 不存在` };
    }
    room.state = RoomState.FINISHED;
    return { success: true, room: { ...room } };
  }

  /**
   * 获取房间信息
   */
  getRoom(roomId: string): RoomData | null {
    const room = this.rooms.get(roomId);
    return room ? { ...room } : null;
  }
}

/* ================================================================
 * Matchmaking — 匹配系统
 * ================================================================ */

/** 匹配玩家信息 */
export interface MatchPlayer {
  playerId: string;
  elo: number;
  latency: number; // ms
}

/** 匹配条件 */
export interface MatchCriteria {
  /** ELO 范围 */
  eloRange: number;
  /** 最大延迟阈值 (ms) */
  maxLatency: number;
}

/** 大厅信息 */
export interface Lobby {
  code: string;
  players: MatchPlayer[];
  createdAt: number;
}

/** 匹配超时降级配置 */
const MATCH_TIMEOUT_MS = 30_000; // 30s
const ELO_RELAX_FACTOR = 1.5; // 放宽 1.5x

/**
 * 匹配引擎
 */
export class Matchmaking {
  private lobby: Lobby | null = null;
  private matchQueue: { player: MatchPlayer; criteria: MatchCriteria; enqueuedAt: number; matched: boolean }[] = [];
  private cancelTokens: Set<string> = new Set();

  /**
   * 快速匹配
   * @returns 匹配到的玩家列表，未匹配到返回空数组
   */
  quickMatch(player: MatchPlayer, criteria: MatchCriteria): MatchPlayer[] {
    const now = Date.now();

    // 先检查是否有可匹配的对手
    for (let i = 0; i < this.matchQueue.length; i++) {
      const entry = this.matchQueue[i];
      if (entry.matched) continue;
      if (entry.player.playerId === player.playerId) continue;

      // 检查是否已取消
      if (this.cancelTokens.has(entry.player.playerId)) continue;

      // 计算有效 ELO 范围（超时降级）
      const elapsed = now - entry.enqueuedAt;
      const effectiveEloRange = elapsed > MATCH_TIMEOUT_MS
        ? entry.criteria.eloRange * ELO_RELAX_FACTOR
        : entry.criteria.eloRange;

      // ELO 匹配
      if (Math.abs(player.elo - entry.player.elo) > effectiveEloRange) continue;

      // 延迟匹配
      if (player.latency > entry.criteria.maxLatency) continue;
      if (entry.player.latency > criteria.maxLatency) continue;

      // 匹配成功
      entry.matched = true;
      return [player, entry.player];
    }

    // 未匹配到，加入队列
    this.matchQueue.push({
      player: { ...player },
      criteria: { ...criteria },
      enqueuedAt: now,
      matched: false,
    });

    return [];
  }

  /**
   * 创建大厅
   */
  createLobby(): Lobby {
    this.lobby = {
      code: _generateId('lobby'),
      players: [],
      createdAt: Date.now(),
    };
    return { ...this.lobby };
  }

  /**
   * 通过邀请码加入大厅
   */
  joinLobby(code: string, player: MatchPlayer): { success: true; lobby: Lobby } | { success: false; error: string } {
    if (!this.lobby) {
      return { success: false, error: '大厅不存在' };
    }
    if (this.lobby.code !== code) {
      return { success: false, error: '邀请码不正确' };
    }
    if (this.lobby.players.some((p) => p.playerId === player.playerId)) {
      return { success: false, error: '玩家已在大厅中' };
    }

    this.lobby.players.push({ ...player });
    return { success: true, lobby: { ...this.lobby } };
  }

  /**
   * 取消匹配
   */
  cancelSearch(playerId: string): void {
    this.cancelTokens.add(playerId);
    // 从队列中移除
    this.matchQueue = this.matchQueue.filter((e) => e.player.playerId !== playerId);
  }

  /**
   * 获取当前队列长度（测试用）
   */
  getQueueLength(): number {
    return this.matchQueue.filter((e) => !e.matched && !this.cancelTokens.has(e.player.playerId)).length;
  }

  /**
   * 强制清空队列（测试用）
   */
  clearQueue(): void {
    this.matchQueue = [];
    this.cancelTokens.clear();
  }
}

/* ================================================================
 * 内部工具
 * ================================================================ */

function _generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
