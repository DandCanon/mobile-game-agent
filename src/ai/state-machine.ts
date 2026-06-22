/**
 * StateMachine — 有限状态机 (FSM)
 *
 * 支持：
 *  - 状态定义 (enter / update / exit)
 *  - 状态转换 (Transition)
 *  - AnyState 全局过渡
 */

/* ================================================================
 * 接口定义
 * ================================================================ */

/** 状态接口 */
export interface State<S extends string> {
  /** 进入状态时调用一次 */
  enter?(previousState: S | null): void;
  /** 每帧 / 每次 update 调用 */
  update?(dt: number): void;
  /** 离开状态时调用一次 */
  exit?(nextState: S): void;
}

/** 状态转换定义 */
export interface Transition<S extends string> {
  from: S | '__any__';
  to: S;
  /** 条件函数，返回 true 时触发转换 */
  condition: () => boolean;
}

/* ================================================================
 * StateMachine 类
 * ================================================================ */

export class StateMachine<S extends string> {
  private states = new Map<S, State<S>>();
  private transitions: Transition<S>[] = [];
  private currentState: S | null = null;
  private stateInstances = new Map<S, State<S>>();

  /** 添加状态 */
  addState(stateId: S, state: State<S>): void {
    this.states.set(stateId, state);
  }

  /** 添加状态转换 */
  addTransition(transition: Transition<S>): void {
    this.transitions.push(transition);
  }

  /** 启动状态机 */
  start(initialState: S): void {
    const state = this.states.get(initialState);
    if (!state) {
      throw new Error(`StateMachine: 状态 "${initialState}" 未注册`);
    }
    this.currentState = initialState;
    this.stateInstances.set(initialState, state);
    state.enter?.(null);
  }

  /** 更新状态机 */
  update(dt: number = 0): void {
    if (this.currentState === null) return;

    // 检查转换
    const triggeredTransition = this.findTriggeredTransition();

    if (triggeredTransition) {
      this.transitionTo(triggeredTransition.to);
    }

    // 更新当前状态
    if (this.currentState !== null) {
      const state = this.states.get(this.currentState);
      state?.update?.(dt);
    }
  }

  /** 获取当前状态 */
  getCurrentState(): S | null {
    return this.currentState;
  }

  /** 强制转换到指定状态（忽略条件） */
  forceTransition(targetState: S): void {
    if (!this.states.has(targetState)) {
      throw new Error(`StateMachine: 目标状态 "${targetState}" 未注册`);
    }
    this.transitionTo(targetState);
  }

  /** 检查是否处于某个状态 */
  isInState(state: S): boolean {
    return this.currentState === state;
  }

  /** 获取所有注册的状态 */
  getStates(): S[] {
    return [...this.states.keys()];
  }

  /** 获取所有转换 */
  getTransitions(): Transition<S>[] {
    return [...this.transitions];
  }

  /* ---- 内部方法 ---- */

  private transitionTo(targetState: S): void {
    if (this.currentState === targetState) return;

    const prevState = this.currentState;
    const prevInstance = prevState ? this.states.get(prevState) : undefined;
    const nextInstance = this.states.get(targetState);

    // 离开旧状态
    prevInstance?.exit?.(targetState);

    // 切换
    this.currentState = targetState;

    // 进入新状态
    nextInstance?.enter?.(prevState);
  }

  private findTriggeredTransition(): Transition<S> | null {
    for (const t of this.transitions) {
      if (t.from === '__any__' || t.from === this.currentState) {
        if (t.condition()) {
          return t;
        }
      }
    }
    return null;
  }
}
