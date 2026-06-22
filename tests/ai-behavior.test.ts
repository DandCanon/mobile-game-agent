/**
 * AI 行为系统单元测试
 *
 * 覆盖：
 *  - 行为树：Sequence / Selector / Parallel / Inverter / Repeater / UntilFail / Cooldown /
 *            Condition / Action / RandomSelector / Blackboard / BehaviorTreeBuilder
 *  - 有限状态机：State enter/update/exit / Transition / AnyState
 *  - GOAP 规划器：A* 最优路径 / 多目标优先级 / 动态重规划
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BTStatus,
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
} from '../src/ai/behavior-tree';
import { StateMachine } from '../src/ai/state-machine';
import type { State, Transition } from '../src/ai/state-machine';
import { GOAPPlanner } from '../src/ai/goap';
import type { WorldState, GOAPAction, GOAPGoal } from '../src/ai/goap';

// ============================================================================
// 行为树测试
// ============================================================================

describe('BehaviorTree', () => {
  let bb: Blackboard;

  beforeEach(() => {
    bb = new Blackboard();
  });

  // ---- BTNode 基类 ----

  describe('BTNode', () => {
    it('应定义 SUCCESS / FAILURE / RUNNING 三个状态', () => {
      expect(BTStatus.SUCCESS).toBe('SUCCESS');
      expect(BTStatus.FAILURE).toBe('FAILURE');
      expect(BTStatus.RUNNING).toBe('RUNNING');
    });

    it('Action 应可返回任意状态', () => {
      const successAction = new Action(() => BTStatus.SUCCESS);
      expect(successAction.tick(bb)).toBe(BTStatus.SUCCESS);

      const failAction = new Action(() => BTStatus.FAILURE);
      expect(failAction.tick(bb)).toBe(BTStatus.FAILURE);

      let count = 0;
      const runningAction = new Action(() => {
        count++;
        return count < 3 ? BTStatus.RUNNING : BTStatus.SUCCESS;
      });
      expect(runningAction.tick(bb)).toBe(BTStatus.RUNNING);
      expect(runningAction.tick(bb)).toBe(BTStatus.RUNNING);
      expect(runningAction.tick(bb)).toBe(BTStatus.SUCCESS);
    });
  });

  // ---- Sequence ----

  describe('Sequence', () => {
    it('应顺序执行所有子节点直到失败', () => {
      const calls: string[] = [];
      const seq = new Sequence([
        new Action(() => { calls.push('A'); return BTStatus.SUCCESS; }),
        new Action(() => { calls.push('B'); return BTStatus.SUCCESS; }),
        new Action(() => { calls.push('C'); return BTStatus.SUCCESS; }),
      ]);
      expect(seq.tick(bb)).toBe(BTStatus.SUCCESS);
      expect(calls).toEqual(['A', 'B', 'C']);
    });

    it('任一子节点失败应立即返回 FAILURE', () => {
      const calls: string[] = [];
      const seq = new Sequence([
        new Action(() => { calls.push('A'); return BTStatus.SUCCESS; }),
        new Action(() => { calls.push('B'); return BTStatus.FAILURE; }),
        new Action(() => { calls.push('C'); return BTStatus.SUCCESS; }),
      ]);
      expect(seq.tick(bb)).toBe(BTStatus.FAILURE);
      expect(calls).toEqual(['A', 'B']);
    });

    it('子节点 RUNNING 时应停止序列执行并返回 RUNNING', () => {
      const calls: string[] = [];
      const seq = new Sequence([
        new Action(() => { calls.push('A'); return BTStatus.SUCCESS; }),
        new Action(() => { calls.push('B'); return BTStatus.RUNNING; }),
        new Action(() => { calls.push('C'); return BTStatus.SUCCESS; }),
      ]);
      expect(seq.tick(bb)).toBe(BTStatus.RUNNING);
      expect(calls).toEqual(['A', 'B']);
    });

    it('空子节点列表应返回 SUCCESS', () => {
      const seq = new Sequence([]);
      expect(seq.tick(bb)).toBe(BTStatus.SUCCESS);
    });
  });

  // ---- Selector ----

  describe('Selector', () => {
    it('应选择第一个成功的子节点', () => {
      const calls: string[] = [];
      const sel = new Selector([
        new Action(() => { calls.push('A'); return BTStatus.FAILURE; }),
        new Action(() => { calls.push('B'); return BTStatus.SUCCESS; }),
        new Action(() => { calls.push('C'); return BTStatus.SUCCESS; }),
      ]);
      expect(sel.tick(bb)).toBe(BTStatus.SUCCESS);
      expect(calls).toEqual(['A', 'B']);
    });

    it('所有子节点失败应返回 FAILURE', () => {
      const sel = new Selector([
        new Action(() => BTStatus.FAILURE),
        new Action(() => BTStatus.FAILURE),
      ]);
      expect(sel.tick(bb)).toBe(BTStatus.FAILURE);
    });

    it('子节点 RUNNING 时应返回 RUNNING', () => {
      const sel = new Selector([
        new Action(() => BTStatus.FAILURE),
        new Action(() => BTStatus.RUNNING),
        new Action(() => BTStatus.SUCCESS),
      ]);
      expect(sel.tick(bb)).toBe(BTStatus.RUNNING);
    });
  });

  // ---- Parallel ----

  describe('Parallel', () => {
    it('policy=all_succeed：全部成功返回 SUCCESS', () => {
      const par = new Parallel([
        new Action(() => BTStatus.SUCCESS),
        new Action(() => BTStatus.SUCCESS),
        new Action(() => BTStatus.SUCCESS),
      ], 'all_succeed');
      expect(par.tick(bb)).toBe(BTStatus.SUCCESS);
    });

    it('policy=all_succeed：任一失败返回 FAILURE', () => {
      const par = new Parallel([
        new Action(() => BTStatus.SUCCESS),
        new Action(() => BTStatus.FAILURE),
        new Action(() => BTStatus.SUCCESS),
      ], 'all_succeed');
      expect(par.tick(bb)).toBe(BTStatus.FAILURE);
    });

    it('policy=any_succeed：任一成功返回 SUCCESS', () => {
      const par = new Parallel([
        new Action(() => BTStatus.FAILURE),
        new Action(() => BTStatus.FAILURE),
        new Action(() => BTStatus.SUCCESS),
      ], 'any_succeed');
      expect(par.tick(bb)).toBe(BTStatus.SUCCESS);
    });

    it('policy=n_succeed：达到 N 个成功时返回 SUCCESS', () => {
      const par = new Parallel([
        new Action(() => BTStatus.SUCCESS),
        new Action(() => BTStatus.SUCCESS),
        new Action(() => BTStatus.FAILURE),
        new Action(() => BTStatus.FAILURE),
      ], 'n_succeed', 2);
      expect(par.tick(bb)).toBe(BTStatus.SUCCESS);
    });

    it('policy=n_succeed：不够 N 个成功且有失败/运行中时返回 FAILURE', () => {
      const par = new Parallel([
        new Action(() => BTStatus.SUCCESS),
        new Action(() => BTStatus.FAILURE),
        new Action(() => BTStatus.FAILURE),
      ], 'n_succeed', 2);
      expect(par.tick(bb)).toBe(BTStatus.FAILURE);
    });
  });

  // ---- Decorator（修饰器） ----

  describe('Decorator', () => {
    it('Inverter：应取反 SUCCESS ↔ FAILURE', () => {
      const inv1 = new Inverter(new Action(() => BTStatus.SUCCESS));
      expect(inv1.tick(bb)).toBe(BTStatus.FAILURE);

      const inv2 = new Inverter(new Action(() => BTStatus.FAILURE));
      expect(inv2.tick(bb)).toBe(BTStatus.SUCCESS);
    });

    it('Inverter：RUNNING 保持不变', () => {
      const inv = new Inverter(new Action(() => BTStatus.RUNNING));
      expect(inv.tick(bb)).toBe(BTStatus.RUNNING);
    });

    it('Repeater：应重复执行 N 次（每次 tick 一步）', () => {
      let count = 0;
      const rep = new Repeater(
        new Action(() => { count++; return BTStatus.SUCCESS; }),
        3,
      );

      // 行为树标准实现：tick 驱动，Repeater 逐 tick 递增计数
      // 可能在不同实现中一次 tick 完成或分步 tick
      const result = rep.tick(bb);
      // 3 次 SUCCESS 后 Repeater 完成——接受 SUCCESS 或 RUNNING（取决实现）
      if (result === BTStatus.SUCCESS) {
        // 单 tick 全部完成
        expect(count).toBe(3);
      } else if (result === BTStatus.RUNNING) {
        // 分步 tick：继续直到完成
        expect(count).toBe(1);
        expect(rep.tick(bb)).toBe(BTStatus.RUNNING);
        expect(count).toBe(2);
        expect(rep.tick(bb)).toBe(BTStatus.SUCCESS);
        expect(count).toBe(3);
      }
    });

    it('Repeater：子节点失败时应立即返回 FAILURE', () => {
      let count = 0;
      const rep = new Repeater(
        new Action(() => { count++; return count < 2 ? BTStatus.SUCCESS : BTStatus.FAILURE; }),
        5,
      );
      // tick 1: count=1, SUCCESS → RUNNING
      expect(rep.tick(bb)).toBe(BTStatus.RUNNING);
      expect(count).toBe(1);
      // tick 2: count=2, FAILURE → FAILURE
      expect(rep.tick(bb)).toBe(BTStatus.FAILURE);
      expect(count).toBe(2);
    });

    it('UntilFail：应重复直到失败返回 SUCCESS', () => {
      let count = 0;
      const uf = new UntilFail(
        new Action(() => { count++; return count < 4 ? BTStatus.SUCCESS : BTStatus.FAILURE; }),
      );
      // tick 1-3: SUCCESS → RUNNING
      expect(uf.tick(bb)).toBe(BTStatus.RUNNING); // count=1
      expect(uf.tick(bb)).toBe(BTStatus.RUNNING); // count=2
      expect(uf.tick(bb)).toBe(BTStatus.RUNNING); // count=3
      // tick 4: FAILURE → SUCCESS
      expect(uf.tick(bb)).toBe(BTStatus.SUCCESS);
      expect(count).toBe(4);
    });

    it('Cooldown：冷却期间应跳过返回 FAILURE', () => {
      let execCount = 0;
      const cd = new Cooldown(
        new Action(() => { execCount++; return BTStatus.SUCCESS; }),
        100, // 100ms
        'test_cd',
      );
      // 第一次执行
      expect(cd.tick(bb)).toBe(BTStatus.SUCCESS);
      expect(execCount).toBe(1);

      // 立即再次执行：冷却中，应跳过
      expect(cd.tick(bb)).toBe(BTStatus.FAILURE);
      expect(execCount).toBe(1);
    });

    it('Cooldown：冷却到期后可再次执行', async () => {
      let execCount = 0;
      const cd = new Cooldown(
        new Action(() => { execCount++; return BTStatus.SUCCESS; }),
        50, // 50ms
        'test_cd2',
      );
      expect(cd.tick(bb)).toBe(BTStatus.SUCCESS);
      expect(execCount).toBe(1);

      // 等待冷却结束
      await new Promise((r) => setTimeout(r, 60));
      expect(cd.tick(bb)).toBe(BTStatus.SUCCESS);
      expect(execCount).toBe(2);
    });
  });

  // ---- Condition & Action 叶节点 ----

  describe('Condition & Action', () => {
    it('Condition：条件为 true 返回 SUCCESS，false 返回 FAILURE', () => {
      bb.set('hp', 50);
      const c1 = new Condition((ctx) => ctx.get<number>('hp')! > 0);
      expect(c1.tick(bb)).toBe(BTStatus.SUCCESS);

      bb.set('hp', 0);
      const c2 = new Condition((ctx) => ctx.get<number>('hp')! > 0);
      expect(c2.tick(bb)).toBe(BTStatus.FAILURE);
    });

    it('Action：可读写 Blackboard', () => {
      const act = new Action((ctx) => {
        ctx.set('result', 42);
        return BTStatus.SUCCESS;
      });
      expect(act.tick(bb)).toBe(BTStatus.SUCCESS);
      expect(bb.get<number>('result')).toBe(42);
    });
  });

  // ---- RandomSelector ----

  describe('RandomSelector', () => {
    it('应随机顺序选择子节点，任一成功则成功', () => {
      const rand = new RandomSelector([
        new Action(() => BTStatus.FAILURE),
        new Action(() => BTStatus.FAILURE),
        new Action(() => BTStatus.SUCCESS),
      ]);
      // 所有失败时才会失败，但第三个返回 SUCCESS
      // 每次都成功，因为总会执行到 SUCCESS 的那个
      for (let i = 0; i < 10; i++) {
        expect(rand.tick(bb)).toBe(BTStatus.SUCCESS);
      }
    });

    it('应至少尝试多个子节点直到成功', () => {
      const calls: string[] = [];
      const rand = new RandomSelector([
        new Action(() => { calls.push('A'); return BTStatus.FAILURE; }),
        new Action(() => { calls.push('B'); return BTStatus.FAILURE; }),
        new Action(() => { calls.push('C'); return BTStatus.SUCCESS; }),
      ]);
      const orders = new Set<string>();
      for (let i = 0; i < 20; i++) {
        calls.length = 0;
        expect(rand.tick(bb)).toBe(BTStatus.SUCCESS);
        expect(calls).toContain('C'); // 成功的总会执行到
        orders.add(calls.join(''));
      }
      // 至少有两种不同执行顺序（证明随机性）
      expect(orders.size).toBeGreaterThan(1);
    });
  });

  // ---- Blackboard ----

  describe('Blackboard', () => {
    it('set / get 应正确存取', () => {
      bb.set('name', 'enemy');
      bb.set('hp', 100);
      expect(bb.get<string>('name')).toBe('enemy');
      expect(bb.get<number>('hp')).toBe(100);
    });

    it('has 应正确判断键是否存在', () => {
      bb.set('alive', true);
      expect(bb.has('alive')).toBe(true);
      expect(bb.has('dead')).toBe(false);
    });

    it('delete 应正确删除键', () => {
      bb.set('temp', 'data');
      expect(bb.has('temp')).toBe(true);
      bb.delete('temp');
      expect(bb.has('temp')).toBe(false);
    });

    it('未设置的键返回 undefined', () => {
      expect(bb.get('nonexistent')).toBeUndefined();
    });
  });

  // ---- BehaviorTreeBuilder ----

  describe('BehaviorTreeBuilder', () => {
    it('应通过链式 API 构建复杂行为树', () => {
      const tree = createBehaviorTree()
        .selector()
          .sequence()
            .condition((bb) => (bb.get<number>('hp') ?? 0) > 30)
            .action(() => BTStatus.SUCCESS)
          .end()
          .action(() => BTStatus.FAILURE)
        .end()
        .build();

      bb.set('hp', 50);
      expect(tree.tick(bb)).toBe(BTStatus.SUCCESS);

      bb.set('hp', 10);
      expect(tree.tick(bb)).toBe(BTStatus.FAILURE);
    });
  });
});

// ============================================================================
// 有限状态机测试
// ============================================================================

type TestState = 'idle' | 'run' | 'attack';

describe('StateMachine', () => {
  let sm: StateMachine<TestState>;
  let log: string[];

  beforeEach(() => {
    log = [];
    sm = new StateMachine<TestState>();

    // idle 状态
    const idleState: State<TestState> = {
      enter: () => { log.push('enter:idle'); },
      update: () => { log.push('update:idle'); },
      exit: () => { log.push('exit:idle'); },
    };

    // run 状态
    const runState: State<TestState> = {
      enter: () => { log.push('enter:run'); },
      update: () => { log.push('update:run'); },
      exit: () => { log.push('exit:run'); },
    };

    // attack 状态
    const attackState: State<TestState> = {
      enter: () => { log.push('enter:attack'); },
      update: () => { log.push('update:attack'); },
      exit: () => { log.push('exit:attack'); },
    };

    sm.addState('idle', idleState);
    sm.addState('run', runState);
    sm.addState('attack', attackState);

    // idle -> run
    sm.addTransition({
      from: 'idle',
      to: 'run',
      condition: () => true,
    });

    // run -> attack
    sm.addTransition({
      from: 'run',
      to: 'attack',
      condition: () => true,
    });
  });

  it('应执行 enter → update 流程', () => {
    const sm2 = new StateMachine<TestState>();

    const idleState: State<TestState> = {
      enter: () => { log.push('enter:idle'); },
      update: () => { log.push('update:idle'); },
      exit: () => { log.push('exit:idle'); },
    };
    const runState: State<TestState> = {
      enter: () => { log.push('enter:run'); },
      update: () => { log.push('update:run'); },
      exit: () => { log.push('exit:run'); },
    };

    sm2.addState('idle', idleState);
    sm2.addState('run', runState);

    // idle→run 转换条件为 false，先验证 update
    sm2.addTransition({ from: 'idle', to: 'run', condition: () => false });

    sm2.start('idle');
    expect(log).toEqual(['enter:idle']);
    log.length = 0;

    sm2.update(0.016);
    expect(log).toContain('update:idle');
  });

  it('应正确执行状态迁移（exit → enter → update）', () => {
    sm.start('idle');
    log.length = 0;

    sm.update(0.016);
    // idle -> run (condition always true)
    expect(log).toEqual(['exit:idle', 'enter:run', 'update:run']);
  });

  it('应支持 getCurrentState', () => {
    sm.start('idle');
    expect(sm.getCurrentState()).toBe('idle');

    // 第一次 update：idle → run
    sm.update(0.016);
    expect(sm.getCurrentState()).toBe('run');

    // 第二次 update：run → attack
    sm.update(0.016);
    expect(sm.getCurrentState()).toBe('attack');
  });

  it('AnyState 全局过渡应正确工作', () => {
    sm = new StateMachine<TestState>();

    const idleState: State<TestState> = {
      enter: () => {},
      update: () => {},
      exit: () => {},
    };
    const runState: State<TestState> = {
      enter: () => {},
      update: () => {},
      exit: () => {},
    };

    sm.addState('idle', idleState);
    sm.addState('run', runState);

    // AnyState → run 当 isRunning=true 时
    let isRunning = false;
    sm.addTransition({
      from: '__any__',
      to: 'run',
      condition: () => isRunning,
    });

    sm.start('idle');
    expect(sm.getCurrentState()).toBe('idle');

    // 不满足条件，保持不变
    sm.update(0.016);
    expect(sm.getCurrentState()).toBe('idle');

    // 满足条件，AnyState 触发
    isRunning = true;
    sm.update(0.016);
    expect(sm.getCurrentState()).toBe('run');
  });
});

// ============================================================================
// GOAP 规划器测试
// ============================================================================

describe('GOAPPlanner', () => {
  it('A* 搜索应找到最优动作序列', () => {
    const actions: GOAPAction[] = [
      {
        name: 'pick_up_axe',
        cost: 1,
        preconditions: { has_axe: false },
        effects: { has_axe: true },
      },
      {
        name: 'chop_tree',
        cost: 2,
        preconditions: { has_axe: true },
        effects: { wood: 3 },
      },
      {
        name: 'collect_sticks',
        cost: 3,
        preconditions: {},
        effects: { wood: 1 },
      },
    ];

    const goals: GOAPGoal[] = [
      {
        name: 'get_wood',
        priority: 1,
        conditions: { wood: 3 },
      },
    ];

    const planner = new GOAPPlanner();
    // 1. pick_up_axe (1) + chop_tree (2) = total 3 — better than collect_sticks x3 (9)
    const plan = planner.plan({ wood: 0, has_axe: false }, goals, actions);

    expect(plan).toHaveLength(2);
    expect(plan.map((a) => a.name)).toEqual(['pick_up_axe', 'chop_tree']);
  });

  it('应选择最小总代价的路径', () => {
    const actions: GOAPAction[] = [
      {
        name: 'buy_sword',
        cost: 5,
        preconditions: { has_coin: true },
        effects: { has_sword: true },
      },
      {
        name: 'mine_gold',
        cost: 1,
        preconditions: {},
        effects: { has_coin: true },
      },
      {
        name: 'craft_sword',
        cost: 3,
        preconditions: { has_iron: true },
        effects: { has_sword: true },
      },
      {
        name: 'get_iron',
        cost: 1,
        preconditions: {},
        effects: { has_iron: true },
      },
    ];

    const goals: GOAPGoal[] = [
      {
        name: 'armed',
        priority: 1,
        conditions: { has_sword: true },
      },
    ];

    const planner = new GOAPPlanner();
    // craft path: get_iron(1) + craft_sword(3) = 4
    // buy path: mine_gold(1) + buy_sword(5) = 6
    // Pick cheaper: craft path
    const plan = planner.plan({}, goals, actions);

    expect(plan).toHaveLength(2);
    expect(plan.map((a) => a.name)).toEqual(['get_iron', 'craft_sword']);
  });

  it('应优先选择高优先级目标', () => {
    const actions: GOAPAction[] = [
      {
        name: 'eat',
        cost: 1,
        preconditions: { has_food: true },
        effects: { hungry: false },
      },
      {
        name: 'find_food',
        cost: 2,
        preconditions: {},
        effects: { has_food: true },
      },
      {
        name: 'sleep',
        cost: 1,
        preconditions: {},
        effects: { tired: false },
      },
    ];

    const goals: GOAPGoal[] = [
      {
        name: 'survive',
        priority: 100,
        conditions: { hungry: false },
      },
      {
        name: 'rest',
        priority: 10,
        conditions: { tired: false },
      },
    ];

    const planner = new GOAPPlanner();
    // survive (priority 100) > rest (priority 10)
    const plan = planner.plan({ hungry: true, tired: true, has_food: false }, goals, actions);

    expect(plan).toHaveLength(2);
    expect(plan.map((a) => a.name)).toEqual(['find_food', 'eat']);
  });

  it('getPlan 应返回当前规划的动作序列', () => {
    const actions: GOAPAction[] = [
      {
        name: 'do_thing',
        cost: 1,
        preconditions: {},
        effects: { done: true },
      },
    ];
    const goals: GOAPGoal[] = [
      {
        name: 'finish',
        priority: 1,
        conditions: { done: true },
      },
    ];

    const planner = new GOAPPlanner();
    planner.plan({ done: false }, goals, actions);
    const plan = planner.getPlan();

    expect(plan).toHaveLength(1);
    expect(plan[0].name).toBe('do_thing');
  });

  it('应支持动态重规划', () => {
    const actions: GOAPAction[] = [
      {
        name: 'get_key',
        cost: 1,
        preconditions: {},
        effects: { has_key: true },
      },
      {
        name: 'open_door',
        cost: 1,
        preconditions: { has_key: true },
        effects: { door_open: true },
      },
      {
        name: 'break_door',
        cost: 5,
        preconditions: {},
        effects: { door_open: true },
      },
    ];

    const goals: GOAPGoal[] = [
      {
        name: 'enter_room',
        priority: 1,
        conditions: { door_open: true },
      },
    ];

    const planner = new GOAPPlanner();

    // 初始：有钥匙 → get_key + open_door
    const plan1 = planner.plan({ has_key: false, door_open: false }, goals, actions);
    expect(plan1.map((a) => a.name)).toEqual(['get_key', 'open_door']);

    // 世界状态变了：移除 get_key 动作 → 只能砸门
    const newActions: GOAPAction[] = [
      {
        name: 'open_door',
        cost: 1,
        preconditions: { has_key: true },
        effects: { door_open: true },
      },
      {
        name: 'break_door',
        cost: 5,
        preconditions: {},
        effects: { door_open: true },
      },
    ];
    const plan2 = planner.replan({ has_key: false, door_open: false }, goals, newActions);
    expect(plan2).toHaveLength(1);
    expect(plan2[0].name).toBe('break_door');
  });

  it('无法达成目标时应返回空数组', () => {
    const actions: GOAPAction[] = [
      {
        name: 'impossible_action',
        cost: 1,
        preconditions: { can_fly: true },
        effects: { goal_reached: true },
      },
    ];

    const goals: GOAPGoal[] = [
      {
        name: 'unreachable',
        priority: 1,
        conditions: { goal_reached: true },
      },
    ];

    const planner = new GOAPPlanner();
    const plan = planner.plan({ can_fly: false }, goals, actions);

    expect(plan).toEqual([]);
  });

  it('已是目标状态时应返回空动作序列', () => {
    const actions: GOAPAction[] = [
      {
        name: 'redundant',
        cost: 1,
        preconditions: {},
        effects: { done: true },
      },
    ];

    const goals: GOAPGoal[] = [
      {
        name: 'already_done',
        priority: 1,
        conditions: { done: true },
      },
    ];

    const planner = new GOAPPlanner();
    const plan = planner.plan({ done: true }, goals, actions);

    expect(plan).toEqual([]);
  });
});
