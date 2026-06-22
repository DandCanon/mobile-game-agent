/**
 * 消息协议 — 类型枚举 / 泛型消息 / Ping 管理 / 序列化
 */

/* ================================================================
 * 消息类型枚举
 * ================================================================ */

export enum MessageType {
  /** 玩家输入 */
  INPUT = 'INPUT',
  /** 状态快照 */
  SNAPSHOT = 'SNAPSHOT',
  /** 聊天消息 */
  CHAT = 'CHAT',
  /** 心跳 Ping */
  PING = 'PING',
  /** 房间状态更新 */
  ROOM_UPDATE = 'ROOM_UPDATE',
  /** 游戏事件（得分、击杀等） */
  GAME_EVENT = 'GAME_EVENT',
  /** 远程过程调用 */
  RPC = 'RPC',
}

/* ================================================================
 * 泛型网络消息
 * ================================================================ */

export interface NetworkMessage<T = unknown> {
  /** 消息类型 */
  type: MessageType;
  /** 单调递增消息序号 */
  seq: number;
  /** 发送时间戳 (ms) */
  timestamp: number;
  /** 发送者 ID */
  senderId: string;
  /** 消息负载 */
  payload: T;
}

/* ================================================================
 * PingManager — 心跳与延迟/抖动管理
 * ================================================================ */

export class PingManager {
  private lastPingSendTime = 0;
  private latencySamples: number[] = [];
  private maxSamples: number;

  constructor(maxSamples = 10) {
    this.maxSamples = maxSamples;
  }

  /**
   * 发送 Ping 时调用，记录发送时间。
   * @returns 当前时间戳
   */
  sendPing(): number {
    this.lastPingSendTime = Date.now();
    return this.lastPingSendTime;
  }

  /**
   * 收到 Pong 时调用，计算并记录 RTT。
   * @param serverTime 服务端回传的时间戳（与 sendPing 的返回值对比）
   * @returns 本次 RTT (ms)
   */
  onPong(serverTime: number): number {
    const rtt = Date.now() - serverTime;
    this.latencySamples.push(rtt);
    // 保持最大样本数
    if (this.latencySamples.length > this.maxSamples) {
      this.latencySamples = this.latencySamples.slice(-this.maxSamples);
    }
    return rtt;
  }

  /**
   * 获取平均延迟 (ms)
   */
  getLatency(): number {
    if (this.latencySamples.length === 0) return 0;
    const sum = this.latencySamples.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencySamples.length);
  }

  /**
   * 获取抖动 — 相邻样本差的绝对值的平均值 (ms)
   */
  getJitter(): number {
    if (this.latencySamples.length < 2) return 0;
    let totalDiff = 0;
    for (let i = 1; i < this.latencySamples.length; i++) {
      totalDiff += Math.abs(this.latencySamples[i] - this.latencySamples[i - 1]);
    }
    return Math.round((totalDiff / (this.latencySamples.length - 1)) * 100) / 100;
  }

  /**
   * 获取所有延迟样本（测试用）
   */
  getSamples(): readonly number[] {
    return this.latencySamples;
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.latencySamples = [];
    this.lastPingSendTime = 0;
  }
}

/* ================================================================
 * 序列化方案 (JSON based)
 * ================================================================ */

/**
 * 序列化消息为 JSON 字符串
 */
export function serialize<T>(msg: NetworkMessage<T>): string {
  return JSON.stringify(msg);
}

/**
 * 反序列化 JSON 字符串为消息
 */
export function deserialize<T = unknown>(raw: string): NetworkMessage<T> {
  const parsed = JSON.parse(raw) as NetworkMessage<T>;
  _validateMessage(parsed);
  return parsed;
}

/* ================================================================
 * 内部校验
 * ================================================================ */

function _validateMessage<T>(msg: NetworkMessage<T>): void {
  if (!msg.type || !Object.values(MessageType).includes(msg.type)) {
    throw new Error(`deserialize: invalid message type "${msg.type}"`);
  }
  if (typeof msg.seq !== 'number' || msg.seq < 0) {
    throw new Error('deserialize: seq must be a non-negative number');
  }
  if (typeof msg.timestamp !== 'number') {
    throw new Error('deserialize: timestamp must be a number');
  }
  if (typeof msg.senderId !== 'string' || msg.senderId.length === 0) {
    throw new Error('deserialize: senderId must be a non-empty string');
  }
}
