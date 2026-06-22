/**
 * AI 行为系统 — 统一导出
 *
 * 包含：
 *  - Behavior Tree（行为树）
 *  - State Machine（有限状态机）
 *  - GOAP Planner（目标导向规划器）
 */

export {
  BTStatus,
  BTNode,
  Sequence,
  Selector,
  Parallel,
  Inverter,
  Repeater,
  UntilFail,
  Cooldown,
  Condition,
  Action,
  RandomSelector,
  Blackboard,
  createBehaviorTree,
} from './behavior-tree';

export type {
  ParallelPolicy,
  ConditionFn,
  ActionFn,
} from './behavior-tree';

export {
  StateMachine,
} from './state-machine';

export type {
  State,
  Transition,
} from './state-machine';

export {
  GOAPPlanner,
} from './goap';

export type {
  WorldState,
  GOAPAction,
  GOAPGoal,
} from './goap';
