/**
 * Behavior Tree — 行为树核心实现
 *
 * 节点类型：
 *  - BTNode 基类
 *  - Sequence / Selector / Parallel / Decorator / Condition / Action / RandomSelector
 *
 * 支持 Blackboard 共享数据上下文。
 */

/* ================================================================
 * 状态枚举
 * ================================================================ */

export enum BTStatus {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  RUNNING = 'RUNNING',
}

/* ================================================================
 * Blackboard — 共享数据上下文
 * ================================================================ */

export class Blackboard {
  private data = new Map<string, unknown>();

  set(key: string, val: unknown): void {
    this.data.set(key, val);
  }

  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  /** 获取所有键 */
  keys(): string[] {
    return [...this.data.keys()];
  }

  /** 清空黑板 */
  clear(): void {
    this.data.clear();
  }
}

/* ================================================================
 * BTNode — 抽象基类
 * ================================================================ */

export abstract class BTNode {
  abstract tick(context: Blackboard): BTStatus;
}

/* ================================================================
 * Sequence — 顺序执行，任一失败则失败
 * ================================================================ */

export class Sequence extends BTNode {
  private children: BTNode[];

  constructor(children: BTNode[]) {
    super();
    this.children = children;
  }

  tick(context: Blackboard): BTStatus {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status === BTStatus.FAILURE) return BTStatus.FAILURE;
      if (status === BTStatus.RUNNING) return BTStatus.RUNNING;
    }
    return BTStatus.SUCCESS;
  }
}

/* ================================================================
 * Selector — 选择执行，任一成功则成功
 * ================================================================ */

export class Selector extends BTNode {
  private children: BTNode[];

  constructor(children: BTNode[]) {
    super();
    this.children = children;
  }

  tick(context: Blackboard): BTStatus {
    for (const child of this.children) {
      const status = child.tick(context);
      if (status === BTStatus.SUCCESS) return BTStatus.SUCCESS;
      if (status === BTStatus.RUNNING) return BTStatus.RUNNING;
    }
    return BTStatus.FAILURE;
  }
}

/* ================================================================
 * Parallel — 并行执行
 * ================================================================ */

export type ParallelPolicy = 'all_succeed' | 'any_succeed' | 'n_succeed';

export class Parallel extends BTNode {
  private children: BTNode[];
  private policy: ParallelPolicy;
  private requiredSuccesses: number;

  constructor(
    children: BTNode[],
    policy: ParallelPolicy = 'all_succeed',
    requiredSuccesses?: number,
  ) {
    super();
    this.children = children;
    this.policy = policy;
    this.requiredSuccesses = requiredSuccesses ?? children.length;
  }

  tick(context: Blackboard): BTStatus {
    let successCount = 0;
    let failureCount = 0;

    for (const child of this.children) {
      const status = child.tick(context);
      if (status === BTStatus.SUCCESS) successCount++;
      if (status === BTStatus.FAILURE) failureCount++;
    }

    switch (this.policy) {
      case 'all_succeed':
        if (failureCount > 0) return BTStatus.FAILURE;
        if (successCount === this.children.length) return BTStatus.SUCCESS;
        return BTStatus.RUNNING;
      case 'any_succeed':
        if (successCount > 0) return BTStatus.SUCCESS;
        if (failureCount === this.children.length) return BTStatus.FAILURE;
        return BTStatus.RUNNING;
      case 'n_succeed':
        if (successCount >= this.requiredSuccesses) return BTStatus.SUCCESS;
        if (failureCount > this.children.length - this.requiredSuccesses) {
          return BTStatus.FAILURE;
        }
        return BTStatus.RUNNING;
    }
  }
}

/* ================================================================
 * Decorator — 修饰节点
 * ================================================================ */

/** 取反装饰器 */
export class Inverter extends BTNode {
  private child: BTNode;

  constructor(child: BTNode) {
    super();
    this.child = child;
  }

  tick(context: Blackboard): BTStatus {
    const status = this.child.tick(context);
    if (status === BTStatus.SUCCESS) return BTStatus.FAILURE;
    if (status === BTStatus.FAILURE) return BTStatus.SUCCESS;
    return BTStatus.RUNNING;
  }
}

/** 重复 N 次装饰器 */
export class Repeater extends BTNode {
  private child: BTNode;
  private maxRepeats: number;
  private currentCount = 0;

  constructor(child: BTNode, maxRepeats: number) {
    super();
    this.child = child;
    this.maxRepeats = maxRepeats;
  }

  tick(context: Blackboard): BTStatus {
    if (this.currentCount >= this.maxRepeats) {
      return BTStatus.SUCCESS;
    }

    const status = this.child.tick(context);

    if (status === BTStatus.FAILURE) {
      this.currentCount = 0;
      return BTStatus.FAILURE;
    }

    if (status === BTStatus.SUCCESS) {
      this.currentCount++;
      if (this.currentCount >= this.maxRepeats) {
        this.currentCount = 0;
        return BTStatus.SUCCESS;
      }
      return BTStatus.RUNNING;
    }

    return BTStatus.RUNNING;
  }
}

/** 重复至失败装饰器 */
export class UntilFail extends BTNode {
  private child: BTNode;

  constructor(child: BTNode) {
    super();
    this.child = child;
  }

  tick(context: Blackboard): BTStatus {
    const status = this.child.tick(context);
    if (status === BTStatus.FAILURE) return BTStatus.SUCCESS;
    if (status === BTStatus.RUNNING) return BTStatus.RUNNING;
    return BTStatus.RUNNING; // SUCCESS → continue
  }
}

/** 冷却装饰器 */
export class Cooldown extends BTNode {
  private child: BTNode;
  private cooldownMs: number;
  private lastTickTime = 0;
  private key: string;

  constructor(child: BTNode, cooldownMs: number, key?: string) {
    super();
    this.child = child;
    this.cooldownMs = cooldownMs;
    this.key = key ?? `cooldown_${Math.random().toString(36).slice(2)}`;
  }

  tick(context: Blackboard): BTStatus {
    const now = Date.now();
    const lastTime = context.get<number>(this.key) ?? 0;

    if (now - lastTime < this.cooldownMs) {
      return BTStatus.FAILURE;
    }

    const status = this.child.tick(context);
    if (status !== BTStatus.RUNNING) {
      context.set(this.key, now);
    }
    return status;
  }
}

/* ================================================================
 * Condition — 条件判断节点
 * ================================================================ */

export type ConditionFn = (context: Blackboard) => boolean;

export class Condition extends BTNode {
  private conditionFn: ConditionFn;

  constructor(fn: ConditionFn) {
    super();
    this.conditionFn = fn;
  }

  tick(context: Blackboard): BTStatus {
    return this.conditionFn(context) ? BTStatus.SUCCESS : BTStatus.FAILURE;
  }
}

/* ================================================================
 * Action — 动作执行节点
 * ================================================================ */

export type ActionFn = (context: Blackboard) => BTStatus;

export class Action extends BTNode {
  private actionFn: ActionFn;

  constructor(fn: ActionFn) {
    super();
    this.actionFn = fn;
  }

  tick(context: Blackboard): BTStatus {
    return this.actionFn(context);
  }
}

/* ================================================================
 * RandomSelector — 随机选择子节点
 * ================================================================ */

export class RandomSelector extends BTNode {
  private children: BTNode[];

  constructor(children: BTNode[]) {
    super();
    this.children = children;
  }

  tick(context: Blackboard): BTStatus {
    if (this.children.length === 0) return BTStatus.FAILURE;

    // Fisher-Yates 打乱
    const indices = this.children.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    for (const idx of indices) {
      const status = this.children[idx].tick(context);
      if (status === BTStatus.SUCCESS) return BTStatus.SUCCESS;
      if (status === BTStatus.RUNNING) return BTStatus.RUNNING;
    }

    return BTStatus.FAILURE;
  }
}

/* ================================================================
 * BehaviorTreeBuilder — 链式 API 构建器
 * ================================================================ */

class BehaviorTreeBuilder {
  private root: BTNode | null = null;
  private nodeStack: { type: 'sequence' | 'selector' | 'parallel'; children: BTNode[]; policy?: ParallelPolicy; required?: number }[] = [];

  /** 开始构建 Sequence */
  sequence(): this {
    this.nodeStack.push({ type: 'sequence', children: [] });
    return this;
  }

  /** 开始构建 Selector */
  selector(): this {
    this.nodeStack.push({ type: 'selector', children: [] });
    return this;
  }

  /** 开始构建 Parallel */
  parallel(policy: ParallelPolicy = 'all_succeed', requiredSuccesses?: number): this {
    this.nodeStack.push({ type: 'parallel', children: [], policy, required: requiredSuccesses });
    return this;
  }

  /** 添加条件节点 */
  condition(fn: ConditionFn): this {
    this.addChild(new Condition(fn));
    return this;
  }

  /** 添加动作节点 */
  action(fn: ActionFn): this {
    this.addChild(new Action(fn));
    return this;
  }

  /** 添加取反装饰器 */
  inverter(child: BTNode): this {
    this.addChild(new Inverter(child));
    return this;
  }

  /** 添加重复装饰器 */
  repeater(child: BTNode, maxRepeats: number): this {
    this.addChild(new Repeater(child, maxRepeats));
    return this;
  }

  /** 添加重复至失败 */
  untilFail(child: BTNode): this {
    this.addChild(new UntilFail(child));
    return this;
  }

  /** 添加冷却装饰器 */
  cooldown(child: BTNode, ms: number, key?: string): this {
    this.addChild(new Cooldown(child, ms, key));
    return this;
  }

  /** 添加随机选择器 */
  randomSelector(children: BTNode[]): this {
    this.addChild(new RandomSelector(children));
    return this;
  }

  /** 结束当前复合节点 */
  end(): this {
    if (this.nodeStack.length === 0) return this;

    const frame = this.nodeStack.pop()!;
    let node: BTNode;

    switch (frame.type) {
      case 'sequence':
        node = new Sequence(frame.children);
        break;
      case 'selector':
        node = new Selector(frame.children);
        break;
      case 'parallel':
        node = new Parallel(frame.children, frame.policy!, frame.required);
        break;
    }

    if (this.nodeStack.length === 0) {
      this.root = node;
    } else {
      this.nodeStack[this.nodeStack.length - 1].children.push(node);
    }

    return this;
  }

  /** 构建并返回根节点 */
  build(): BTNode {
    // 自动关闭未闭合的复合节点
    while (this.nodeStack.length > 0) {
      this.end();
    }
    if (!this.root) {
      throw new Error('BehaviorTreeBuilder: 未定义任何节点');
    }
    return this.root;
  }

  private addChild(node: BTNode): void {
    if (this.nodeStack.length > 0) {
      this.nodeStack[this.nodeStack.length - 1].children.push(node);
    } else if (!this.root) {
      this.root = node;
    } else {
      throw new Error('BehaviorTreeBuilder: 根节点已存在，请将多个节点包裹在 Sequence/Selector/Parallel 中');
    }
  }
}

export function createBehaviorTree(): BehaviorTreeBuilder {
  return new BehaviorTreeBuilder();
}
