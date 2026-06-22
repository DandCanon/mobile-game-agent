/**
 * Planner — 任务拆解引擎
 *
 * 职责：
 * 1. 接收用户原始需求 + 上下文
 * 2. 调用技术选型决策引擎
 * 3. 输出结构化的执行计划（含目录结构、接口契约、数据模型、验收标准）
 * 4. 处理步骤依赖关系，给出执行顺序
 *
 * 当前版本：基于规则模板 + 游戏品类知识库生成计划。
 * 未来可由 LLM 接管生成更灵活的计划。
 */

import type {
  ExecutionPlan,
  PlanStep,
  PipelinePhase,
  Context,
  InterfaceContract,
  DataModel,
  AcceptanceCriterion,
} from '../protocol/agent-protocol';
import type { TechSelectionInput } from '../protocol/agent-protocol';
import { selectTechStack } from './tech-selector';
import { Logger } from './logger';
import type { MemorySnapshot } from '../src/memory-v2/types';
import { InjectionStrategy } from '../src/memory-v2/injection';
import { generateStyleAndMotion } from '../src/style-director/style-director';
import { generateArtDirection } from '../src/style-director/art-direction-generator';
import { recallKnowledgeCards } from './knowledge-recall';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const plannerLogger = new Logger('Planner');

/* ===================== 品类模板库 ===================== */

interface GameTemplate {
  gameType: string;
  phases: Record<string, PlanStepTemplate[]>;
}

interface PlanStepTemplate {
  title: string;
  description: string;
  directoryStructure: string[];
  interfaceContracts: InterfaceContract[];
  dataModels: DataModel[];
  acceptanceCriteria: AcceptanceCriterion[];
  estimatedTools: string[];
  maxCodeLines: number;
}

/** 放置类手游模板 */
const IDLE_GAME_TEMPLATE: GameTemplate = {
  gameType: '放置',
  phases: {
    立项: [
      {
        title: '项目初始化',
        description: '初始化项目目录结构，安装框架依赖',
        directoryStructure: ['src/game/', 'src/game/components/', 'src/game/systems/'],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'init-1', description: 'package.json 存在且依赖安装成功', verifyBy: 'file-exists', verifyParam: 'package.json' },
          { id: 'init-2', description: 'TypeScript 编译无错误', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 50,
      },
      {
        title: '游戏数据模型定义',
        description: '定义游戏核心数据类型：GameState、资源、升级项、成就',
        directoryStructure: ['src/game/types.ts'],
        interfaceContracts: [],
        dataModels: [
          { name: 'GameState', fields: [
            { name: 'gold', type: 'number', nullable: false, description: '金币（主货币）' },
            { name: 'gems', type: 'number', nullable: false, description: '钻石（高级货币）' },
            { name: 'totalClicks', type: 'number', nullable: false, description: '总点击数' },
          ], description: '玩家全局状态' },
          { name: 'Upgrade', fields: [
            { name: 'id', type: 'string', nullable: false, description: '升级项唯一 ID' },
            { name: 'level', type: 'number', nullable: false, description: '当前等级' },
            { name: 'baseCost', type: 'number', nullable: false, description: '基础成本' },
          ], description: '升级项定义' },
        ],
        acceptanceCriteria: [
          { id: 'types-1', description: 'types.ts 文件存在', verifyBy: 'file-exists', verifyParam: 'src/game/types.ts' },
          { id: 'types-2', description: 'GameState 接口含 gold/gems/totalClicks 字段', verifyBy: 'unit-test', verifyParam: 'type check passes' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 80,
      },
      {
        title: '游戏引擎核心实现',
        description: '实现 GameEngine 纯逻辑层：点击收益、自动生产、离线计算、升级购买、成就检测',
        directoryStructure: ['src/game/GameEngine.ts'],
        interfaceContracts: [
          { name: 'performClick', signature: '(state: GameState) => GameState', params: [{ name: 'state', type: 'GameState', required: true, description: '当前游戏状态' }], returns: 'GameState', purpose: '执行一次点击，返回新状态' },
          { name: 'getIncomePerSec', signature: '(state: GameState) => number', params: [{ name: 'state', type: 'GameState', required: true, description: '当前游戏状态' }], returns: 'number', purpose: '计算每秒自动收益' },
          { name: 'buyUpgrade', signature: '(state: GameState, id: string) => { state: GameState; success: boolean }', params: [
            { name: 'state', type: 'GameState', required: true, description: '当前游戏状态' },
            { name: 'id', type: 'string', required: true, description: '升级项 ID' },
          ], returns: '{ state, success }', purpose: '购买升级' },
        ],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'engine-1', description: 'performClick 正确增加金币和点击数', verifyBy: 'unit-test', verifyParam: 'test: performClick' },
          { id: 'engine-2', description: 'buyUpgrade 金币不足时返回 success=false', verifyBy: 'unit-test', verifyParam: 'test: buyUpgrade insufficient' },
          { id: 'engine-3', description: '离线收益计算正确', verifyBy: 'unit-test', verifyParam: 'test: calculateTimeAdvance' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 200,
      },
      {
        title: 'idle-game',
        description: '深化放置类引擎：IdleEngine 资源管理/点击收益/自动生产/升级树/离线收益/里程碑系统',
        directoryStructure: ['src/game/IdleEngine.ts'],
        interfaceContracts: [
          { name: 'createInitialState', signature: '() => IdleState', params: [], returns: 'IdleState', purpose: '创建默认初始状态' },
          { name: 'click', signature: '(state: IdleState) => IdleState', params: [{ name: 'state', type: 'IdleState', required: true, description: '当前游戏状态' }], returns: 'IdleState', purpose: '执行一次点击，返回新状态' },
          { name: 'buyUpgrade', signature: '(state: IdleState, id: string) => BuyUpgradeResult', params: [{ name: 'state', type: 'IdleState', required: true, description: '当前状态' }, { name: 'id', type: 'string', required: true, description: '升级项 ID' }], returns: 'BuyUpgradeResult', purpose: '购买升级项' },
          { name: 'tick', signature: '(state: IdleState, deltaMs: number) => IdleState', params: [{ name: 'state', type: 'IdleState', required: true, description: '当前状态' }, { name: 'deltaMs', type: 'number', required: true, description: '时间增量(ms)' }], returns: 'IdleState', purpose: '时间推进，自动产出金币' },
          { name: 'calculateOfflineEarnings', signature: '(state: IdleState, awayMs: number) => number', params: [{ name: 'state', type: 'IdleState', required: true, description: '当前状态' }, { name: 'awayMs', type: 'number', required: true, description: '离线时长(ms)' }], returns: 'number', purpose: '计算离线收益金币数' },
          { name: 'checkMilestones', signature: '(state: IdleState) => string[]', params: [{ name: 'state', type: 'IdleState', required: true, description: '当前状态' }], returns: 'string[]', purpose: '返回当前未解锁的里程碑 ID 列表' },
        ],
        dataModels: [
          { name: 'IdleState', fields: [
            { name: 'resources', type: 'IdleResources', nullable: false, description: '资源（金币/钻石）' },
            { name: 'upgrades', type: 'Record<string, number>', nullable: false, description: '升级项等级映射' },
            { name: 'milestones', type: 'string[]', nullable: false, description: '已解锁里程碑 ID' },
            { name: 'stats', type: 'IdleStats', nullable: false, description: '统计数据' },
          ], description: '放置游戏全局状态' },
          { name: 'UpgradeDef', fields: [
            { name: 'id', type: 'string', nullable: false, description: '升级项唯一 ID' },
            { name: 'category', type: 'UpgradeCategory', nullable: false, description: '类别：点击力/自动产量/离线倍率' },
            { name: 'baseCost', type: 'number', nullable: false, description: '基础成本' },
            { name: 'effectValue', type: 'number', nullable: false, description: '每级效果值' },
          ], description: '升级项定义' },
          { name: 'MilestoneDef', fields: [
            { name: 'id', type: 'string', nullable: false, description: '里程碑唯一 ID' },
            { name: 'name', type: 'string', nullable: false, description: '里程碑名称' },
            { name: 'check', type: '(state: IdleState) => boolean', nullable: false, description: '检测函数' },
          ], description: '里程碑定义' },
        ],
        acceptanceCriteria: [
          { id: 'idle-1', description: 'click 正确增加金币和点击数', verifyBy: 'unit-test', verifyParam: 'vitest: click' },
          { id: 'idle-2', description: 'buyUpgrade 金币不足时返回 success=false', verifyBy: 'unit-test', verifyParam: 'vitest: buyUpgrade insufficient' },
          { id: 'idle-3', description: 'tick 按时间产出金币', verifyBy: 'unit-test', verifyParam: 'vitest: tick' },
          { id: 'idle-4', description: '离线收益计算受倍率和 24h 上限约束', verifyBy: 'unit-test', verifyParam: 'vitest: calculateOfflineEarnings' },
          { id: 'idle-5', description: '4 项里程碑全部可触发', verifyBy: 'unit-test', verifyParam: 'vitest: milestones' },
          { id: 'idle-6', description: '升级成本指数增长曲线正确', verifyBy: 'unit-test', verifyParam: 'vitest: cost curve' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 450,
      },
    ],
    原型: [
      {
        title: '主界面组件开发',
        description: '实现 App.tsx 主框架和资源显示/点击区域/升级面板',
        directoryStructure: ['src/App.tsx', 'src/game/components/'],
        interfaceContracts: [
          { name: 'ResourceDisplay', signature: '(props: { state: GameState }) => JSX.Element', params: [{ name: 'state', type: 'GameState', required: true, description: '游戏状态' }], returns: 'JSX.Element', purpose: '显示金币/钻石/每秒收益' },
          { name: 'ClickArea', signature: '(props: { state: GameState; onClick: () => void }) => JSX.Element', params: [
            { name: 'state', type: 'GameState', required: true, description: '游戏状态' },
            { name: 'onClick', type: '() => void', required: true, description: '点击回调' },
          ], returns: 'JSX.Element', purpose: '点击区域' },
        ],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'ui-1', description: '页面渲染无白屏/报错', verifyBy: 'manual', verifyParam: '手动打开 dev server' },
          { id: 'ui-2', description: '点击区域有视觉反馈', verifyBy: 'manual', verifyParam: '点击观察浮动数字' },
          { id: 'ui-3', description: '升级面板显示所有升级项', verifyBy: 'manual', verifyParam: '观察面板内容' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 200,
      },
      {
        title: '离线收益与存档',
        description: '实现离线收益计算弹窗、localStorage 存档/读档、自动保存',
        directoryStructure: [],
        interfaceContracts: [
          { name: 'saveGame', signature: '(state: GameState) => void', params: [{ name: 'state', type: 'GameState', required: true, description: '游戏状态' }], returns: 'void', purpose: '保存游戏到 localStorage' },
          { name: 'loadGame', signature: '() => GameState | null', params: [], returns: 'GameState | null', purpose: '从 localStorage 读取存档' },
        ],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'save-1', description: '刷新页面后金币不丢失', verifyBy: 'manual', verifyParam: '修改金币后刷新' },
          { id: 'save-2', description: '离线收益弹窗显示正确', verifyBy: 'manual', verifyParam: '修改系统时间后刷新' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 100,
      },
    ],
    生产: [
      {
        title: '成就系统与音效',
        description: '补充成就弹窗 UI、音效触发逻辑',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'ach-1', description: '达到条件后弹出成就提示', verifyBy: 'manual', verifyParam: '完成首次点击' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 80,
      },
    ],
    验证: [
      {
        title: 'TypeScript 类型检查',
        description: '执行 npx tsc --noEmit 确保所有源码类型无错误',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'ts-1', description: 'tsc --noEmit 零错误', verifyBy: 'shell', verifyParam: 'npx tsc --noEmit' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
      {
        title: '引擎单元测试',
        description: '运行 vitest 验证 GameEngine 核心逻辑（点击、升级、离线收益、成就）',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'test-1', description: '12 项引擎单元测试全部通过', verifyBy: 'shell', verifyParam: 'npx vitest run' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
      {
        title: 'dev server 启动验证',
        description: '启动 Vite dev server，验证页面无编译错误且可访问',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'dev-1', description: 'npm run dev 启动成功且页面可访问', verifyBy: 'shell', verifyParam: 'npm run dev -- --host 0.0.0.0' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** 卡牌手游模板 */
const CARD_GAME_TEMPLATE: GameTemplate = {
  gameType: '卡牌',
  phases: {
    立项: [
      {
        title: '项目初始化',
        description: '初始化项目目录结构，安装框架依赖',
        directoryStructure: ['src/game/', 'src/game/components/', 'src/game/systems/'],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'init-1', description: 'package.json 存在且依赖安装成功', verifyBy: 'file-exists', verifyParam: 'package.json' },
          { id: 'init-2', description: 'TypeScript 编译无错误', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 50,
      },
      {
        title: '卡牌数据模型定义',
        description: '定义卡牌核心类型：Card、CardDeck、BattleState、TurnPhase',
        directoryStructure: ['src/game/types.ts'],
        interfaceContracts: [],
        dataModels: [
          { name: 'Card', fields: [
            { name: 'id', type: 'string', nullable: false, description: '卡牌唯一 ID' },
            { name: 'name', type: 'string', nullable: false, description: '卡牌名称' },
            { name: 'cost', type: 'number', nullable: false, description: '消耗法力' },
            { name: 'attack', type: 'number', nullable: false, description: '攻击力' },
            { name: 'health', type: 'number', nullable: false, description: '生命值' },
            { name: 'rarity', type: 'string', nullable: false, description: '稀有度：白/蓝/紫/橙' },
          ], description: '卡牌定义' },
          { name: 'BattleState', fields: [
            { name: 'playerHP', type: 'number', nullable: false, description: '玩家生命' },
            { name: 'enemyHP', type: 'number', nullable: false, description: '敌人生命' },
            { name: 'mana', type: 'number', nullable: false, description: '当前法力' },
            { name: 'hand', type: 'Card[]', nullable: false, description: '手牌' },
            { name: 'board', type: 'Card[]', nullable: false, description: '战场区域' },
          ], description: '战斗全局状态' },
        ],
        acceptanceCriteria: [
          { id: 'types-1', description: 'types.ts 文件存在', verifyBy: 'file-exists', verifyParam: 'src/game/types.ts' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 80,
      },
      {
        title: '卡牌引擎核心实现',
        description: '实现 CardEngine：抽牌、出牌、回合切换、伤害结算、AI 行动',
        directoryStructure: ['src/game/CardEngine.ts'],
        interfaceContracts: [
          { name: 'playCard', signature: '(state: BattleState, cardId: string) => BattleState', params: [
            { name: 'state', type: 'BattleState', required: true, description: '当前战斗状态' },
            { name: 'cardId', type: 'string', required: true, description: '要打出的卡牌 ID' },
          ], returns: 'BattleState', purpose: '打出一张卡牌' },
          { name: 'endTurn', signature: '(state: BattleState) => BattleState', params: [
            { name: 'state', type: 'BattleState', required: true, description: '当前战斗状态' },
          ], returns: 'BattleState', purpose: '结束回合，触发敌方行动' },
          { name: 'drawCard', signature: '(state: BattleState, deck: Card[]) => BattleState', params: [
            { name: 'state', type: 'BattleState', required: true, description: '当前战斗状态' },
            { name: 'deck', type: 'Card[]', required: true, description: '牌库' },
          ], returns: 'BattleState', purpose: '抽一张牌' },
        ],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'engine-1', description: 'playCard 正确扣除法力并放置卡牌', verifyBy: 'unit-test', verifyParam: 'test: playCard' },
          { id: 'engine-2', description: 'endTurn 切换回合并触发 AI', verifyBy: 'unit-test', verifyParam: 'test: endTurn' },
          { id: 'engine-3', description: 'HP≤0 时返回胜利/失败', verifyBy: 'unit-test', verifyParam: 'test: checkWinLoss' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 250,
      },
      {
        title: 'card-game',
        description: '深化卡牌引擎：CardEngine 手牌管理/法力水晶/战吼亡语/冲锋嘲讽风怒魔免/随从攻防结算/回合制流程',
        directoryStructure: ['src/game/CardEngine.ts'],
        interfaceContracts: [
          { name: 'createInitialState', signature: '(playerDeckIds: string[]) => CardGameState', params: [{ name: 'playerDeckIds', type: 'string[]', required: true, description: '玩家牌库卡牌 ID 列表' }], returns: 'CardGameState', purpose: '创建初始战斗状态' },
          { name: 'startTurn', signature: '(state: CardGameState) => CardGameState', params: [{ name: 'state', type: 'CardGameState', required: true, description: '当前状态' }], returns: 'CardGameState', purpose: '开始新回合，增长法力水晶' },
          { name: 'drawCard', signature: '(state: CardGameState) => CardGameState', params: [{ name: 'state', type: 'CardGameState', required: true, description: '当前状态' }], returns: 'CardGameState', purpose: '抽一张牌' },
          { name: 'playCard', signature: '(state: CardGameState, handIndex: number, targetSlot?: number) => PlayCardResult', params: [{ name: 'state', type: 'CardGameState', required: true, description: '当前状态' }, { name: 'handIndex', type: 'number', required: true, description: '手牌索引' }], returns: 'PlayCardResult', purpose: '打出一张手牌' },
          { name: 'attack', signature: '(state: CardGameState, attackerIndex: number, targetIndex?: number) => AttackResult', params: [{ name: 'state', type: 'CardGameState', required: true, description: '当前状态' }, { name: 'attackerIndex', type: 'number', required: true, description: '攻击者战场索引' }], returns: 'AttackResult', purpose: '随从攻击' },
          { name: 'endTurn', signature: '(state: CardGameState) => CardGameState', params: [{ name: 'state', type: 'CardGameState', required: true, description: '当前状态' }], returns: 'CardGameState', purpose: '结束当前回合' },
          { name: 'checkGameOver', signature: '(state: CardGameState) => CardGameState', params: [{ name: 'state', type: 'CardGameState', required: true, description: '当前状态' }], returns: 'CardGameState', purpose: '检测胜负并设置 gameOver/winner' },
        ],
        dataModels: [
          { name: 'CardGameState', fields: [
            { name: 'player', type: 'PlayerState', nullable: false, description: '玩家状态' },
            { name: 'enemy', type: 'PlayerState', nullable: false, description: '敌方状态' },
            { name: 'currentTurn', type: "'player' | 'enemy'", nullable: false, description: '当前回合方' },
            { name: 'phase', type: "'draw' | 'main' | 'combat' | 'end'", nullable: false, description: '当前阶段' },
            { name: 'gameOver', type: 'boolean', nullable: false, description: '游戏是否结束' },
          ], description: '卡牌对战全局状态' },
          { name: 'CardDef', fields: [
            { name: 'id', type: 'string', nullable: false, description: '卡牌唯一 ID' },
            { name: 'name', type: 'string', nullable: false, description: '卡牌名称' },
            { name: 'cost', type: 'number', nullable: false, description: '法力消耗' },
            { name: 'attack', type: 'number', nullable: false, description: '攻击力' },
            { name: 'effects', type: 'EffectType[]', nullable: false, description: '效果列表' },
          ], description: '卡牌定义' },
          { name: 'EffectType', fields: [
            { name: 'battlecry', type: 'string', nullable: false, description: '战吼：打出时触发' },
            { name: 'deathrattle', type: 'string', nullable: false, description: '亡语：死亡时触发' },
            { name: 'charge', type: 'string', nullable: false, description: '冲锋：上场即可攻击' },
            { name: 'taunt', type: 'string', nullable: false, description: '嘲讽：敌方必须先攻击此随从' },
            { name: 'windfury', type: 'string', nullable: false, description: '风怒：每回合可攻击两次' },
            { name: 'spell_immunity', type: 'string', nullable: false, description: '魔免：免疫法术伤害和效果' },
          ], description: '卡牌效果类型枚举' },
        ],
        acceptanceCriteria: [
          { id: 'card-1', description: 'createInitialState 产出合法状态', verifyBy: 'unit-test', verifyParam: 'vitest: initial state' },
          { id: 'card-2', description: 'drawCard/startTurn 法力水晶每回合+1 上限 10', verifyBy: 'unit-test', verifyParam: 'vitest: mana growth' },
          { id: 'card-3', description: 'playCard 法力不足/战场满/非主阶段拒绝', verifyBy: 'unit-test', verifyParam: 'vitest: playCard rejections' },
          { id: 'card-4', description: '冲锋随从可立即攻击，普通随从不能', verifyBy: 'unit-test', verifyParam: 'vitest: charge' },
          { id: 'card-5', description: '有嘲讽时不能攻击英雄', verifyBy: 'unit-test', verifyParam: 'vitest: taunt' },
          { id: 'card-6', description: '风怒可攻击两次', verifyBy: 'unit-test', verifyParam: 'vitest: windfury' },
          { id: 'card-7', description: 'HP≤0 时 gameOver 置 true 并设置 winner', verifyBy: 'unit-test', verifyParam: 'vitest: game over' },
          { id: 'card-8', description: '8 张预置卡牌属性正确', verifyBy: 'unit-test', verifyParam: 'vitest: card catalog' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 650,
      },
    ],
    原型: [
      {
        title: '战斗主界面',
        description: '实现 BattleScreen：手牌区/战场/对手区/回合指示器/法力条',
        directoryStructure: ['src/App.tsx', 'src/game/components/'],
        interfaceContracts: [
          { name: 'BattleScreen', signature: '(props: { state: BattleState; onPlay: (id: string) => void; onEndTurn: () => void }) => JSX.Element', params: [], returns: 'JSX.Element', purpose: '战斗主界面' },
          { name: 'HandArea', signature: '(props: { cards: Card[]; mana: number; onPlay: (id: string) => void }) => JSX.Element', params: [], returns: 'JSX.Element', purpose: '手牌区域' },
        ],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'ui-1', description: '战斗界面渲染手牌/战场/对手', verifyBy: 'manual', verifyParam: '手动打开 dev server' },
          { id: 'ui-2', description: '点击卡牌可以打出（法力足够时）', verifyBy: 'manual', verifyParam: '点击手牌观察战场' },
          { id: 'ui-3', description: '回合结束按钮可用', verifyBy: 'manual', verifyParam: '点击结束回合' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 250,
      },
      {
        title: '卡组编辑器',
        description: '实现 DeckEditor：卡牌列表浏览、拖拽组牌、保存卡组',
        directoryStructure: [],
        interfaceContracts: [
          { name: 'DeckEditor', signature: '(props: { catalog: Card[]; onSave: (deck: Card[]) => void }) => JSX.Element', params: [], returns: 'JSX.Element', purpose: '卡组编辑界面' },
        ],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'deck-1', description: '卡牌目录显示所有可用卡牌', verifyBy: 'manual', verifyParam: '手动打开编辑器' },
          { id: 'deck-2', description: '卡组保存到 localStorage', verifyBy: 'manual', verifyParam: '编辑后刷新页面' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 180,
      },
    ],
    验证: [
      {
        title: 'TypeScript 类型检查',
        description: '执行 npx tsc --noEmit 确保所有源码类型无错误',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'ts-1', description: 'tsc --noEmit 零错误', verifyBy: 'shell', verifyParam: 'npx tsc --noEmit' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
      {
        title: '引擎单元测试',
        description: '运行 vitest 验证 CardEngine 核心逻辑（抽牌、出牌、回合切换、胜负判定）',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'test-1', description: '10 项卡牌引擎单元测试全部通过', verifyBy: 'shell', verifyParam: 'npx vitest run' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
      {
        title: 'dev server 启动验证',
        description: '启动 Vite dev server，验证页面无编译错误且可访问',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'dev-1', description: 'npm run dev 启动成功且页面可访问', verifyBy: 'shell', verifyParam: 'npm run dev -- --host 0.0.0.0' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** 肉鸽类手游模板 */
const ROGUELIKE_TEMPLATE: GameTemplate = {
  gameType: '肉鸽',
  phases: {
    立项: [
      {
        title: '项目初始化',
        description: '初始化项目目录结构，安装框架依赖',
        directoryStructure: ['src/game/', 'src/game/components/'],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'init-1', description: 'package.json 存在且依赖安装成功', verifyBy: 'file-exists', verifyParam: 'package.json' },
          { id: 'init-2', description: 'TypeScript 编译无错误', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 50,
      },
      {
        title: '肉鸽数据模型定义',
        description: '定义地牢网格、玩家实体、敌人、道具、楼层状态',
        directoryStructure: ['src/game/types.ts'],
        interfaceContracts: [],
        dataModels: [
          { name: 'Entity', fields: [
            { name: 'id', type: 'string', nullable: false, description: '实体 ID' },
            { name: 'name', type: 'string', nullable: false, description: '名称' },
            { name: 'hp', type: 'number', nullable: false, description: '生命值' },
            { name: 'maxHp', type: 'number', nullable: false, description: '最大生命' },
            { name: 'attack', type: 'number', nullable: false, description: '攻击力' },
            { name: 'x', type: 'number', nullable: false, description: 'X 坐标' },
            { name: 'y', type: 'number', nullable: false, description: 'Y 坐标' },
          ], description: '游戏实体' },
          { name: 'DungeonFloor', fields: [
            { name: 'grid', type: 'CellType[][]', nullable: false, description: '二维网格' },
            { name: 'player', type: 'Entity', nullable: false, description: '玩家实体' },
            { name: 'enemies', type: 'Entity[]', nullable: false, description: '敌人列表' },
            { name: 'floor', type: 'number', nullable: false, description: '当前楼层' },
          ], description: '楼层状态' },
        ],
        acceptanceCriteria: [
          { id: 'types-1', description: 'types.ts 定义 Entity/DungeonFloor/CellType', verifyBy: 'file-exists', verifyParam: 'src/game/types.ts' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 60,
      },
      {
        title: '肉鸽引擎核心实现',
        description: '地牢生成、移动、战斗、楼层推进、死亡重置',
        directoryStructure: ['src/game/DungeonEngine.ts'],
        interfaceContracts: [
          { name: 'generateFloor', signature: '(floor: number) => DungeonFloor', params: [{ name: 'floor', type: 'number', required: true, description: '楼层序号(0-based)' }], returns: 'DungeonFloor', purpose: '生成新楼层' },
          { name: 'movePlayer', signature: '(floor: DungeonFloor, dx: number, dy: number) => DungeonFloor', params: [
            { name: 'floor', type: 'DungeonFloor', required: true, description: '当前楼层状态' },
            { name: 'dx', type: 'number', required: true, description: 'X 方向位移' },
            { name: 'dy', type: 'number', required: true, description: 'Y 方向位移' },
          ], returns: 'DungeonFloor', purpose: '玩家移动' },
          { name: 'playerAttack', signature: '(floor: DungeonFloor, targetId: string) => DungeonFloor', params: [
            { name: 'floor', type: 'DungeonFloor', required: true, description: '当前楼层状态' },
            { name: 'targetId', type: 'string', required: true, description: '目标敌人 ID' },
          ], returns: 'DungeonFloor', purpose: '玩家攻击敌人' },
        ],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'eng-1', description: 'generateFloor 产出合法地图', verifyBy: 'unit-test', verifyParam: 'test: generateFloor' },
          { id: 'eng-2', description: 'movePlayer 移动后坐标更新', verifyBy: 'unit-test', verifyParam: 'test: movePlayer' },
          { id: 'eng-3', description: 'playerAttack 击杀敌人后从列表移除', verifyBy: 'unit-test', verifyParam: 'test: playerAttack' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 200,
      },
    ],
    原型: [
      {
        title: '地牢主界面',
        description: '网格渲染、玩家/敌人/道具绘制、操作按钮（上下左右 + 攻击 + 下一层）',
        directoryStructure: ['src/App.tsx', 'src/game/components/DungeonScreen.tsx'],
        interfaceContracts: [
          { name: 'DungeonScreen', signature: '(props: { floor: DungeonFloor }) => JSX.Element', params: [
            { name: 'floor', type: 'DungeonFloor', required: true, description: '当前楼层状态' },
          ], returns: 'JSX.Element', purpose: '渲染地牢界面' },
        ],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'ui-1', description: '网格渲染完整（墙壁/地板/玩家/敌人）', verifyBy: 'manual', verifyParam: '手动打开 dev server' },
          { id: 'ui-2', description: '方向键可移动', verifyBy: 'manual', verifyParam: '点击方向按钮' },
          { id: 'ui-3', description: '攻击击败敌人后消失', verifyBy: 'manual', verifyParam: '点击攻击按钮' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 250,
      },
    ],
    验证: [
      {
        title: 'TypeScript 类型检查',
        description: '执行 npx tsc --noEmit 确保所有源码类型无错误',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'ts-1', description: 'tsc --noEmit 零错误', verifyBy: 'shell', verifyParam: 'npx tsc --noEmit' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
      {
        title: '引擎单元测试',
        description: '运行 vitest 验证 DungeonEngine 核心逻辑',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'test-1', description: '10 项引擎单元测试全部通过', verifyBy: 'shell', verifyParam: 'npx vitest run' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
      {
        title: 'dev server 启动验证',
        description: '启动 Vite dev server，验证页面无编译错误且可访问',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'dev-1', description: 'npm run dev 启动成功且页面可访问', verifyBy: 'shell', verifyParam: 'npm run dev -- --host 0.0.0.0' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** 关卡生成模板 */
const LEVEL_GEN_TEMPLATE: GameTemplate = {
  gameType: 'level-gen',
  phases: {
    立项: [
      {
        title: 'level-gen',
        description: '关卡生成引擎初始化：实现 BSP/CellularAutomata/RandomWalk/WFC 四种算法、关卡数据模型、合法性校验',
        directoryStructure: ['src/level-gen/', 'tests/'],
        interfaceContracts: [
          { name: 'generateBSPDungeon', signature: '(params: BSPParams) => { rooms: Room[]; corridors: Corridor[] }', params: [{ name: 'params', type: 'BSPParams', required: true, description: 'BSP 分割参数' }], returns: '{ rooms, corridors }', purpose: '二叉树空间分割生成地下城' },
          { name: 'generateCaveMap', signature: '(params: CAParams) => TileType[][]', params: [{ name: 'params', type: 'CAParams', required: true, description: '元胞自动机参数' }], returns: 'TileType[][]', purpose: '元胞自动机生成洞穴' },
          { name: 'generateRandomWalk', signature: '(params: RandomWalkParams) => TileType[][]', params: [{ name: 'params', type: 'RandomWalkParams', required: true, description: '随机游走参数' }], returns: 'TileType[][]', purpose: '随机游走生成自然洞穴' },
          { name: 'generateWFC', signature: '(params: WFCParams) => TileID[][]', params: [{ name: 'params', type: 'WFCParams', required: true, description: 'WFC 参数含 tileset' }], returns: 'TileID[][]', purpose: 'Wave Function Collapse 生成' },
          { name: 'validateLevel', signature: '(level: GeneratedLevel) => LevelValidationResult', params: [{ name: 'level', type: 'GeneratedLevel', required: true, description: '生成的关卡对象' }], returns: 'LevelValidationResult', purpose: '校验关卡合法性（连通性等）' },
        ],
        dataModels: [
          { name: 'Room', fields: [
            { name: 'x', type: 'number', nullable: false, description: '左上角 x' },
            { name: 'y', type: 'number', nullable: false, description: '左上角 y' },
            { name: 'width', type: 'number', nullable: false, description: '宽度' },
            { name: 'height', type: 'number', nullable: false, description: '高度' },
            { name: 'id', type: 'number', nullable: false, description: '房间 ID' },
            { name: 'type', type: 'string', nullable: false, description: '房间类型' },
          ], description: 'BSP 房间' },
          { name: 'Corridor', fields: [
            { name: 'path', type: '{ x: number; y: number }[]', nullable: false, description: '走廊路径点' },
          ], description: 'BSP 走廊' },
          { name: 'GeneratedLevel', fields: [
            { name: 'meta', type: 'object', nullable: false, description: '元信息' },
            { name: 'data', type: 'union', nullable: false, description: '算法输出联合类型' },
          ], description: '统一关卡输出' },
        ],
        acceptanceCriteria: [
          { id: 'lg-1', description: '4 种算法均可独立运行并输出正确结构', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/level-gen.test.ts' },
          { id: 'lg-2', description: 'TypeScript 编译零报错', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
          { id: 'lg-3', description: '每种算法 5+ 测试用例全绿', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/level-gen.test.ts' },
          { id: 'lg-4', description: 'validateLevel 可检测非法关卡', verifyBy: 'unit-test', verifyParam: 'test: validateLevel rejection' },
          { id: 'lg-5', description: 'code-generator 可生成 TS / GDScript / JSON 关卡代码', verifyBy: 'file-exists', verifyParam: 'src/level-gen/engine-integration.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 0,
      },
    ],
    原型: [],
    生产: [],
    验证: [
      {
        title: '关卡生成单元测试',
        description: '运行 vitest 验证所有 4 种算法生成结果的结构正确性、参数边界、输出格式',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'test-1', description: '所有算法测试用例全部通过', verifyBy: 'shell', verifyParam: 'npx vitest run tests/level-gen.test.ts' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** 刷宝 ARPG 品类模板（2D 像素风格优先） */
const LOOT_ARPG_TEMPLATE: GameTemplate = {
  gameType: 'loot-arpg',
  phases: {
    立项: [
      {
        title: '项目初始化与类型定义',
        description: '初始化 Godot 4.x 2D 项目结构，定义核心数据模型：装备词缀(Affix)、物品(Item)、装备槽(EquipmentSlot)、掉落表(LootTable)、玩家属性(PlayerStats)',
        directoryStructure: ['data/', 'scripts/', 'scenes/', 'src/numerics/'],
        interfaceContracts: [
          { name: 'Affix.generate', signature: '(tier: RarityTier) => Affix', params: [{ name: 'tier', type: 'RarityTier', required: true, description: '稀有度等级' }], returns: 'Affix', purpose: '根据稀有度生成随机词缀' },
          { name: 'LootTable.roll', signature: '(count?: number) => LootResult[]', params: [{ name: 'count', type: 'number', required: false, description: '掉落数量' }], returns: 'LootResult[]', purpose: '加权随机掉落' },
          { name: 'Equipment.equip', signature: '(item: Equipment) => boolean', params: [{ name: 'item', type: 'Equipment', required: true, description: '要装备的物品' }], returns: 'boolean', purpose: '装备物品到对应槽位' },
        ],
        dataModels: [
          { name: 'Affix', fields: [
            { name: 'id', type: 'string', nullable: false, description: '词缀唯一 ID' },
            { name: 'stat', type: 'string', nullable: false, description: '影响的属性名（如 attack_power）' },
            { name: 'value', type: 'number', nullable: false, description: '加成数值' },
            { name: 'tier', type: 'RarityTier', nullable: false, description: '词缀稀有度' },
            { name: 'label', type: 'string', nullable: false, description: '词缀展示名（如"屠龙者之"）' },
          ], description: '装备词缀定义' },
          { name: 'Equipment', fields: [
            { name: 'id', type: 'string', nullable: false, description: '装备唯一 ID' },
            { name: 'slot', type: 'EquipmentSlot', nullable: false, description: '装备槽位' },
            { name: 'baseName', type: 'string', nullable: false, description: '基础名称' },
            { name: 'rarity', type: 'RarityTier', nullable: false, description: '稀有度' },
            { name: 'affixes', type: 'Affix[]', nullable: false, description: '词缀列表' },
            { name: 'baseStats', type: 'Record<string, number>', nullable: false, description: '基础属性' },
          ], description: '装备物品定义' },
          { name: 'PlayerStats', fields: [
            { name: 'hp', type: 'number', nullable: false, description: '生命值' },
            { name: 'maxHp', type: 'number', nullable: false, description: '最大生命值' },
            { name: 'attackPower', type: 'number', nullable: false, description: '攻击力' },
            { name: 'defense', type: 'number', nullable: false, description: '防御力' },
            { name: 'critRate', type: 'number', nullable: false, description: '暴击率 (0-1)' },
            { name: 'critDamage', type: 'number', nullable: false, description: '暴击倍率' },
            { name: 'moveSpeed', type: 'number', nullable: false, description: '移动速度' },
            { name: 'attackSpeed', type: 'number', nullable: false, description: '攻击速度' },
          ], description: '玩家属性（基础值 + 装备加成）' },
        ],
        acceptanceCriteria: [
          { id: 'la-1-1', description: 'Affix 类型定义完整（5 字段）', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
          { id: 'la-1-2', description: 'LootTable 类型定义含加权随机逻辑', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
          { id: 'la-1-3', description: 'data/items.json 含至少 20 件基础装备', verifyBy: 'file-exists', verifyParam: 'data/items.json' },
          { id: 'la-1-4', description: 'data/affixes.json 含至少 30 个词缀（5 种稀有度各 6 个）', verifyBy: 'file-exists', verifyParam: 'data/affixes.json' },
          { id: 'la-1-5', description: 'PlayerStats 完整含 8 个属性字段', verifyBy: 'unit-test', verifyParam: 'test: player stats model' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 500,
      },
      {
        title: '战斗系统核心',
        description: '实现 CombatController（攻击判定/伤害计算/暴击判定/受击反馈）、Enemy 基类（HP/AI 状态机/死亡掉落）、EnemySpawner（波次生成/难度曲线）',
        directoryStructure: ['scripts/', 'scenes/'],
        interfaceContracts: [
          { name: 'CombatController.attack', signature: '(attacker: Stats, defender: Stats, affixes: Affix[]) => DamageResult', params: [{ name: 'attacker', type: 'Stats', required: true, description: '攻击方属性' }, { name: 'defender', type: 'Stats', required: true, description: '防御方属性' }, { name: 'affixes', type: 'Affix[]', required: true, description: '攻击方装备词缀' }], returns: 'DamageResult', purpose: '计算最终伤害（含攻防/暴击/词缀修正）' },
          { name: 'Enemy.onDeath', signature: '() => void', params: [], returns: 'void', purpose: '死亡时触发掉落并销毁自身' },
          { name: 'EnemySpawner.spawnWave', signature: '(wave: number) => Enemy[]', params: [{ name: 'wave', type: 'number', required: true, description: '波次数' }], returns: 'Enemy[]', purpose: '按波次生成敌人（数量/类型/属性递增）' },
        ],
        dataModels: [
          { name: 'DamageResult', fields: [
            { name: 'baseDamage', type: 'number', nullable: false, description: '基础伤害' },
            { name: 'finalDamage', type: 'number', nullable: false, description: '最终伤害（经所有修正）' },
            { name: 'isCrit', type: 'boolean', nullable: false, description: '是否暴击' },
            { name: 'affixBonuses', type: 'Record<string, number>', nullable: false, description: '词缀加成明细' },
          ], description: '伤害计算结果' },
          { name: 'EnemyConfig', fields: [
            { name: 'id', type: 'string', nullable: false, description: '敌人 ID' },
            { name: 'hp', type: 'number', nullable: false, description: '生命值' },
            { name: 'damage', type: 'number', nullable: false, description: '基础伤害' },
            { name: 'defense', type: 'number', nullable: false, description: '防御力' },
            { name: 'speed', type: 'number', nullable: false, description: '移动速度' },
            { name: 'lootTableId', type: 'string', nullable: false, description: '关联掉落表 ID' },
            { name: 'xpReward', type: 'number', nullable: false, description: '经验奖励' },
          ], description: '敌人配置' },
        ],
        acceptanceCriteria: [
          { id: 'la-2-1', description: 'CombatController 伤害计算含攻防/暴击/词缀三步修正', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/combat.test.ts' },
          { id: 'la-2-2', description: 'Enemy 状态机 4 态（idle/chase/attack/death）可用', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/combat.test.ts' },
          { id: 'la-2-3', description: 'EnemySpawner 波次生成（wave 1→5 数量翻倍 + 属性递增）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/combat.test.ts' },
          { id: 'la-2-4', description: 'DamageResult 含 affixBonuses 明细', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/combat.test.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 600,
      },
      {
        title: '掉落与词缀系统',
        description: '实现 LootTable（加权随机/保底掉落）、AffixSystem（词缀池/稀有度权重/生成/冲突检测/去重）、DropPopup（掉落弹窗/HUD 反馈）',
        directoryStructure: ['scripts/', 'scenes/'],
        interfaceContracts: [
          { name: 'LootTable.roll', signature: '(count: number, luckBonus?: number) => LootResult[]', params: [{ name: 'count', type: 'number', required: true, description: '掉落数量' }, { name: 'luckBonus', type: 'number', required: false, description: '幸运值加成' }], returns: 'LootResult[]', purpose: '加权随机掉落（幸运值影响稀有度概率）' },
          { name: 'LootTable.getPityDrop', signature: '(consecutiveBadLuck: number) => LootResult', params: [{ name: 'consecutiveBadLuck', type: 'number', required: true, description: '连续低品质掉落次数' }], returns: 'LootResult', purpose: '保底掉落（连续 N 次低品质后强制至少 Rare）' },
          { name: 'AffixSystem.generateAffixes', signature: '(base: Equipment, count: number) => Affix[]', params: [{ name: 'base', type: 'Equipment', required: true, description: '基础装备' }, { name: 'count', type: 'number', required: true, description: '词缀数量（受稀有度影响）' }], returns: 'Affix[]', purpose: '为装备生成随机词缀（无冲突）' },
          { name: 'AffixSystem.checkConflict', signature: '(existing: Affix[], candidate: Affix) => boolean', params: [{ name: 'existing', type: 'Affix[]', required: true, description: '已有词缀' }, { name: 'candidate', type: 'Affix', required: true, description: '候选词缀' }], returns: 'boolean', purpose: '检查词缀是否与已有词缀冲突' },
        ],
        dataModels: [
          { name: 'LootResult', fields: [
            { name: 'equipment', type: 'Equipment', nullable: false, description: '掉落的装备' },
            { name: 'rarity', type: 'RarityTier', nullable: false, description: '稀有度' },
            { name: 'isPity', type: 'boolean', nullable: false, description: '是否保底触发' },
          ], description: '掉落结果' },
          { name: 'DropPool', fields: [
            { name: 'commonWeight', type: 'number', nullable: false, description: '普通掉落权重' },
            { name: 'uncommonWeight', type: 'number', nullable: false, description: '非凡掉落权重' },
            { name: 'rareWeight', type: 'number', nullable: false, description: '稀有掉落权重' },
            { name: 'epicWeight', type: 'number', nullable: false, description: '史诗掉落权重' },
            { name: 'legendaryWeight', type: 'number', nullable: false, description: '传说掉落权重' },
            { name: 'pityThreshold', type: 'number', nullable: false, description: '保底阈值（连续低品质次数）' },
          ], description: '掉落池配置' },
        ],
        acceptanceCriteria: [
          { id: 'la-3-1', description: 'LootTable 加权随机掉落 1000 次模拟偏差 < 5%', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/loot.test.ts' },
          { id: 'la-3-2', description: '保底机制：连续 10 次 common 后第 11 次至少 rare', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/loot.test.ts' },
          { id: 'la-3-3', description: 'Affix 生成无冲突（同属性词缀不重复）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/affix.test.ts' },
          { id: 'la-3-4', description: 'legnedary 装备固定 5 词缀，epic 4 词缀，rare 3 词缀', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/affix.test.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 500,
      },
    ],
    原型: [
      {
        title: '背包与装备系统',
        description: '实现 Inventory（背包网格/容量/排序/堆叠）、Equipment（装备槽/穿戴/卸下/属性叠加）、装备比较面板（当前 vs 候选）',
        directoryStructure: ['scripts/', 'scenes/'],
        interfaceContracts: [
          { name: 'Inventory.addItem', signature: '(item: Equipment) => boolean', params: [{ name: 'item', type: 'Equipment', required: true, description: '要添加的装备' }], returns: 'boolean', purpose: '将装备加入背包（容量满返回 false）' },
          { name: 'Inventory.removeItem', signature: '(itemId: string) => Equipment | null', params: [{ name: 'itemId', type: 'string', required: true, description: '装备 ID' }], returns: 'Equipment | null', purpose: '从背包移除装备' },
          { name: 'Inventory.sortBy', signature: '(key: SortKey) => void', params: [{ name: 'key', type: 'SortKey', required: true, description: '排序键（rarity/slot/name/time）' }], returns: 'void', purpose: '按指定键排序背包' },
          { name: 'Equipment.compareWith', signature: '(equipped: Equipment, candidate: Equipment) => CompareResult', params: [{ name: 'equipped', type: 'Equipment', required: true, description: '当前装备' }, { name: 'candidate', type: 'Equipment', required: true, description: '候选装备' }], returns: 'CompareResult', purpose: '比较两件装备并给出升级/降级/持平判断' },
          { name: 'Equipment.recalcStats', signature: '() => PlayerStats', params: [], returns: 'PlayerStats', purpose: '重算当前所有装备槽的总属性' },
        ],
        dataModels: [
          { name: 'EquipmentSlot', fields: [
            { name: 'slotType', type: 'string', nullable: false, description: '槽位类型（weapon/armor/helmet/ring/amulet/boots/gloves）' },
            { name: 'equipped', type: 'Equipment | null', nullable: true, description: '当前装备物品' },
          ], description: '装备槽位' },
          { name: 'CompareResult', fields: [
            { name: 'verdict', type: 'string', nullable: false, description: '比较结论（upgrade/downgrade/sidegrade/equal）' },
            { name: 'diffs', type: 'Record<string, number>', nullable: false, description: '各属性差值（正数=提升）' },
          ], description: '装备比较结果' },
        ],
        acceptanceCriteria: [
          { id: 'la-4-1', description: '背包容量上限 50，满后 addItem 返回 false', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/inventory.test.ts' },
          { id: 'la-4-2', description: 'Equipment 穿戴后 recalcStats 包含词缀加成', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/equipment.test.ts' },
          { id: 'la-4-3', description: 'CompareResult 能区分 upgrade/downgrade/sidegrade', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/equipment.test.ts' },
          { id: 'la-4-4', description: 'Inventory.sortBy rarity 排序验证（legendary 在最前）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/inventory.test.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 550,
      },
      {
        title: 'HUD 与掉落反馈',
        description: '实现 HUD（HP/MP 条 + 技能栏 + 装备快捷查看）、DropPopup（掉落弹窗/稀有度光柱/拾取动画）、DamageNumber（伤害数字飘出）、迷你地图',
        directoryStructure: ['scripts/', 'scenes/'],
        interfaceContracts: [
          { name: 'HUD.updateHealth', signature: '(current: number, max: number) => void', params: [{ name: 'current', type: 'number', required: true, description: '当前 HP' }, { name: 'max', type: 'number', required: true, description: '最大 HP' }], returns: 'void', purpose: '更新血条显示' },
          { name: 'HUD.showDropPopup', signature: '(loot: LootResult, sourcePos: Vector2) => void', params: [{ name: 'loot', type: 'LootResult', required: true, description: '掉落结果' }, { name: 'sourcePos', type: 'Vector2', required: true, description: '掉落来源位置' }], returns: 'void', purpose: '显示掉落弹窗并飞向背包' },
          { name: 'DamageNumber.show', signature: '(amount: number, position: Vector2, isCrit: boolean) => void', params: [{ name: 'amount', type: 'number', required: true, description: '伤害数值' }, { name: 'position', type: 'Vector2', required: true, description: '世界坐标' }, { name: 'isCrit', type: 'boolean', required: true, description: '是否暴击' }], returns: 'void', purpose: '显示伤害数字' },
          { name: 'Minimap.update', signature: '(playerPos: Vector2) => void', params: [{ name: 'playerPos', type: 'Vector2', required: true, description: '玩家位置' }], returns: 'void', purpose: '更新迷你地图' },
        ],
        dataModels: [
          { name: 'HUDState', fields: [
            { name: 'hpPercent', type: 'number', nullable: false, description: 'HP 百分比 (0-1)' },
            { name: 'activeSkills', type: 'SkillSlot[]', nullable: false, description: '当前可用技能' },
            { name: 'nearbyEnemies', type: 'number', nullable: false, description: '附近敌人数' },
          ], description: 'HUD 显示状态' },
        ],
        acceptanceCriteria: [
          { id: 'la-5-1', description: 'HUD 血条实时响应装备变更导致的 maxHp 变化', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/hud.test.ts' },
          { id: 'la-5-2', description: 'DropPopup 根据稀有度显示不同光柱颜色（5 级）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/hud.test.ts' },
          { id: 'la-5-3', description: 'DamageNumber 暴击时字号 +50% 且颜色变为橙红', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/hud.test.ts' },
          { id: 'la-5-4', description: 'Minimap 跟随玩家位置更新', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/hud.test.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 500,
      },
      {
        title: 'PlayerController 2D像素移动与攻击',
        description: '实现 PlayerController2D（CharacterBody2D 移动/闪避/攻击动画）、PixelCamera（像素完美相机/整数缩放/视差滚动）、InputMap（键盘+手柄输入映射）',
        directoryStructure: ['scripts/', 'scenes/'],
        interfaceContracts: [
          { name: 'PlayerController2D._physics_process', signature: '(delta: float) => void', params: [{ name: 'delta', type: 'float', required: true, description: '物理帧间隔' }], returns: 'void', purpose: '处理移动、闪避、攻击冷却' },
          { name: 'PlayerController2D.dash', signature: '() => void', params: [], returns: 'void', purpose: '闪避（无敌帧 + 快速位移）' },
          { name: 'PixelCamera.snapToPixel', signature: '(pos: Vector2) => Vector2', params: [{ name: 'pos', type: 'Vector2', required: true, description: '世界坐标' }], returns: 'Vector2', purpose: '将坐标对齐到像素网格' },
        ],
        dataModels: [
          { name: 'PlayerConfig', fields: [
            { name: 'walkSpeed', type: 'float', nullable: false, description: '走路速度' },
            { name: 'dashSpeed', type: 'float', nullable: false, description: '闪避速度' },
            { name: 'dashCooldown', type: 'float', nullable: false, description: '闪避冷却秒数' },
            { name: 'dashInvincibleMs', type: 'float', nullable: false, description: '闪避无敌毫秒' },
            { name: 'pixelsPerUnit', type: 'int', nullable: false, description: '像素密度（如 16）' },
          ], description: '玩家控制器配置' },
        ],
        acceptanceCriteria: [
          { id: 'la-6-1', description: 'WASD/方向键/手柄左摇杆均可控制移动', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/player.test.ts' },
          { id: 'la-6-2', description: '闪避有无敌帧（dashInvincibleMs 内不受伤害）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/player.test.ts' },
          { id: 'la-6-3', description: 'PixelCamera snapToPixel 输出坐标为整数', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/player.test.ts' },
          { id: 'la-6-4', description: '攻击动画与伤害判定帧对齐', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/player.test.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 450,
      },
    ],
    生产: [],
    验证: [
      {
        title: '刷宝 ARPG 集成测试',
        description: '运行完整游戏循环测试：移动→战斗→掉落→拾取→装备替换→属性叠加→进入下一波。验证所有核心系统串联工作。',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'la-int-1', description: 'TypeScript 编译零报错', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
          { id: 'la-int-2', description: '战斗测试用例全绿（伤害计算/暴击/词缀/无敌帧）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/combat.test.ts' },
          { id: 'la-int-3', description: '掉落测试用例全绿（加权随机/保底/稀有度分布）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/loot.test.ts' },
          { id: 'la-int-4', description: '词缀测试用例全绿（生成/冲突检测/稀有度数量）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/affix.test.ts' },
          { id: 'la-int-5', description: '背包测试用例全绿（增删/排序/容量/装备比较）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/inventory.test.ts' },
          { id: 'la-int-6', description: '装备测试用例全绿（穿戴/卸下/属性叠加）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/equipment.test.ts' },
          { id: 'la-int-7', description: 'HUD 测试用例全绿（血条/掉落弹窗/伤害数字/迷你地图）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/hud.test.ts' },
          { id: 'la-int-8', description: 'Player 测试用例全绿（移动/闪避/像素相机）', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/player.test.ts' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** Godot 引擎模板 */
const GODOT_GAME_TEMPLATE: GameTemplate = {
  gameType: 'godot',
  phases: {
    立项: [
      {
        title: 'godot-2d',
        description: 'Godot 4.x 2D 项目初始化：生成主场景脚本（extends Node2D）、Player2D 移动脚本（CharacterBody2D）、EventBus Autoload、project.godot 配置文件',
        directoryStructure: ['src/game/', 'src/game/global/'],
        interfaceContracts: [
          { name: 'Main._ready', signature: '() => void', params: [], returns: 'void', purpose: '初始化相机、TileMap、玩家、HUD 并连接信号' },
          { name: 'Main._process', signature: '(delta: float) => void', params: [{ name: 'delta', type: 'float', required: true, description: '帧间隔秒数' }], returns: 'void', purpose: '每帧更新 HUD 和游戏状态' },
          { name: 'Player2D._physics_process', signature: '(delta: float) => void', params: [{ name: 'delta', type: 'float', required: true, description: '物理帧间隔' }], returns: 'void', purpose: '处理重力、输入、移动和动画' },
        ],
        dataModels: [
          { name: 'PlayerState', fields: [
            { name: 'speed', type: 'float', nullable: false, description: '移动速度' },
            { name: 'jump_velocity', type: 'float', nullable: false, description: '跳跃速度' },
            { name: 'is_dashing', type: 'bool', nullable: false, description: '是否正在冲刺' },
          ], description: '玩家运行时状态' },
        ],
        acceptanceCriteria: [
          { id: 'gd2d-1', description: 'Main.gd 存在且 extends Node2D', verifyBy: 'file-exists', verifyParam: 'src/game/Main.gd' },
          { id: 'gd2d-2', description: 'player.gd 含 CharacterBody2D 移动逻辑', verifyBy: 'file-exists', verifyParam: 'src/game/player.gd' },
          { id: 'gd2d-3', description: 'event_bus.gd 定义 10 个以上 signal', verifyBy: 'file-exists', verifyParam: 'src/game/global/event_bus.gd' },
          { id: 'gd2d-4', description: 'project.godot 含 Autoload 配置和 2D 渲染设置', verifyBy: 'file-exists', verifyParam: 'project.godot' },
          { id: 'gd2d-5', description: 'project.godot rendering_method=forward_plus', verifyBy: 'unit-test', verifyParam: 'test: project.godot structure' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 280,
      },
      {
        title: 'godot-3d',
        description: 'Godot 4.x 3D 项目初始化：生成主场景脚本（extends Node3D）、Player3D 移动脚本（CharacterBody3D + Camera3D 第三人称跟随）、EventBus3D Autoload、project.godot 配置（含 3D 渲染设置）',
        directoryStructure: ['src/game/', 'src/game/global/'],
        interfaceContracts: [
          { name: 'Main3D._ready', signature: '() => void', params: [], returns: 'void', purpose: '初始化相机、光照、玩家、HUD 并连接信号' },
          { name: 'Main3D._physics_process', signature: '(delta: float) => void', params: [{ name: 'delta', type: 'float', required: true, description: '物理帧间隔' }], returns: 'void', purpose: '物理相关逐帧逻辑' },
          { name: 'Player3D._physics_process', signature: '(delta: float) => void', params: [{ name: 'delta', type: 'float', required: true, description: '物理帧间隔' }], returns: 'void', purpose: '处理重力、WASD 移动、跳跃、冲刺' },
          { name: 'Player3D._input', signature: '(event: InputEvent) => void', params: [{ name: 'event', type: 'InputEvent', required: true, description: '输入事件' }], returns: 'void', purpose: '鼠标视角旋转' },
        ],
        dataModels: [
          { name: 'Player3DState', fields: [
            { name: 'walk_speed', type: 'float', nullable: false, description: '走路速度' },
            { name: 'sprint_speed', type: 'float', nullable: false, description: '冲刺速度' },
            { name: 'jump_velocity', type: 'float', nullable: false, description: '跳跃速度' },
            { name: 'mouse_sensitivity', type: 'float', nullable: false, description: '鼠标灵敏度' },
          ], description: '3D 玩家配置' },
        ],
        acceptanceCriteria: [
          { id: 'gd3d-1', description: 'Main3D.gd 存在且 extends Node3D', verifyBy: 'file-exists', verifyParam: 'src/game/Main3D.gd' },
          { id: 'gd3d-2', description: 'player_3d.gd 含 CharacterBody3D + Camera3D 逻辑', verifyBy: 'file-exists', verifyParam: 'src/game/player_3d.gd' },
          { id: 'gd3d-3', description: 'event_bus_3d.gd 定义 8 个以上 signal', verifyBy: 'file-exists', verifyParam: 'src/game/global/event_bus_3d.gd' },
          { id: 'gd3d-4', description: 'project.godot 含 3D 渲染设置（msaa_3d/screen_space_aa）', verifyBy: 'file-exists', verifyParam: 'project.godot' },
          { id: 'gd3d-5', description: 'project.godot 含 WASD 输入映射', verifyBy: 'unit-test', verifyParam: 'test: project.godot inputs' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 300,
      },
    ],
    原型: [],
    验证: [
      {
        title: 'GDScript 语法验证',
        description: '验证生成的 .gd 文件基本语法结构正确（extends / func / signal 关键字、缩进）',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'syntax-1', description: '所有 .gd 文件含 extends 声明', verifyBy: 'unit-test', verifyParam: 'test: GDScript syntax' },
          { id: 'syntax-2', description: 'project.godot 含 config_version=5', verifyBy: 'unit-test', verifyParam: 'test: project.godot structure' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** 数值系统模板 */
const NUMERICS_TEMPLATE: GameTemplate = {
  gameType: 'numerics',
  phases: {
    立项: [
      {
        title: 'numerics',
        description: '数值系统初始化：成长曲线（linear/exponential/polynomial/logistic/piecewise）+ 掉落系统（加权随机/保底）+ 抽卡（软硬保底）+ 战斗数值 + 经济平衡 + CSV 导出',
        directoryStructure: ['src/numerics/', 'tests/'],
        interfaceContracts: [
          { name: 'GrowthCurve.linear', signature: '(base: number, slope: number, level: number) => number', params: [{ name: 'base', type: 'number', required: true, description: '基础值' }, { name: 'slope', type: 'number', required: true, description: '斜率' }, { name: 'level', type: 'number', required: true, description: '等级' }], returns: 'number', purpose: '线性成长曲线' },
          { name: 'GrowthCurve.exponential', signature: '(base: number, factor: number, level: number) => number', params: [{ name: 'base', type: 'number', required: true, description: '基础值' }, { name: 'factor', type: 'number', required: true, description: '增长因子' }, { name: 'level', type: 'number', required: true, description: '等级' }], returns: 'number', purpose: '指数成长曲线 base * factor^level' },
          { name: 'GrowthCurve.polynomial', signature: '(base: number, coeff: number, degree: number, level: number) => number', params: [{ name: 'base', type: 'number', required: true, description: '基础值' }, { name: 'coeff', type: 'number', required: true, description: '系数' }, { name: 'degree', type: 'number', required: true, description: '幂次' }, { name: 'level', type: 'number', required: true, description: '等级' }], returns: 'number', purpose: '多项式成长曲线' },
          { name: 'GrowthCurve.logistic', signature: '(max: number, mid: number, steep: number, level: number) => number', params: [{ name: 'max', type: 'number', required: true, description: '最大值' }, { name: 'mid', type: 'number', required: true, description: '中点等级' }, { name: 'steep', type: 'number', required: true, description: '陡峭度' }, { name: 'level', type: 'number', required: true, description: '等级' }], returns: 'number', purpose: 'S 型 logistic 曲线' },
          { name: 'GrowthCurve.inverseCurve', signature: '(fn: (lv: number) => number, target: number, range: [number, number], tol?: number) => number | null', params: [{ name: 'fn', type: 'function', required: true, description: '正向曲线函数' }, { name: 'target', type: 'number', required: true, description: '目标值' }, { name: 'range', type: '[number, number]', required: true, description: '搜索范围' }], returns: 'number | null', purpose: '反查目标值所需等级' },
          { name: 'LootTable.roll', signature: '(count?: number, withReplacement?: boolean) => { item: T; quantity: number }[]', params: [], returns: '{ item, quantity }[]', purpose: '加权随机掉落' },
          { name: 'GachaBanner.pull', signature: '(count?: number) => GachaResult[]', params: [{ name: 'count', type: 'number', required: false, description: '抽卡次数' }], returns: 'GachaResult[]', purpose: '执行抽卡含软硬保底' },
          { name: 'CombatMath.damageReduction', signature: '(armor: number, formula: ArmorFormula, params?: number[]) => number', params: [{ name: 'armor', type: 'number', required: true, description: '护甲值' }, { name: 'formula', type: 'ArmorFormula', required: true, description: '减伤公式类型' }], returns: 'number', purpose: '护甲减伤率' },
          { name: 'Economy.timeToBuy', signature: '(cost: number, incomeRate: number) => number', params: [{ name: 'cost', type: 'number', required: true, description: '购买成本' }, { name: 'incomeRate', type: 'number', required: true, description: '收入速率' }], returns: 'number', purpose: '购买时间预估' },
        ],
        dataModels: [
          { name: 'PiecewiseSegment', fields: [
            { name: 'from', type: 'number', nullable: false, description: '起始等级' },
            { name: 'to', type: 'number', nullable: false, description: '结束等级' },
            { name: 'formula', type: 'string', nullable: false, description: '公式类型' },
            { name: 'params', type: 'number[]', nullable: false, description: '公式参数' },
          ], description: '分段曲线片段' },
          { name: 'GachaResult', fields: [
            { name: 'rarity', type: 'string', nullable: false, description: '稀有度' },
            { name: 'pityTriggered', type: 'boolean', nullable: false, description: '是否保底触发' },
            { name: 'newCard', type: 'boolean', nullable: false, description: '是否新卡' },
          ], description: '抽卡结果' },
        ],
        acceptanceCriteria: [
          { id: 'nu-1', description: '成长曲线：6 种公式 + 反查全部可用', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/numerics.test.ts' },
          { id: 'nu-2', description: '掉落表：加权/保底/放回不放回全部可用', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/numerics.test.ts' },
          { id: 'nu-3', description: '抽卡：软硬保底概率校准合理', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/numerics.test.ts' },
          { id: 'nu-4', description: '战斗数值：减伤/DPS/有效HP/战力评分全部可用', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/numerics.test.ts' },
          { id: 'nu-5', description: '经济平衡：购买时间/资源消耗/通胀调整全部可用', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/numerics.test.ts' },
          { id: 'nu-6', description: 'CSV 导出：成长表/掉落分布/抽卡统计均正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/numerics.test.ts' },
          { id: 'nu-7', description: 'TypeScript 编译零报错', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
          { id: 'nu-8', description: '每种算法至少 3 个测试用例全绿', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/numerics.test.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 0,
      },
    ],
    原型: [],
    生产: [],
    验证: [
      {
        title: '数值系统单元测试',
        description: '运行 vitest 验证成长曲线、掉落表、抽卡、战斗数值、经济平衡、导出函数全部正确',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'nu-test-1', description: '所有 30+ 测试用例全绿', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/numerics.test.ts' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** Unity 引擎模板 */
const UNITY_GAME_TEMPLATE: GameTemplate = {
  gameType: 'unity',
  phases: {
    立项: [
      {
        title: 'unity-2d',
        description: 'Unity 2D 项目初始化：生成 PlayerController2D（Input System + Rigidbody2D 移动跳跃）、GameManager（单例 + 场景加载 + 分数管理）、ObjectPool<T>（泛型对象池）、EventBus（UnityEvent 事件总线）',
        directoryStructure: ['src/game/'],
        interfaceContracts: [
          { name: 'PlayerController2D.OnMove', signature: '(InputAction.CallbackContext) => void', params: [{ name: 'context', type: 'InputAction.CallbackContext', required: true, description: '输入回调上下文' }], returns: 'void', purpose: 'Input System Move 回调' },
          { name: 'PlayerController2D.OnJump', signature: '(InputAction.CallbackContext) => void', params: [{ name: 'context', type: 'InputAction.CallbackContext', required: true, description: '输入回调上下文' }], returns: 'void', purpose: 'Input System Jump 回调' },
          { name: 'PlayerController2D.FixedUpdate', signature: '() => void', params: [], returns: 'void', purpose: '物理帧移动 + 重力修正' },
          { name: 'GameManager.AddScore', signature: '(int points) => void', params: [{ name: 'points', type: 'int', required: true, description: '分数增量' }], returns: 'void', purpose: '增加分数并触发 OnScoreChanged' },
          { name: 'ObjectPool<T>.Get', signature: '() => T', params: [], returns: 'T', purpose: '从池中获取对象' },
          { name: 'ObjectPool<T>.Return', signature: '(T obj) => void', params: [{ name: 'obj', type: 'T', required: true, description: '回收对象' }], returns: 'void', purpose: '将对象回收到池中' },
        ],
        dataModels: [
          { name: 'PlayerConfig', fields: [
            { name: 'moveSpeed', type: 'float', nullable: false, description: '移动速度' },
            { name: 'jumpForce', type: 'float', nullable: false, description: '跳跃力度' },
            { name: 'coyoteTime', type: 'float', nullable: false, description: '土狼时间' },
          ], description: '2D 玩家移动配置' },
        ],
        acceptanceCriteria: [
          { id: 'u2d-1', description: 'PlayerController2D.cs 存在且继承 MonoBehaviour', verifyBy: 'file-exists', verifyParam: 'src/game/PlayerController2D.cs' },
          { id: 'u2d-2', description: 'PlayerController2D 含 OnMove/OnJump/FixedUpdate 方法', verifyBy: 'unit-test', verifyParam: 'test: unity-2d methods' },
          { id: 'u2d-3', description: 'GameManager.cs 为单例模式（Instance + Awake）', verifyBy: 'file-exists', verifyParam: 'src/game/GameManager.cs' },
          { id: 'u2d-4', description: 'ObjectPool.cs 为泛型类 ObjectPool<T> where T : Component', verifyBy: 'file-exists', verifyParam: 'src/game/ObjectPool.cs' },
          { id: 'u2d-5', description: 'EventBus.cs 含 8 个以上 UnityEvent', verifyBy: 'file-exists', verifyParam: 'src/game/EventBus.cs' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 350,
      },
      {
        title: 'unity-3d',
        description: 'Unity 3D 项目初始化：生成 PlayerController3D（CharacterController + 鼠标视角）、CameraFollow（第三人称相机跟随 + 碰撞检测）、GameManager3D（单例 + 场景加载 + 分数管理）、ObjectPool<T>（泛型对象池）、EventBus3D（UnityEvent 事件总线）',
        directoryStructure: ['src/game/'],
        interfaceContracts: [
          { name: 'PlayerController3D.OnMove', signature: '(InputAction.CallbackContext) => void', params: [{ name: 'context', type: 'InputAction.CallbackContext', required: true, description: '输入回调上下文' }], returns: 'void', purpose: 'Input System Move 回调' },
          { name: 'PlayerController3D.OnLook', signature: '(InputAction.CallbackContext) => void', params: [{ name: 'context', type: 'InputAction.CallbackContext', required: true, description: '输入回调上下文' }], returns: 'void', purpose: 'Input System Look 回调（鼠标视角）' },
          { name: 'PlayerController3D.Update', signature: '() => void', params: [], returns: 'void', purpose: '处理视角旋转、重力、移动' },
          { name: 'CameraFollow.LateUpdate', signature: '() => void', params: [], returns: 'void', purpose: '平滑跟随目标 + 碰撞避让' },
          { name: 'GameManager3D.AddScore', signature: '(int points) => void', params: [{ name: 'points', type: 'int', required: true, description: '分数增量' }], returns: 'void', purpose: '增加分数并触发 OnScoreChanged' },
        ],
        dataModels: [
          { name: 'Player3DConfig', fields: [
            { name: 'walkSpeed', type: 'float', nullable: false, description: '走路速度' },
            { name: 'sprintSpeed', type: 'float', nullable: false, description: '冲刺速度' },
            { name: 'jumpHeight', type: 'float', nullable: false, description: '跳跃高度' },
            { name: 'mouseSensitivity', type: 'float', nullable: false, description: '鼠标灵敏度' },
          ], description: '3D 玩家配置' },
        ],
        acceptanceCriteria: [
          { id: 'u3d-1', description: 'PlayerController3D.cs 存在且使用 CharacterController', verifyBy: 'file-exists', verifyParam: 'src/game/PlayerController3D.cs' },
          { id: 'u3d-2', description: 'CameraFollow.cs 含 LookAt 和碰撞避让逻辑', verifyBy: 'file-exists', verifyParam: 'src/game/CameraFollow.cs' },
          { id: 'u3d-3', description: 'PlayerController3D 含 OnLook + Update 方法', verifyBy: 'unit-test', verifyParam: 'test: unity-3d methods' },
          { id: 'u3d-4', description: 'GameManager3D.cs 为单例模式 + DontDestroyOnLoad', verifyBy: 'file-exists', verifyParam: 'src/game/GameManager3D.cs' },
          { id: 'u3d-5', description: 'EventBus3D.cs 含 6 个以上 UnityEvent', verifyBy: 'file-exists', verifyParam: 'src/game/EventBus3D.cs' },
        ],
        estimatedTools: ['write_file'],
        maxCodeLines: 400,
      },
    ],
    原型: [],
    验证: [
      {
        title: 'C# 语法验证',
        description: '验证生成的 .cs 文件基本语法结构正确（namespace / class / using / FixedUpdate 等关键字）',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'syntax-1', description: '所有 .cs 文件含 namespace 声明', verifyBy: 'unit-test', verifyParam: 'test: C# syntax' },
          { id: 'syntax-2', description: 'MonoBehaviour 脚本含 Awake 或 Start 生命周期', verifyBy: 'unit-test', verifyParam: 'test: C# lifecycle' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** 商业化 monetization 模板 */
const MONETIZATION_TEMPLATE: GameTemplate = {
  gameType: 'monetization',
  phases: {
    立项: [
      {
        title: 'monetization',
        description: '商业化模块初始化：实现商店(StoreCatalog/PurchaseValidator/IAPValidator)、虚拟货币(CurrencyManager)、通行证(BattlePass)、礼包(BundleManager)、广告(AdManager)',
        directoryStructure: ['src/monetization/', 'tests/'],
        interfaceContracts: [
          { name: 'StoreCatalog.addProduct', signature: '(product: Product) => void', params: [{ name: 'product', type: 'Product', required: true, description: '商品定义' }], returns: 'void', purpose: '添加商品到目录' },
          { name: 'StoreCatalog.getProductsByType', signature: '(type: ProductType) => Product[]', params: [{ name: 'type', type: 'ProductType', required: true, description: '商品类型' }], returns: 'Product[]', purpose: '按类型获取商品列表' },
          { name: 'PurchaseValidator.validate', signature: '(product, userId, userLevel, vipLevel, catalog, now?) => { valid, reason? }', params: [{ name: 'product', type: 'Product', required: true, description: '商品' }, { name: 'userId', type: 'string', required: true, description: '用户ID' }, { name: 'userLevel', type: 'number', required: true, description: '用户等级' }, { name: 'vipLevel', type: 'number', required: true, description: 'VIP等级' }, { name: 'catalog', type: 'StoreCatalog', required: true, description: '商品目录' }], returns: '{ valid, reason? }', purpose: '购买前置校验(等级/VIP/限购/限时)' },
          { name: 'IAPValidator.validateReceipt', signature: '(receipt: IAPReceipt, productId: string) => IAPValidationResult', params: [{ name: 'receipt', type: 'IAPReceipt', required: true, description: '票据' }, { name: 'productId', type: 'string', required: true, description: '商品ID' }], returns: 'IAPValidationResult', purpose: '票据校验流程' },
          { name: 'IAPValidator.restorePurchases', signature: '(userId, productIds, productTypes) => string[]', params: [{ name: 'userId', type: 'string', required: true, description: '用户ID' }, { name: 'productIds', type: 'string[]', required: true, description: '商品ID列表' }, { name: 'productTypes', type: 'Map<string,ProductType>', required: true, description: '商品类型映射' }], returns: 'string[]', purpose: '恢复非消耗品和订阅' },
          { name: 'CurrencyManager.earn', signature: '(kind: CurrencyKind, amount: number, source: string) => Transaction', params: [{ name: 'kind', type: 'CurrencyKind', required: true, description: '货币种类' }, { name: 'amount', type: 'number', required: true, description: '数量' }, { name: 'source', type: 'string', required: true, description: '来源' }], returns: 'Transaction', purpose: '获取货币' },
          { name: 'CurrencyManager.spend', signature: '(kind: CurrencyKind, amount: number, reason: string) => Transaction | null', params: [{ name: 'kind', type: 'CurrencyKind', required: true, description: '货币种类' }, { name: 'amount', type: 'number', required: true, description: '数量' }, { name: 'reason', type: 'string', required: true, description: '消费原因' }], returns: 'Transaction | null', purpose: '消费货币(余额不足返回null)' },
          { name: 'CurrencyManager.exchangeSoftToHard', signature: '(softAmount: number) => { success, hardReceived?, error? }', params: [{ name: 'softAmount', type: 'number', required: true, description: '软货币数量' }], returns: '{ success, hardReceived?, error? }', purpose: '软硬货币兑换' },
          { name: 'BattlePass.addXP', signature: '(userId: string, amount: number) => PassProgress', params: [{ name: 'userId', type: 'string', required: true, description: '用户ID' }, { name: 'amount', type: 'number', required: true, description: '经验值' }], returns: 'PassProgress', purpose: '获取经验并升级' },
          { name: 'BattlePass.claimReward', signature: '(userId, track, level) => { success, rewards?, error? }', params: [{ name: 'userId', type: 'string', required: true, description: '用户ID' }, { name: 'track', type: 'PassTrack', required: true, description: 'free或premium' }, { name: 'level', type: 'number', required: true, description: '等级' }], returns: '{ success, rewards?, error? }', purpose: '领取通行证奖励' },
          { name: 'BattlePass.purchasePremium', signature: '(userId) => { success, error? }', params: [{ name: 'userId', type: 'string', required: true, description: '用户ID' }], returns: '{ success, error? }', purpose: '购买Premium通行证' },
          { name: 'BundleManager.getActiveBundles', signature: '(now?) => Bundle[]', params: [{ name: 'now', type: 'number', required: false, description: '时间戳' }], returns: 'Bundle[]', purpose: '获取当前有效礼包(过滤过期/售罄)' },
          { name: 'BundleManager.purchaseBundle', signature: '(bundleId, userId, now?) => { success, bundle?, error? }', params: [{ name: 'bundleId', type: 'string', required: true, description: '礼包ID' }, { name: 'userId', type: 'string', required: true, description: '用户ID' }], returns: '{ success, bundle?, error? }', purpose: '购买礼包(含校验)' },
          { name: 'BundleManager.getTriggeredOffers', signature: '(userId, context) => LimitedTimeOffer[]', params: [{ name: 'userId', type: 'string', required: true, description: '用户ID' }, { name: 'context', type: '{ isFirstLogin, daysSinceLastLogin, now }', required: true, description: '触发上下文' }], returns: 'LimitedTimeOffer[]', purpose: '获取应触发的限时弹窗' },
          { name: 'AdManager.showAd', signature: '(type: AdType, placement: AdPlacement, now?) => AdShowResult', params: [{ name: 'type', type: 'AdType', required: true, description: '广告类型' }, { name: 'placement', type: 'AdPlacement', required: true, description: '展示位置' }], returns: 'AdShowResult', purpose: '展示广告(含频控/上限)' },
          { name: 'AdManager.removeAds', signature: '(purchaseId) => { success, error? }', params: [{ name: 'purchaseId', type: 'string', required: true, description: 'IAP商品ID' }], returns: '{ success, error? }', purpose: '购买去广告' },
        ],
        dataModels: [
          { name: 'Product', fields: [
            { name: 'id', type: 'string', nullable: false, description: '商品ID' },
            { name: 'type', type: 'ProductType', nullable: false, description: 'consumable/non-consumable/subscription' },
            { name: 'priceTier', type: 'PriceTierLevel', nullable: false, description: 'T1-T6价格阶梯' },
            { name: 'currency', type: 'CurrencyType', nullable: false, description: '货币类型' },
            { name: 'displayName', type: 'string', nullable: false, description: '显示名称' },
            { name: 'icon', type: 'string', nullable: false, description: '图标' },
            { name: 'rewards', type: 'Record<string,number>', nullable: false, description: '出货内容映射' },
          ], description: '商品定义' },
          { name: 'SeasonConfig', fields: [
            { name: 'seasonId', type: 'string', nullable: false, description: '赛季ID' },
            { name: 'name', type: 'string', nullable: false, description: '赛季名称' },
            { name: 'theme', type: 'string', nullable: false, description: '主题' },
            { name: 'startTime', type: 'number', nullable: false, description: '开始时间戳' },
            { name: 'endTime', type: 'number', nullable: false, description: '结束时间戳' },
            { name: 'maxLevel', type: 'number', nullable: false, description: '最大等级(30-50)' },
            { name: 'premiumPrice', type: 'number', nullable: false, description: 'Premium价格' },
            { name: 'premiumCurrency', type: "'soft'|'hard'", nullable: false, description: 'Premium购买货币' },
          ], description: '赛季配置' },
          { name: 'Bundle', fields: [
            { name: 'id', type: 'string', nullable: false, description: '礼包ID' },
            { name: 'name', type: 'string', nullable: false, description: '礼包名称' },
            { name: 'products', type: 'string[]', nullable: false, description: '包含商品ID列表' },
            { name: 'discountPercent', type: 'number', nullable: false, description: '折扣百分比0-100' },
            { name: 'originalPrice', type: 'number', nullable: false, description: '原始总价' },
            { name: 'finalPrice', type: 'number', nullable: false, description: '折后价格' },
            { name: 'validUntil', type: 'number', nullable: false, description: '有效期截止时间戳(0永久)' },
            { name: 'purchaseLimit', type: 'number', nullable: false, description: '限购次数(0无限)' },
          ], description: '礼包定义' },
          { name: 'Transaction', fields: [
            { name: 'id', type: 'string', nullable: false, description: '交易ID' },
            { name: 'timestamp', type: 'number', nullable: false, description: '交易时间戳' },
            { name: 'kind', type: 'CurrencyKind', nullable: false, description: '货币种类软/硬' },
            { name: 'amount', type: 'number', nullable: false, description: '交易数量' },
            { name: 'balanceAfter', type: 'number', nullable: false, description: '交易后余额' },
            { name: 'type', type: "'earn'|'spend'", nullable: false, description: '交易类型' },
            { name: 'source', type: 'string', nullable: false, description: 'earn来源/spend原因' },
          ], description: '货币交易记录' },
        ],
        acceptanceCriteria: [
          { id: 'mon-1', description: '商店：商品增删/类型筛选/购买记录 全部可用', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/monetization.test.ts' },
          { id: 'mon-2', description: '购买校验：等级/VIP/限购/限时 四项校验正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/monetization.test.ts' },
          { id: 'mon-3', description: 'IAP：票据校验/签名验证/发货/恢复购买 正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/monetization.test.ts' },
          { id: 'mon-4', description: '货币：获取/消费/兑换/序列化恢复 正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/monetization.test.ts' },
          { id: 'mon-5', description: '通行证：XP升级/双轨奖励/Premium购买 正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/monetization.test.ts' },
          { id: 'mon-6', description: '礼包：有效期过滤/限购/购买/限时弹窗触发 正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/monetization.test.ts' },
          { id: 'mon-7', description: '广告：激励/插屏/横幅/频控/上限/去广告 正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/monetization.test.ts' },
          { id: 'mon-8', description: 'TypeScript 编译零报错', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
          { id: 'mon-9', description: 'code-generator 可生成 monetization 四模块代码', verifyBy: 'file-exists', verifyParam: 'src/monetization/index.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 0,
      },
    ],
    原型: [],
    生产: [],
    验证: [
      {
        title: '商业化单元测试',
        description: '运行 vitest 验证商店/IAP/货币/通行证/礼包/广告所有模块正确',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'test-1', description: '所有测试用例全绿', verifyBy: 'shell', verifyParam: 'npx vitest run tests/monetization.test.ts' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** 联网对战模板 */
const NETWORKING_TEMPLATE: GameTemplate = {
  gameType: 'networking',
  phases: {
    立项: [
      {
        title: 'networking',
        description: '联网对战模块初始化：实现状态同步引擎(StateSync)、客户端预测回滚(ClientPrediction)、插值(Interpolation)、房间匹配(Room/Matchmaking)、消息协议(NetworkMessage/PingManager)',
        directoryStructure: ['src/networking/', 'tests/'],
        interfaceContracts: [
          { name: 'StateSync.createSnapshot', signature: '<T>(state: T, seq: number) => Snapshot<T>', params: [{ name: 'state', type: 'T', required: true, description: '游戏状态' }, { name: 'seq', type: 'number', required: true, description: '单调递增序号' }], returns: 'Snapshot<T>', purpose: '生成状态快照含 checksum' },
          { name: 'StateSync.applySnapshot', signature: '<T>(current: T, snapshot: Snapshot<T>) => T', params: [{ name: 'current', type: 'T', required: true, description: '当前状态' }, { name: 'snapshot', type: 'Snapshot<T>', required: true, description: '服务端快照' }], returns: 'T', purpose: '全量同步应用快照' },
          { name: 'StateSync.deltaCompress', signature: '<T>(prev: T, current: T) => Partial<T>', params: [{ name: 'prev', type: 'T', required: true, description: '上一帧状态' }, { name: 'current', type: 'T', required: true, description: '当前帧状态' }], returns: 'Partial<T>', purpose: '增量压缩只传变化字段' },
          { name: 'StateSync.deltaApply', signature: '<T>(base: T, delta: Partial<T>) => T', params: [{ name: 'base', type: 'T', required: true, description: '基础状态' }, { name: 'delta', type: 'Partial<T>', required: true, description: '增量数据' }], returns: 'T', purpose: '增量应用到基础状态' },
          { name: 'ClientPrediction.reconcile', signature: '<S,I>(serverState: S, ackedSeq: number) => S', params: [{ name: 'serverState', type: 'S', required: true, description: '服务端权威状态' }, { name: 'ackedSeq', type: 'number', required: true, description: '服务端已确认 seq' }], returns: 'S', purpose: '回滚到权威状态后重放未确认输入' },
          { name: 'Interpolation.lerp', signature: '(a: number, b: number, t: number) => number', params: [{ name: 'a', type: 'number', required: true, description: '起始值' }, { name: 'b', type: 'number', required: true, description: '结束值' }, { name: 't', type: 'number', required: true, description: '插值因子[0,1]' }], returns: 'number', purpose: '线性插值' },
          { name: 'Interpolation.slerp', signature: '(a: number, b: number, t: number) => number', params: [{ name: 'a', type: 'number', required: true, description: '起始角度' }, { name: 'b', type: 'number', required: true, description: '结束角度' }, { name: 't', type: 'number', required: true, description: '插值因子[0,1]' }], returns: 'number', purpose: '球面线性插值用于旋转' },
          { name: 'Interpolation.interpolateRenderState', signature: '<T>(buffer: Snapshot<T>[], renderTime: number) => T', params: [{ name: 'buffer', type: 'Snapshot<T>[]', required: true, description: '快照缓冲数组' }, { name: 'renderTime', type: 'number', required: true, description: '渲染时间戳' }], returns: 'T', purpose: '从快照缓冲插值出当前渲染状态' },
          { name: 'Room.createRoom', signature: '(config: RoomConfig) => RoomData', params: [{ name: 'config', type: 'RoomConfig', required: true, description: '房间配置(容量/密码/属性)' }], returns: 'RoomData', purpose: '创建房间' },
          { name: 'Room.joinRoom', signature: '(roomId: string, playerId: string) => { success, room } | { success, error }', params: [{ name: 'roomId', type: 'string', required: true, description: '房间ID' }, { name: 'playerId', type: 'string', required: true, description: '玩家ID' }], returns: '{ success, room } | { success, error }', purpose: '加入房间' },
          { name: 'Matchmaking.quickMatch', signature: '(player: MatchPlayer, criteria: MatchCriteria) => MatchPlayer[]', params: [{ name: 'player', type: 'MatchPlayer', required: true, description: '匹配玩家(elo/latency)' }, { name: 'criteria', type: 'MatchCriteria', required: true, description: '匹配条件(eloRange/maxLatency)' }], returns: 'MatchPlayer[]', purpose: '快速匹配含30s超时降级' },
          { name: 'PingManager.getLatency', signature: '() => number', params: [], returns: 'number', purpose: '获取平均延迟(ms)' },
          { name: 'PingManager.getJitter', signature: '() => number', params: [], returns: 'number', purpose: '获取抖动(ms)' },
          { name: 'serialize', signature: '<T>(msg: NetworkMessage<T>) => string', params: [{ name: 'msg', type: 'NetworkMessage<T>', required: true, description: '网络消息' }], returns: 'string', purpose: '序列化消息为JSON' },
          { name: 'deserialize', signature: '<T>(raw: string) => NetworkMessage<T>', params: [{ name: 'raw', type: 'string', required: true, description: 'JSON字符串' }], returns: 'NetworkMessage<T>', purpose: '反序列化并校验' },
        ],
        dataModels: [
          { name: 'Snapshot<T>', fields: [
            { name: 'seq', type: 'number', nullable: false, description: '单调递增序号' },
            { name: 'timestamp', type: 'number', nullable: false, description: '生成时间戳(ms)' },
            { name: 'data', type: 'T', nullable: false, description: '状态数据' },
            { name: 'checksum', type: 'number', nullable: false, description: '简易校验和' },
          ], description: '状态快照' },
          { name: 'NetworkMessage<T>', fields: [
            { name: 'type', type: 'MessageType', nullable: false, description: '消息类型枚举' },
            { name: 'seq', type: 'number', nullable: false, description: '消息序号' },
            { name: 'timestamp', type: 'number', nullable: false, description: '发送时间戳' },
            { name: 'senderId', type: 'string', nullable: false, description: '发送者ID' },
            { name: 'payload', type: 'T', nullable: false, description: '消息负载' },
          ], description: '泛型网络消息' },
          { name: 'RoomData', fields: [
            { name: 'roomId', type: 'string', nullable: false, description: '房间唯一ID' },
            { name: 'state', type: 'RoomState', nullable: false, description: '房间状态(WAITING/READY/PLAYING/FINISHED)' },
            { name: 'config', type: 'RoomConfig', nullable: false, description: '房间配置' },
            { name: 'players', type: 'RoomPlayer[]', nullable: false, description: '玩家列表' },
          ], description: '房间数据结构' },
        ],
        acceptanceCriteria: [
          { id: 'net-1', description: '状态同步：createSnapshot/applySnapshot/deltaCompress/deltaApply 全部可用', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/networking.test.ts' },
          { id: 'net-2', description: '客户端预测：addInput/predict/reconcile 正确回滚重放', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/networking.test.ts' },
          { id: 'net-3', description: '插值：lerp边界/slerp跨越±PI/interpolateRenderState 正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/networking.test.ts' },
          { id: 'net-4', description: '房间匹配：创建/加入/离开/准备/开始 状态迁移正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/networking.test.ts' },
          { id: 'net-5', description: '消息协议：序列化/反序列化/校验/Ping延迟抖动 正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/networking.test.ts' },
          { id: 'net-6', description: '匹配超时降级：30s后ELO范围放宽1.5x', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/networking.test.ts' },
          { id: 'net-7', description: 'TypeScript 编译零报错', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
          { id: 'net-8', description: 'code-generator 可生成 Web/Godot/Unity 三层网络代码', verifyBy: 'file-exists', verifyParam: 'src/networking/index.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 0,
      },
    ],
    原型: [],
    生产: [],
    验证: [
      {
        title: '联网对战单元测试',
        description: '运行 vitest 验证状态同步/快照/增量/预测回滚/插值/房间匹配/消息协议全部正确',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'test-1', description: '所有 35+ 测试用例全绿', verifyBy: 'shell', verifyParam: 'npx vitest run tests/networking.test.ts' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** AI 行为系统模板 */
const AI_BEHAVIOR_TEMPLATE: GameTemplate = {
  gameType: 'ai-behavior',
  phases: {
    立项: [
      {
        title: 'ai-behavior',
        description: 'AI 行为系统初始化：实现行为树(Sequence/Selector/Parallel/Decorator/Condition/Action/Blackboard)、有限状态机(State/Transition/AnyState)、GOAP规划器(A*搜索/动态重规划)',
        directoryStructure: ['src/ai/', 'tests/'],
        interfaceContracts: [
          { name: 'BTNode.tick', signature: '(context: Blackboard) => BTStatus', params: [{ name: 'context', type: 'Blackboard', required: true, description: '行为树共享数据上下文' }], returns: 'BTStatus', purpose: '执行节点并返回 SUCCESS/FAILURE/RUNNING' },
          { name: 'Sequence', signature: '(children: BTNode[]) => Sequence', params: [{ name: 'children', type: 'BTNode[]', required: true, description: '子节点列表' }], returns: 'Sequence', purpose: '顺序执行，任一失败则失败' },
          { name: 'Selector', signature: '(children: BTNode[]) => Selector', params: [{ name: 'children', type: 'BTNode[]', required: true, description: '子节点列表' }], returns: 'Selector', purpose: '选择执行，任一成功则成功' },
          { name: 'Parallel', signature: '(children, policy?, requiredSuccesses?) => Parallel', params: [{ name: 'children', type: 'BTNode[]', required: true, description: '子节点列表' }, { name: 'policy', type: "ParallelPolicy", required: false, description: 'all_succeed/any_succeed/n_succeed' }], returns: 'Parallel', purpose: '并行执行，可配策略' },
          { name: 'Inverter', signature: '(child: BTNode) => Inverter', params: [{ name: 'child', type: 'BTNode', required: true, description: '被修饰的子节点' }], returns: 'Inverter', purpose: '取反装饰器(SUCCESS↔FAILURE)' },
          { name: 'Repeater', signature: '(child: BTNode, maxRepeats: number) => Repeater', params: [{ name: 'child', type: 'BTNode', required: true, description: '被修饰的子节点' }, { name: 'maxRepeats', type: 'number', required: true, description: '最大重复次数' }], returns: 'Repeater', purpose: '重复执行N次后返回SUCCESS' },
          { name: 'UntilFail', signature: '(child: BTNode) => UntilFail', params: [{ name: 'child', type: 'BTNode', required: true, description: '被修饰的子节点' }], returns: 'UntilFail', purpose: '重复执行直到FAILURE返回SUCCESS' },
          { name: 'Cooldown', signature: '(child: BTNode, cooldownMs: number, key?: string) => Cooldown', params: [{ name: 'child', type: 'BTNode', required: true, description: '被修饰的子节点' }, { name: 'cooldownMs', type: 'number', required: true, description: '冷却时间(ms)' }], returns: 'Cooldown', purpose: '冷却装饰器(冷却期内返回FAILURE)' },
          { name: 'Condition', signature: '(fn: ConditionFn) => Condition', params: [{ name: 'fn', type: 'ConditionFn', required: true, description: '条件判断函数(context)=>boolean' }], returns: 'Condition', purpose: '条件判断节点' },
          { name: 'Action', signature: '(fn: ActionFn) => Action', params: [{ name: 'fn', type: 'ActionFn', required: true, description: '动作执行函数(context)=>BTStatus' }], returns: 'Action', purpose: '动作执行节点' },
          { name: 'RandomSelector', signature: '(children: BTNode[]) => RandomSelector', params: [{ name: 'children', type: 'BTNode[]', required: true, description: '子节点列表' }], returns: 'RandomSelector', purpose: '随机顺序选择子节点' },
          { name: 'Blackboard.set', signature: '(key: string, val: unknown) => void', params: [{ name: 'key', type: 'string', required: true, description: '键名' }, { name: 'val', type: 'unknown', required: true, description: '值' }], returns: 'void', purpose: '设置黑板键值' },
          { name: 'Blackboard.get', signature: '<T>(key: string) => T | undefined', params: [{ name: 'key', type: 'string', required: true, description: '键名' }], returns: 'T | undefined', purpose: '获取黑板值' },
          { name: 'StateMachine.start', signature: '(initialState: S) => void', params: [{ name: 'initialState', type: 'S', required: true, description: '初始状态名' }], returns: 'void', purpose: '启动状态机' },
          { name: 'StateMachine.update', signature: '(dt: number) => void', params: [{ name: 'dt', type: 'number', required: true, description: '时间增量' }], returns: 'void', purpose: '更新状态机(检查转换+执行update)' },
          { name: 'StateMachine.addState', signature: '(stateId: S, state: State<S>) => void', params: [{ name: 'stateId', type: 'S', required: true, description: '状态标识' }, { name: 'state', type: 'State<S>', required: true, description: '状态配置' }], returns: 'void', purpose: '注册状态' },
          { name: 'StateMachine.addTransition', signature: '(transition: Transition<S>) => void', params: [{ name: 'transition', type: 'Transition<S>', required: true, description: '转换定义(from/to/condition)' }], returns: 'void', purpose: '注册状态转换' },
          { name: 'GOAPPlanner.plan', signature: '(currentState, goals, actions) => GOAPAction[]', params: [{ name: 'currentState', type: 'WorldState', required: true, description: '当前世界状态' }, { name: 'goals', type: 'GOAPGoal[]', required: true, description: '目标列表' }, { name: 'actions', type: 'GOAPAction[]', required: true, description: '可用动作列表' }], returns: 'GOAPAction[]', purpose: 'A*搜索最优动作序列' },
          { name: 'GOAPPlanner.getPlan', signature: '() => GOAPAction[]', params: [], returns: 'GOAPAction[]', purpose: '获取当前规划的动作序列' },
          { name: 'GOAPPlanner.replan', signature: '(currentState, goals, actions) => GOAPAction[]', params: [{ name: 'currentState', type: 'WorldState', required: true, description: '当前世界状态' }, { name: 'goals', type: 'GOAPGoal[]', required: true, description: '目标列表' }, { name: 'actions', type: 'GOAPAction[]', required: true, description: '可用动作列表' }], returns: 'GOAPAction[]', purpose: '动态重规划(世界状态变化时)' },
        ],
        dataModels: [
          { name: 'BTStatus', fields: [
            { name: 'SUCCESS', type: 'enum', nullable: false, description: '节点执行成功' },
            { name: 'FAILURE', type: 'enum', nullable: false, description: '节点执行失败' },
            { name: 'RUNNING', type: 'enum', nullable: false, description: '节点仍在执行中' },
          ], description: '行为树节点状态枚举' },
          { name: 'GOAPAction', fields: [
            { name: 'name', type: 'string', nullable: false, description: '动作名称' },
            { name: 'cost', type: 'number', nullable: false, description: '动作代价(越小越优先)' },
            { name: 'preconditions', type: 'WorldState', nullable: false, description: '前置条件(世界状态映射)' },
            { name: 'effects', type: 'WorldState', nullable: false, description: '执行效果(状态变更映射)' },
          ], description: 'GOAP动作定义' },
          { name: 'GOAPGoal', fields: [
            { name: 'name', type: 'string', nullable: false, description: '目标名称' },
            { name: 'priority', type: 'number', nullable: false, description: '优先级(越大越优先)' },
            { name: 'conditions', type: 'WorldState', nullable: false, description: '目标条件(世界状态满足时达成)' },
          ], description: 'GOAP目标定义' },
          { name: 'Transition<S>', fields: [
            { name: 'from', type: "S | '__any__'", nullable: false, description: '源状态(__any__为全局)' },
            { name: 'to', type: 'S', nullable: false, description: '目标状态' },
            { name: 'condition', type: '() => boolean', nullable: false, description: '条件函数' },
          ], description: '状态机转换定义' },
        ],
        acceptanceCriteria: [
          { id: 'ai-1', description: '行为树：Sequence/Selector/Parallel 三种复合节点正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/ai-behavior.test.ts' },
          { id: 'ai-2', description: '行为树：Inverter/Repeater/UntilFail/Cooldown 四种Decorator正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/ai-behavior.test.ts' },
          { id: 'ai-3', description: '行为树：Condition/Action 叶节点 + Blackboard 数据共享正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/ai-behavior.test.ts' },
          { id: 'ai-4', description: '行为树：BehaviorTreeBuilder 链式API构建正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/ai-behavior.test.ts' },
          { id: 'ai-5', description: '状态机：State enter/update/exit + Transition 状态迁移正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/ai-behavior.test.ts' },
          { id: 'ai-6', description: '状态机：AnyState 全局过渡正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/ai-behavior.test.ts' },
          { id: 'ai-7', description: 'GOAP：A* 搜索最优动作序列正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/ai-behavior.test.ts' },
          { id: 'ai-8', description: 'GOAP：动态重规划 + 多目标优先级排序正确', verifyBy: 'unit-test', verifyParam: 'npx vitest run tests/ai-behavior.test.ts' },
          { id: 'ai-9', description: 'TypeScript 编译零报错', verifyBy: 'type-check', verifyParam: 'npx tsc --noEmit' },
          { id: 'ai-10', description: 'code-generator 可生成 ai-behavior 三模块代码', verifyBy: 'file-exists', verifyParam: 'src/ai/index.ts' },
        ],
        estimatedTools: ['write_file', 'shell_executor'],
        maxCodeLines: 0,
      },
    ],
    原型: [],
    生产: [],
    验证: [
      {
        title: 'AI 行为系统单元测试',
        description: '运行 vitest 验证行为树所有节点类型、状态机状态迁移、GOAP 规划器最优路径搜索全部正确',
        directoryStructure: [],
        interfaceContracts: [],
        dataModels: [],
        acceptanceCriteria: [
          { id: 'test-1', description: '所有测试用例全绿', verifyBy: 'shell', verifyParam: 'npx vitest run tests/ai-behavior.test.ts' },
        ],
        estimatedTools: ['shell_executor'],
        maxCodeLines: 0,
      },
    ],
  },
};

/** 所有品类模板 */
const GAME_TEMPLATES: GameTemplate[] = [IDLE_GAME_TEMPLATE, CARD_GAME_TEMPLATE, ROGUELIKE_TEMPLATE, LOOT_ARPG_TEMPLATE, GODOT_GAME_TEMPLATE, UNITY_GAME_TEMPLATE, LEVEL_GEN_TEMPLATE, NUMERICS_TEMPLATE, MONETIZATION_TEMPLATE, NETWORKING_TEMPLATE, AI_BEHAVIOR_TEMPLATE];

/* ===================== Planner ===================== */

/**
 * 根据用户需求和上下文生成执行计划。
 */
export function generatePlan(
  userRequest: string,
  gameType: string,
  context: Context,
  memorySnapshot?: MemorySnapshot,
  options?: {
    targetEngine?: string;
    artStyle?: string;
    platforms?: string[];
  },
): ExecutionPlan {
  plannerLogger.info(`generatePlan 入口: gameType=${gameType}`, { taskLen: userRequest.length });

  // 1. 技术选型
  const explicitPlatforms = options?.platforms ?? parsePlatforms(userRequest);
  const techInput: TechSelectionInput = {
    gameType,
    teamSize: context.preferences.teamSize ?? 1,
    needHotUpdate: /热更|热更新|在线更新/i.test(userRequest),
    performanceLevel: inferPerformanceLevel(userRequest, gameType),
    targetPlatforms: explicitPlatforms,
    budget: 'zero',
    developerExperience: context.preferences.developerExperience ?? '',
  };

  const techResult = selectTechStack(techInput);

  // 确定目标引擎（options > userRequest > techResult）
  const targetEngine =
    options?.targetEngine ?? techResult.recommendation.engine ?? inferEngineFromRequest(userRequest, gameType);

  // 2. 匹配品类模板
  const template = matchTemplate(gameType);
  const phases = determinePhases(userRequest, template);

  // 2.5. 知识卡召回（修仙/仙侠类需求自动检索公开安全的通用知识卡）
  const recallResult = recallKnowledgeCards(userRequest, 5);

  // 3. 生成步骤
  const steps: PlanStep[] = [];
  let stepIndex = 0;

  for (const phase of phases) {
    const phaseTemplates = template?.phases[phase] ?? [];
    for (const tpl of phaseTemplates) {
      const prevIds = steps.length > 0 ? [steps[steps.length - 1].id] : [];
      steps.push({
        id: `step-${String(stepIndex + 1).padStart(2, '0')}`,
        phase: phase as PipelinePhase,
        title: tpl.title,
        description: tpl.description,
        directoryStructure: tpl.directoryStructure.map(
          (d) => `${context.workspacePath}\\${d}`,
        ),
        interfaceContracts: tpl.interfaceContracts,
        dataModels: tpl.dataModels,
        acceptanceCriteria: tpl.acceptanceCriteria,
        estimatedTools: tpl.estimatedTools,
        dependencies: prevIds,
        maxCodeLines: tpl.maxCodeLines,
      });
      stepIndex++;
    }
  }

  // 4. 风险提示
  const risks = buildRisks(targetEngine, gameType);

  // 5. UI 风格与动效指南生成（仅当有具体品类时）
  let styleGuidePath = '';
  let motionGuidePath = '';
  let artDirectionPath = '';
  if (template && template.gameType !== 'godot' && template.gameType !== 'unity') {
    const artifactDir = join(context.workspacePath, 'style-guides');
    mkdirSync(artifactDir, { recursive: true });
    const artStyle = options?.artStyle;
    const result = generateStyleAndMotion(gameType, userRequest.substring(0, 30), targetEngine, artStyle);

    const stylePath = join(artifactDir, 'UI_STYLE_GUIDE.md');
    writeFileSync(stylePath, result.styleGuide, 'utf-8');
    styleGuidePath = stylePath;

    const motionPath = join(artifactDir, 'MOTION_GUIDE.md');
    writeFileSync(motionPath, result.motionGuide, 'utf-8');
    motionGuidePath = motionPath;

    // 生成美术方向指南
    if (result.artDirection) {
      const artDirPath = join(artifactDir, 'ART_DIRECTION.md');
      writeFileSync(artDirPath, result.artDirection, 'utf-8');
      artDirectionPath = artDirPath;
    }
  }

  // 6. 可用 Skill 建议
  if (context.skillManifests && context.skillManifests.length > 0) {
    const matchingSkills = context.skillManifests.filter((s) => {
      const text = `${s.name} ${s.description} ${s.triggers.join(' ')}`.toLowerCase();
      const keywords = userRequest.toLowerCase().split(/[\s,，、]+/);
      return keywords.some((kw) => text.includes(kw));
    });
    if (matchingSkills.length > 0) {
      risks.push(
        `可用 Skill 建议: ${matchingSkills.map((s) => s.name).join('、')}（匹配到 ${matchingSkills.length} 个 Skill）`,
      );
    }
  }

  const plan: ExecutionPlan = {
    planId: `plan-${Date.now()}`,
    overallGoal: userRequest,
    techRecommendation: techResult.recommendation,
    steps,
    estimatedDuration: steps.length * 120,
    risks,
    styleGuidePath: styleGuidePath || undefined,
    motionGuidePath: motionGuidePath || undefined,
    artDirectionPath: artDirectionPath || undefined,
    knowledgeCards: recallResult.compactPrompt || undefined,
  };

  // 6. [Memory v2] 构建 System Prompt 前缀（向后兼容）
  if (memorySnapshot) {
    const injectionStrategy = new InjectionStrategy();
    const systemPrompt = injectionStrategy.buildSystemPrompt(memorySnapshot);
    plan.memoryV2SystemPrompt = systemPrompt;
    plannerLogger.info(`Memory v2 System Prompt 已注入: ${systemPrompt.length} 字符`);
  }

  plannerLogger.info(`generatePlan 出口: ${steps.length} 步骤, planId=${plan.planId}`, { gameType });
  return plan;
}

/* ===================== 辅助函数 ===================== */

function matchTemplate(gameType: string): GameTemplate | null {
  const normalized = gameType.toLowerCase();
  return GAME_TEMPLATES.find((t) => t.gameType.includes(normalized) || normalized.includes(t.gameType)) ?? null;
}

function determinePhases(userRequest: string, template: GameTemplate | null): string[] {
  const phases: string[] = [];

  if (/立项|初始化|创建|新建|开始/i.test(userRequest)) phases.push('立项');
  if (/原型|demo|核心|玩法|MVP/i.test(userRequest)) phases.push('原型');
  if (/内容|关卡|美术|生产|批量/i.test(userRequest)) phases.push('生产');

  // 默认阶段
  if (phases.length === 0 && template) {
    phases.push('立项', '原型');
  }

  // 只要包含开发阶段就追加验证
  if (phases.length > 0) phases.push('验证');

  return phases;
}

function inferPerformanceLevel(userRequest: string, gameType: string): 'low' | 'medium' | 'high' {
  if (/3[dD]|三维|高性能|重度|动作|射击|开放世界/i.test(userRequest)) return 'high';
  if (/2[dD]|像素|平台/i.test(userRequest)) return 'medium';
  // 放置、卡牌、文字类默认低性能需求
  if (/放置|idle|卡牌|card|文字|text/i.test(gameType)) return 'low';
  return 'medium';
}

function parsePlatforms(userRequest: string): string[] {
  const platforms: string[] = [];
  if (/android|安卓|apk/i.test(userRequest)) platforms.push('Android');
  if (/ios|苹果|ipa/i.test(userRequest)) platforms.push('iOS');
  if (/web|网页|浏览器|h5/i.test(userRequest)) platforms.push('Web');
  return platforms.length > 0 ? platforms : ['Android', 'iOS'];
}

function buildRisks(engine: string, gameType: string): string[] {
  const risks: string[] = [];
  if (engine === 'react-vite-tailwind' && !['放置', '卡牌', '休闲'].includes(gameType)) {
    risks.push('Web 技术栈对非轻度品类的性能支持有限，建议先做 MVP 验证');
  }
  if (engine === 'godot' && gameType === '放置') {
    risks.push('放置类游戏使用 Godot 可能过度工程，但可接受');
  }
  if (gameType === 'loot-arpg') {
    risks.push(
      '掉落池配置需持续调优，初始权重来自设计稿而非玩家数据，上线后必须关注稀有度分布监控',
    );
    risks.push(
      '词缀冲突检测逻辑需要在每次新增词缀时回归测试，建议搭配自动化校验脚本',
    );
    risks.push(
      '2D 像素风格中装备图标和词缀文字可读性需在低分辨率下验证（建议最低测试分辨率 640×360）',
    );
    risks.push(
      '刷宝 ARPG 的玩家驱动力来自掉落正反馈曲线，建议内置掉落模拟器用于平衡调优',
    );
  }
  return risks;
}

/** 从用户需求和游戏类型推断目标引擎 */
function inferEngineFromRequest(userRequest: string, gameType: string): string {
  if (/godot/i.test(userRequest)) return 'godot';
  if (/unity/i.test(userRequest)) return 'unity';
  if (/web|网页|浏览器|h5|react/i.test(userRequest)) return 'react-vite-tailwind';
  if (/loot|arpg|刷宝|地牢|像素|动作|战斗|射击|3d/i.test(gameType + userRequest)) return 'godot';
  if (/放置|idle|卡牌|card|文字|text|休闲/i.test(gameType)) return 'react-vite-tailwind';
  return 'godot';
}
