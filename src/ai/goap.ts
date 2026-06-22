/**
 * GOAPPlanner — 目标导向行动规划器
 *
 * 基于 A* 搜索最优动作序列，实现 Goal-Oriented Action Planning。
 *
 * 支持：
 *  - 世界状态动态变化时的重规划
 *  - 动作代价/优先级权衡
 *  - 目标优先级排序
 */

/* ================================================================
 * 类型定义
 * ================================================================ */

/** 世界状态：键值对映射 */
export type WorldState = Record<string, unknown>;

/** GOAP 动作 */
export interface GOAPAction {
  name: string;
  /** 动作代价（越小越优先） */
  cost: number;
  /** 前置条件：世界状态必须满足 */
  preconditions: WorldState;
  /** 执行效果：执行后会修改世界状态 */
  effects: WorldState;
}

/** GOAP 目标 */
export interface GOAPGoal {
  name: string;
  /** 优先级（越大越优先） */
  priority: number;
  /** 目标条件：世界状态满足时视为达成 */
  conditions: WorldState;
}

/* ================================================================
 * A* 节点
 * ================================================================ */

interface PlanNode {
  state: WorldState;
  action: GOAPAction | null; // null 表示起始节点
  parent: PlanNode | null;
  gCost: number; // 实际代价
  hCost: number; // 启发式代价
  get fCost(): number; // toString 兼容，实际使用时直接计算 g+h
}

/* ================================================================
 * GOAPPlanner 类
 * ================================================================ */

export class GOAPPlanner {
  private currentPlan: GOAPAction[] | null = null;
  private lastWorldState: WorldState | null = null;
  private replanThreshold = 0; // 世界状态变化计数阈值

  /**
   * 执行规划 — 对所有目标按优先级排序，为最高优先级的可达目标规划路径
   * @param currentState 当前世界状态
   * @param goals 目标列表
   * @param actions 可用动作列表
   * @returns 最优动作序列（空数组表示无解）
   */
  plan(currentState: WorldState, goals: GOAPGoal[], actions: GOAPAction[]): GOAPAction[] {
    // 按优先级降序排列目标
    const sortedGoals = [...goals].sort((a, b) => b.priority - a.priority);

    let bestPlan: GOAPAction[] = [];
    let bestCost = Infinity;

    for (const goal of sortedGoals) {
      // 检查目标是否已达成
      if (this.stateSatisfies(currentState, goal.conditions)) {
        this.currentPlan = [];
        this.lastWorldState = { ...currentState };
        return [];
      }

      const plan = this.buildPlan(currentState, goal, actions);
      if (plan !== null) {
        const cost = this.calculatePlanCost(plan);
        if (cost < bestCost) {
          bestCost = cost;
          bestPlan = plan;
        }
        // 高优先级目标已找到解，不再继续低优先级
        // （若需要多目标规划，可在此扩展）
        break;
      }
    }

    this.currentPlan = bestPlan;
    this.lastWorldState = { ...currentState };
    return bestPlan;
  }

  /**
   * 获取当前规划的动作序列
   */
  getPlan(): GOAPAction[] {
    return this.currentPlan ? [...this.currentPlan] : [];
  }

  /**
   * 检查是否需要重规划 — 世界状态发生变化时返回 true
   */
  needsReplan(currentState: WorldState, tolerance: number = 0): boolean {
    if (!this.lastWorldState) return true;

    const diffCount = this.countStateDiff(this.lastWorldState, currentState);
    return diffCount > tolerance;
  }

  /**
   * 动态重规划
   */
  replan(currentState: WorldState, goals: GOAPGoal[], actions: GOAPAction[]): GOAPAction[] {
    return this.plan(currentState, goals, actions);
  }

  /* ---- A* 搜索 ---- */

  private buildPlan(
    initialState: WorldState,
    goal: GOAPGoal,
    actions: GOAPAction[],
  ): GOAPAction[] | null {
    // 起始节点
    const startNode: PlanNode = {
      state: { ...initialState },
      action: null,
      parent: null,
      gCost: 0,
      hCost: this.heuristic(initialState, goal.conditions),
      get fCost() { return this.gCost + this.hCost; },
    };

    const openList: PlanNode[] = [startNode];
    const closedSet = new Set<string>();

    let iterations = 0;
    const MAX_ITERATIONS = 1000;

    while (openList.length > 0 && iterations++ < MAX_ITERATIONS) {
      // 取出 fCost 最小的节点
      openList.sort((a, b) => (a.gCost + a.hCost) - (b.gCost + b.hCost));
      const current = openList.shift()!;

      // 检查是否达成目标
      if (this.stateSatisfies(current.state, goal.conditions)) {
        return this.reconstructPlan(current);
      }

      const stateKey = this.stateToKey(current.state);
      if (closedSet.has(stateKey)) continue;
      closedSet.add(stateKey);

      // 扩展节点：尝试所有可用动作
      for (const action of actions) {
        if (!this.stateSatisfies(current.state, action.preconditions)) {
          continue; // 前置条件不满足
        }

        const newState = this.applyEffects(current.state, action.effects);
        const newNode: PlanNode = {
          state: newState,
          action,
          parent: current,
          gCost: current.gCost + action.cost,
          hCost: this.heuristic(newState, goal.conditions),
          get fCost() { return this.gCost + this.hCost; },
        };

        const newKey = this.stateToKey(newState);
        if (!closedSet.has(newKey)) {
          // 检查 openList 中是否有相同的状态且代价更低
          const existingIdx = openList.findIndex(
            (n) => this.stateToKey(n.state) === newKey,
          );
          if (existingIdx >= 0) {
            if (newNode.gCost < openList[existingIdx].gCost) {
              openList[existingIdx] = newNode;
            }
          } else {
            openList.push(newNode);
          }
        }
      }
    }

    return null; // 无解
  }

  /* ---- 辅助方法 ---- */

  /** 检查世界状态是否满足条件集合 */
  private stateSatisfies(state: WorldState, conditions: WorldState): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      if (!(key in state)) return false;
      if (JSON.stringify(state[key]) !== JSON.stringify(value)) return false;
    }
    return true;
  }

  /** 应用动作效果到世界状态 */
  private applyEffects(state: WorldState, effects: WorldState): WorldState {
    return { ...state, ...effects };
  }

  /** 启发式函数：计算当前状态与目标条件的差异数 */
  private heuristic(state: WorldState, goalConditions: WorldState): number {
    let diff = 0;
    for (const [key, value] of Object.entries(goalConditions)) {
      if (!(key in state)) {
        diff++;
      } else if (JSON.stringify(state[key]) !== JSON.stringify(value)) {
        diff++;
      }
    }
    return diff;
  }

  /** 从目标节点回溯构建动作序列 */
  private reconstructPlan(node: PlanNode): GOAPAction[] {
    const plan: GOAPAction[] = [];
    let current: PlanNode | null = node;
    while (current && current.action !== null) {
      plan.unshift(current.action);
      current = current.parent;
    }
    return plan;
  }

  /** 计算计划总代价 */
  private calculatePlanCost(plan: GOAPAction[]): number {
    return plan.reduce((sum, action) => sum + action.cost, 0);
  }

  /** 世界状态序列化为字符串键 */
  private stateToKey(state: WorldState): string {
    const sorted = Object.keys(state).sort();
    const pairs = sorted.map((k) => `${k}=${JSON.stringify(state[k])}`);
    return pairs.join('|');
  }

  /** 计算两个世界状态的差异数 */
  private countStateDiff(a: WorldState, b: WorldState): number {
    const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let diff = 0;
    for (const key of allKeys) {
      const va = a[key];
      const vb = b[key];
      if (JSON.stringify(va) !== JSON.stringify(vb)) diff++;
    }
    return diff;
  }
}
