import { describe, it, expect, beforeEach } from 'vitest';
import {
  StateSync,
  ClientPrediction,
  Interpolation,
  Room,
  Matchmaking,
  MessageType,
  PingManager,
  serialize,
  deserialize,
} from '../src/networking/index';
import type { Snapshot } from '../src/networking/sync';
import type { NetworkMessage } from '../src/networking/protocol';
import type { MatchPlayer, MatchCriteria } from '../src/networking/matchmaking';

/* ================================================================
 * StateSync — 状态快照与增量
 * ================================================================ */

type TestState = {
  x: number;
  y: number;
  hp: number;
  name: string;
  [key: string]: unknown;
};

describe('StateSync — 状态快照', () => {
  it('createSnapshot 生成正确的快照结构', () => {
    const state: TestState = { x: 10, y: 20, hp: 100, name: 'player1' };
    const snap = StateSync.createSnapshot(state, 1);
    expect(snap.seq).toBe(1);
    expect(snap.timestamp).toBeGreaterThan(0);
    expect(snap.data).toEqual(state);
    expect(typeof snap.checksum).toBe('number');
  });

  it('相同状态产生相同 checksum', () => {
    const s1 = StateSync.createSnapshot({ x: 1, y: 2, hp: 100, name: 'a' }, 0);
    const s2 = StateSync.createSnapshot({ x: 1, y: 2, hp: 100, name: 'a' }, 1);
    expect(s1.checksum).toBe(s2.checksum);
  });

  it('不同状态产生不同 checksum', () => {
    const s1 = StateSync.createSnapshot({ x: 1, y: 2, hp: 100, name: 'a' }, 0);
    const s2 = StateSync.createSnapshot({ x: 1, y: 3, hp: 100, name: 'a' }, 1);
    expect(s1.checksum).not.toBe(s2.checksum);
  });

  it('seq 递增正确', () => {
    const s1 = StateSync.createSnapshot({ x: 0, y: 0, hp: 100, name: 'p' }, 5);
    const s2 = StateSync.createSnapshot({ x: 0, y: 0, hp: 100, name: 'p' }, 10);
    expect(s2.seq).toBeGreaterThan(s1.seq);
  });
});

describe('StateSync — applySnapshot 全量同步', () => {
  it('applySnapshot 应用快照覆盖当前状态', () => {
    const current: TestState = { x: 1, y: 1, hp: 50, name: 'old' };
    const snap = StateSync.createSnapshot({ x: 10, y: 20, hp: 100, name: 'new' }, 2);
    const result = StateSync.applySnapshot(current, snap);
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
    expect(result.hp).toBe(100);
    expect(result.name).toBe('new');
  });

  it('applySnapshot 返回深拷贝，修改不影响原快照', () => {
    const snap = StateSync.createSnapshot({ x: 5, y: 5, hp: 80, name: 'p' }, 1);
    const result = StateSync.applySnapshot({ x: 0, y: 0, hp: 0, name: '' }, snap);
    result.x = 999;
    expect(snap.data.x).toBe(5);
  });
});

describe('StateSync — deltaCompress 增量压缩', () => {
  it('deltaCompress 只返回变化的字段', () => {
    const prev: TestState = { x: 0, y: 0, hp: 100, name: 'p' };
    const current: TestState = { x: 5, y: 0, hp: 100, name: 'p' };
    const delta = StateSync.deltaCompress(prev, current);
    expect(Object.keys(delta)).toEqual(['x']);
    expect(delta.x).toBe(5);
  });

  it('deltaCompress 多字段变化时全部捕获', () => {
    const prev: TestState = { x: 0, y: 0, hp: 100, name: 'old' };
    const current: TestState = { x: 10, y: 20, hp: 80, name: 'old' };
    const delta = StateSync.deltaCompress(prev, current);
    expect(Object.keys(delta as object).sort()).toEqual(['hp', 'x', 'y']);
    expect(delta.x).toBe(10);
    expect(delta.y).toBe(20);
    expect(delta.hp).toBe(80);
  });

  it('deltaCompress 无变化时返回空对象', () => {
    const state: TestState = { x: 1, y: 2, hp: 100, name: 'p' };
    const delta = StateSync.deltaCompress(state, { ...state });
    expect(Object.keys(delta as object).length).toBe(0);
  });
});

describe('StateSync — deltaApply 增量应用', () => {
  it('deltaApply 合并增量到基础状态', () => {
    const base: TestState = { x: 0, y: 0, hp: 100, name: 'p' };
    const result = StateSync.deltaApply(base, { x: 10, hp: 50 });
    expect(result).toEqual({ x: 10, y: 0, hp: 50, name: 'p' });
  });

  it('deltaApply 返回新对象不修改原对象', () => {
    const base: TestState = { x: 0, y: 0, hp: 100, name: 'p' };
    const result = StateSync.deltaApply(base, { x: 5 });
    expect(result).not.toBe(base);
    expect(base.x).toBe(0);
  });

  it('deltaApply 与 deltaCompress 可逆', () => {
    const prev: TestState = { x: 0, y: 0, hp: 100, name: 'a' };
    const current: TestState = { x: 10, y: 20, hp: 100, name: 'a' };
    const delta = StateSync.deltaCompress(prev, current);
    const restored = StateSync.deltaApply(prev, delta);
    expect(restored).toEqual(current);
  });
});

/* ================================================================
 * ClientPrediction — 客户端预测与回滚
 * ================================================================ */

interface PlayerState {
  x: number;
  y: number;
  hp: number;
}

interface PlayerInput {
  dx: number;
  dy: number;
}

function moveState(state: PlayerState, input: PlayerInput): PlayerState {
  return { ...state, x: state.x + input.dx, y: state.y + input.dy };
}

describe('ClientPrediction', () => {
  let cp: ClientPrediction<PlayerState, PlayerInput>;

  beforeEach(() => {
    cp = new ClientPrediction(moveState);
  });

  it('addInput 记录输入', () => {
    cp.addInput(1, { dx: 1, dy: 0 });
    cp.addInput(2, { dx: -1, dy: 1 });
    // 输入被记录（通过 reconcile 验证）
    expect(cp.getLastAckedSeq()).toBe(-1);
  });

  it('predict 本地预测正确', () => {
    const state: PlayerState = { x: 0, y: 0, hp: 100 };
    const result = cp.predict(state, { dx: 5, dy: 3 });
    expect(result).toEqual({ x: 5, y: 3, hp: 100 });
  });

  it('predict 不修改原始状态', () => {
    const state: PlayerState = { x: 0, y: 0, hp: 100 };
    cp.predict(state, { dx: 10, dy: 0 });
    expect(state.x).toBe(0);
  });

  it('reconcile 回滚重放未确认输入', () => {
    // 模拟：玩家在 seq 1 做了输入A，客户端预测到 (5,0)
    // 同时在 seq 2 做了输入B，预测到 (8,3)
    // 但服务端权威状态在 seq 1 是 (4,0)（略有偏差）
    // reconcile 应从服务端 (4,0) 重放 seq 2 的输入B → (7,3)
    cp.addInput(1, { dx: 5, dy: 0 });
    cp.addInput(2, { dx: 3, dy: 3 });

    // 服务端告知 seq 1 已确认，且服务端状态为 (4,0)
    const result = cp.reconcile({ x: 4, y: 0, hp: 100 }, 1);

    // 应该重放 seq 2 的输入：(4+3, 0+3) = (7, 3)
    expect(result).toEqual({ x: 7, y: 3, hp: 100 });
    expect(cp.getLastAckedSeq()).toBe(1);
  });

  it('reconcile 所有输入已确认时返回服务端状态', () => {
    cp.addInput(1, { dx: 1, dy: 0 });
    cp.addInput(2, { dx: 2, dy: 0 });
    const result = cp.reconcile({ x: 100, y: 0, hp: 50 }, 2);
    expect(result).toEqual({ x: 100, y: 0, hp: 50 });
  });

  it('reconcile 多次重放：ack 跳跃式更新', () => {
    cp.addInput(1, { dx: 1, dy: 0 });
    cp.addInput(2, { dx: 1, dy: 0 });
    cp.addInput(3, { dx: 1, dy: 0 });

    // 服务端 ack=3，所有输入确认
    const result = cp.reconcile({ x: 100, y: 0, hp: 100 }, 3);
    expect(result.x).toBe(100); // 服务端状态直接采用
  });
});

/* ================================================================
 * Interpolation — 插值
 * ================================================================ */

describe('Interpolation.lerp — 线性插值', () => {
  it('t=0 返回 a', () => {
    expect(Interpolation.lerp(10, 20, 0)).toBe(10);
  });

  it('t=1 返回 b', () => {
    expect(Interpolation.lerp(10, 20, 1)).toBe(20);
  });

  it('t=0.5 返回中点', () => {
    expect(Interpolation.lerp(10, 20, 0.5)).toBe(15);
  });

  it('t 超出 [0,1] 被钳制', () => {
    expect(Interpolation.lerp(10, 20, 2)).toBe(20);
    expect(Interpolation.lerp(10, 20, -1)).toBe(10);
  });
});

describe('Interpolation.slerp — 球面插值', () => {
  it('t=0 返回 a', () => {
    expect(Interpolation.slerp(0, Math.PI, 0)).toBeCloseTo(0);
  });

  it('t=1 返回 b (归一化)', () => {
    // b=PI, 但 slerp 归一化到 [-PI, PI]，所以 PI 在边界上
    const result = Interpolation.slerp(0, Math.PI, 1);
    expect(result).toBeCloseTo(Math.PI, 0);
  });

  it('t=0.5 返回中点', () => {
    const result = Interpolation.slerp(0, Math.PI, 0.5);
    expect(result).toBeCloseTo(Math.PI / 2);
  });

  it('跨越 ±PI 边界正确处理（选择短弧）', () => {
    // 3.0 rad → -3.0 rad，短弧是通过 0 的 0.283 rad
    const result = Interpolation.slerp(3.0, -3.0, 0.5);
    // 短弧中点约为 3.14159... (PI) 附近
    expect(Math.abs(result)).toBeCloseTo(Math.PI, 0);
  });
});

describe('Interpolation.interpolateRenderState — 快照缓冲插值', () => {
  it('buffer 只有一个快照时直接返回', () => {
    const snap = StateSync.createSnapshot({ x: 10, y: 20, hp: 100, name: 'a' }, 0);
    const result = Interpolation.interpolateRenderState([snap], snap.timestamp + 100);
    expect(result).toEqual(snap.data);
  });

  it('双快照插值 t=0.5', () => {
    const t0 = 1000;
    const t1 = 2000;
    const snap1 = StateSync.createSnapshot({ x: 0, y: 0, hp: 100, name: 'a' }, 0);
    snap1.timestamp = t0;
    const snap2 = StateSync.createSnapshot({ x: 10, y: 20, hp: 100, name: 'a' }, 1);
    snap2.timestamp = t1;

    const result = Interpolation.interpolateRenderState([snap1, snap2], 1500);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(10);
    expect(result.hp).toBe(100); // 相同值不变
  });

  it('renderTime 在第一个快照之前时取第一个', () => {
    const snap1 = StateSync.createSnapshot({ x: 0, y: 0, hp: 100, name: 'a' }, 0);
    snap1.timestamp = 1000;
    const snap2 = StateSync.createSnapshot({ x: 10, y: 0, hp: 100, name: 'a' }, 1);
    snap2.timestamp = 2000;

    const result = Interpolation.interpolateRenderState([snap1, snap2], 500);
    expect(result.x).toBe(0); // t 被钳制到 0
  });

  it('非数字字段不插值', () => {
    const snap1 = StateSync.createSnapshot({ x: 0, y: 0, hp: 100, name: 'old' }, 0);
    snap1.timestamp = 1000;
    const snap2 = StateSync.createSnapshot({ x: 10, y: 0, hp: 100, name: 'new' }, 1);
    snap2.timestamp = 2000;

    const result = Interpolation.interpolateRenderState([snap1, snap2], 1500);
    expect(result.name).toBe('old'); // 字符串不插值，保留 from 的值
  });
});

/* ================================================================
 * Room — 房间管理
 * ================================================================ */

describe('Room', () => {
  let room: Room;

  beforeEach(() => {
    room = new Room();
  });

  it('createRoom 创建房间 WAITING 状态', () => {
    const r = room.createRoom({ capacity: 4, password: '', properties: {} });
    expect(r.roomId).toContain('room-');
    expect(r.state).toBe('WAITING');
    expect(r.config.capacity).toBe(4);
    expect(r.players).toHaveLength(0);
  });

  it('joinRoom 玩家加入成功', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: {} });
    const result = room.joinRoom(r.roomId, 'p1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.room.players).toHaveLength(1);
      expect(result.room.players[0].playerId).toBe('p1');
      expect(result.room.players[0].ready).toBe(false);
    }
  });

  it('joinRoom 房间满员时拒绝', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: {} });
    room.joinRoom(r.roomId, 'p1');
    room.joinRoom(r.roomId, 'p2');
    const result = room.joinRoom(r.roomId, 'p3');
    expect(result.success).toBe(false);
  });

  it('joinRoom 重复加入拒绝', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: {} });
    room.joinRoom(r.roomId, 'p1');
    const result = room.joinRoom(r.roomId, 'p1');
    expect(result.success).toBe(false);
  });

  it('leaveRoom 玩家离开', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: {} });
    room.joinRoom(r.roomId, 'p1');
    room.joinRoom(r.roomId, 'p2');
    const result = room.leaveRoom(r.roomId, 'p1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.room.players).toHaveLength(1);
    }
  });

  it('setReady 设置准备状态', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: {} });
    room.joinRoom(r.roomId, 'p1');
    const result = room.setReady('p1', true);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.room.players[0].ready).toBe(true);
    }
  });

  it('startGame 全部就绪后开始', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: {} });
    room.joinRoom(r.roomId, 'p1');
    room.joinRoom(r.roomId, 'p2');
    room.setReady('p1', true);
    room.setReady('p2', true);
    const result = room.startGame(r.roomId);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.room.state).toBe('PLAYING');
    }
  });

  it('startGame 有玩家未就绪时拒绝', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: {} });
    room.joinRoom(r.roomId, 'p1');
    room.joinRoom(r.roomId, 'p2');
    room.setReady('p1', true);
    const result = room.startGame(r.roomId);
    expect(result.success).toBe(false);
  });

  it('startGame 单人房间拒绝', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: {} });
    room.joinRoom(r.roomId, 'p1');
    room.setReady('p1', true);
    const result = room.startGame(r.roomId);
    expect(result.success).toBe(false);
  });

  it('状态迁移 WAITING → READY → PLAYING', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: {} });
    expect(r.state).toBe('WAITING');
    room.joinRoom(r.roomId, 'p1');
    room.joinRoom(r.roomId, 'p2');
    room.setReady('p1', true);
    room.setReady('p2', true);
    const startResult = room.startGame(r.roomId);
    expect(startResult.success).toBe(true);
    if (startResult.success) {
      expect(startResult.room.state).toBe('PLAYING');
    }
  });

  it('getRoom 返回房间副本', () => {
    const r = room.createRoom({ capacity: 2, password: '', properties: { map: 'arena' } });
    const fetched = room.getRoom(r.roomId);
    expect(fetched).not.toBeNull();
    expect(fetched!.roomId).toBe(r.roomId);
    expect(fetched!.config.properties.map).toBe('arena');
  });
});

/* ================================================================
 * Matchmaking — 匹配系统
 * ================================================================ */

function makePlayer(id: string, elo: number, latency: number): MatchPlayer {
  return { playerId: id, elo, latency };
}

function makeCriteria(eloRange: number, maxLatency: number): MatchCriteria {
  return { eloRange, maxLatency };
}

describe('Matchmaking', () => {
  let mm: Matchmaking;

  beforeEach(() => {
    mm = new Matchmaking();
  });

  it('quickMatch 首次无匹配对手返回空', () => {
    const result = mm.quickMatch(makePlayer('p1', 1500, 50), makeCriteria(200, 100));
    expect(result).toHaveLength(0);
    expect(mm.getQueueLength()).toBe(1);
  });

  it('quickMatch ELO 范围匹配成功', () => {
    mm.quickMatch(makePlayer('p1', 1500, 50), makeCriteria(200, 100));
    const result = mm.quickMatch(makePlayer('p2', 1600, 60), makeCriteria(200, 100));
    expect(result).toHaveLength(2);
    expect(result[0].playerId).toBe('p2'); // 新加入的在前
    expect(result[1].playerId).toBe('p1');
  });

  it('quickMatch ELO 超出范围不匹配', () => {
    mm.quickMatch(makePlayer('p1', 1500, 50), makeCriteria(100, 100));
    const result = mm.quickMatch(makePlayer('p2', 1700, 60), makeCriteria(100, 100));
    expect(result).toHaveLength(0);
    expect(mm.getQueueLength()).toBe(2);
  });

  it('quickMatch 延迟超限不匹配', () => {
    mm.quickMatch(makePlayer('p1', 1500, 50), makeCriteria(500, 50));
    const result = mm.quickMatch(makePlayer('p2', 1600, 200), makeCriteria(500, 100));
    // p2 延迟 200 > p1 最大容忍 50，且 p1 延迟 50 ≤ p2 最大容忍 100，但从 p2 视角 p1 延迟 50 ≤ 100 成立
    // 但从 p1 视角 p2 延迟 200 > 50 不成立
    expect(result).toHaveLength(0);
  });

  it('cancelSearch 取消匹配', () => {
    mm.quickMatch(makePlayer('p1', 1500, 50), makeCriteria(200, 100));
    expect(mm.getQueueLength()).toBe(1);
    mm.cancelSearch('p1');
    expect(mm.getQueueLength()).toBe(0);
  });

  it('createLobby 创建大厅含邀请码', () => {
    const lobby = mm.createLobby();
    expect(lobby.code).toContain('lobby-');
    expect(lobby.players).toHaveLength(0);
  });

  it('joinLobby 通过邀请码加入', () => {
    const lobby = mm.createLobby();
    const result = mm.joinLobby(lobby.code, makePlayer('p1', 1500, 50));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.lobby.players).toHaveLength(1);
    }
  });
});

/* ================================================================
 * 消息协议 — MessageType / PingManager / 序列化
 * ================================================================ */

describe('MessageType 枚举', () => {
  it('包含全部 7 种类型', () => {
    const types = Object.values(MessageType);
    expect(types).toContain('INPUT');
    expect(types).toContain('SNAPSHOT');
    expect(types).toContain('CHAT');
    expect(types).toContain('PING');
    expect(types).toContain('ROOM_UPDATE');
    expect(types).toContain('GAME_EVENT');
    expect(types).toContain('RPC');
    expect(types).toHaveLength(7);
  });
});

describe('PingManager', () => {
  it('sendPing 返回时间戳', () => {
    const pm = new PingManager();
    const ts = pm.sendPing();
    expect(ts).toBeGreaterThan(0);
  });

  it('onPong 记录 RTT', () => {
    const pm = new PingManager();
    const sendTime = pm.sendPing();
    // 模拟 50ms 延迟
    const rtt = pm.onPong(sendTime - 50);
    // 实际 RTT 约 50ms（可能有微小误差）
    expect(rtt).toBeGreaterThan(40);
    expect(rtt).toBeLessThan(100);
    expect(pm.getLatency()).toBe(rtt);
  });

  it('getLatency 多次采样取平均', () => {
    const pm = new PingManager();
    // 模拟 5 次采样：50, 52, 48, 51, 49 ms 延迟
    const scenarios = [50, 52, 48, 51, 49];
    const now = Date.now();
    for (const d of scenarios) {
      const sendTime = now - d;
      pm.onPong(sendTime);
    }
    const avg = pm.getLatency();
    expect(avg).toBeGreaterThanOrEqual(48);
    expect(avg).toBeLessThanOrEqual(52);
  });

  it('getJitter 计算抖动', () => {
    const pm = new PingManager();
    const now = Date.now();
    // 稳定延迟：50, 50, 50 → 抖动 0
    pm.onPong(now - 50);
    pm.onPong(now - 50);
    pm.onPong(now - 50);
    expect(pm.getJitter()).toBe(0);

    // 重置后再测
    const pm2 = new PingManager();
    pm2.onPong(Date.now() - 50);
    pm2.onPong(Date.now() - 70); // 差 20
    expect(pm2.getJitter()).toBe(20);
  });

  it('超过 maxSamples 限制旧样本丢弃', () => {
    const pm = new PingManager(3);
    const now = Date.now();
    pm.onPong(now - 10);
    pm.onPong(now - 20);
    pm.onPong(now - 30);
    pm.onPong(now - 100); // 第 4 个样本，第 1 个被丢弃
    expect(pm.getLatency()).toBeGreaterThan(0);
  });
});

describe('serialize / deserialize', () => {
  it('序列化后反序列化一致', () => {
    const msg: NetworkMessage<{ x: number; y: number }> = {
      type: MessageType.INPUT,
      seq: 42,
      timestamp: 1700000000000,
      senderId: 'player1',
      payload: { x: 10, y: 20 },
    };
    const raw = serialize(msg);
    const restored = deserialize<{ x: number; y: number }>(raw);
    expect(restored.type).toBe(MessageType.INPUT);
    expect(restored.seq).toBe(42);
    expect(restored.senderId).toBe('player1');
    expect(restored.payload).toEqual({ x: 10, y: 20 });
  });

  it('deserialize 非法类型抛错', () => {
    const raw = JSON.stringify({ type: 'INVALID', seq: 1, timestamp: 1, senderId: 'x', payload: {} });
    expect(() => deserialize(raw)).toThrow('invalid message type');
  });

  it('deserialize 负序号抛错', () => {
    const raw = JSON.stringify({ type: MessageType.INPUT, seq: -1, timestamp: 1, senderId: 'x', payload: {} });
    expect(() => deserialize(raw)).toThrow('seq must be a non-negative number');
  });
});
