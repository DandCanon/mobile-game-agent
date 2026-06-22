/**
 * 状态同步引擎 & 客户端预测 & 插值
 *
 * 引擎无关的实现，可运行于浏览器 / Node.js / 任何 JS 运行时。
 */

/* ================================================================
 * 状态快照 Snapshot<T>
 * ================================================================ */

/** 状态快照 */
export interface Snapshot<T> {
  /** 单调递增序号 */
  seq: number;
  /** 生成快照时的时间戳 (ms) */
  timestamp: number;
  /** 状态数据 */
  data: T;
  /** 简易校验和 (JSON 序列化后的字符串长度作为指纹) */
  checksum: number;
}

/* ================================================================
 * StateSync 命名空间
 * ================================================================ */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace StateSync {
  /**
   * 生成状态快照
   */
  export function createSnapshot<T>(state: T, seq: number): Snapshot<T> {
    const json = JSON.stringify(state);
    return {
      seq,
      timestamp: Date.now(),
      data: state,
      checksum: _checksum(json),
    };
  }

  /**
   * 应用快照 — 全量同步
   * 直接将快照数据覆盖到当前状态。
   */
  export function applySnapshot<T>(_current: T, snapshot: Snapshot<T>): T {
    // 深拷贝快照数据以防止外部修改影响
    return JSON.parse(JSON.stringify(snapshot.data)) as T;
  }

  /**
   * 增量压缩 — 返回两对象之间的差异字段。
   * 只返回 prev 和 current 之间值发生变化的字段。
   */
  export function deltaCompress<T extends Record<string, unknown>>(
    prev: T,
    current: T,
  ): Partial<T> {
    const delta: Partial<T> = {};
    const keys = new Set([...Object.keys(prev as object), ...Object.keys(current as object)]);
    for (const key of keys) {
      const k = key as keyof T;
      if (!_deepEqual(prev[k], current[k])) {
        delta[k] = current[k];
      }
    }
    return delta;
  }

  /**
   * 增量应用 — 将 delta 合并到 base，返回新对象。
   */
  export function deltaApply<T extends Record<string, unknown>>(
    base: T,
    delta: Partial<T>,
  ): T {
    const result = { ...base };
    for (const key of Object.keys(delta) as (keyof T)[]) {
      result[key] = delta[key] as T[keyof T];
    }
    return result;
  }

  /** 简单 checksum */
  function _checksum(json: string): number {
    let h = 0;
    for (let i = 0; i < json.length; i++) {
      h = (h * 31 + json.charCodeAt(i)) & 0x7fffffff;
    }
    return h;
  }
}

/* ================================================================
 * 客户端预测与回滚 ClientPrediction
 * ================================================================ */

interface InputEntry<I> {
  seq: number;
  input: I;
}

/**
 * 客户端预测引擎。
 *
 * 工作流程：
 * 1. 玩家产生输入 → addInput(seq, input)
 * 2. 每帧 predict(input) 在本地预测执行
 * 3. 服务端返回权威状态后 → reconcile(serverState, lastAckedSeq)
 *    回滚到 lastAckedSeq 的状态，重放其后所有未确认输入。
 */
export class ClientPrediction<S, I> {
  /** 输入历史（按 seq 排序） */
  private inputHistory: InputEntry<I>[] = [];
  /** 已确认的最新 seq */
  private lastAckedSeq = -1;

  /**
   * @param applyInput 将输入应用到状态的回调 (state, input) => newState
   */
  constructor(private applyInput: (state: S, input: I) => S) {}

  /**
   * 记录玩家输入。
   */
  addInput(seq: number, input: I): void {
    this.inputHistory.push({ seq, input });
  }

  /**
   * 本地预测执行。
   * 返回预测后的状态。注意：这不会改变内部存储的状态。
   */
  predict(localState: S, input: I): S {
    return this.applyInput(localState, input);
  }

  /**
   * 服务端权威状态到达后回滚重放。
   *
   * @param serverState 服务端确认的最新状态（对应 lastAckedSeq）
   * @param ackedSeq 服务端最新已确认的 seq
   * @returns 回滚重放之后的状态
   */
  reconcile(serverState: S, ackedSeq: number): S {
    if (ackedSeq > this.lastAckedSeq) {
      this.lastAckedSeq = ackedSeq;
    }

    // 清除已确认的输入
    this.inputHistory = this.inputHistory.filter((e) => e.seq > ackedSeq);

    // 从服务端状态重放所有未确认输入
    let state = serverState;
    for (const entry of this.inputHistory) {
      state = this.applyInput(state, entry.input);
    }
    return state;
  }

  /** 获取最新已确认 seq */
  getLastAckedSeq(): number {
    return this.lastAckedSeq;
  }
}

/* ================================================================
 * 插值 Interpolation
 * ================================================================ */

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Interpolation {
  /**
   * 线性插值
   */
  export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  /**
   * 球面线性插值 (四元数风格)，
   * 适用于角度/旋转的平滑过渡。
   */
  export function slerp(a: number, b: number, t: number): number {
    // 将角度标准化到 [-PI, PI]
    const normalize = (x: number) => ((x + Math.PI) % (2 * Math.PI)) - Math.PI;
    const aN = normalize(a);
    const bN = normalize(b);
    let diff = bN - aN;
    if (Math.abs(diff) >= Math.PI) {
      diff = diff > 0 ? diff - 2 * Math.PI : diff + 2 * Math.PI;
    }
    return aN + diff * Math.max(0, Math.min(1, t));
  }

  /**
   * 从快照缓冲中插值渲染状态。
   *
   * @param buffer     按 seq 升序排列的快照数组（至少 2 个）
   * @param renderTime 渲染时间戳 (ms)。
   *                   应在 buffer[0].timestamp 和 buffer[last].timestamp 之间。
   * @param lerpFn     插值函数，默认数字字段用 lerp。
   * @returns 插值后的状态，若 buffer 不足则返回最近的一个。
   */
  export function interpolateRenderState<T extends Record<string, unknown>>(
    buffer: Snapshot<T>[],
    renderTime: number,
    lerpFn: (a: number, b: number, t: number) => number = lerp,
  ): T {
    if (buffer.length === 0) {
      throw new Error('interpolateRenderState: buffer is empty');
    }
    if (buffer.length === 1) {
      return buffer[0].data;
    }

    // 寻找两个包围 renderTime 的快照
    let fromIdx = 0;
    for (let i = 1; i < buffer.length; i++) {
      if (buffer[i].timestamp >= renderTime) {
        fromIdx = i - 1;
        break;
      }
      fromIdx = i;
    }

    const toIdx = Math.min(fromIdx + 1, buffer.length - 1);

    if (fromIdx === toIdx) {
      return buffer[fromIdx].data;
    }

    const from = buffer[fromIdx];
    const to = buffer[toIdx];

    const duration = to.timestamp - from.timestamp;
    if (duration <= 0) {
      return from.data;
    }

    const t = Math.max(0, Math.min(1, (renderTime - from.timestamp) / duration));

    // 对每个字段做插值：数字字段用 lerpFn，其他字段直接使用 from 的值
    const result = {} as T;
    const keys = new Set([...Object.keys(from.data as object), ...Object.keys(to.data as object)]);
    for (const key of keys) {
      const k = key as keyof T;
      const fv = from.data[k];
      const tv = to.data[k];
      if (typeof fv === 'number' && typeof tv === 'number') {
        (result as Record<string, unknown>)[key as string] = lerpFn(fv, tv, t);
      } else {
        (result as Record<string, unknown>)[key as string] = fv;
      }
    }

    return result;
  }
}

/* ================================================================
 * 内部工具函数
 * ================================================================ */

function _deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (typeof a === 'object' && typeof b === 'object') {
    // JSON round-trip 比较（占位实现，实际项目可替换为更高效的比较）
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}
