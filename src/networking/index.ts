/**
 * 网络同步核心库 — 引擎无关的状态同步、客户端预测、插值
 */

export { StateSync } from './sync';
export { ClientPrediction } from './sync';
export { Interpolation } from './sync';
export { Room, Matchmaking } from './matchmaking';
export {
  MessageType,
  type NetworkMessage,
  PingManager,
  serialize,
  deserialize,
} from './protocol';
