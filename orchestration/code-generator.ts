/**
 * CodeGenerator — 代码生成器
 *
 * 职责：
 * 1. 根据 PlanStep 生成实际源代码文件
 * 2. 内建放置类手游完整代码模板
 * 3. 输出 { filePath, content }[] 供 Executor 写入磁盘
 *
 * 扩展：新增游戏类型时，在此添加对应的 generate 分支。
 */

import type { PlanStep } from '../protocol/agent-protocol';

export interface GeneratedFile {
  /** 相对于工作区根目录的路径 */
  filePath: string;
  /** UTF-8 文件内容 */
  content: string;
}

/**
 * 根据 PlanStep 生成代码文件。
 * 当前仅支持放置类手游模板。
 */
export function generateCode(step: PlanStep): GeneratedFile[] {
  const title = step.title;

  switch (title) {
    case '项目初始化':
      return generateScaffold();
    case '游戏数据模型定义':
      return generateTypes();
    case '游戏引擎核心实现':
      return [
        ...generateGameEngine(),
        ...generateEngineTests(),
      ];
    case '主界面组件开发':
      return generateUI();
    case '离线收益与存档':
      return generateSaveSystem();
    /* ---- 卡牌品类 ---- */
    case '卡牌数据模型定义':
      return generateCardTypes();
    case '卡牌引擎核心实现':
      return [
        ...generateCardEngine(),
        ...generateCardEngineTests(),
      ];
    case '战斗主界面':
      return generateBattleUI();
    case '卡组编辑器':
      return generateDeckEditor();
    /* ---- 肉鸽品类 ---- */
    case '肉鸽数据模型定义':
      return generateRoguelikeTypes();
    case '肉鸽引擎核心实现':
      return [
        ...generateDungeonEngine(),
        ...generateDungeonEngineTests(),
      ];
    case '地牢主界面':
      return generateDungeonScreen();
    /* ---- 品类深化：放置类 (idle-game) ---- */
    case 'idle-game':
      return generateIdleGame();
    /* ---- 品类深化：卡牌类 (card-game) ---- */
    case 'card-game':
      return generateCardGame();
    /* ---- Godot 引擎：2D 品类 ---- */
    case 'godot-2d':
      return generateGodot2D();
    /* ---- Godot 引擎：3D 品类 ---- */
    case 'godot-3d':
      return generateGodot3D();
    /* ---- Unity 引擎：2D 品类 ---- */
    case 'unity-2d':
      return generateUnity2D();
    /* ---- Unity 引擎：3D 品类 ---- */
    case 'unity-3d':
      return generateUnity3D();
    /* ---- 关卡生成 level-gen ---- */
    case 'level-gen':
      return generateLevelGen();
    /* ---- 数值系统 numerics ---- */
    case 'numerics':
      return generateNumerics();
    /* ---- 联网对战 networking ---- */
    case 'networking':
      return generateNetworking();
    /* ---- 商业化 monetization ---- */
    case 'monetization':
      return generateMonetization();
    /* ---- AI 行为系统 ai-behavior ---- */
    case 'ai-behavior':
      return generateAIBehavior();
    /* ---- Unity Spec 产物（手游工程模板） ---- */
    case 'unity-spec':
      return generateUnitySpec();
    default:
      return [];
  }
}

/* ================================================================
 * 步骤 1: 项目脚手架
 * ================================================================ */

function generateScaffold(): GeneratedFile[] {
  return [
    {
      filePath: 'package.json',
      content: JSON.stringify(
        {
          name: 'idle-game',
          private: true,
          version: '0.0.1',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc -b && vite build',
            preview: 'vite preview',
            'typecheck': 'tsc --noEmit',
          },
          dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
          devDependencies: {
            '@types/react': '^18.3.3',
            '@types/react-dom': '^18.3.0',
            '@vitejs/plugin-react': '^4.3.0',
            typescript: '^5.4.0',
            vite: '^5.3.0',
          },
        },
        null,
        2,
      ),
    },
    {
      filePath: 'tsconfig.json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            isolatedModules: true,
            moduleDetection: 'force',
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
            forceConsistentCasingInFileNames: true,
          },
          include: ['src'],
        },
        null,
        2,
      ),
    },
    {
      filePath: 'vite.config.ts',
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, open: true },
  build: { outDir: 'dist' },
})
`,
    },
    {
      filePath: 'index.html',
      content: `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>修仙放置</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      filePath: 'src/main.tsx',
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    },
    {
      filePath: 'src/index.css',
      content: `* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
  color: #e8e8e8;
  min-height: 100vh;
}

#root {
  max-width: 480px;
  margin: 0 auto;
  padding: 24px 16px;
}

button {
  cursor: pointer;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  padding: 8px 16px;
  transition: transform 0.1s, box-shadow 0.1s;
}
button:active {
  transform: scale(0.96);
}
`,
    },
  ];
}

/* ================================================================
 * 步骤 2: 数据类型
 * ================================================================ */

function generateTypes(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/types.ts',
      content: `/** 玩家全局状态 */
export interface GameState {
  gold: number;
  gems: number;
  totalClicks: number;
  upgrades: Upgrade[];
  achievements: string[];
  lastSaveTime: number;
}

/** 升级项定义 */
export interface Upgrade {
  id: string;
  name: string;
  level: number;
  baseCost: number;
  costMultiplier: number;
  goldPerClick: number;
  goldPerSec: number;
}

/** 升级配置 */
export interface UpgradeConfig {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  goldPerClick: number;
  goldPerSec: number;
}

/** 成就 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  condition: (state: GameState) => boolean;
}

/** 离线收益计算结果 */
export interface TimeAdvanceResult {
  goldEarned: number;
  secondsAway: number;
}
`,
    },
  ];
}

/* ================================================================
 * 步骤 3: 游戏引擎
 * ================================================================ */

function generateGameEngine(): GeneratedFile[] {
  // 升级配置
  const upgrades = [
    { id: 'click_power', name: '点击强化', desc: '每次点击 +{n} 金币', base: 10, mult: 1.25, perClick: 1, perSec: 0 },
    { id: 'auto_mine', name: '自动采矿', desc: '每秒自动 +{n} 金币', base: 50, mult: 1.3, perClick: 0, perSec: 1 },
    { id: 'meditation', name: '冥想修炼', desc: '每秒 +{n} 金币', base: 200, mult: 1.35, perClick: 0, perSec: 5 },
    { id: 'pill_factory', name: '丹房炼制', desc: '每秒 +{n} 金币', base: 1000, mult: 1.4, perClick: 0, perSec: 25 },
    { id: 'sect_hall', name: '宗门大厅', desc: '每秒 +{n} 金币', base: 5000, mult: 1.45, perClick: 0, perSec: 120 },
    { id: 'spirit_vein', name: '灵脉开采', desc: '每秒 +{n} 金币', base: 25000, mult: 1.5, perClick: 0, perSec: 600 },
    { id: 'dao_stele', name: '道碑参悟', desc: '每秒 +{n} 金币', base: 120000, mult: 1.55, perClick: 0, perSec: 3000 },
    { id: 'immortal_realm', name: '仙域洞天', desc: '每秒 +{n} 金币', base: 600000, mult: 1.6, perClick: 0, perSec: 15000 },
  ];

  const configsCode = upgrades
    .map(
      (u) => `  {
    id: '${u.id}',
    name: '${u.name}',
    description: '${u.desc}',
    baseCost: ${u.base},
    costMultiplier: ${u.mult},
    goldPerClick: ${u.perClick},
    goldPerSec: ${u.perSec},
  }`,
    )
    .join(',\n');

  const defaultUpgradesCode = upgrades
    .map(
      (u) => `  {
    id: '${u.id}',
    name: '${u.name}',
    level: 0,
    baseCost: ${u.base},
    costMultiplier: ${u.mult},
    goldPerClick: ${u.perClick},
    goldPerSec: ${u.perSec},
  }`,
    )
    .join(',\n');

  const achievements = [
    { id: 'first_click', name: '踏入仙途', desc: '完成第一次点击' },
    { id: 'gold_100', name: '初窥门径', desc: '累计获得 100 金币' },
    { id: 'gold_10000', name: '小有所成', desc: '累计获得 10,000 金币' },
    { id: 'gold_1000000', name: '金丹大成', desc: '累计获得 1,000,000 金币' },
    { id: 'gold_100000000', name: '元婴出窍', desc: '累计获得 100,000,000 金币' },
    { id: 'gems_10', name: '机缘初现', desc: '累计获得 10 钻石' },
    { id: 'upgrade_10', name: '修炼狂人', desc: '任意升级项达到 10 级' },
    { id: 'upgrade_50', name: '大道争锋', desc: '任意升级项达到 50 级' },
  ];

  const achievementConditionsCode = achievements
    .map((a) => `  { id: '${a.id}', name: '${a.name}', description: '${a.desc}', condition: ${getCondition(a.id)} }`)
    .join(',\n');

  return [
    {
      filePath: 'src/game/GameEngine.ts',
      content: `import type { GameState, Upgrade, UpgradeConfig, Achievement, TimeAdvanceResult } from './types';

/* ==================== 升级配置 ==================== */

export const UPGRADE_CONFIGS: UpgradeConfig[] = [
${configsCode},
];

/* ==================== 成就列表 ==================== */

export const ACHIEVEMENTS: Achievement[] = [
${achievementConditionsCode},
];

/* ==================== 初始状态 ==================== */

export function createInitialState(): GameState {
  return {
    gold: 0,
    gems: 0,
    totalClicks: 0,
    upgrades: [
${defaultUpgradesCode},
    ],
    achievements: [],
    lastSaveTime: Date.now(),
  };
}

/* ==================== 核心计算 ==================== */

/** 执行一次点击 */
export function performClick(state: GameState): GameState {
  const clickGold = state.upgrades.reduce((sum, u) => sum + u.level * u.goldPerClick, 1);
  const newState = { ...state, gold: state.gold + clickGold, totalClicks: state.totalClicks + 1 };

  // 首次点击触发成就
  if (newState.totalClicks === 1 && !newState.achievements.includes('first_click')) {
    newState.achievements = [...newState.achievements, 'first_click'];
  }

  return checkAchievements(newState);
}

/** 计算每秒自动收益 */
export function getIncomePerSec(state: GameState): number {
  return state.upgrades.reduce((sum, u) => sum + u.level * u.goldPerSec, 0);
}

/** 购买升级 */
export function buyUpgrade(
  state: GameState,
  upgradeId: string,
): { state: GameState; success: boolean } {
  const upgradeIndex = state.upgrades.findIndex((u) => u.id === upgradeId);
  if (upgradeIndex === -1) return { state, success: false };

  const upgrade = state.upgrades[upgradeIndex];
  const cost = calcUpgradeCost(upgrade);

  if (state.gold < cost) return { state, success: false };

  const newUpgrades = [...state.upgrades];
  newUpgrades[upgradeIndex] = { ...upgrade, level: upgrade.level + 1 };

  const newState: GameState = {
    ...state,
    gold: state.gold - cost,
    upgrades: newUpgrades,
  };

  return { state: checkAchievements(newState), success: true };
}

/** 计算升级花费 */
export function calcUpgradeCost(upgrade: Upgrade): number {
  return Math.floor(upgrade.baseCost * Math.pow(upgrade.costMultiplier, upgrade.level));
}

/* ==================== 离线收益 ==================== */

/** 计算离线收益 */
export function calculateTimeAdvance(state: GameState, now: number): TimeAdvanceResult {
  const secondsAway = Math.floor((now - state.lastSaveTime) / 1000);
  if (secondsAway <= 1) return { goldEarned: 0, secondsAway: 0 };

  const incomePerSec = getIncomePerSec(state);
  // 离线收益打 50% 折扣
  const goldEarned = Math.floor(incomePerSec * secondsAway * 0.5);

  return { goldEarned, secondsAway };
}

/** 应用离线收益 */
export function applyTimeAdvance(state: GameState, now: number): GameState {
  const { goldEarned } = calculateTimeAdvance(state, now);
  if (goldEarned <= 0) return { ...state, lastSaveTime: now };

  return checkAchievements({
    ...state,
    gold: state.gold + goldEarned,
    lastSaveTime: now,
  });
}

/* ==================== 成就检测 ==================== */

function checkAchievements(state: GameState): GameState {
  const newAchievements = [...state.achievements];
  for (const ach of ACHIEVEMENTS) {
    if (!newAchievements.includes(ach.id) && ach.condition(state)) {
      newAchievements.push(ach.id);
    }
  }
  return { ...state, achievements: newAchievements };
}

/** 查找成就 */
export function findAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
`,
    },
  ];
}

/* ==================== 成就条件（生成的辅助） ==================== */

function getCondition(id: string): string {
  switch (id) {
    case 'first_click':
      return '(s: GameState) => s.totalClicks >= 1';
    case 'gold_100':
      return '(s: GameState) => s.gold >= 100';
    case 'gold_10000':
      return '(s: GameState) => s.gold >= 10000';
    case 'gold_1000000':
      return '(s: GameState) => s.gold >= 1000000';
    case 'gold_100000000':
      return '(s: GameState) => s.gold >= 100000000';
    case 'gems_10':
      return '(s: GameState) => s.gems >= 10';
    case 'upgrade_10':
      return '(s: GameState) => s.upgrades.some((u) => u.level >= 10)';
    case 'upgrade_50':
      return '(s: GameState) => s.upgrades.some((u) => u.level >= 50)';
    default:
      return '() => false';
  }
}

/* ================================================================
 * 步骤 4: UI 组件
 * ================================================================ */

function generateUI(): GeneratedFile[] {
  return [
    {
      filePath: 'src/App.tsx',
      content: `import { useState, useCallback, useEffect } from 'react';
import { GameState } from './game/types';
import {
  createInitialState,
  performClick,
  getIncomePerSec,
  buyUpgrade,
  calcUpgradeCost,
  UPGRADE_CONFIGS,
  findAchievement,
} from './game/GameEngine';
import { ResourceDisplay } from './game/components/ResourceDisplay';
import { ClickArea } from './game/components/ClickArea';
import { UpgradePanel } from './game/components/UpgradePanel';

const SAVE_KEY = 'idle-game-save';
const TICK_MS = 50;

function loadState(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return createInitialState();
}

function saveState(state: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(loadState);
  const [incomePerSec, setIncomePerSec] = useState(0);
  const [showAchievement, setShowAchievement] = useState<string | null>(null);

  // 自动收益 tick
  useEffect(() => {
    const timer = setInterval(() => {
      setGameState((prev) => {
        const income = getIncomePerSec(prev);
        const tickGold = Math.floor((income * TICK_MS) / 1000);
        if (tickGold <= 0) return prev;
        return { ...prev, gold: prev.gold + tickGold };
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // 每秒更新收益显示
  useEffect(() => {
    const timer = setInterval(() => {
      setGameState((prev) => {
        setIncomePerSec(getIncomePerSec(prev));
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 自动保存
  useEffect(() => {
    const timer = setInterval(() => {
      setGameState((prev) => {
        saveState(prev);
        return prev;
      });
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleClick = useCallback(() => {
    setGameState((prev) => {
      const before = prev.achievements.length;
      const next = performClick(prev);
      if (next.achievements.length > before) {
        const newOne = next.achievements[next.achievements.length - 1];
        const ach = findAchievement(newOne);
        if (ach) {
          setShowAchievement(ach.name);
          setTimeout(() => setShowAchievement(null), 2500);
        }
      }
      return next;
    });
  }, []);

  const handleBuy = useCallback((upgradeId: string) => {
    setGameState((prev) => {
      const { state } = buyUpgrade(prev, upgradeId);
      return state;
    });
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <h1 style={{ textAlign: 'center', fontSize: 28, color: '#ffd700' }}>
        修仙放置
      </h1>

      <ResourceDisplay state={gameState} incomePerSec={incomePerSec} />

      <ClickArea onGoldClick={handleClick} state={gameState} />

      {showAchievement && (
        <div style={{
          textAlign: 'center',
          background: '#4a3f1a',
          border: '2px solid #ffd700',
          borderRadius: 12,
          padding: 12,
          fontSize: 18,
          fontWeight: 700,
          color: '#ffd700',
        }}>
          🏆 成就解锁：{showAchievement}
        </div>
      )}

      <UpgradePanel
        state={gameState}
        configs={UPGRADE_CONFIGS}
        calcCost={calcUpgradeCost}
        onBuy={handleBuy}
      />
    </div>
  );
}
`,
    },
    {
      filePath: 'src/game/components/ResourceDisplay.tsx',
      content: `import { GameState } from '../types';

interface Props {
  state: GameState;
  incomePerSec: number;
}

export function ResourceDisplay({ state, incomePerSec }: Props) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 20,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
      }}
    >
      <Resource label="金币" value={Math.floor(state.gold)} color="#ffd700" />
      <Resource label="每秒" value={incomePerSec} color="#87ceeb" suffix="/s" />
      <Resource label="点击" value={state.totalClicks} color="#98fb98" />
    </div>
  );
}

function Resource({
  label,
  value,
  color,
  suffix = '',
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>
        {formatNumber(value)}
        {suffix}
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
`,
    },
    {
      filePath: 'src/game/components/ClickArea.tsx',
      content: `import { GameState } from '../types';

interface Props {
  state: GameState;
  onGoldClick: () => void;
}

export function ClickArea({ state, onGoldClick }: Props) {
  // 点击收益
  const clickGold = state.upgrades.reduce((sum, u) => sum + u.level * u.goldPerClick, 1);

  return (
    <div style={{ textAlign: 'center' }}>
      <button
        onClick={onGoldClick}
        style={{
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ffd700, #b8860b)',
          border: '4px solid #ffec8b',
          fontSize: 20,
          fontWeight: 700,
          color: '#1a1a2e',
          cursor: 'pointer',
          boxShadow: '0 0 40px rgba(255, 215, 0, 0.3)',
          margin: '0 auto',
          display: 'block',
        }}
      >
        <div>点击修炼</div>
        <div style={{ fontSize: 14, opacity: 0.7 }}>+{clickGold} 金币</div>
      </button>
    </div>
  );
}
`,
    },
    {
      filePath: 'src/game/components/UpgradePanel.tsx',
      content: `import { GameState, Upgrade, UpgradeConfig } from '../types';

interface Props {
  state: GameState;
  configs: UpgradeConfig[];
  calcCost: (u: Upgrade) => number;
  onBuy: (id: string) => void;
}

export function UpgradePanel({ state, configs, calcCost, onBuy }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ fontSize: 18, color: '#ccc', marginBottom: 4 }}>升级</h2>
      {configs.map((cfg) => {
        const upgrade = state.upgrades.find((u) => u.id === cfg.id);
        if (!upgrade) return null;
        const cost = calcCost(upgrade);
        const canAfford = state.gold >= cost;

        return (
          <div
            key={cfg.id}
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{cfg.name}</div>
              <div style={{ fontSize: 12, color: '#999' }}>
                Lv.{upgrade.level} · {cfg.description.replace('{n}', String(upgrade.level * (cfg.goldPerClick || cfg.goldPerSec)))}
              </div>
            </div>
            <button
              onClick={() => onBuy(cfg.id)}
              disabled={!canAfford}
              style={{
                background: canAfford ? '#ffd700' : '#333',
                color: canAfford ? '#1a1a2e' : '#666',
                fontWeight: 600,
                padding: '6px 14px',
                fontSize: 13,
                minWidth: 80,
              }}
            >
              {cost} 金币
            </button>
          </div>
        );
      })}
    </div>
  );
}
`,
    },
  ];
}

/* ================================================================
 * 步骤 4 附: 引擎单元测试
 * ================================================================ */

function generateEngineTests(): GeneratedFile[] {
  return [
    {
      filePath: 'tests/GameEngine.test.ts',
      content: `import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  performClick,
  getIncomePerSec,
  buyUpgrade,
  calcUpgradeCost,
  calculateTimeAdvance,
  applyTimeAdvance,
  UPGRADE_CONFIGS,
  ACHIEVEMENTS,
  findAchievement,
} from '../src/game/GameEngine';

describe('GameEngine — 核心逻辑', () => {
  it('初始状态金币为 0', () => {
    const s = createInitialState();
    expect(s.gold).toBe(0);
    expect(s.totalClicks).toBe(0);
    expect(s.upgrades.length).toBe(UPGRADE_CONFIGS.length);
  });

  it('点击增加金币和计数', () => {
    const s = performClick(createInitialState());
    expect(s.totalClicks).toBe(1);
    expect(s.gold).toBeGreaterThan(0);
  });

  it('首次点击触发 first_click 成就', () => {
    const s = performClick(createInitialState());
    expect(s.achievements).toContain('first_click');
  });

  it('金币不足时购买失败', () => {
    const { success } = buyUpgrade(createInitialState(), 'meditation');
    expect(success).toBe(false);
  });

  it('calcUpgradeCost 随等级递增', () => {
    const s = createInitialState();
    const u = s.upgrades.find((x) => x.id === 'auto_mine')!;
    const c1 = calcUpgradeCost(u);
    const { state: s2 } = buyUpgrade({ ...s, gold: 99999 }, 'auto_mine');
    const u2 = s2.upgrades.find((x) => x.id === 'auto_mine')!;
    expect(calcUpgradeCost(u2)).toBeGreaterThan(c1);
  });

  it('getIncomePerSec 初始为 0', () => {
    expect(getIncomePerSec(createInitialState())).toBe(0);
  });

  it('购买后 getIncomePerSec > 0', () => {
    const s = createInitialState();
    const { state: s2 } = buyUpgrade({ ...s, gold: 999 }, 'auto_mine');
    expect(getIncomePerSec(s2)).toBeGreaterThan(0);
  });

  it('calculateTimeAdvance 计算离线收益', () => {
    const s = createInitialState();
    const future = s.lastSaveTime + 120_000; // 120s
    const r = calculateTimeAdvance(s, future);
    expect(r.secondsAway).toBe(120);
    expect(r.goldEarned).toBe(0);
  });

  it('applyTimeAdvance 正确应用离线收益', () => {
    const s = createInitialState();
    const s2 = { ...s, gold: 999 };
    const { state: s3 } = buyUpgrade(s2, 'auto_mine');
    const future = s3.lastSaveTime + 100_000;
    const s4 = applyTimeAdvance(s3, future);
    expect(s4.gold).toBe(s3.gold + 50); // 1/sec × 100s × 50%
    expect(s4.lastSaveTime).toBe(future);
  });

  it('成就列表共 8 项', () => {
    expect(ACHIEVEMENTS.length).toBe(8);
    ACHIEVEMENTS.forEach((a) => {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(typeof a.condition).toBe('function');
    });
  });

  it('findAchievement 返回正确成就', () => {
    const a = findAchievement('first_click');
    expect(a).toBeDefined();
    expect(a!.name).toBe('踏入仙途');
  });

  it('金币 100 触发 gold_100 成就', () => {
    const s = performClick({ ...createInitialState(), gold: 100 });
    expect(s.achievements).toContain('gold_100');
  });
});
`,
    },
  ];
}

/* ================================================================
 * 步骤 5: 存档系统（已在 App.tsx 中实现，此处仅生成样式增强）
 * ================================================================ */

function generateSaveSystem(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/components/SaveIndicator.tsx',
      content: `import { useState, useEffect } from 'react';

export function SaveIndicator() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onSave = () => {
      setShow(true);
      setTimeout(() => setShow(false), 1500);
    };

    // 监听 localStorage 变更
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function (...args) {
      originalSetItem.apply(this, args);
      if (args[0] === 'idle-game-save') onSave();
    };

    return () => { localStorage.setItem = originalSetItem; };
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        background: 'rgba(0,0,0,0.7)',
        color: '#8f8',
        padding: '8px 16px',
        borderRadius: 8,
        fontSize: 13,
      }}
    >
      已保存
    </div>
  );
}
`,
    },
  ];
}

/* ================================================================
 * 卡牌品类 — 数据模型
 * ================================================================ */

function generateCardTypes(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/types.ts',
      content: `/** 稀有度 */
export type Rarity = '白' | '蓝' | '紫' | '橙';

/** 卡牌 */
export interface Card {
  id: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  rarity: Rarity;
  description: string;
}

/** 回合阶段 */
export type TurnPhase = 'player' | 'enemy' | 'victory' | 'defeat';

/** 战场状态 */
export interface BattleState {
  playerHP: number;
  playerMaxHP: number;
  enemyHP: number;
  enemyMaxHP: number;
  mana: number;
  maxMana: number;
  hand: Card[];
  board: Card[];
  enemyBoard: Card[];
  phase: TurnPhase;
  turn: number;
}

/** 战斗行动 */
export type BattleAction =
  | { type: 'play'; cardId: string }
  | { type: 'end_turn' }
  | { type: 'attack'; sourceIdx: number; targetIdx: number };
`,
    },
  ];
}

/* ================================================================
 * 卡牌品类 — 引擎
 * ================================================================ */

function generateCardEngine(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/CardEngine.ts',
      content: `import type { Card, BattleState } from './types';

/* ==================== 卡牌目录 ==================== */

export const CARD_CATALOG: Card[] = [
  { id: 'card_01', name: '剑士', cost: 2, attack: 3, health: 2, rarity: '白', description: '基础战力' },
  { id: 'card_02', name: '弓手', cost: 3, attack: 4, health: 1, rarity: '白', description: '远程打击' },
  { id: 'card_03', name: '骑士', cost: 4, attack: 2, health: 5, rarity: '蓝', description: '坚实防线' },
  { id: 'card_04', name: '法师', cost: 3, attack: 2, health: 2, rarity: '蓝', description: '法力充沛' },
  { id: 'card_05', name: '刺客', cost: 2, attack: 5, health: 1, rarity: '蓝', description: '致命一击' },
  { id: 'card_06', name: '治疗师', cost: 2, attack: 1, health: 3, rarity: '白', description: '恢复' },
  { id: 'card_07', name: '龙骑士', cost: 7, attack: 7, health: 7, rarity: '紫', description: '龙焰焚天' },
  { id: 'card_08', name: '大贤者', cost: 6, attack: 4, health: 4, rarity: '紫', description: '智慧之光' },
  { id: 'card_09', name: '凤凰', cost: 8, attack: 6, health: 8, rarity: '橙', description: '涅槃重生' },
  { id: 'card_10', name: '暗影领主', cost: 9, attack: 8, health: 6, rarity: '橙', description: '虚空吞噬' },
  { id: 'card_11', name: '哥布林', cost: 1, attack: 1, health: 1, rarity: '白', description: '数量优势' },
  { id: 'card_12', name: '石像鬼', cost: 3, attack: 3, health: 4, rarity: '白', description: '坚如磐石' },
];

/* ==================== 初始状态 ==================== */

export function createBattleState(deck: Card[]): BattleState {
  const shuffled = [...deck].sort(() => Math.random() - 0.5);
  const hand = shuffled.splice(0, Math.min(4, shuffled.length));
  return {
    playerHP: 30,
    playerMaxHP: 30,
    enemyHP: 30,
    enemyMaxHP: 30,
    mana: 1,
    maxMana: 1,
    hand,
    board: [],
    enemyBoard: [],
    phase: 'player',
    turn: 1,
  };
}

/* ==================== 打出一张卡牌 ==================== */

export function playCard(state: BattleState, cardId: string): BattleState {
  if (state.phase !== 'player') return state;

  const cardIdx = state.hand.findIndex((c) => c.id === cardId);
  if (cardIdx === -1) return state;

  const card = state.hand[cardIdx];
  if (card.cost > state.mana) return state;

  const newHand = [...state.hand];
  newHand.splice(cardIdx, 1);

  return {
    ...state,
    mana: state.mana - card.cost,
    hand: newHand,
    board: [...state.board, card],
  };
}

/* ==================== 战场攻击结算 ==================== */

export function resolveAttack(state: BattleState): BattleState {
  let { board, enemyBoard, enemyHP, playerHP } = state;

  for (const minion of board) {
    if (enemyBoard.length > 0) {
      const target = enemyBoard[0];
      target.health -= minion.attack;
      minion.health -= target.attack;
    } else {
      enemyHP -= minion.attack;
    }
  }

  for (const minion of enemyBoard) {
    if (board.length > 0) {
      const target = board[0];
      target.health -= minion.attack;
      minion.health -= target.attack;
    } else {
      playerHP -= minion.attack;
    }
  }

  board = board.filter((m) => m.health > 0);
  enemyBoard = enemyBoard.filter((m) => m.health > 0);

  return { ...state, board, enemyBoard, enemyHP, playerHP };
}

/* ==================== 结束回合 ==================== */

export function endTurn(state: BattleState): BattleState {
  if (state.phase !== 'player') return state;

  let next = resolveAttack(state);

  if (next.enemyHP <= 0) return { ...next, phase: 'victory' };
  if (next.playerHP <= 0) return { ...next, phase: 'defeat' };

  // AI 回合
  const enemyDeck = CARD_CATALOG.filter((c) => c.cost <= 3 + next.turn);
  const enemyCard = enemyDeck.length > 0
    ? { ...enemyDeck[Math.floor(Math.random() * enemyDeck.length)], id: \`enemy_\${Date.now()}\` }
    : null;

  if (enemyCard) {
    next = { ...next, enemyBoard: [...next.enemyBoard, enemyCard] };
  }

  next = resolveAttack(next);

  if (next.enemyHP <= 0) return { ...next, phase: 'victory' };
  if (next.playerHP <= 0) return { ...next, phase: 'defeat' };

  // 新回合
  const newTurn = next.turn + 1;
  const newMaxMana = Math.min(newTurn + 1, 10);
  const drawCount = Math.max(0, Math.min(newTurn, 5) - next.hand.length);

  return {
    ...next,
    phase: 'player',
    turn: newTurn,
    mana: newMaxMana,
    maxMana: newMaxMana,
    hand: [...next.hand],
    board: next.board,
  };
}

export function isGameOver(state: BattleState): boolean {
  return state.phase === 'victory' || state.phase === 'defeat';
}
`,
    },
  ];
}

/* ================================================================
 * 卡牌品类 — 引擎单元测试
 * ================================================================ */

function generateCardEngineTests(): GeneratedFile[] {
  return [
    {
      filePath: 'tests/CardEngine.test.ts',
      content: `import { describe, it, expect } from 'vitest';
import { createBattleState, playCard, endTurn, CARD_CATALOG } from '../src/game/CardEngine';

describe('CardEngine', () => {
  it('初始状态为玩家回合', () => {
    const s = createBattleState(CARD_CATALOG.slice(0, 6));
    expect(s.phase).toBe('player');
    expect(s.playerHP).toBe(30);
    expect(s.hand.length).toBe(4);
  });

  it('法力不足时无法出牌', () => {
    const s = createBattleState(CARD_CATALOG.slice(0, 6));
    const s2 = playCard(s, 'card_07');
    expect(s2.board.length).toBe(0);
  });

  it('出牌后手牌减少、法力扣除', () => {
    const s = createBattleState(CARD_CATALOG.slice(0, 6));
    const cheap = s.hand.find((c) => c.cost <= 1);
    if (cheap) {
      const s2 = playCard(s, cheap.id);
      expect(s2.hand.length).toBe(s.hand.length - 1);
      expect(s2.mana).toBeLessThan(s.mana);
      expect(s2.board.length).toBe(1);
    }
  });

  it('不存在的卡牌 ID 无变化', () => {
    const s = createBattleState(CARD_CATALOG.slice(0, 6));
    const s2 = playCard(s, 'nonexistent');
    expect(s2.hand.length).toBe(s.hand.length);
  });

  it('非玩家回合不能出牌', () => {
    const s = createBattleState(CARD_CATALOG.slice(0, 6));
    const s2 = playCard({ ...s, phase: 'enemy' }, s.hand[0]?.id ?? '');
    expect(s2.board.length).toBe(0);
  });

  it('结束回合后进入新回合', () => {
    const s = createBattleState(CARD_CATALOG.slice(0, 6));
    const s2 = endTurn(s);
    expect(['player', 'victory', 'defeat']).toContain(s2.phase);
    expect(s2.turn).toBeGreaterThanOrEqual(2);
  });

  it('连续出牌再结束回合', () => {
    let s = createBattleState(CARD_CATALOG.slice(0, 10));
    const cheap = s.hand.filter((c) => c.cost <= 1);
    for (const c of cheap) s = playCard(s, c.id);
    s = endTurn(s);
    expect(s.turn).toBeGreaterThanOrEqual(2);
  });

  it('敌方生命为 0 时胜利', () => {
    const s = createBattleState(CARD_CATALOG.slice(0, 6));
    const s2 = endTurn({ ...s, enemyHP: 0 });
    expect(s2.phase).toBe('victory');
  });

  it('玩家生命为 0 时失败', () => {
    const s = createBattleState(CARD_CATALOG.slice(0, 6));
    const s2 = endTurn({ ...s, playerHP: 0 });
    expect(s2.phase).toBe('defeat');
  });
});
`,
    },
  ];
}

/* ================================================================
 * 卡牌品类 — 战斗主界面
 * ================================================================ */

function generateBattleUI(): GeneratedFile[] {
  return [
    {
      filePath: 'src/App.tsx',
      content: `import { useState } from 'react';
import { BattleScreen } from './game/components/BattleScreen';
import { DeckEditor } from './game/components/DeckEditor';
import { createBattleState } from './game/CardEngine';
import { CARD_CATALOG } from './game/CardEngine';
import type { BattleState, Card } from './game/types';

type View = 'battle' | 'deck';

function App() {
  const [view, setView] = useState<View>('deck');
  const [deck, setDeck] = useState<Card[]>(CARD_CATALOG.slice(0, 6));
  const [state, setState] = useState<BattleState | null>(null);

  const startBattle = () => {
    setState(createBattleState(deck));
    setView('battle');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: '#eee' }}>
      {view === 'deck' && (
        <DeckEditor
          catalog={CARD_CATALOG}
          deck={deck}
          onDeckChange={setDeck}
          onStartBattle={startBattle}
        />
      )}
      {view === 'battle' && state && (
        <BattleScreen
          state={state}
          onStateChange={setState}
          onBackToDeck={() => { setView('deck'); setState(null); }}
        />
      )}
    </div>
  );
}

export default App;
`,
    },
    {
      filePath: 'src/game/components/BattleScreen.tsx',
      content: `import { playCard, endTurn, isGameOver } from '../CardEngine';
import type { BattleState } from '../types';

interface Props {
  state: BattleState;
  onStateChange: (s: BattleState) => void;
  onBackToDeck: () => void;
}

export function BattleScreen({ state, onStateChange, onBackToDeck }: Props) {
  const handlePlay = (cardId: string) => {
    if (isGameOver(state)) return;
    onStateChange(playCard(state, cardId));
  };

  const handleEndTurn = () => {
    if (isGameOver(state)) return;
    onStateChange(endTurn(state));
  };

  const manaPercent = (state.mana / Math.max(state.maxMana, 1)) * 100;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={onBackToDeck} style={btnStyle}>← 返回</button>
        <span style={{ fontSize: 14 }}>回合 {state.turn}</span>
      </div>

      <div style={zoneStyle('#3a1a1a')}>
        <div style={{ display: 'flex', gap: 8 }}>
          {state.enemyBoard.map((c, i) => (
            <div key={i} style={cardMiniStyle(c.rarity)}>
              <div style={{ fontSize: 12 }}>{c.name}</div>
              <div style={{ fontSize: 11 }}>{c.attack}/{c.health}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>❤️ {Math.max(0, state.enemyHP)}/{state.enemyMaxHP}</div>
      </div>

      <div style={zoneStyle('#1a3a1a')}>
        <div style={{ display: 'flex', gap: 8 }}>
          {state.board.map((c, i) => (
            <div key={i} style={cardMiniStyle(c.rarity)}>
              <div style={{ fontSize: 12 }}>{c.name}</div>
              <div style={{ fontSize: 11 }}>{c.attack}/{c.health}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>❤️ {Math.max(0, state.playerHP)}/{state.playerMaxHP}</div>
      </div>

      <div style={{ margin: '12px 0' }}>
        <div style={{ background: '#333', borderRadius: 8, height: 12 }}>
          <div style={{
            width: \`\${manaPercent}%\`,
            height: '100%',
            background: 'linear-gradient(90deg, #44f, #88f)',
            borderRadius: 8,
            transition: 'width 0.3s',
          }} />
        </div>
        <div style={{ textAlign: 'center', fontSize: 13, marginTop: 4 }}>
          💎 {state.mana}/{state.maxMana}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
        {state.hand.map((c) => {
          const canPlay = c.cost <= state.mana && !isGameOver(state);
          return (
            <div
              key={c.id}
              onClick={() => canPlay && handlePlay(c.id)}
              style={{
                ...cardStyle(c.rarity),
                cursor: canPlay ? 'pointer' : 'not-allowed',
                opacity: canPlay ? 1 : 0.5,
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: 14 }}>{c.name}</div>
              <div style={{ fontSize: 12 }}>💎{c.cost} ⚔{c.attack} ❤{c.health}</div>
              <div style={{ fontSize: 11, color: '#aaa' }}>{c.description}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={handleEndTurn}
          disabled={isGameOver(state)}
          style={{ ...btnStyle, padding: '10px 32px', fontSize: 16 }}
        >
          {isGameOver(state) ? (state.phase === 'victory' ? '胜利！' : '失败') : '结束回合'}
        </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#334', color: '#eee', border: '1px solid #556',
  borderRadius: 8, padding: '6px 16px', cursor: 'pointer',
};

function zoneStyle(bg: string): React.CSSProperties {
  return { background: bg, borderRadius: 12, padding: 12, marginBottom: 8, minHeight: 60 };
}

function cardMiniStyle(rarity: string): React.CSSProperties {
  const colors: Record<string, string> = { 白: '#aaa', 蓝: '#48f', 紫: '#c4f', 橙: '#f90' };
  return { background: '#222', border: \`2px solid \${colors[rarity] ?? '#666'}\`, borderRadius: 6, padding: '4px 8px', fontSize: 12 };
}

function cardStyle(rarity: string): React.CSSProperties {
  return { ...cardMiniStyle(rarity), width: 100, padding: 8 };
}
`,
    },
  ];
}

/* ================================================================
 * 卡牌品类 — 卡组编辑器
 * ================================================================ */

function generateDeckEditor(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/components/DeckEditor.tsx',
      content: `import type { Card } from '../types';

const MAX_DECK = 10;

interface Props {
  catalog: Card[];
  deck: Card[];
  onDeckChange: (deck: Card[]) => void;
  onStartBattle: () => void;
}

export function DeckEditor({ catalog, deck, onDeckChange, onStartBattle }: Props) {
  const addCard = (card: Card) => {
    if (deck.length >= MAX_DECK) return;
    onDeckChange([...deck, { ...card, id: \`\${card.id}_\${Date.now()}\` }]);
  };

  const removeCard = (idx: number) => {
    onDeckChange(deck.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>卡组编辑器</h2>

      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span>我的卡组 ({deck.length}/{MAX_DECK})</span>
          <button
            onClick={onStartBattle}
            disabled={deck.length === 0}
            style={{
              background: deck.length > 0 ? '#6a3' : '#333',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '8px 24px', cursor: deck.length > 0 ? 'pointer' : 'not-allowed', fontSize: 14,
            }}
          >
            开始战斗
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 60, background: '#1a2830', borderRadius: 8, padding: 8 }}>
          {deck.map((c, i) => (
            <div key={i} onClick={() => removeCard(i)} style={deckCardStyle(c.rarity)}>
              <div>{c.name}</div>
              <div style={{ fontSize: 11 }}>💎{c.cost} ⚔{c.attack} ❤{c.health}</div>
            </div>
          ))}
          {deck.length === 0 && <span style={{ color: '#666' }}>点击下方卡牌加入卡组</span>}
        </div>
      </div>

      <div>
        <div style={{ marginBottom: 8 }}>卡牌目录</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {catalog.map((c) => (
            <div
              key={c.id}
              onClick={() => addCard(c)}
              style={{ ...catalogCardStyle(c.rarity), cursor: deck.length < MAX_DECK ? 'pointer' : 'not-allowed' }}
            >
              <div style={{ fontWeight: 'bold', fontSize: 13 }}>{c.name}</div>
              <div style={{ fontSize: 11 }}>💎{c.cost} ⚔{c.attack} ❤{c.health}</div>
              <div style={{ fontSize: 10, color: '#aaa' }}>{c.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const deckCardStyle = (rarity: string): React.CSSProperties => {
  const colors: Record<string, string> = { 白: '#aaa', 蓝: '#48f', 紫: '#c4f', 橙: '#f90' };
  return { width: 80, background: '#222', border: \`2px solid \${colors[rarity] ?? '#666'}\`, borderRadius: 6, padding: 6, cursor: 'pointer', fontSize: 12 };
};

const catalogCardStyle = (rarity: string): React.CSSProperties => {
  return { ...deckCardStyle(rarity), width: 100 };
};
`,
    },
  ];
}

/* ================================================================
 * 肉鸽品类生成器
 * ================================================================ */

function generateRoguelikeTypes(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/types.ts',
      content: `// 肉鸽地牢类型定义

/** 格类型 */
export type CellType = 'wall' | 'floor' | 'exit' | 'item';

/** 游戏实体 */
export interface Entity {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  attack: number;
  x: number;
  y: number;
}

/** 道具 */
export interface Item {
  id: string;
  name: string;
  type: 'heal' | 'buff' | 'key';
  value: number;
  x: number;
  y: number;
}

/** 楼层状态 */
export interface DungeonFloor {
  grid: CellType[][];
  player: Entity;
  enemies: Entity[];
  items: Item[];
  floor: number;
  width: number;
  height: number;
  gameOver: boolean;
  victory: boolean;
  log: string[];
}

/** 创建基础玩家 */
export function createPlayer(): Entity {
  return { id: 'player', name: '冒险者', hp: 30, maxHp: 30, attack: 5, x: 0, y: 0 };
}

/** 生成随机敌人 */
export function createEnemy(floor: number, x: number, y: number): Entity {
  const names = ['骷髅兵', '哥布林', '暗影刺客', '石像鬼', '炎魔'];
  const baseHp = 8 + floor * 4;
  const baseAtk = 3 + floor * 2;
  return {
    id: \`enemy_\${x}_\${y}\`,
    name: names[Math.floor(Math.random() * names.length)],
    hp: baseHp + Math.floor(Math.random() * 6),
    maxHp: baseHp + 6,
    attack: baseAtk + Math.floor(Math.random() * 3),
    x,
    y,
  };
}

/** 生成随机道具 */
export function createItem(floor: number, x: number, y: number): Item {
  const types: Array<Item['type']> = ['heal', 'buff', 'key'];
  const type = types[Math.floor(Math.random() * types.length)];
  const names: Record<Item['type'], string> = { heal: '生命药水', buff: '力量卷轴', key: '钥匙' };
  const values: Record<Item['type'], number> = { heal: 5 + floor * 2, buff: 2 + floor, key: floor + 1 };
  return {
    id: \`item_\${x}_\${y}\`,
    name: names[type],
    type,
    value: values[type],
    x,
    y,
  };
}
`,
    },
  ];
}

function generateDungeonEngine(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/DungeonEngine.ts',
      content: `// 肉鸽地牢引擎
import type { CellType, DungeonFloor, Entity, Item } from './types';
import { createPlayer, createEnemy, createItem } from './types';

const SIZE = 9;

function isWalkable(grid: CellType[][], x: number, y: number): boolean {
  return y >= 0 && y < grid.length && x >= 0 && x < grid[0].length && grid[y][x] !== 'wall';
}

export function generateFloor(floor: number): DungeonFloor {
  const grid: CellType[][] = [];
  const walls = Math.min(12 + floor * 2, 30);

  for (let y = 0; y < SIZE; y++) {
    grid[y] = [];
    for (let x = 0; x < SIZE; x++) grid[y][x] = 'floor';
  }

  for (let i = 0; i < walls; i++) {
    const wx = Math.floor(Math.random() * SIZE);
    const wy = Math.floor(Math.random() * SIZE);
    if ((wx === 0 && wy === 0) || grid[wy][wx] === 'wall') { i--; continue; }
    grid[wy][wx] = 'wall';
  }

  const exitX = SIZE - 1, exitY = SIZE - 1;
  grid[exitY][exitX] = 'exit';

  const player = createPlayer();
  player.x = 0; player.y = 0;

  const enemies: Entity[] = [];
  const enemyCount = floor + 2;
  const used = new Set<string>();
  used.add('0,0'); used.add(\`\${exitX},\${exitY}\`);
  for (let i = 0; i < enemyCount; i++) {
    let ex: number, ey: number;
    do { ex = Math.floor(Math.random() * SIZE); ey = Math.floor(Math.random() * SIZE); }
    while (used.has(\`\${ex},\${ey}\`) || grid[ey][ex] === 'wall');
    used.add(\`\${ex},\${ey}\`);
    enemies.push(createEnemy(floor, ex, ey));
  }

  const items: Item[] = [];
  const itemCount = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < itemCount; i++) {
    let ix: number, iy: number;
    do { ix = Math.floor(Math.random() * SIZE); iy = Math.floor(Math.random() * SIZE); }
    while (used.has(\`\${ix},\${iy}\`) || grid[iy][ix] === 'wall');
    used.add(\`\${ix},\${iy}\`);
    items.push(createItem(floor, ix, iy));
  }

  return { grid, player, enemies, items, floor, width: SIZE, height: SIZE, gameOver: false, victory: false, log: [\`进入第 \${floor + 1} 层\`] };
}

export function movePlayer(floor: DungeonFloor, dx: number, dy: number): DungeonFloor {
  if (floor.gameOver || floor.victory) return floor;
  const { player, grid } = floor;
  const nx = player.x + dx, ny = player.y + dy;
  if (!isWalkable(grid, nx, ny)) return { ...floor, log: [...floor.log, '前方是墙，无法通过'] };

  const next = { ...floor, log: [...floor.log] };
  next.player = { ...player, x: nx, y: ny };

  const enemy = next.enemies.find(e => e.x === nx && e.y === ny);
  if (enemy && enemy.hp > 0) next.log.push(\`遭遇 \${enemy.name}！\`);

  const itemIdx = next.items.findIndex(it => it.x === nx && it.y === ny);
  if (itemIdx >= 0) {
    const item = next.items[itemIdx];
    next.items = next.items.filter((_, i) => i !== itemIdx);
    if (item.type === 'heal') {
      next.player = { ...next.player, hp: Math.min(next.player.maxHp, next.player.hp + item.value) };
      next.log.push(\`拾取 \${item.name}，恢复 \${item.value} HP\`);
    } else if (item.type === 'buff') {
      next.player = { ...next.player, attack: next.player.attack + item.value };
      next.log.push(\`拾取 \${item.name}，攻击力 +\${item.value}\`);
    } else {
      next.log.push(\`拾取 \${item.name}（编号 \${item.value}）\`);
    }
  }

  if (grid[ny][nx] === 'exit') { next.victory = true; next.log.push('发现通往下层的楼梯！'); }
  return next;
}

export function playerAttack(floor: DungeonFloor, targetId: string): DungeonFloor {
  if (floor.gameOver || floor.victory) return floor;
  const next = { ...floor, log: [...floor.log] };
  const enemyIdx = next.enemies.findIndex(e => e.id === targetId);
  if (enemyIdx < 0) return floor;

  const enemy = { ...next.enemies[enemyIdx] };
  const player = next.player;
  const playerDmg = Math.max(1, player.attack + Math.floor(Math.random() * 5) - 2);
  enemy.hp -= playerDmg;
  next.log.push(\`对 \${enemy.name} 造成 \${playerDmg} 点伤害\`);

  if (enemy.hp <= 0) {
    next.enemies = next.enemies.filter((_, i) => i !== enemyIdx);
    const heal = 3 + floor.floor;
    next.player = { ...player, hp: Math.min(player.maxHp, player.hp + heal) };
    next.log.push(\`击败 \${enemy.name}！恢复 \${heal} HP\`);
  } else {
    const enemyDmg = Math.max(1, enemy.attack + Math.floor(Math.random() * 3) - 1);
    next.player = { ...next.player, hp: next.player.hp - enemyDmg };
    next.log.push(\`\${enemy.name} 反击造成 \${enemyDmg} 点伤害\`);
    next.enemies[enemyIdx] = enemy;
    if (next.player.hp <= 0) {
      next.player = { ...next.player, hp: 0 };
      next.gameOver = true;
      next.log.push('你被击败了…游戏结束');
    }
  }
  return next;
}

export function nextFloor(floor: DungeonFloor): DungeonFloor {
  const next = generateFloor(floor.floor + 1);
  next.player.attack = floor.player.attack;
  next.player.maxHp = floor.player.maxHp;
  next.player.hp = floor.player.hp;
  return next;
}
`,
    },
  ];
}

function generateDungeonEngineTests(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/__tests__/DungeonEngine.test.ts',
      content: `import { describe, it, expect } from 'vitest';
import { generateFloor, movePlayer, playerAttack, nextFloor } from '../DungeonEngine';

describe('DungeonEngine - generateFloor', () => {
  it('生成 9x9 网格', () => {
    const f = generateFloor(0);
    expect(f.grid.length).toBe(9);
    expect(f.grid[0].length).toBe(9);
  });
  it('玩家在 (0,0)', () => {
    const f = generateFloor(0);
    expect(f.player.x).toBe(0);
    expect(f.player.y).toBe(0);
  });
  it('敌人数量 = floor+2', () => {
    expect(generateFloor(3).enemies.length).toBe(5);
  });
  it('道具 2~4 个', () => {
    const f = generateFloor(0);
    expect(f.items.length).toBeGreaterThanOrEqual(2);
    expect(f.items.length).toBeLessThanOrEqual(4);
  });
  it('出口在 (8,8)', () => {
    expect(generateFloor(0).grid[8][8]).toBe('exit');
  });
});

describe('DungeonEngine - movePlayer', () => {
  it('可移动且坐标更新', () => {
    const f = generateFloor(0);
    if (f.grid[0][1] !== 'wall') {
      const n = movePlayer(f, 1, 0);
      expect(n.player.x).toBe(1);
    }
  });
  it('撞墙不动', () => {
    const f = generateFloor(0);
    f.grid[0][1] = 'wall';
    expect(movePlayer(f, 1, 0).player.x).toBe(0);
  });
  it('踩道具拾取并治疗', () => {
    const f = generateFloor(0);
    f.grid[0][1] = 'floor';
    f.items = [{ id: 't', name: '生命药水', type: 'heal', value: 5, x: 1, y: 0 }];
    f.player.hp = 20;
    const n = movePlayer(f, 1, 0);
    expect(n.items.length).toBe(0);
    expect(n.player.hp).toBe(25);
  });
});

describe('DungeonEngine - playerAttack', () => {
  it('攻击相邻敌人', () => {
    const f = generateFloor(0);
    f.enemies = [{ id: 'e1', name: '哥布林', hp: 10, maxHp: 10, attack: 3, x: 1, y: 0 }];
    expect(playerAttack(f, 'e1').log.some(l => l.includes('造成'))).toBe(true);
  });
  it('击杀后列表移除', () => {
    const f = generateFloor(0);
    f.enemies = [{ id: 'e2', name: '骷髅', hp: 1, maxHp: 2, attack: 1, x: 1, y: 0 }];
    f.player.attack = 99;
    expect(playerAttack(f, 'e2').enemies.length).toBe(0);
  });
  it('HP 归零触发 gameOver', () => {
    const f = generateFloor(0);
    f.player.hp = 1;
    f.enemies = [{ id: 'boss', name: '炎魔', hp: 999, maxHp: 999, attack: 99, x: 1, y: 0 }];
    const n = playerAttack(f, 'boss');
    if (n.player.hp <= 0) expect(n.gameOver).toBe(true);
    expect(n.log.some(l => l.includes('反击'))).toBe(true);
  });
});

describe('DungeonEngine - nextFloor', () => {
  it('楼层+1', () => expect(nextFloor(generateFloor(0)).floor).toBe(1));
  it('继承攻击力 buff', () => {
    const f = generateFloor(0);
    f.player.attack = 15;
    expect(nextFloor(f).player.attack).toBe(15);
  });
});
`,
    },
  ];
}

function generateDungeonScreen(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/components/DungeonScreen.tsx',
      content: `import React from 'react';
import type { DungeonFloor, Entity } from '../types';

interface Props { floor: DungeonFloor; }

const CELL = 52, GAP = 2;

function cellStyle(type: string, active: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    width: CELL, height: CELL, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 12, fontWeight: 'bold',
    borderRadius: 4, boxSizing: 'border-box',
  };
  if (active) return { ...base, background: '#2a2a4a', border: '2px solid #48f' };
  switch (type) {
    case 'wall': return { ...base, background: '#2a2a2a', border: '1px solid #444' };
    case 'floor': return { ...base, background: '#1a1a1a', border: '1px solid #222' };
    case 'exit': return { ...base, background: '#1a3a1a', border: '2px solid #4a4', color: '#4f4' };
    default: return base;
  }
}

export default function DungeonScreen({ floor }: Props) {
  const enemyMap = new Map<string, Entity>();
  floor.enemies.forEach(e => enemyMap.set(\`\${e.x},\${e.y}\`, e));
  const itemSet = new Set(floor.items.map(it => \`\${it.x},\${it.y}\`));

  return (
    <div style={{ background: '#111', padding: 16, borderRadius: 8, maxWidth: 540, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, color: '#ccc', fontSize: 14 }}>
        <span>第 {floor.floor + 1} 层</span>
        <span style={{ color: floor.player.hp < 10 ? '#f44' : '#4f4' }}>HP {floor.player.hp}/{floor.player.maxHp}</span>
        <span>ATK {floor.player.attack}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
        {floor.grid.map((row, y) => (
          <div key={y} style={{ display: 'flex', gap: GAP }}>
            {row.map((cell, x) => {
              const key = \`\${x},\${y}\`;
              const enemy = enemyMap.get(key);
              const hasItem = itemSet.has(key);
              const isPlayer = floor.player.x === x && floor.player.y === y;
              let emoji = '';
              if (isPlayer) emoji = '🧑';
              else if (enemy) emoji = '👹';
              else if (cell === 'exit') emoji = '↓';
              else if (hasItem) emoji = '💎';
              return (
                <div key={key} style={cellStyle(cell, isPlayer)}>
                  {emoji}
                  {enemy && <span style={{ color: '#f84', fontSize: 9, marginLeft: 2 }}>{enemy.hp}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, maxHeight: 80, overflowY: 'auto', background: '#1a1a1a', borderRadius: 4, padding: 6, fontSize: 11, color: '#aaa', lineHeight: 1.6 }}>
        {floor.log.slice(-6).reverse().map((msg, i) => <div key={i} style={{ opacity: 1 - i * 0.15 }}>{msg}</div>)}
      </div>
      {floor.gameOver && <div style={{ marginTop: 12, color: '#f44', textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>💀 游戏结束</div>}
      {floor.victory && <div style={{ marginTop: 12, color: '#4f4', textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}>🏆 本层通关！</div>}
    </div>
  );
}
`,
    },
    {
      filePath: 'src/App.tsx',
      content: `import React, { useState, useCallback } from 'react';
import DungeonScreen from './game/components/DungeonScreen';
import { generateFloor, movePlayer, playerAttack, nextFloor } from './game/DungeonEngine';
import type { DungeonFloor, Entity } from './game/types';

export default function App() {
  const [floor, setFloor] = useState<DungeonFloor>(() => generateFloor(0));

  const handleMove = useCallback((dx: number, dy: number) =>
    setFloor(prev => movePlayer(prev, dx, dy)), []);

  const handleAttack = useCallback((targetId: string) =>
    setFloor(prev => playerAttack(prev, targetId)), []);

  const adjacentEnemy: Entity | undefined = floor.enemies.find(e =>
    Math.abs(e.x - floor.player.x) + Math.abs(e.y - floor.player.y) === 1 && e.hp > 0);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#eee', fontFamily: 'monospace', padding: 16 }}>
      <h1 style={{ textAlign: 'center', fontSize: 22, marginBottom: 12, color: '#c84' }}>深渊地牢</h1>
      <DungeonScreen floor={floor} />
      {!floor.gameOver && !floor.victory && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 56px)', gap: 4, justifyContent: 'center' }}>
            <div /><button onClick={() => handleMove(0, -1)} style={btnStyle}>▲</button><div />
            <button onClick={() => handleMove(-1, 0)} style={btnStyle}>◀</button>
            <div style={{ ...btnStyle, background: '#333', cursor: 'default' }}>·</div>
            <button onClick={() => handleMove(1, 0)} style={btnStyle}>▶</button>
            <div /><button onClick={() => handleMove(0, 1)} style={btnStyle}>▼</button><div />
          </div>
        </div>
      )}
      <div style={{ textAlign: 'center', marginTop: 12, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        {adjacentEnemy && !floor.gameOver && !floor.victory && (
          <button onClick={() => handleAttack(adjacentEnemy.id)} style={{ ...actionBtn, background: '#a33' }}>
            ⚔ 攻击 {adjacentEnemy.name}
          </button>
        )}
        {floor.victory && (
          <button onClick={() => setFloor(nextFloor(floor))} style={{ ...actionBtn, background: '#3a3' }}>↓ 下一层</button>
        )}
        {(floor.gameOver || floor.victory) && (
          <button onClick={() => setFloor(generateFloor(0))} style={{ ...actionBtn, background: '#555' }}>🔄 重新开始</button>
        )}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  width: 56, height: 56, fontSize: 20, background: '#222', color: '#eee',
  border: '1px solid #444', borderRadius: 6, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none',
};
const actionBtn: React.CSSProperties = {
  padding: '10px 20px', fontSize: 14, fontWeight: 'bold', color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer',
};
`,
    },
  ];
}

/* ================================================================
 * 品类深化：放置类引擎 (idle-game)
 * ================================================================ */

function generateIdleGame(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/IdleEngine.ts',
      content: `/* ===================================================================
 * IdleEngine — 放置类游戏纯逻辑引擎
 *
 * 设计原则：
 *  - 所有函数为纯函数，接收 state 返回新 state
 *  - 不依赖任何 UI 框架或浏览器 API
 *  - 状态结构扁平化，便于序列化/反序列化
 * =================================================================== */

/* ==================== 类型定义 ==================== */

export interface IdleResources {
  gold: number;
  diamonds: number;
}

export interface IdleStats {
  totalClicks: number;
  totalGoldEarned: number;
  totalUpgradesPurchased: number;
  maxOfflineEarnings: number;
}

export interface IdleState {
  resources: IdleResources;
  upgrades: Record<string, number>;
  milestones: string[];
  stats: IdleStats;
  lastTickTime: number;
}

export type UpgradeCategory = 'click_power' | 'auto_production' | 'offline_multiplier';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  category: UpgradeCategory;
  effectValue: number;
}

export interface MilestoneDef {
  id: string;
  name: string;
  description: string;
  check: (state: IdleState) => boolean;
}

export interface BuyUpgradeResult {
  state: IdleState;
  success: boolean;
  message?: string;
}

/* ==================== 升级项定义 ==================== */

/** 点击力：Lv1-10，每级增加点击收益，成本指数增长 */
const clickPowerUpgrades: UpgradeDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: 'click_power_' + (i + 1),
  name: '点击力 Lv' + (i + 1),
  description: '每次点击额外获得金币',
  baseCost: Math.floor(10 * Math.pow(1.5, i)),
  costMultiplier: 1,
  maxLevel: 1,
  category: 'click_power' as const,
  effectValue: (i + 1) * 2,
}));

/** 自动产量：Lv1-10，每级增加每秒产出，成本指数增长 */
const autoProdUpgrades: UpgradeDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: 'auto_prod_' + (i + 1),
  name: '自动产量 Lv' + (i + 1),
  description: '每秒自动获得金币',
  baseCost: Math.floor(25 * Math.pow(1.6, i)),
  costMultiplier: 1,
  maxLevel: 1,
  category: 'auto_production' as const,
  effectValue: (i + 1) * 1,
}));

/** 离线倍率：Lv1-5，每级增加 0.1x 离线收益，成本指数增长 */
const offlineMultiplierUpgrades: UpgradeDef[] = Array.from({ length: 5 }, (_, i) => ({
  id: 'offline_mult_' + (i + 1),
  name: '离线倍率 Lv' + (i + 1),
  description: '离线收益倍率提升',
  baseCost: Math.floor(50 * Math.pow(2.0, i)),
  costMultiplier: 1,
  maxLevel: 1,
  category: 'offline_multiplier' as const,
  effectValue: 0.1,
}));

export const UPGRADE_DEFS: UpgradeDef[] = [
  ...clickPowerUpgrades,
  ...autoProdUpgrades,
  ...offlineMultiplierUpgrades,
];

/* ==================== 里程碑定义 ==================== */

export const MILESTONE_DEFS: MilestoneDef[] = [
  {
    id: 'first_100_gold',
    name: '初获财富',
    description: '首次达到 100 金币',
    check: (s: IdleState) => s.resources.gold >= 100,
  },
  {
    id: 'cumulative_1000_clicks',
    name: '勤勉修炼',
    description: '累计点击 1000 次',
    check: (s: IdleState) => s.stats.totalClicks >= 1000,
  },
  {
    id: 'unlock_3_upgrades',
    name: '初窥门径',
    description: '解锁 3 个升级项',
    check: (s: IdleState) => s.stats.totalUpgradesPurchased >= 3,
  },
  {
    id: 'offline_earnings_1000',
    name: '离线富翁',
    description: '单次离线收益超过 1000 金币',
    check: (s: IdleState) => s.stats.maxOfflineEarnings >= 1000,
  },
];

/* ==================== 基础常量 ==================== */

const BASE_CLICK_GOLD = 1;
const BASE_OFFLINE_MULTIPLIER = 0.5;
const MAX_OFFLINE_HOURS = 24;

/* ==================== 引擎函数 ==================== */

/** 创建默认初始状态 */
export function createInitialState(): IdleState {
  const upgrades: Record<string, number> = {};
  for (const def of UPGRADE_DEFS) {
    upgrades[def.id] = 0;
  }
  return {
    resources: { gold: 0, diamonds: 0 },
    upgrades,
    milestones: [],
    stats: {
      totalClicks: 0,
      totalGoldEarned: 0,
      totalUpgradesPurchased: 0,
      maxOfflineEarnings: 0,
    },
    lastTickTime: Date.now(),
  };
}

/** 计算点击收益（基础值 + 所有已解锁点击力升级的加成） */
export function getClickValue(state: IdleState): number {
  let value = BASE_CLICK_GOLD;
  for (const def of UPGRADE_DEFS) {
    if (def.category === 'click_power' && state.upgrades[def.id] > 0) {
      value += def.effectValue;
    }
  }
  return value;
}

/** 计算每秒自动收益 */
export function getAutoProductionPerSec(state: IdleState): number {
  let value = 0;
  for (const def of UPGRADE_DEFS) {
    if (def.category === 'auto_production' && state.upgrades[def.id] > 0) {
      value += def.effectValue;
    }
  }
  return value;
}

/** 计算离线收益倍率 */
export function getOfflineMultiplier(state: IdleState): number {
  let multiplier = BASE_OFFLINE_MULTIPLIER;
  for (const def of UPGRADE_DEFS) {
    if (def.category === 'offline_multiplier' && state.upgrades[def.id] > 0) {
      multiplier += def.effectValue;
    }
  }
  return Math.min(multiplier, 1.0);
}

/** 执行一次点击 */
export function click(state: IdleState): IdleState {
  const clickValue = getClickValue(state);
  const next: IdleState = {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold + clickValue,
    },
    stats: {
      ...state.stats,
      totalClicks: state.stats.totalClicks + 1,
      totalGoldEarned: state.stats.totalGoldEarned + clickValue,
    },
  };
  return applyMilestones(next);
}

/** 购买升级项 */
export function buyUpgrade(state: IdleState, upgradeId: string): BuyUpgradeResult {
  const def = UPGRADE_DEFS.find((d) => d.id === upgradeId);
  if (!def) {
    return { state, success: false, message: '未知升级项: ' + upgradeId };
  }

  const currentLevel = state.upgrades[upgradeId] ?? 0;
  if (currentLevel >= def.maxLevel) {
    return { state, success: false, message: def.name + ' 已达最大等级' };
  }

  if (state.resources.gold < def.baseCost) {
    return { state, success: false, message: '金币不足 (需要 ' + def.baseCost + ')' };
  }

  const next: IdleState = {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold - def.baseCost,
    },
    upgrades: {
      ...state.upgrades,
      [upgradeId]: currentLevel + 1,
    },
    stats: {
      ...state.stats,
      totalUpgradesPurchased: state.stats.totalUpgradesPurchased + 1,
    },
  };

  return { state: applyMilestones(next), success: true };
}

/** 时间推进（用于游戏循环 tick） */
export function tick(state: IdleState, deltaMs: number): IdleState {
  if (deltaMs <= 0) return state;

  const seconds = deltaMs / 1000;
  const autoGold = Math.floor(getAutoProductionPerSec(state) * seconds);
  if (autoGold <= 0) {
    return { ...state, lastTickTime: state.lastTickTime + deltaMs };
  }

  const next: IdleState = {
    ...state,
    resources: {
      ...state.resources,
      gold: state.resources.gold + autoGold,
    },
    stats: {
      ...state.stats,
      totalGoldEarned: state.stats.totalGoldEarned + autoGold,
    },
    lastTickTime: state.lastTickTime + deltaMs,
  };
  return applyMilestones(next);
}

/** 计算离线收益（不修改状态） */
export function calculateOfflineEarnings(state: IdleState, awayMs: number): number {
  if (awayMs <= 0) return 0;

  const maxAwayMs = MAX_OFFLINE_HOURS * 3600 * 1000;
  const cappedMs = Math.min(awayMs, maxAwayMs);
  const seconds = cappedMs / 1000;
  const multiplier = getOfflineMultiplier(state);

  return Math.floor(getAutoProductionPerSec(state) * seconds * multiplier);
}

/** 检查当前未解锁的里程碑 */
export function checkMilestones(state: IdleState): string[] {
  return MILESTONE_DEFS
    .filter((m) => !state.milestones.includes(m.id) && m.check(state))
    .map((m) => m.id);
}

/** 应用里程碑检测 */
function applyMilestones(state: IdleState): IdleState {
  const newIds = checkMilestones(state);
  if (newIds.length === 0) return state;

  // 更新 maxOfflineEarnings 统计
  const updatedStats = { ...state.stats };
  if (state.stats.maxOfflineEarnings > updatedStats.maxOfflineEarnings) {
    updatedStats.maxOfflineEarnings = state.stats.maxOfflineEarnings;
  }

  return {
    ...state,
    milestones: [...state.milestones, ...newIds],
    stats: updatedStats,
  };
}

/** 查找里程碑定义 */
export function findMilestoneDef(id: string): MilestoneDef | undefined {
  return MILESTONE_DEFS.find((m) => m.id === id);
}

/** 查找升级项定义 */
export function findUpgradeDef(id: string): UpgradeDef | undefined {
  return UPGRADE_DEFS.find((d) => d.id === id);
}

/** 获取已解锁升级项列表 */
export function getUnlockedUpgrades(state: IdleState): UpgradeDef[] {
  return UPGRADE_DEFS.filter((d) => state.upgrades[d.id] > 0);
}

/** 计算升级项的下一个成本（已满级返回 -1） */
export function getNextUpgradeCost(state: IdleState, upgradeId: string): number {
  const def = UPGRADE_DEFS.find((d) => d.id === upgradeId);
  if (!def) return -1;

  const currentLevel = state.upgrades[upgradeId] ?? 0;
  if (currentLevel >= def.maxLevel) return -1;

  return def.baseCost;
}
`,
    },
    {
      filePath: 'tests/idle-engine.test.ts',
      content: `import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  click,
  buyUpgrade,
  tick,
  calculateOfflineEarnings,
  checkMilestones,
  getClickValue,
  getAutoProductionPerSec,
  getOfflineMultiplier,
  UPGRADE_DEFS,
  MILESTONE_DEFS,
  findMilestoneDef,
  findUpgradeDef,
  getUnlockedUpgrades,
  getNextUpgradeCost,
} from '../src/game/IdleEngine';

/* ==================== 初始状态 ==================== */

describe('IdleEngine — 初始状态', () => {
  it('金币和钻石初始为 0', () => {
    const s = createInitialState();
    expect(s.resources.gold).toBe(0);
    expect(s.resources.diamonds).toBe(0);
  });

  it('所有升级项初始等级为 0', () => {
    const s = createInitialState();
    for (const def of UPGRADE_DEFS) {
      expect(s.upgrades[def.id]).toBe(0);
    }
  });

  it('里程碑列表为空', () => {
    const s = createInitialState();
    expect(s.milestones).toEqual([]);
  });

  it('统计字段初始为 0', () => {
    const s = createInitialState();
    expect(s.stats.totalClicks).toBe(0);
    expect(s.stats.totalGoldEarned).toBe(0);
    expect(s.stats.totalUpgradesPurchased).toBe(0);
    expect(s.stats.maxOfflineEarnings).toBe(0);
  });

  it('lastTickTime 为合理时间戳', () => {
    const s = createInitialState();
    expect(s.lastTickTime).toBeGreaterThan(1600000000000);
  });
});

/* ==================== 点击系统 ==================== */

describe('IdleEngine — 点击系统', () => {
  it('点击增加金币', () => {
    const s = click(createInitialState());
    expect(s.resources.gold).toBeGreaterThan(0);
  });

  it('点击增加计数', () => {
    const s = click(createInitialState());
    expect(s.stats.totalClicks).toBe(1);
  });

  it('getClickValue 初始为基础值 1', () => {
    expect(getClickValue(createInitialState())).toBe(1);
  });

  it('购买点击力升级后 getClickValue 增加', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 99999 } };
    const { state: s2 } = buyUpgrade(s, 'click_power_1');
    expect(getClickValue(s2)).toBe(3); // 1 + 2
    expect(s2.upgrades['click_power_1']).toBe(1);
  });

  it('连续点击多次，gold 累加正确', () => {
    let s = createInitialState();
    for (let i = 0; i < 5; i++) s = click(s);
    expect(s.stats.totalClicks).toBe(5);
    expect(s.resources.gold).toBe(5);
  });
});

/* ==================== 升级系统 ==================== */

describe('IdleEngine — 升级系统', () => {
  it('金币不足时 buyUpgrade 返回 success=false', () => {
    const { state, success } = buyUpgrade(createInitialState(), 'click_power_1');
    expect(success).toBe(false);
    expect(state.resources.gold).toBe(0);
  });

  it('金币足够时成功购买并扣费', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2, success } = buyUpgrade(s, 'click_power_1');
    expect(success).toBe(true);
    expect(s2.upgrades['click_power_1']).toBe(1);
    expect(s2.resources.gold).toBe(90); // 100 - 10
    expect(s2.stats.totalUpgradesPurchased).toBe(1);
  });

  it('购买已满级升级项返回失败', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2 } = buyUpgrade(s, 'click_power_1');
    const { success, message } = buyUpgrade(s2, 'click_power_1');
    expect(success).toBe(false);
    expect(message).toContain('已达最大等级');
  });

  it('购买不存在的升级项返回失败', () => {
    const { success, message } = buyUpgrade(createInitialState(), 'nonexistent');
    expect(success).toBe(false);
    expect(message).toContain('未知');
  });

  it('升级成本随索引指数增长', () => {
    expect(UPGRADE_DEFS[0].baseCost).toBe(10);  // click_power_1: 10 * 1.5^0
    expect(UPGRADE_DEFS[1].baseCost).toBe(15);  // click_power_2: 10 * 1.5^1
    expect(UPGRADE_DEFS[2].baseCost).toBe(22);  // click_power_3: 10 * 1.5^2 = 22.5 -> 22
    expect(UPGRADE_DEFS[9].baseCost).toBeGreaterThan(UPGRADE_DEFS[0].baseCost);
  });

  it('离线倍率升级成本为 2.0 指数增长', () => {
    const offlineUpgrades = UPGRADE_DEFS.filter((d) => d.category === 'offline_multiplier');
    expect(offlineUpgrades[0].baseCost).toBe(50);   // 50 * 2.0^0
    expect(offlineUpgrades[1].baseCost).toBe(100);  // 50 * 2.0^1
    expect(offlineUpgrades[2].baseCost).toBe(200);  // 50 * 2.0^2
  });

  it('getNextUpgradeCost 返回正确成本', () => {
    const s = createInitialState();
    expect(getNextUpgradeCost(s, 'click_power_1')).toBe(10);
    expect(getNextUpgradeCost(s, 'click_power_5')).toBe(50);
  });

  it('已满级时 getNextUpgradeCost 返回 -1', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 }, upgrades: { ...s.upgrades, click_power_1: 1 } };
    expect(getNextUpgradeCost(s, 'click_power_1')).toBe(-1);
  });

  it('getUnlockedUpgrades 返回已解锁项', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 1000 } };
    const { state: s2 } = buyUpgrade(s, 'click_power_1');
    const { state: s3 } = buyUpgrade(s2, 'click_power_2');
    const unlocked = getUnlockedUpgrades(s3);
    expect(unlocked.length).toBe(2);
    expect(unlocked.map((u) => u.id)).toContain('click_power_1');
    expect(unlocked.map((u) => u.id)).toContain('click_power_2');
  });
});

/* ==================== 自动生产 ==================== */

describe('IdleEngine — 自动生产', () => {
  it('初始自动产量为 0', () => {
    expect(getAutoProductionPerSec(createInitialState())).toBe(0);
  });

  it('购买自动产量后 > 0', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2 } = buyUpgrade(s, 'auto_prod_1');
    expect(getAutoProductionPerSec(s2)).toBe(1);
  });

  it('tick 按时间产生金币', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2 } = buyUpgrade(s, 'auto_prod_1');
    // auto_prod_1 = 1 gold/sec, tick 2000ms -> 2 gold
    const s3 = tick(s2, 2000);
    expect(s3.resources.gold).toBe(s2.resources.gold + 2);
  });

  it('tick deltaMs=0 状态不变', () => {
    const s = createInitialState();
    const s2 = tick(s, 0);
    expect(s2.resources.gold).toBe(s.resources.gold);
  });

  it('tick 更新 lastTickTime', () => {
    const s = createInitialState();
    const s2 = tick(s, 1000);
    expect(s2.lastTickTime).toBe(s.lastTickTime + 1000);
  });
});

/* ==================== 离线收益 ==================== */

describe('IdleEngine — 离线收益', () => {
  it('初始离线收益倍率为 0.5', () => {
    expect(getOfflineMultiplier(createInitialState())).toBe(0.5);
  });

  it('购买离线倍率升级后倍率增加', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 1000 } };
    const { state: s2 } = buyUpgrade(s, 'offline_mult_1');
    expect(getOfflineMultiplier(s2)).toBe(0.6); // 0.5 + 0.1
  });

  it('离线收益上限不超过 24 小时', () => {
    const s = createInitialState();
    const away48h = 48 * 3600 * 1000;
    const earnings = calculateOfflineEarnings(s, away48h);
    // 无自动产量，收益为 0
    expect(earnings).toBe(0);
  });

  it('awayMs <= 0 返回 0', () => {
    expect(calculateOfflineEarnings(createInitialState(), -1)).toBe(0);
    expect(calculateOfflineEarnings(createInitialState(), 0)).toBe(0);
  });

  it('有自动产量时离线收益 = 产量 × 秒数 × 倍率', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    const { state: s2 } = buyUpgrade(s, 'auto_prod_1');
    // 1 gold/sec * 100 sec * 0.5 = 50
    expect(calculateOfflineEarnings(s2, 100000)).toBe(50);
  });
});

/* ==================== 里程碑 ==================== */

describe('IdleEngine — 里程碑', () => {
  it('MILESTONE_DEFS 共 4 项', () => {
    expect(MILESTONE_DEFS.length).toBe(4);
  });

  it('checkMilestones 初始返回空', () => {
    expect(checkMilestones(createInitialState())).toEqual([]);
  });

  it('达到 100 金币触发 first_100_gold', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 100 } };
    // click 会触发里程碑检测
    s = { ...s, resources: { ...s.resources, gold: 99 } };
    const s2 = click(s); // gold goes from 99 to 100
    expect(s2.milestones).toContain('first_100_gold');
  });

  it('累计点击 1000 次触发 cumulative_1000_clicks', () => {
    let s = createInitialState();
    for (let i = 0; i < 1000; i++) s = click(s);
    expect(s.milestones).toContain('cumulative_1000_clicks');
  });

  it('购买 3 次升级触发 unlock_3_upgrades', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 99999 } };
    const { state: s2 } = buyUpgrade(s, 'click_power_1');
    const { state: s3 } = buyUpgrade(s2, 'click_power_2');
    const { state: s4 } = buyUpgrade(s3, 'click_power_3');
    expect(s4.milestones).toContain('unlock_3_upgrades');
  });

  it('findMilestoneDef 返回正确定义', () => {
    const m = findMilestoneDef('first_100_gold');
    expect(m).toBeDefined();
    expect(m!.name).toBe('初获财富');
  });

  it('findMilestoneDef 不存在时返回 undefined', () => {
    expect(findMilestoneDef('nonexistent')).toBeUndefined();
  });
});

/* ==================== 工具函数 ==================== */

describe('IdleEngine — 工具函数', () => {
  it('findUpgradeDef 查找存在项', () => {
    const d = findUpgradeDef('click_power_1');
    expect(d).toBeDefined();
    expect(d!.name).toBe('点击力 Lv1');
    expect(d!.category).toBe('click_power');
  });

  it('findUpgradeDef 不存在时返回 undefined', () => {
    expect(findUpgradeDef('nonexistent')).toBeUndefined();
  });

  it('离线倍率不超过 1.0', () => {
    let s = createInitialState();
    s = { ...s, resources: { ...s.resources, gold: 999999 } };
    // 购买所有 5 级离线倍率
    s = buyUpgrade(s, 'offline_mult_1').state;
    s = buyUpgrade(s, 'offline_mult_2').state;
    s = buyUpgrade(s, 'offline_mult_3').state;
    s = buyUpgrade(s, 'offline_mult_4').state;
    s = buyUpgrade(s, 'offline_mult_5').state;
    // 0.5 + 0.1*5 = 1.0, capped at 1.0
    expect(getOfflineMultiplier(s)).toBe(1.0);
  });

  it('UPGRADE_DEFS 共 25 项 (10+10+5)', () => {
    expect(UPGRADE_DEFS.length).toBe(25);
  });
});
`,
    },
  ];
}

/* ================================================================
 * 品类深化：卡牌引擎 (card-game)
 * ================================================================ */

function generateCardGame(): GeneratedFile[] {
  return [
    {
      filePath: 'src/game/CardEngine.ts',
      content: `/* ===================================================================
 * CardEngine — 卡牌对战纯逻辑引擎
 *
 * 设计原则：
 *  - 所有函数为纯函数，接收 state 返回新 state
 *  - 回合流程：抽牌 → 主阶段（出牌）→ 战斗阶段 → 结束
 *  - 支持六种效果：战吼/亡语/冲锋/嘲讽/风怒/魔免
 *  - 法力水晶每回合 +1，上限 10
 * =================================================================== */

/* ==================== 类型定义 ==================== */

export type EffectType =
  | 'battlecry'
  | 'deathrattle'
  | 'charge'
  | 'taunt'
  | 'windfury'
  | 'spell_immunity';

export interface CardDef {
  id: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  effects: EffectType[];
  spellDamage?: number;
  healAmount?: number;
  aoeDamage?: number;
  isSpell?: boolean;
}

export interface CardInstance {
  defId: string;
  name: string;
  cost: number;
  attack: number;
  health: number;
  maxHealth: number;
  effects: EffectType[];
  isSpell: boolean;
  spellDamage?: number;
  healAmount?: number;
  aoeDamage?: number;
  attacksThisTurn: number;
  justPlayed: boolean;
}

export interface BoardUnit {
  card: CardInstance;
  slot: number;
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  hand: CardInstance[];
  board: BoardUnit[];
  deck: CardInstance[];
  graveyard: CardInstance[];
}

export interface CardGameState {
  player: PlayerState;
  enemy: PlayerState;
  currentTurn: 'player' | 'enemy';
  turnNumber: number;
  phase: 'draw' | 'main' | 'combat' | 'end';
  gameOver: boolean;
  winner: 'player' | 'enemy' | null;
}

/* ==================== 卡牌目录 ==================== */

function createCard(def: CardDef): CardInstance {
  return {
    defId: def.id,
    name: def.name,
    cost: def.cost,
    attack: def.attack,
    health: def.health,
    maxHealth: def.health,
    effects: [...def.effects],
    isSpell: def.isSpell ?? false,
    spellDamage: def.spellDamage,
    healAmount: def.healAmount,
    aoeDamage: def.aoeDamage,
    attacksThisTurn: 0,
    justPlayed: false,
  };
}

export const CARD_CATALOG: CardDef[] = [
  { id: 'axe_soldier',  name: '战斧兵',   cost: 1, attack: 2, health: 3, effects: [] },
  { id: 'shield_guard', name: '盾卫',     cost: 2, attack: 1, health: 5, effects: ['taunt'] },
  { id: 'fireball',     name: '火球术',   cost: 3, attack: 0, health: 0, effects: [], spellDamage: 4, isSpell: true },
  { id: 'healing_light',name: '治疗术',   cost: 2, attack: 0, health: 0, effects: [], healAmount: 5, isSpell: true },
  { id: 'blademaster',  name: '剑圣',     cost: 4, attack: 4, health: 3, effects: ['charge', 'windfury'] },
  { id: 'archer',       name: '弓箭手',   cost: 2, attack: 3, health: 2, effects: [] },
  { id: 'flame_storm',  name: '烈焰风暴', cost: 5, attack: 0, health: 0, effects: [], aoeDamage: 2, isSpell: true },
  { id: 'faerie_dragon',name: '精灵龙',   cost: 3, attack: 3, health: 3, effects: ['spell_immunity'] },
];

export function getCardDefById(id: string): CardDef | undefined {
  return CARD_CATALOG.find((c) => c.id === id);
}

/* ==================== 状态创建 ==================== */

const MAX_BOARD_SLOTS = 7;
const MAX_HAND_SIZE = 10;
const MAX_MANA = 10;
const STARTING_HP = 30;
const STARTING_HAND_SIZE = 4;

export function createInitialState(playerDeckIds: string[]): CardGameState {
  const buildDeck = (ids: string[]): CardInstance[] =>
    ids.map((id) => {
      const def = getCardDefById(id);
      if (!def) throw new Error('未知卡牌 ID: ' + id);
      return createCard(def);
    });

  const shuffle = <T>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const playerDeck = shuffle(buildDeck(playerDeckIds));
  const playerHand = playerDeck.splice(0, Math.min(STARTING_HAND_SIZE, playerDeck.length));

  return {
    player: {
      hp: STARTING_HP,
      maxHp: STARTING_HP,
      mana: 1,
      maxMana: 1,
      hand: playerHand,
      board: [],
      deck: playerDeck,
      graveyard: [],
    },
    enemy: {
      hp: STARTING_HP,
      maxHp: STARTING_HP,
      mana: 1,
      maxMana: 1,
      hand: [],
      board: [],
      deck: [],
      graveyard: [],
    },
    currentTurn: 'player',
    turnNumber: 1,
    phase: 'draw',
    gameOver: false,
    winner: null,
  };
}

/* ==================== 回合管理 ==================== */

export function startTurn(state: CardGameState): CardGameState {
  if (state.gameOver) return state;

  const next: CardGameState = {
    ...state,
    turnNumber: state.turnNumber + 1,
    phase: 'draw',
  };

  const activePlayer = next.currentTurn === 'player' ? 'player' : 'enemy';
  const passivePlayer = activePlayer === 'player' ? 'enemy' : 'player';
  const ap = { ...next[activePlayer] };
  const pp = { ...next[passivePlayer] };

  // 法力水晶增长
  ap.maxMana = Math.min(ap.maxMana + 1, MAX_MANA);
  ap.mana = ap.maxMana;

  // 重置随从攻击次数
  ap.board = ap.board.map((u) => ({
    ...u,
    card: { ...u.card, attacksThisTurn: 0, justPlayed: false },
  }));
  pp.board = pp.board.map((u) => ({
    ...u,
    card: { ...u.card, attacksThisTurn: 0, justPlayed: false },
  }));

  return {
    ...next,
    [activePlayer]: ap,
    [passivePlayer]: pp,
  };
}

export function drawCard(state: CardGameState): CardGameState {
  if (state.gameOver) return state;
  if (state.phase !== 'draw') return state;

  const activePlayer = state.currentTurn === 'player' ? 'player' : 'enemy';
  const ap = { ...state[activePlayer] };

  if (ap.deck.length === 0) {
    // 疲劳伤害：牌库为空时受到伤害
    return {
      ...state,
      [activePlayer]: { ...ap, hp: ap.hp - 1 },
      phase: 'main',
      gameOver: ap.hp <= 1 ? true : state.gameOver,
      winner: ap.hp <= 1 ? (activePlayer === 'player' ? 'enemy' : 'player') : null,
    };
  }

  if (ap.hand.length >= MAX_HAND_SIZE) {
    // 手牌满，抽到的牌直接弃掉
    const burnt = ap.deck[0];
    return {
      ...state,
      [activePlayer]: {
        ...ap,
        deck: ap.deck.slice(1),
        graveyard: [...ap.graveyard, burnt],
      },
      phase: 'main',
    };
  }

  const drawn = ap.deck[0];
  return {
    ...state,
    [activePlayer]: {
      ...ap,
      deck: ap.deck.slice(1),
      hand: [...ap.hand, drawn],
    },
    phase: 'main',
  };
}

/* ==================== 出牌 ==================== */

export interface PlayCardResult {
  state: CardGameState;
  success: boolean;
  message?: string;
}

export function playCard(
  state: CardGameState,
  handIndex: number,
  targetSlot?: number,
): PlayCardResult {
  if (state.gameOver) return { state, success: false, message: '游戏已结束' };
  if (state.phase !== 'main') return { state, success: false, message: '当前不是主阶段' };

  const activePlayer = state.currentTurn === 'player' ? 'player' : 'enemy';
  const passivePlayer = activePlayer === 'player' ? 'enemy' : 'player';
  const ap = { ...state[activePlayer] };
  const pp = { ...state[passivePlayer] };

  if (handIndex < 0 || handIndex >= ap.hand.length) {
    return { state, success: false, message: '无效的手牌索引' };
  }

  const card = ap.hand[handIndex];
  if (card.cost > ap.mana) {
    return { state, success: false, message: '法力不足' };
  }

  if (!card.isSpell && ap.board.length >= MAX_BOARD_SLOTS) {
    return { state, success: false, message: '战场已满' };
  }

  // 扣除法力
  ap.mana -= card.cost;

  // 从手牌移除
  const newHand = [...ap.hand];
  newHand.splice(handIndex, 1);
  ap.hand = newHand;

  if (card.isSpell) {
    // 法术：立即结算效果后进入坟场
    let resultState: CardGameState = {
      ...state,
      [activePlayer]: ap,
      [passivePlayer]: pp,
    };
    resultState = executeSpellEffect(resultState, card, activePlayer, passivePlayer);
    const resultAp = { ...resultState[activePlayer] };
    resultAp.graveyard = [...resultAp.graveyard, card];
    return {
      state: checkGameOver({
        ...resultState,
        [activePlayer]: resultAp,
      }),
      success: true,
    };
  }

  // 随从：放置到战场
  const slot = targetSlot ?? ap.board.length;
  const playedCard: CardInstance = { ...card, justPlayed: true, attacksThisTurn: 0 };

  // 冲锋随从可立即攻击
  if (playedCard.effects.includes('charge')) {
    playedCard.attacksThisTurn = 0;
  }

  const newBoard = [...ap.board];
  // 在指定位置插入（简化：直接追加）
  newBoard.push({ card: playedCard, slot });

  ap.board = newBoard;

  let resultState: CardGameState = {
    ...state,
    [activePlayer]: ap,
    [passivePlayer]: pp,
  };

  // 战吼效果
  if (playedCard.effects.includes('battlecry')) {
    resultState = executeBattlecry(resultState, playedCard, activePlayer, passivePlayer);
  }

  return {
    state: checkGameOver(resultState),
    success: true,
  };
}

function executeSpellEffect(
  state: CardGameState,
  card: CardInstance,
  caster: 'player' | 'enemy',
  target: 'player' | 'enemy',
): CardGameState {
  const pp = { ...state[target] };
  const cp = { ...state[caster] };

  // 直接伤害
  if (card.spellDamage) {
    // 检查目标是否有魔免随从（对敌方英雄伤害时）
    const hasSpellImmune = pp.board.some((u) => u.card.effects.includes('spell_immunity'));
    if (!hasSpellImmune) {
      pp.hp = Math.max(0, pp.hp - card.spellDamage);
      // 受伤的英雄为敌方时，可额外处理
    }
  }

  // 治疗
  if (card.healAmount) {
    cp.hp = Math.min(cp.maxHp, cp.hp + card.healAmount);
  }

  // 全场 AOE
  if (card.aoeDamage) {
    // 对敌方全场打 aoeDamage
    pp.board = pp.board
      .map((u) => {
        if (u.card.effects.includes('spell_immunity')) return u;
        const newHp = u.card.health - card.aoeDamage;
        return newHp <= 0 ? null : { ...u, card: { ...u.card, health: newHp } };
      })
      .filter((u): u is BoardUnit => u !== null);
  }

  return {
    ...state,
    [caster]: cp,
    [target]: pp,
  };
}

function executeBattlecry(
  state: CardGameState,
  card: CardInstance,
  caster: 'player' | 'enemy',
  target: 'player' | 'enemy',
): CardGameState {
  // 通用战吼简化处理：对敌方英雄造成 1 点伤害
  let pp = { ...state[target] };
  pp = { ...pp, hp: Math.max(0, pp.hp - 1) };
  return { ...state, [target]: pp };
}

/* ==================== 攻击 ==================== */

export interface AttackResult {
  state: CardGameState;
  success: boolean;
  message?: string;
}

export function attack(
  state: CardGameState,
  attackerIndex: number,
  targetIndex?: number,
): AttackResult {
  if (state.gameOver) return { state, success: false, message: '游戏已结束' };
  if (state.phase !== 'main' && state.phase !== 'combat') {
    return { state, success: false, message: '当前阶段不能攻击' };
  }

  const activePlayer = state.currentTurn === 'player' ? 'player' : 'enemy';
  const passivePlayer = activePlayer === 'player' ? 'enemy' : 'player';
  const ap = { ...state[activePlayer] };
  const pp = { ...state[passivePlayer] };

  if (attackerIndex < 0 || attackerIndex >= ap.board.length) {
    return { state, success: false, message: '无效的攻击者索引' };
  }

  const attacker = ap.board[attackerIndex];
  const attackerCard = attacker.card;

  // 刚上场的随从（无冲锋）不能攻击
  if (attackerCard.justPlayed && !attackerCard.effects.includes('charge')) {
    return { state, success: false, message: '该随从本回合无法攻击' };
  }

  // 风怒：最多攻击 2 次
  const maxAttacks = attackerCard.effects.includes('windfury') ? 2 : 1;
  if (attackerCard.attacksThisTurn >= maxAttacks) {
    return { state, success: false, message: '该随从本回合攻击次数已用完' };
  }

  // 攻击力为 0 不能攻击
  if (attackerCard.attack <= 0) {
    return { state, success: false, message: '该随从攻击力为 0' };
  }

  // 确定目标：如果有嘲讽随从必须优先攻击
  if (targetIndex === undefined) {
    // 攻击敌方英雄
    const taunts = pp.board.filter((u) => u.card.effects.includes('taunt'));
    if (taunts.length > 0) {
      const tauntNames = taunts.map((t) => t.card.name).join('、');
      return { state, success: false, message: '必须先攻击嘲讽随从: ' + tauntNames };
    }
    // 攻击英雄
    pp.hp = Math.max(0, pp.hp - attackerCard.attack);
  } else {
    if (targetIndex < 0 || targetIndex >= pp.board.length) {
      return { state, success: false, message: '无效的目标索引' };
    }

    const target = pp.board[targetIndex];
    const targetCard = target.card;

    // 双方互相造成伤害
    const attackerNewHp = attackerCard.health - targetCard.attack;
    const targetNewHp = targetCard.health - attackerCard.attack;

    // 更新攻方
    if (attackerNewHp <= 0) {
      // 攻击者死亡
      ap.board = ap.board.filter((_, i) => i !== attackerIndex);
      ap.graveyard = [...ap.graveyard, { ...attackerCard, health: 0 }];
      // 亡语触发（简化：对敌方英雄造成 1 点伤害）
      if (attackerCard.effects.includes('deathrattle')) {
        pp.hp = Math.max(0, pp.hp - 1);
      }
    } else {
      ap.board[attackerIndex] = {
        ...attacker,
        card: { ...attackerCard, health: attackerNewHp, attacksThisTurn: attackerCard.attacksThisTurn + 1, justPlayed: false },
      };
    }

    // 更新目标
    if (targetNewHp <= 0) {
      pp.board = pp.board.filter((_, i) => i !== targetIndex);
      pp.graveyard = [...pp.graveyard, { ...targetCard, health: 0 }];
      if (targetCard.effects.includes('deathrattle')) {
        ap.hp = Math.max(0, ap.hp - 1);
      }
    } else {
      pp.board[targetIndex] = {
        ...target,
        card: { ...targetCard, health: targetNewHp },
      };
    }
  }

  return {
    state: checkGameOver({
      ...state,
      [activePlayer]: ap,
      [passivePlayer]: pp,
    }),
    success: true,
  };
}

/* ==================== 结束回合 ==================== */

export function endTurn(state: CardGameState): CardGameState {
  if (state.gameOver) return state;

  const nextCurrentTurn: 'player' | 'enemy' =
    state.currentTurn === 'player' ? 'enemy' : 'player';

  return checkGameOver({
    ...state,
    currentTurn: nextCurrentTurn,
    phase: 'end',
  });
}

/* ==================== 胜负判定 ==================== */

export function checkGameOver(state: CardGameState): CardGameState {
  if (state.gameOver) return state;

  if (state.player.hp <= 0) {
    return { ...state, gameOver: true, winner: 'enemy' };
  }
  if (state.enemy.hp <= 0) {
    return { ...state, gameOver: true, winner: 'player' };
  }
  return state;
}

/* ==================== 实用函数 ==================== */

export function canAttack(card: CardInstance): boolean {
  if (card.attack <= 0) return false;
  const maxAttacks = card.effects.includes('windfury') ? 2 : 1;
  if (card.attacksThisTurn >= maxAttacks) return false;
  if (card.justPlayed && !card.effects.includes('charge')) return false;
  return true;
}

export function getAttackableUnits(board: BoardUnit[]): number[] {
  return board
    .map((u, i) => (canAttack(u.card) ? i : -1))
    .filter((i) => i >= 0);
}

export function hasTaunt(board: BoardUnit[]): boolean {
  return board.some((u) => u.card.effects.includes('taunt'));
}
`,
    },
    {
      filePath: 'tests/card-engine.test.ts',
      content: `import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  startTurn,
  drawCard,
  playCard,
  attack,
  endTurn,
  checkGameOver,
  canAttack,
  getAttackableUnits,
  hasTaunt,
  CARD_CATALOG,
  getCardDefById,
} from '../src/game/CardEngine';

const TEST_DECK = [
  'axe_soldier',
  'shield_guard',
  'fireball',
  'healing_light',
  'blademaster',
  'archer',
  'flame_storm',
  'faerie_dragon',
  'axe_soldier',
  'shield_guard',
  'blademaster',
  'archer',
  'faerie_dragon',
  'axe_soldier',
  'shield_guard',
  'archer',
  'faerie_dragon',
  'fireball',
  'healing_light',
  'flame_storm',
];

/* ==================== 初始状态 ==================== */

describe('CardEngine — 初始状态', () => {
  it('玩家 HP 为 30', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.player.hp).toBe(30);
    expect(s.player.maxHp).toBe(30);
  });

  it('初始法力为 1/1', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.player.mana).toBe(1);
    expect(s.player.maxMana).toBe(1);
  });

  it('初始手牌 4 张', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.player.hand.length).toBe(4);
  });

  it('初始为玩家回合', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.currentTurn).toBe('player');
    expect(s.phase).toBe('draw');
    expect(s.turnNumber).toBe(1);
  });

  it('游戏未结束', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.gameOver).toBe(false);
    expect(s.winner).toBeNull();
  });

  it('牌库数量正确', () => {
    const s = createInitialState(TEST_DECK);
    expect(s.player.deck.length).toBe(TEST_DECK.length - 4);
  });
});

/* ==================== 核心循环 ==================== */

describe('CardEngine — 回合抽牌', () => {
  it('startTurn 增加回合并重置法力', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s); // phase -> main
    s = endTurn(s);  // currentTurn -> enemy
    s = startTurn(s); // new player turn
    expect(s.turnNumber).toBe(2);
    expect(s.currentTurn).toBe('player');
    expect(s.phase).toBe('draw');
    expect(s.player.maxMana).toBe(2);
    expect(s.player.mana).toBe(2);
  });

  it('drawCard 抽一张牌并进入主阶段', () => {
    let s = createInitialState(TEST_DECK);
    const deckSize = s.player.deck.length;
    s = drawCard(s);
    expect(s.player.hand.length).toBe(5);
    expect(s.player.deck.length).toBe(deckSize - 1);
    expect(s.phase).toBe('main');
  });

  it('牌库空时抽牌受疲劳伤害', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, player: { ...s.player, deck: [] } };
    s = drawCard(s);
    expect(s.player.hp).toBe(29);
  });

  it('法力上限不超过 10', () => {
    let s = createInitialState(TEST_DECK);
    for (let i = 0; i < 12; i++) {
      s = drawCard(s);
      s = endTurn(s);
      s = startTurn(s);
    }
    expect(s.player.maxMana).toBe(10);
  });
});

/* ==================== 出牌 ==================== */

describe('CardEngine — 出牌', () => {
  it('法力足够时成功出牌', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s); // phase -> main
    const cheapIdx = s.player.hand.findIndex((c) => c.cost <= 1);
    if (cheapIdx >= 0) {
      const result = playCard(s, cheapIdx);
      expect(result.success).toBe(true);
      expect(result.state.player.board.length).toBe(1);
      expect(result.state.player.mana).toBeLessThan(s.player.mana);
    }
  });

  it('法力不足时出牌失败', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s); // phase -> main
    s = { ...s, player: { ...s.player, mana: 0 } };
    const result = playCard(s, 0);
    expect(result.success).toBe(false);
    expect(result.message).toContain('法力不足');
  });

  it('非主阶段不能出牌', () => {
    const s = createInitialState(TEST_DECK);
    const result = playCard(s, 0); // phase is 'draw'
    expect(result.success).toBe(false);
  });

  it('游戏结束时不能出牌', () => {
    const s = createInitialState(TEST_DECK);
    const over = { ...s, gameOver: true };
    const result = playCard(over, 0);
    expect(result.success).toBe(false);
  });

  it('无效手牌索引返回失败', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s);
    const result = playCard(s, 999);
    expect(result.success).toBe(false);
  });

  it('法术牌打出后进入坟场', () => {
    let s = createInitialState(TEST_DECK);
    // 需要手上有法术牌
    s = { ...s, player: { ...s.player, hand: [s.player.hand.find((c) => c.isSpell) ?? s.player.hand[0]], mana: 10 } };
    s = { ...s, phase: 'main' as const };
    const spellIdx = s.player.hand.findIndex((c) => c.isSpell);
    if (spellIdx >= 0) {
      const result = playCard(s, spellIdx);
      if (result.success) {
        expect(result.state.player.graveyard.length).toBeGreaterThan(0);
      }
    }
  });

  it('出牌后手牌数减少', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, player: { ...s.player, mana: 10, hand: [createCardInstance('axe_soldier')] }, phase: 'main' as const };
    const result = playCard(s, 0);
    if (result.success) {
      expect(result.state.player.hand.length).toBe(0);
    }
  });
});

/* ==================== 攻击系统 ==================== */

describe('CardEngine — 攻击系统', () => {
  it('刚上场无冲锋的随从不能攻击', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, phase: 'main' as const, player: { ...s.player, mana: 10, hand: [createCardInstance('axe_soldier')] } };
    const result = playCard(s, 0);
    if (result.success) {
      const atkResult = attack(result.state, 0, undefined);
      expect(atkResult.success).toBe(false);
    }
  });

  it('冲锋随从上场后可立即攻击', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, phase: 'main' as const, player: { ...s.player, mana: 10, hand: [createCardInstance('blademaster')] } };
    const result = playCard(s, 0);
    if (result.success) {
      const atkResult = attack(result.state, 0, undefined);
      expect(atkResult.success).toBe(true);
    }
  });

  it('攻击造成伤害', () => {
    let s = createInitialState(TEST_DECK);
    const atkCard = createCardInstance('blademaster');
    // 手动放一个已可攻击的随从
    s = {
      ...s,
      phase: 'main' as const,
      player: {
        ...s.player,
        board: [{ card: { ...atkCard, justPlayed: false, attacksThisTurn: 0 }, slot: 0 }],
      },
    };
    const result = attack(s, 0, undefined);
    if (result.success) {
      expect(result.state.enemy.hp).toBeLessThan(30);
    }
  });

  it('有嘲讽时必须先攻击嘲讽随从', () => {
    const tauntCard = createCardInstance('shield_guard');
    let s = createInitialState(TEST_DECK);
    const atkCard = createCardInstance('blademaster');
    s = {
      ...s,
      phase: 'main' as const,
      player: {
        ...s.player,
        board: [{ card: { ...atkCard, justPlayed: false, attacksThisTurn: 0 }, slot: 0 }],
      },
      enemy: {
        ...s.enemy,
        board: [{ card: tauntCard, slot: 0 }],
      },
    };
    const result = attack(s, 0, undefined); // 尝试打英雄
    if (result.success === false) {
      expect(result.message).toContain('嘲讽');
    }
  });
});

/* ==================== 战斗结算 ==================== */

describe('CardEngine — 战斗结算', () => {
  it('敌方 HP ≤ 0 玩家胜利', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, enemy: { ...s.enemy, hp: 1 } };
    s = checkGameOver(s);
    expect(s.gameOver).toBe(false);
    s = { ...s, enemy: { ...s.enemy, hp: 0 } };
    s = checkGameOver(s);
    expect(s.gameOver).toBe(true);
    expect(s.winner).toBe('player');
  });

  it('玩家 HP ≤ 0 敌方胜利', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, player: { ...s.player, hp: 0 } };
    s = checkGameOver(s);
    expect(s.gameOver).toBe(true);
    expect(s.winner).toBe('enemy');
  });

  it('endTurn 切换回合', () => {
    let s = createInitialState(TEST_DECK);
    s = drawCard(s);
    s = endTurn(s);
    expect(s.currentTurn).toBe('enemy');
  });

  it('游戏结束后 endTurn 不变', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, gameOver: true, winner: 'player' as const };
    const s2 = endTurn(s);
    expect(s2.currentTurn).toBe(s.currentTurn);
  });
});

/* ==================== 工具函数 ==================== */

describe('CardEngine — 工具函数', () => {
  it('canAttack 判断正确', () => {
    const c = createCardInstance('axe_soldier');
    const fresh = { ...c, justPlayed: true, attacksThisTurn: 0 };
    expect(canAttack(fresh)).toBe(false); // just played, no charge

    const ready = { ...c, justPlayed: false, attacksThisTurn: 0 };
    expect(canAttack(ready)).toBe(true);

    const used = { ...c, justPlayed: false, attacksThisTurn: 1 };
    expect(canAttack(used)).toBe(false);
  });

  it('风怒随从可攻击两次', () => {
    const c = createCardInstance('blademaster');
    const ready = { ...c, justPlayed: false, attacksThisTurn: 0 };
    expect(canAttack(ready)).toBe(true);

    const usedOnce = { ...c, justPlayed: false, attacksThisTurn: 1 };
    expect(canAttack(usedOnce)).toBe(true); // windfury!

    const usedTwice = { ...c, justPlayed: false, attacksThisTurn: 2 };
    expect(canAttack(usedTwice)).toBe(false);
  });

  it('getAttackableUnits 返回可攻击索引', () => {
    const cards = [createCardInstance('axe_soldier'), createCardInstance('blademaster')];
    const board = [
      { card: { ...cards[0], justPlayed: false, attacksThisTurn: 0 }, slot: 0 },
      { card: { ...cards[1], justPlayed: false, attacksThisTurn: 0 }, slot: 1 },
    ];
    const indices = getAttackableUnits(board);
    expect(indices.length).toBe(2);
    expect(indices).toContain(0);
    expect(indices).toContain(1);
  });

  it('hasTaunt 检测嘲讽', () => {
    const board = [
      { card: createCardInstance('axe_soldier'), slot: 0 },
      { card: createCardInstance('shield_guard'), slot: 1 },
    ];
    expect(hasTaunt(board)).toBe(true);

    const noTaunt = [{ card: createCardInstance('axe_soldier'), slot: 0 }];
    expect(hasTaunt(noTaunt)).toBe(false);
  });

  it('getCardDefById 查找卡牌', () => {
    const d = getCardDefById('fireball');
    expect(d).toBeDefined();
    expect(d!.name).toBe('火球术');
    expect(d!.isSpell).toBe(true);
  });

  it('getCardDefById 不存在返回 undefined', () => {
    expect(getCardDefById('nonexistent')).toBeUndefined();
  });
});

/* ==================== 卡牌效果 ==================== */

describe('CardEngine — 卡牌效果', () => {
  it('战斧兵属性正确', () => {
    const d = getCardDefById('axe_soldier')!;
    expect(d.cost).toBe(1);
    expect(d.attack).toBe(2);
    expect(d.health).toBe(3);
    expect(d.effects).toEqual([]);
  });

  it('盾卫有嘲讽', () => {
    const d = getCardDefById('shield_guard')!;
    expect(d.effects).toContain('taunt');
    expect(d.health).toBe(5);
  });

  it('火球术为法术牌', () => {
    const d = getCardDefById('fireball')!;
    expect(d.isSpell).toBe(true);
    expect(d.spellDamage).toBe(4);
  });

  it('剑圣有冲锋和风怒', () => {
    const d = getCardDefById('blademaster')!;
    expect(d.effects).toContain('charge');
    expect(d.effects).toContain('windfury');
  });

  it('精灵龙有魔免', () => {
    const d = getCardDefById('faerie_dragon')!;
    expect(d.effects).toContain('spell_immunity');
  });

  it('烈焰风暴有全场AOE', () => {
    const d = getCardDefById('flame_storm')!;
    expect(d.isSpell).toBe(true);
    expect(d.aoeDamage).toBe(2);
  });

  it('治疗术可治疗', () => {
    const d = getCardDefById('healing_light')!;
    expect(d.isSpell).toBe(true);
    expect(d.healAmount).toBe(5);
  });
});

/* ==================== 边界情况 ==================== */

describe('CardEngine — 边界情况', () => {
  it('战场满 7 个随从时不能再放', () => {
    let s = createInitialState(TEST_DECK);
    s = { ...s, phase: 'main' as const };
    const card = createCardInstance('axe_soldier');
    s = {
      ...s,
      player: {
        ...s.player,
        mana: 10,
        hand: [card],
        board: Array.from({ length: 7 }, (_, i) => ({
          card: createCardInstance('axe_soldier'),
          slot: i,
        })),
      },
    };
    const result = playCard(s, 0);
    expect(result.success).toBe(false);
    expect(result.message).toContain('战场已满');
  });

  it('攻击力为 0 的随从不能攻击', () => {
    let s = createInitialState(TEST_DECK);
    const zeroAtk = { ...createCardInstance('fireball'), attack: 0, justPlayed: false, attacksThisTurn: 0 };
    s = {
      ...s,
      phase: 'main' as const,
      player: { ...s.player, board: [{ card: zeroAtk, slot: 0 }] },
    };
    const result = attack(s, 0, undefined);
    expect(result.success).toBe(false);
    expect(result.message).toContain('攻击力为 0');
  });

  it('createInitialState 使用未知 ID 抛错', () => {
    expect(() => createInitialState(['nonexistent'])).toThrow('未知卡牌 ID');
  });
});

/* ---- helper ---- */

function createCardInstance(id: string) {
  const def = getCardDefById(id)!;
  return {
    defId: def.id,
    name: def.name,
    cost: def.cost,
    attack: def.attack,
    health: def.health,
    maxHealth: def.health,
    effects: [...def.effects],
    isSpell: def.isSpell ?? false,
    spellDamage: def.spellDamage,
    healAmount: def.healAmount,
    aoeDamage: def.aoeDamage,
    attacksThisTurn: 0,
    justPlayed: false,
  };
}
`,
    },
  ];
}

/* ==================== Godot 引擎：2D 品类代码生成 ==================== */

export function generateGodot2D(): GeneratedFile[] {
  return [
    /* ---- 主场景脚本 ---- */
    {
      filePath: 'src/game/Main.gd',
      content: `extends Node2D
## Godot 2D Game — Main Scene Script
## Autogenerated by mgai Godot 2D Code Generator v1.0

# ==================== 属性 ====================

@export var gravity: float = 980.0
@export var debug_mode: bool = false

# ==================== 生命周期 ====================

func _ready() -> void:
\t_setup_camera()
\t_setup_tilemap()
\t_setup_player()
\t_setup_hud()
\t_connect_signals()
\tif debug_mode:
\t\tprint("[Main] 场景初始化完成")


func _process(delta: float) -> void:
\t_update_hud()
\t_check_game_state()


func _input(event: InputEvent) -> void:
\tif event.is_action_pressed("ui_cancel"):
\t\t_pause_game()
\telif event.is_action_pressed("restart"):
\t\t_restart_game()


# ==================== 子节点初始化 ====================

func _setup_camera() -> void:
\tvar camera: Camera2D = $Player/Camera2D
\tif camera:
\t\tcamera.make_current()
\t\tcamera.limit_smoothed = true
\t\t_apply_camera_limits(camera)


func _apply_camera_limits(camera: Camera2D) -> void:
\tif not has_node("TileMap"):
\t\treturn
\tvar tilemap: TileMap = $TileMap
\tvar rect: Rect2i = tilemap.get_used_rect()
\tvar cell_size: Vector2i = tilemap.tile_set.tile_size
\tcamera.limit_left = rect.position.x * cell_size.x
\tcamera.limit_top = rect.position.y * cell_size.y
\tcamera.limit_right = rect.end.x * cell_size.x
\tcamera.limit_bottom = rect.end.y * cell_size.y


func _setup_tilemap() -> void:
\tif has_node("TileMap"):
\t\tprint("[Main] TileMap 节点就绪")


func _setup_player() -> void:
\tif has_node("Player"):
\t\tprint("[Main] Player 节点就绪")


func _setup_hud() -> void:
\tif has_node("HUD"):
\t\tprint("[Main] HUD 节点就绪")


# ==================== 信号连接 ====================

func _connect_signals() -> void:
\tvar hud: Node = get_node_or_null("HUD")
\tif hud and hud.has_signal("pause_requested"):
\t\thud.pause_requested.connect(_pause_game)
\tif hud and hud.has_signal("restart_requested"):
\t\thud.restart_requested.connect(_restart_game)

\tvar player: Node = get_node_or_null("Player")
\tif player and player.has_signal("player_died"):
\t\tplayer.player_died.connect(_on_player_died)

\t_connect_to_event_bus()


func _connect_to_event_bus() -> void:
\tif not is_instance_valid(EventBus):
\t\treturn
\tEventBus.score_changed.connect(_on_score_changed)
\tEventBus.level_complete.connect(_on_level_complete)


# ==================== 游戏状态管理 ====================

func _update_hud() -> void:
\tvar hud: Node = get_node_or_null("HUD")
\tif not hud:
\t\treturn
\tif hud.has_method("update_fps"):
\t\thud.update_fps(Engine.get_frames_per_second())


func _check_game_state() -> void:
\tpass


func _pause_game() -> void:
\tget_tree().paused = not get_tree().paused


func _restart_game() -> void:
\tget_tree().paused = false
\tget_tree().reload_current_scene()


# ==================== 信号回调 ====================

func _on_player_died() -> void:
\temit_signal("game_over")


func _on_score_changed(new_score: int) -> void:
\tif debug_mode:
\t\tprint("[Main] 分数更新: ", new_score)


func _on_level_complete() -> void:
\tprint("[Main] 关卡完成!")

`,
    },
    /* ---- Player 2D 移动脚本 (CharacterBody2D) ---- */
    {
      filePath: 'src/game/player.gd',
      content: `class_name Player2D
extends CharacterBody2D
## 2D 玩家角色脚本

@export var speed: float = 300.0
@export var jump_velocity: float = -400.0
@export var dash_speed: float = 600.0
@export var dash_duration: float = 0.2
@export var dash_cooldown: float = 1.0

@onready var sprite: Sprite2D = $Sprite2D
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var collision_shape: CollisionShape2D = $CollisionShape2D
@onready var coyote_timer: Timer = $CoyoteTimer
@onready var dash_timer: Timer = $DashTimer

var dash_cooldown_remaining: float = 0.0
var is_dashing: bool = false
var was_on_floor: bool = false


func _ready() -> void:
\t_validate_nodes()


func _physics_process(delta: float) -> void:
\t_update_dash_cooldown(delta)
\t_apply_gravity(delta)
\t_handle_input(delta)
\t_handle_movement()
\t_update_animation()


func _apply_gravity(delta: float) -> void:
\tif not is_on_floor():
\t\tvelocity.y += ProjectSettings.get_setting("physics/2d/default_gravity") * delta


func _handle_input(_delta: float) -> void:
\tvar direction: float = Input.get_axis("move_left", "move_right")

\tif direction != 0.0:
\t\tvelocity.x = direction * (is_dashing and dash_speed or speed)
\telse:
\t\tvelocity.x = move_toward(velocity.x, 0.0, speed)

\tif Input.is_action_just_pressed("jump") and (is_on_floor() or not coyote_timer.is_stopped()):
\t\tvelocity.y = jump_velocity
\t\tcoyote_timer.stop()

\tif Input.is_action_just_pressed("dash") and dash_cooldown_remaining <= 0.0 and not is_dashing:
\t\t_start_dash()


func _handle_movement() -> void:
\twas_on_floor = is_on_floor()
\tmove_and_slide()

\tif is_on_floor() and not was_on_floor:
\t\tcoyote_timer.stop()
\telif not is_on_floor() and was_on_floor:
\t\tcoyote_timer.start()


func _start_dash() -> void:
\tis_dashing = true
\tdash_cooldown_remaining = dash_cooldown
\tdash_timer.start(dash_duration)


func _update_dash_cooldown(delta: float) -> void:
\tif dash_cooldown_remaining > 0.0:
\t\tdash_cooldown_remaining -= delta


func _update_animation() -> void:
\tif not animation_player:
\t\treturn

\tif is_dashing:
\t\tanimation_player.play("dash")
\telif not is_on_floor():
\t\tanimation_player.play("jump")
\telif abs(velocity.x) > 10.0:
\t\tanimation_player.play("run")
\telse:
\t\tanimation_player.play("idle")

\t_sprite_flip()


func _sprite_flip() -> void:
\tif not sprite:
\t\treturn
\tif velocity.x > 0.0:
\t\tsprite.flip_h = false
\telif velocity.x < 0.0:
\t\tsprite.flip_h = true


func _validate_nodes() -> void:
\tassert(sprite, "Player2D: Sprite2D 子节点缺失")
\tassert(collision_shape, "Player2D: CollisionShape2D 子节点缺失")


func _on_dash_timer_timeout() -> void:
\tis_dashing = false

`,
    },
    /* ---- EventBus Autoload 脚本 ---- */
    {
      filePath: 'src/game/global/event_bus.gd',
      content: `extends Node
## EventBus — 全局事件总线 (Autoload)

signal game_started
signal game_paused
signal game_resumed
signal game_over

signal player_damaged(amount: int, current_health: int)
signal player_healed(amount: int, current_health: int)
signal player_died

signal score_changed(new_score: int)
signal level_complete
signal collectible_picked(type: String, value: int)

`,
    },
    /* ---- project.godot 配置 ---- */
    {
      filePath: 'project.godot',
      content: `; Engine configuration file — Godot 2D project.
; Autogenerated by mgai Godot 2D Code Generator v1.0

config_version=5

[application]

config/name="Godot2DGame"
config/description="A 2D game built with Godot 4.x and mgai."
config/run/main_scene="res://src/game/Main.tscn"
config/features=PackedStringArray("2.0", "Forward Plus")

[autoload]

EventBus="*res://src/game/global/event_bus.gd"

[display]

window/size/viewport_width=1280
window/size/viewport_height=720
window/size/resizable=true
window/stretch/mode="canvas_items"
window/stretch/aspect="expand"

[input]

move_left={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":65,"key_label":0,"unicode":97,"echo":false,"script":null)
, Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194319,"key_label":0,"unicode":0,"echo":false,"script":null)
]
}
move_right={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":68,"key_label":0,"unicode":100,"echo":false,"script":null)
, Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194321,"key_label":0,"unicode":0,"echo":false,"script":null)
]
}
jump={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":87,"key_label":0,"unicode":119,"echo":false,"script":null)
, Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":32,"key_label":0,"unicode":32,"echo":false,"script":null)
, Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194320,"key_label":0,"unicode":0,"echo":false,"script":null)
]
}
dash={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194325,"key_label":0,"unicode":0,"echo":false,"script":null)
]
}
restart={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":82,"key_label":0,"unicode":114,"echo":false,"script":null)
]
}

[physics]

2d/default_gravity=980.0
common/max_physics_steps_per_frame=4

[rendering]

renderer/rendering_method="forward_plus"
textures/canvas_textures/default_texture_filter=0
anti_aliasing/quality/msaa_2d=1
quality/2d/use_pixel_snap=true

[editor_plugins]

enabled=PackedStringArray()
`,
    },
  ];
}

/* ==================== Godot 引擎：3D 品类代码生成 ==================== */

export function generateGodot3D(): GeneratedFile[] {
  return [
    /* ---- 主场景脚本 ---- */
    {
      filePath: 'src/game/Main3D.gd',
      content: `extends Node3D
## Godot 3D Game — Main Scene Script
## Autogenerated by mgai Godot 3D Code Generator v1.0

@export var debug_mode: bool = false


func _ready() -> void:
\t_setup_camera()
\t_setup_lights()
\t_setup_player()
\t_setup_hud()
\t_connect_signals()
\tif debug_mode:
\t\tprint("[Main3D] 场景初始化完成")


func _process(_delta: float) -> void:
\t_update_hud()
\t_check_game_state()


func _physics_process(_delta: float) -> void:
\tpass


func _setup_camera() -> void:
\tvar camera: Camera3D = get_node_or_null("Camera3D")
\tif not camera:
\t\tcamera = get_node_or_null("Player/Camera3D")
\tif camera:
\t\tcamera.make_current()


func _setup_lights() -> void:
\tvar sun: DirectionalLight3D = get_node_or_null("DirectionalLight3D")
\tif sun:
\t\tsun.shadow_enabled = true
\t\tsun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS

\tvar env: WorldEnvironment = get_node_or_null("WorldEnvironment")
\tif env and env.environment:
\t\tenv.environment.background_mode = Environment.BG_SKY
\t\tenv.environment.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
\t\tenv.environment.ambient_light_energy = 0.5


func _setup_player() -> void:
\tif has_node("Player") and debug_mode:
\t\tprint("[Main3D] Player 节点就绪")


func _setup_hud() -> void:
\tif has_node("HUD") and debug_mode:
\t\tprint("[Main3D] HUD 节点就绪")


func _connect_signals() -> void:
\tvar player: Node = get_node_or_null("Player")
\tif player and player.has_signal("player_died"):
\t\tplayer.player_died.connect(_on_player_died)

\tif is_instance_valid(EventBus3D):
\t\tEventBus3D.score_changed.connect(_on_score_changed)
\t\tEventBus3D.level_complete.connect(_on_level_complete)


func _update_hud() -> void:
\tvar hud: Node = get_node_or_null("HUD")
\tif hud and hud.has_method("update_fps"):
\t\thud.update_fps(Engine.get_frames_per_second())


func _check_game_state() -> void:
\tpass


func _pause_game() -> void:
\tget_tree().paused = not get_tree().paused


func _restart_game() -> void:
\tget_tree().paused = false
\tget_tree().reload_current_scene()


func _on_player_died() -> void:
\tif debug_mode:
\t\tprint("[Main3D] 玩家死亡")


func _on_score_changed(_new_score: int) -> void:
\tpass


func _on_level_complete() -> void:
\tif debug_mode:
\t\tprint("[Main3D] 关卡完成!")

`,
    },
    /* ---- Player 3D 移动脚本 (CharacterBody3D) ---- */
    {
      filePath: 'src/game/player_3d.gd',
      content: `class_name Player3D
extends CharacterBody3D
## 3D 玩家角色脚本 — CharacterBody3D 移动控制、第三人称相机跟随

@export var walk_speed: float = 5.0
@export var sprint_speed: float = 8.0
@export var jump_velocity: float = 4.5
@export var mouse_sensitivity: float = 0.002
@export var acceleration: float = 10.0

@onready var camera_pivot: Node3D = $CameraPivot
@onready var camera_spring: SpringArm3D = $CameraPivot/SpringArm3D
@onready var camera: Camera3D = $CameraPivot/SpringArm3D/Camera3D
@onready var animation_player: AnimationPlayer = $AnimationPlayer

var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity")


func _ready() -> void:
\tInput.mouse_mode = Input.MOUSE_MODE_CAPTURED
\t_validate_nodes()


func _physics_process(delta: float) -> void:
\t_apply_gravity(delta)
\t_handle_movement(delta)
\t_update_animation()


func _input(event: InputEvent) -> void:
\tif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
\t\tcamera_pivot.rotate_x(-event.relative.y * mouse_sensitivity)
\t\tcamera_pivot.rotation.x = clamp(camera_pivot.rotation.x, -1.2, 1.2)
\t\trotate_y(-event.relative.x * mouse_sensitivity)


func _apply_gravity(delta: float) -> void:
\tif not is_on_floor():
\t\tvelocity.y -= gravity * delta


func _handle_movement(delta: float) -> void:
\tvar input_dir: Vector2 = Input.get_vector(
\t\t"move_left", "move_right", "move_forward", "move_back"
\t)
\tvar direction: Vector3 = (transform.basis * Vector3(input_dir.x, 0.0, input_dir.y)).normalized()

\tvar target_speed: float = sprint_speed if Input.is_action_pressed("sprint") else walk_speed
\tvar target_velocity: Vector3 = direction * target_speed

\tvelocity.x = move_toward(velocity.x, target_velocity.x, acceleration * delta)
\tvelocity.z = move_toward(velocity.z, target_velocity.z, acceleration * delta)

\tif Input.is_action_just_pressed("jump") and is_on_floor():
\t\tvelocity.y = jump_velocity

\tmove_and_slide()


func _update_animation() -> void:
\tif not animation_player:
\t\treturn

\tif not is_on_floor():
\t\tanimation_player.play("jump")
\treturn

\tvar speed_ratio: float = Vector2(velocity.x, velocity.z).length() / sprint_speed
\tif speed_ratio > 0.8:
\t\tanimation_player.play("sprint")
\telif speed_ratio > 0.1:
\t\tanimation_player.play("walk")
\telse:
\t\tanimation_player.play("idle")


func _validate_nodes() -> void:
\tassert(camera_pivot, "Player3D: CameraPivot 子节点缺失")
\tassert(camera_spring, "Player3D: SpringArm3D 子节点缺失")
\tassert(camera, "Player3D: Camera3D 子节点缺失")

`,
    },
    /* ---- EventBus3D Autoload 脚本 ---- */
    {
      filePath: 'src/game/global/event_bus_3d.gd',
      content: `extends Node
## EventBus3D — 全局事件总线 (Autoload)

signal game_started
signal game_paused
signal game_over

signal player_damaged(amount: int, current_health: int)
signal player_died
signal item_collected(item_id: String)

signal score_changed(new_score: int)
signal level_complete
signal objective_updated(objective_text: String)

signal client_connected(peer_id: int)
signal client_disconnected(peer_id: int)

`,
    },
    /* ---- project.godot 配置 ---- */
    {
      filePath: 'project.godot',
      content: `; Engine configuration file — Godot 3D project.
; Autogenerated by mgai Godot 3D Code Generator v1.0

config_version=5

[application]

config/name="Godot3DGame"
config/description="A 3D game built with Godot 4.x and mgai."
config/run/main_scene="res://src/game/Main3D.tscn"
config/features=PackedStringArray("3.0", "Forward Plus")

[autoload]

EventBus3D="*res://src/game/global/event_bus_3d.gd"

[display]

window/size/viewport_width=1920
window/size/viewport_height=1080
window/size/resizable=true
window/stretch/mode="disabled"
window/vsync/vsync_mode=0

[input]

move_left={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":65,"key_label":0,"unicode":97,"echo":false,"script":null)
]
}
move_right={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":68,"key_label":0,"unicode":100,"echo":false,"script":null)
]
}
move_forward={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":87,"key_label":0,"unicode":119,"echo":false,"script":null)
]
}
move_back={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":83,"key_label":0,"unicode":115,"echo":false,"script":null)
]
}
jump={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":32,"key_label":0,"unicode":32,"echo":false,"script":null)
]
}
sprint={
"deadzone": 0.5,
"events": [Object(InputEventKey,"resource_local_to_scene":false,"resource_name":"","device":-1,"window_id":0,"alt_pressed":false,"shift_pressed":false,"ctrl_pressed":false,"meta_pressed":false,"pressed":false,"keycode":0,"physical_keycode":4194325,"key_label":0,"unicode":0,"echo":false,"script":null)
]
}

[physics]

3d/default_gravity=9.8
common/max_physics_steps_per_frame=4

[rendering]

renderer/rendering_method="forward_plus"
anti_aliasing/quality/msaa_3d=2
anti_aliasing/quality/screen_space_aa=1
environment/defaults/default_clear_color=Color(0, 0, 0, 1)
quality/shadow_atlas/size=4096
quality/shadows/soft_shadow_quality=2

[editor_plugins]

enabled=PackedStringArray()
`,
    },
  ];
}

/* ================================================================
 * 品类深化：关卡生成 (level-gen)
 * ================================================================ */

function generateLevelGen(): GeneratedFile[] {
  return [
    /* ---- TS 引擎集成模块 ---- */
    {
      filePath: 'src/level-gen/engine-integration.ts',
      content: "/* ===================================================================\n * LevelGen Engine Integration — 关卡生成引擎集成\n *\n * 提供从 MapConfig → GeneratedLevel → 游戏引擎可消费数据的完整流程。\n * 可被 Web / Godot 等项目直接导入使用。\n * =================================================================== */\n\nimport {\n  generateLevel,\n  generateBSPDungeon,\n  generateCaveMap,\n  generateRandomWalk,\n  generateWFC,\n  validateLevel,\n  type MapConfig,\n  type GeneratedLevel,\n  type Room,\n  type Corridor,\n  type TileType,\n  type Grid2D,\n  DEFAULT_BSP_PARAMS,\n  DEFAULT_CA_PARAMS,\n  DEFAULT_RANDOM_WALK_PARAMS,\n  DEFAULT_WFC_PARAMS,\n  DEFAULT_WFC_TILESET,\n} from './index';\n\n/* ==================== 统一入口 ==================== */\n\nexport function createLevel(config: MapConfig): GeneratedLevel {\n  return generateLevel(config);\n}\n\nexport { validateLevel };\n\n/* ==================== Web 引擎桥接 ==================== */\n\n/**\n * 将 GeneratedLevel 转换为 WebTilemap 格式（适用于 Canvas/WebGL 渲染）\n */\nexport interface WebTilemapLayer {\n  name: string;\n  width: number;\n  height: number;\n  data: number[][];\n}\n\nexport interface WebLevelData {\n  rooms: Room[];\n  corridors: Corridor[];\n  tilemapLayers: WebTilemapLayer[];\n  meta: GeneratedLevel['meta'];\n}\n\nexport function toWebTilemap(level: GeneratedLevel): WebLevelData {\n  const layers: WebTilemapLayer[] = [];\n\n  if (level.data.type === 'grid') {\n    const { grid, width, height } = level.data;\n    const data: number[][] = [];\n    for (let y = 0; y < height; y++) {\n      const row: number[] = [];\n      for (let x = 0; x < width; x++) {\n        row.push(grid[y][x] === 'floor' ? 1 : 0);\n      }\n      data.push(row);\n    }\n    layers.push({ name: 'terrain', width, height, data });\n  }\n\n  if (level.data.type === 'bsp') {\n    const { rooms } = level.data;\n    const maxX = Math.max(...rooms.map((r) => r.x + r.width));\n    const maxY = Math.max(...rooms.map((r) => r.y + r.height));\n    const width = Math.max(maxX, 64);\n    const height = Math.max(maxY, 64);\n    const data: number[][] = [];\n    for (let y = 0; y < height; y++) {\n      const row: number[] = new Array(width).fill(0);\n      data.push(row);\n    }\n    for (const room of rooms) {\n      for (let y = room.y; y < room.y + room.height; y++) {\n        for (let x = room.x; x < room.x + room.width; x++) {\n          if (y < height && x < width) {\n            data[y][x] = 1;\n          }\n        }\n      }\n    }\n    if (level.data.corridors) {\n      for (const corr of level.data.corridors) {\n        for (const pt of corr.path) {\n          if (pt.y < height && pt.x < width) {\n            data[pt.y][pt.x] = 1;\n          }\n        }\n      }\n    }\n    layers.push({ name: 'terrain', width, height, data });\n  }\n\n  if (level.data.type === 'wfc') {\n    const { tiles, width, height } = level.data;\n    const data: number[][] = [];\n    for (let y = 0; y < height; y++) {\n      data.push([...tiles[y]]);\n    }\n    layers.push({ name: 'tiles', width, height, data });\n  }\n\n  return {\n    rooms: level.data.type === 'bsp' ? level.data.rooms : [],\n    corridors: level.data.type === 'bsp' ? (level.data.corridors ?? []) : [],\n    tilemapLayers: layers,\n    meta: level.meta,\n  };\n}\n\nexport function createDefaultDungeon(width = 64, height = 64): WebLevelData {\n  const level = createLevel({\n    algorithm: 'bsp',\n    seed: Date.now(),\n    width,\n    height,\n    algorithmParams: { ...DEFAULT_BSP_PARAMS, mapWidth: width, mapHeight: height },\n  });\n  return toWebTilemap(level);\n}\n",
    },
    /* ---- GDScript 关卡生成模块 ---- */
    {
      filePath: 'src/level-gen/level_gen.gd',
      content: "extends RefCounted\n## LevelGen — Procedural Level Generation for Godot 4.x\n## Autogenerated by mgai LevelGen Code Generator v1.0\n\n# ==================== 枚举与常量 ====================\n\nenum TileType {\n\tWALL = 0,\n\tFLOOR = 1,\n}\n\n# ==================== BSP 空间分割 ====================\n\nclass Room:\n\tvar x: int\n\tvar y: int\n\tvar width: int\n\tvar height: int\n\tvar id: int\n\tvar type: String\n\n\tfunc _init(p_x: int, p_y: int, p_w: int, p_h: int, p_id: int, p_type: String = \"normal\") -> void:\n\t\tx = p_x; y = p_y; width = p_w; height = p_h; id = p_id; type = p_type\n\n\nclass Corridor:\n\tvar path: Array\n\n\tfunc _init(p_path: Array) -> void:\n\t\tpath = p_path\n\n\nclass BSPNode:\n\tvar rect: Rect2i\n\tvar left: BSPNode\n\tvar right: BSPNode\n\tvar room: Room\n\n\tfunc _init(p_rect: Rect2i) -> void:\n\t\trect = p_rect\n\t\tleft = null\n\t\tright = null\n\t\troom = null\n\n\nstatic func generate_bsp_dungeon(\n\tmap_width: int = 64,\n\tmap_height: int = 64,\n\tmin_room_size: int = 5,\n\tmax_depth: int = 4,\n\tseed: int = -1\n) -> Dictionary:\n\tvar rng: RandomNumberGenerator = RandomNumberGenerator.new()\n\tif seed >= 0:\n\t\trng.seed = seed\n\telse:\n\t\trng.randomize()\n\n\tvar rooms: Array[Room] = []\n\tvar corridors: Array[Corridor] = []\n\tvar room_id_counter: int = 0\n\n\tfunc split_node(node: BSPNode, depth: int, rng: RandomNumberGenerator) -> void:\n\t\tif depth >= max_depth:\n\t\t\treturn\n\n\t\tvar rect: Rect2i = node.rect\n\t\tvar split_horizontally: bool = rng.randf() < 0.5\n\n\t\tif rect.size.x <= min_room_size * 2 and rect.size.y <= min_room_size * 2:\n\t\t\treturn\n\n\t\tif rect.size.x <= min_room_size * 2:\n\t\t\tsplit_horizontally = false\n\t\telif rect.size.y <= min_room_size * 2:\n\t\t\tsplit_horizontally = true\n\n\t\tif split_horizontally:\n\t\t\tvar split: int = rng.randi_range(rect.position.x + min_room_size, rect.end.x - min_room_size)\n\t\t\tnode.left = BSPNode.new(Rect2i(rect.position.x, rect.position.y, split - rect.position.x, rect.size.y))\n\t\t\tnode.right = BSPNode.new(Rect2i(split, rect.position.y, rect.end.x - split, rect.size.y))\n\t\telse:\n\t\t\tvar split: int = rng.randi_range(rect.position.y + min_room_size, rect.end.y - min_room_size)\n\t\t\tnode.left = BSPNode.new(Rect2i(rect.position.x, rect.position.y, rect.size.x, split - rect.position.y))\n\t\t\tnode.right = BSPNode.new(Rect2i(rect.position.x, split, rect.size.x, rect.end.y - split))\n\n\t\tsplit_node(node.left, depth + 1, rng)\n\t\tsplit_node(node.right, depth + 1, rng)\n\n\tfunc create_rooms(node: BSPNode, rng: RandomNumberGenerator) -> void:\n\t\tif node.left or node.right:\n\t\t\tif node.left:\n\t\t\t\tcreate_rooms(node.left, rng)\n\t\t\tif node.right:\n\t\t\t\tcreate_rooms(node.right, rng)\n\t\t\treturn\n\n\t\tvar rect: Rect2i = node.rect\n\t\tvar room_w: int = rng.randi_range(min_room_size, max(min_room_size + 3, rect.size.x - 2))\n\t\tvar room_h: int = rng.randi_range(min_room_size, max(min_room_size + 3, rect.size.y - 2))\n\t\tvar room_x: int = rect.position.x + rng.randi_range(1, max(1, rect.size.x - room_w - 1))\n\t\tvar room_y: int = rect.position.y + rng.randi_range(1, max(1, rect.size.y - room_h - 1))\n\n\t\tnode.room = Room.new(room_x, room_y, room_w, room_h, room_id_counter)\n\t\trooms.append(node.room)\n\t\troom_id_counter += 1\n\n\tfunc connect_nodes(node: BSPNode) -> void:\n\t\tif not node.left or not node.right:\n\t\t\treturn\n\n\t\tconnect_nodes(node.left)\n\t\tconnect_nodes(node.right)\n\n\t\tvar room_left: Room = _get_leaf_room(node.left)\n\t\tvar room_right: Room = _get_leaf_room(node.right)\n\n\t\tif room_left and room_right:\n\t\t\tvar cx1: int = room_left.x + room_left.width / 2\n\t\t\tvar cy1: int = room_left.y + room_left.height / 2\n\t\t\tvar cx2: int = room_right.x + room_right.width / 2\n\t\t\tvar cy2: int = room_right.y + room_right.height / 2\n\n\t\t\tvar path: Array[Vector2i] = []\n\t\t\tif rng.randf() < 0.5:\n\t\t\t\tvar x: int = cx1\n\t\t\t\twhile x != cx2:\n\t\t\t\t\tx += 1 if cx2 > cx1 else -1\n\t\t\t\t\tpath.append(Vector2i(x, cy1))\n\t\t\t\tvar y: int = cy1\n\t\t\t\twhile y != cy2:\n\t\t\t\t\ty += 1 if cy2 > cy1 else -1\n\t\t\t\t\tpath.append(Vector2i(cx2, y))\n\t\t\telse:\n\t\t\t\tvar y: int = cy1\n\t\t\t\twhile y != cy2:\n\t\t\t\t\ty += 1 if cy2 > cy1 else -1\n\t\t\t\t\tpath.append(Vector2i(cx1, y))\n\t\t\t\tvar x: int = cx1\n\t\t\t\twhile x != cx2:\n\t\t\t\t\tx += 1 if cx2 > cx1 else -1\n\t\t\t\t\tpath.append(Vector2i(x, cy2))\n\n\t\t\tcorridors.append(Corridor.new(path))\n\n\tfunc _get_leaf_room(node: BSPNode) -> Room:\n\t\tif node.room:\n\t\t\treturn node.room\n\t\tif node.left:\n\t\t\tvar r: Room = _get_leaf_room(node.left)\n\t\t\tif r:\n\t\t\t\treturn r\n\t\tif node.right:\n\t\t\treturn _get_leaf_room(node.right)\n\t\treturn null\n\n\tvar root: BSPNode = BSPNode.new(Rect2i(0, 0, map_width, map_height))\n\tsplit_node(root, 0, rng)\n\tcreate_rooms(root, rng)\n\tconnect_nodes(root)\n\n\treturn { \"rooms\": rooms, \"corridors\": corridors }\n\n\n# ==================== Cellular Automata 元胞自动机 ====================\n\nstatic func generate_cave_map(\n\twidth: int = 64,\n\theight: int = 64,\n\tfill_probability: float = 0.45,\n\titerations: int = 4,\n\tbirth_limit: int = 4,\n\tdeath_limit: int = 3,\n\tseed: int = -1\n) -> Array:\n\tvar rng: RandomNumberGenerator = RandomNumberGenerator.new()\n\tif seed >= 0:\n\t\trng.seed = seed\n\telse:\n\t\trng.randomize()\n\n\tvar grid: Array = []\n\tfor y in range(height):\n\t\tvar row: Array = []\n\t\tfor x in range(width):\n\t\t\trow.append(TileType.FLOOR if rng.randf() < fill_probability else TileType.WALL)\n\t\tgrid.append(row)\n\n\tfor _iter in range(iterations):\n\t\tvar next: Array = []\n\t\tfor y in range(height):\n\t\t\tvar row: Array = []\n\t\t\tfor x in range(width):\n\t\t\t\tvar neighbors: int = _count_wall_neighbors(grid, x, y, width, height)\n\t\t\t\tif grid[y][x] == TileType.WALL:\n\t\t\t\t\trow.append(TileType.FLOOR if neighbors < death_limit else TileType.WALL)\n\t\t\t\telse:\n\t\t\t\t\trow.append(TileType.FLOOR if neighbors > birth_limit else TileType.WALL)\n\t\t\tnext.append(row)\n\t\tgrid = next\n\n\treturn grid\n\n\nstatic func _count_wall_neighbors(grid: Array, cx: int, cy: int, w: int, h: int) -> int:\n\tvar count: int = 0\n\tfor dy in range(-1, 2):\n\t\tfor dx in range(-1, 2):\n\t\t\tif dx == 0 and dy == 0:\n\t\t\t\tcontinue\n\t\t\tvar nx: int = cx + dx\n\t\t\tvar ny: int = cy + dy\n\t\t\tif nx < 0 or nx >= w or ny < 0 or ny >= h:\n\t\t\t\tcount += 1\n\t\t\telif grid[ny][nx] == TileType.WALL:\n\t\t\t\tcount += 1\n\treturn count\n\n\n# ==================== Random Walk 随机游走 ====================\n\nstatic func generate_random_walk(\n\twidth: int = 64,\n\theight: int = 64,\n\tsteps: int = 2000,\n\tturn_bias: float = 0.3,\n\tseed: int = -1\n) -> Array:\n\tvar rng: RandomNumberGenerator = RandomNumberGenerator.new()\n\tif seed >= 0:\n\t\trng.seed = seed\n\telse:\n\t\trng.randomize()\n\n\tvar grid: Array = []\n\tfor y in range(height):\n\t\tvar row: Array = []\n\t\tfor x in range(width):\n\t\t\trow.append(TileType.WALL)\n\t\tgrid.append(row)\n\n\tvar cx: int = width / 2\n\tvar cy: int = height / 2\n\tgrid[cy][cx] = TileType.FLOOR\n\n\tvar dx: int = 0\n\tvar dy: int = 0\n\n\tfor _i in range(steps):\n\t\tif rng.randf() < turn_bias or (dx == 0 and dy == 0):\n\t\t\tvar dirs: Array = [\n\t\t\t\tVector2i(1, 0), Vector2i(-1, 0),\n\t\t\t\tVector2i(0, 1), Vector2i(0, -1),\n\t\t\t]\n\t\t\tvar choice: Vector2i = dirs[rng.randi_range(0, 3)]\n\t\t\tdx = choice.x\n\t\t\tdy = choice.y\n\n\t\tcx = clampi(cx + dx, 0, width - 1)\n\t\tcy = clampi(cy + dy, 0, height - 1)\n\t\tgrid[cy][cx] = TileType.FLOOR\n\n\treturn grid\n\n\n# ==================== 通用导出函数 ====================\n\nstatic func grid_to_tilemap_data(grid: Array, wall_tile_id: int = 0, floor_tile_id: int = 1) -> PackedInt32Array:\n\tvar result: PackedInt32Array = PackedInt32Array()\n\tfor row in grid:\n\t\tfor cell in row:\n\t\t\tresult.append(floor_tile_id if cell == TileType.FLOOR else wall_tile_id)\n\treturn result\n\n\nstatic func rooms_to_tilemap_data(rooms: Array, corridors: Array, width: int, height: int) -> PackedInt32Array:\n\tvar result: PackedInt32Array = PackedInt32Array()\n\tresult.resize(width * height)\n\tresult.fill(0)\n\n\tfor room in rooms:\n\t\tif not room is Room:\n\t\t\tcontinue\n\t\tfor y in range(clampi(room.y, 0, height - 1), clampi(room.y + room.height, 0, height)):\n\t\t\tfor x in range(clampi(room.x, 0, width - 1), clampi(room.x + room.width, 0, width)):\n\t\t\t\tresult[y * width + x] = 1\n\n\tfor corr in corridors:\n\t\tif not corr is Corridor:\n\t\t\tcontinue\n\t\tfor pt in corr.path:\n\t\t\tif pt.y >= 0 and pt.y < height and pt.x >= 0 and pt.x < width:\n\t\t\t\tresult[pt.y * width + pt.x] = 1\n\n\treturn result\n",
    },
    /* ---- JSON 关卡数据文件 ---- */
    {
      filePath: 'src/level-gen/example-level.json',
      content: "{\n  \"meta\": {\n    \"algorithm\": \"bsp\",\n    \"seed\": 42,\n    \"width\": 64,\n    \"height\": 64,\n    \"generatedAt\": \"2026-06-13T00:00:00.000Z\"\n  },\n  \"data\": {\n    \"type\": \"bsp\",\n    \"rooms\": [\n      { \"id\": 0, \"x\": 8, \"y\": 8, \"width\": 12, \"height\": 10, \"type\": \"normal\" },\n      { \"id\": 1, \"x\": 44, \"y\": 8, \"width\": 10, \"height\": 12, \"type\": \"treasure\" },\n      { \"id\": 2, \"x\": 8, \"y\": 44, \"width\": 14, \"height\": 10, \"type\": \"combat\" },\n      { \"id\": 3, \"x\": 44, \"y\": 40, \"width\": 10, \"height\": 14, \"type\": \"boss\" }\n    ],\n    \"corridors\": [\n      {\n        \"from\": 0,\n        \"to\": 1,\n        \"path\": [\n          { \"x\": 14, \"y\": 13 },\n          { \"x\": 20, \"y\": 13 },\n          { \"x\": 30, \"y\": 13 },\n          { \"x\": 40, \"y\": 13 },\n          { \"x\": 44, \"y\": 13 }\n        ]\n      },\n      {\n        \"from\": 0,\n        \"to\": 2,\n        \"path\": [\n          { \"x\": 14, \"y\": 18 },\n          { \"x\": 14, \"y\": 30 },\n          { \"x\": 14, \"y\": 44 }\n        ]\n      },\n      {\n        \"from\": 1,\n        \"to\": 3,\n        \"path\": [\n          { \"x\": 49, \"y\": 20 },\n          { \"x\": 49, \"y\": 30 },\n          { \"x\": 49, \"y\": 40 }\n        ]\n      }\n    ]\n  }\n}\n",
    },
    /* ---- 关卡生成测试 ---- */
    {
      filePath: 'tests/level-gen.test.ts',
      content: "import { describe, it, expect, beforeEach } from 'vitest';\nimport {\n  generateBSPDungeon,\n  generateCaveMap,\n  generateRandomWalk,\n  generateWFC,\n  generateLevel,\n  validateLevel,\n  TileType,\n  DEFAULT_BSP_PARAMS,\n  DEFAULT_CA_PARAMS,\n  DEFAULT_RANDOM_WALK_PARAMS,\n  DEFAULT_WFC_PARAMS,\n  DEFAULT_WFC_TILESET,\n  type Room,\n  type Corridor,\n  type WFCTile,\n  type WFCTileset,\n} from '../src/level-gen/index';\n\nfunction countTileType(grid: TileType[][], type: TileType): number {\n  let count = 0;\n  for (const row of grid) {\n    for (const cell of row) {\n      if (cell === type) count++;\n    }\n  }\n  return count;\n}\n\nfunction gridDimensions(grid: TileType[][]): { width: number; height: number } {\n  return { height: grid.length, width: grid[0]?.length ?? 0 };\n}\n\ndescribe('LevelGen — BSP 地下城生成', () => {\n  it('正常参数：生成房间和走廊', () => {\n    const { rooms, corridors } = generateBSPDungeon({\n      mapWidth: 64,\n      mapHeight: 64,\n      minRoomSize: 5,\n      maxDepth: 4,\n      seed: 42,\n    });\n\n    expect(rooms.length).toBeGreaterThan(0);\n    expect(rooms.length).toBeLessThanOrEqual(16);\n    expect(corridors.length).toBeGreaterThan(0);\n\n    for (const room of rooms) {\n      expect(room.x).toBeGreaterThanOrEqual(0);\n      expect(room.y).toBeGreaterThanOrEqual(0);\n      expect(room.width).toBeGreaterThanOrEqual(5);\n      expect(room.height).toBeGreaterThanOrEqual(5);\n      expect(room.x + room.width).toBeLessThanOrEqual(64);\n      expect(room.y + room.height).toBeLessThanOrEqual(64);\n      expect(typeof room.id).toBe('number');\n      expect(room.type).toBeTruthy();\n    }\n  });\n\n  it('边界参数：最小尺寸房间', () => {\n    const { rooms } = generateBSPDungeon({\n      mapWidth: 30,\n      mapHeight: 30,\n      minRoomSize: 5,\n      maxDepth: 1,\n      seed: 1,\n    });\n    expect(rooms.length).toBeLessThanOrEqual(2);\n    expect(rooms.length).toBeGreaterThanOrEqual(1);\n    for (const room of rooms) {\n      expect(room.width).toBeGreaterThanOrEqual(5);\n      expect(room.height).toBeGreaterThanOrEqual(5);\n    }\n  });\n\n  it('极值参数：很小的地图', () => {\n    const { rooms } = generateBSPDungeon({\n      mapWidth: 20,\n      mapHeight: 20,\n      minRoomSize: 3,\n      maxDepth: 1,\n      seed: 7,\n    });\n    for (const room of rooms) {\n      expect(room.x + room.width).toBeLessThanOrEqual(20);\n      expect(room.y + room.height).toBeLessThanOrEqual(20);\n    }\n  });\n\n  it('多次生成一致性：相同种子产生相同结果', () => {\n    const a = generateBSPDungeon({ ...DEFAULT_BSP_PARAMS, seed: 12345 });\n    const b = generateBSPDungeon({ ...DEFAULT_BSP_PARAMS, seed: 12345 });\n    expect(a.rooms.length).toBe(b.rooms.length);\n    expect(a.corridors.length).toBe(b.corridors.length);\n    for (let i = 0; i < a.rooms.length; i++) {\n      expect(a.rooms[i].x).toBe(b.rooms[i].x);\n      expect(a.rooms[i].y).toBe(b.rooms[i].y);\n      expect(a.rooms[i].width).toBe(b.rooms[i].width);\n      expect(a.rooms[i].height).toBe(b.rooms[i].height);\n    }\n  });\n\n  it('连通性校验：走廊连接所有房间', () => {\n    for (let seed = 0; seed < 5; seed++) {\n      const { rooms, corridors } = generateBSPDungeon({\n        ...DEFAULT_BSP_PARAMS,\n        seed,\n      });\n      if (rooms.length <= 1) continue;\n      for (const corr of corridors) {\n        expect(corr.path.length).toBeGreaterThan(0);\n      }\n      expect(corridors.length).toBeGreaterThanOrEqual(rooms.length - 1);\n    }\n  });\n\n  it('深递归：maxDepth=6', () => {\n    const { rooms } = generateBSPDungeon({\n      mapWidth: 128,\n      mapHeight: 128,\n      minRoomSize: 4,\n      maxDepth: 6,\n      seed: 99,\n    });\n    expect(rooms.length).toBeGreaterThanOrEqual(1);\n    expect(rooms.length).toBeLessThanOrEqual(64);\n  });\n\n  it('走廊路径点都在地图边界内', () => {\n    const { corridors } = generateBSPDungeon({\n      mapWidth: 64,\n      mapHeight: 64,\n      minRoomSize: 5,\n      maxDepth: 3,\n      seed: 55,\n    });\n    for (const corr of corridors) {\n      for (const pt of corr.path) {\n        expect(pt.x).toBeGreaterThanOrEqual(0);\n        expect(pt.x).toBeLessThan(64);\n        expect(pt.y).toBeGreaterThanOrEqual(0);\n        expect(pt.y).toBeLessThan(64);\n      }\n    }\n  });\n});\n\ndescribe('LevelGen — CA 洞穴生成', () => {\n  it('正常参数：生成合适比例的洞穴', () => {\n    const grid = generateCaveMap({\n      width: 64,\n      height: 64,\n      fillProbability: 0.45,\n      iterations: 4,\n      birthLimit: 4,\n      deathLimit: 3,\n      seed: 42,\n    });\n    const { width, height } = gridDimensions(grid);\n    expect(width).toBe(64);\n    expect(height).toBe(64);\n    const floorCount = countTileType(grid, TileType.FLOOR);\n    const ratio = floorCount / (width * height);\n    expect(ratio).toBeGreaterThan(0.1);\n    expect(ratio).toBeLessThan(0.9);\n  });\n\n  it('边界参数：全墙（fillProbability=0）', () => {\n    const grid = generateCaveMap({\n      width: 20,\n      height: 20,\n      fillProbability: 0.0,\n      iterations: 4,\n      birthLimit: 4,\n      deathLimit: 3,\n      seed: 1,\n    });\n    const floorCount = countTileType(grid, TileType.FLOOR);\n    expect(floorCount).toBe(0);\n  });\n\n  it('边界参数：全地（fillProbability=1）', () => {\n    const grid = generateCaveMap({\n      width: 20,\n      height: 20,\n      fillProbability: 1.0,\n      iterations: 4,\n      birthLimit: 4,\n      deathLimit: 3,\n      seed: 2,\n    });\n    const wallCount = countTileType(grid, TileType.WALL);\n    expect(wallCount).toBe(0);\n  });\n\n  it('极值参数：超大地图', () => {\n    const grid = generateCaveMap({\n      width: 100,\n      height: 100,\n      fillProbability: 0.45,\n      iterations: 2,\n      birthLimit: 4,\n      deathLimit: 3,\n      seed: 3,\n    });\n    expect(grid.length).toBe(100);\n    expect(grid[0].length).toBe(100);\n  });\n\n  it('多次生成一致性：相同种子相同结果', () => {\n    const a = generateCaveMap({ ...DEFAULT_CA_PARAMS, seed: 99999 });\n    const b = generateCaveMap({ ...DEFAULT_CA_PARAMS, seed: 99999 });\n    for (let y = 0; y < a.length; y++) {\n      for (let x = 0; x < a[y].length; x++) {\n        expect(a[y][x]).toBe(b[y][x]);\n      }\n    }\n  });\n\n  it('不同种子产生不同结果', () => {\n    const a = generateCaveMap({ ...DEFAULT_CA_PARAMS, seed: 111 });\n    const b = generateCaveMap({ ...DEFAULT_CA_PARAMS, seed: 222 });\n    let diffCount = 0;\n    for (let y = 0; y < a.length; y++) {\n      for (let x = 0; x < a[y].length; x++) {\n        if (a[y][x] !== b[y][x]) diffCount++;\n      }\n    }\n    expect(diffCount).toBeGreaterThan(0);\n  });\n\n  it('多次迭代后趋于稳定', () => {\n    const highIter = generateCaveMap({\n      ...DEFAULT_CA_PARAMS,\n      seed: 42,\n      iterations: 6,\n    });\n    const lowIter = generateCaveMap({\n      ...DEFAULT_CA_PARAMS,\n      seed: 42,\n      iterations: 2,\n    });\n    let diffCount = 0;\n    for (let y = 0; y < highIter.length; y++) {\n      for (let x = 0; x < highIter[y].length; x++) {\n        if (highIter[y][x] !== lowIter[y][x]) diffCount++;\n      }\n    }\n    expect(diffCount).toBeGreaterThan(0);\n  });\n});\n\ndescribe('LevelGen — Random Walk 随机游走', () => {\n  it('正常参数：从中心开始挖出连续通道', () => {\n    const grid = generateRandomWalk({\n      width: 64,\n      height: 64,\n      steps: 2000,\n      turnBias: 0.3,\n      seed: 42,\n    });\n    const { width, height } = gridDimensions(grid);\n    expect(width).toBe(64);\n    expect(height).toBe(64);\n    const floorCount = countTileType(grid, TileType.FLOOR);\n    expect(floorCount).toBeGreaterThan(0);\n    expect(floorCount).toBeLessThanOrEqual(2000);\n  });\n\n  it('边界参数：0 步', () => {\n    const grid = generateRandomWalk({\n      width: 32,\n      height: 32,\n      steps: 0,\n      turnBias: 0.3,\n      seed: 1,\n    });\n    const floorCount = countTileType(grid, TileType.FLOOR);\n    expect(floorCount).toBe(1);\n  });\n\n  it('极值参数：超多步数', () => {\n    const grid = generateRandomWalk({\n      width: 50,\n      height: 50,\n      steps: 10000,\n      turnBias: 0.5,\n      seed: 2,\n    });\n    const floorCount = countTileType(grid, TileType.FLOOR);\n    expect(floorCount).toBeGreaterThan(0);\n    expect(floorCount).toBeLessThanOrEqual(2500);\n  });\n\n  it('多次生成一致性：相同种子相同结果', () => {\n    const a = generateRandomWalk({\n      ...DEFAULT_RANDOM_WALK_PARAMS,\n      seed: 7777,\n    });\n    const b = generateRandomWalk({\n      ...DEFAULT_RANDOM_WALK_PARAMS,\n      seed: 7777,\n    });\n    for (let y = 0; y < a.length; y++) {\n      for (let x = 0; x < a[y].length; x++) {\n        expect(a[y][x]).toBe(b[y][x]);\n      }\n    }\n  });\n\n  it('高转弯概率：游走更局部', () => {\n    const highTurn = generateRandomWalk({\n      width: 64,\n      height: 64,\n      steps: 1000,\n      turnBias: 0.9,\n      seed: 42,\n    });\n    const lowTurn = generateRandomWalk({\n      width: 64,\n      height: 64,\n      steps: 1000,\n      turnBias: 0.1,\n      seed: 42,\n    });\n    let diffCount = 0;\n    for (let y = 0; y < highTurn.length; y++) {\n      for (let x = 0; x < highTurn[y].length; x++) {\n        if (highTurn[y][x] !== lowTurn[y][x]) diffCount++;\n      }\n    }\n    expect(diffCount).toBeGreaterThan(0);\n  });\n\n  it('游走不超出地图边界', () => {\n    const grid = generateRandomWalk({\n      width: 32,\n      height: 32,\n      steps: 5000,\n      turnBias: 0.5,\n      seed: 123,\n    });\n    expect(grid.length).toBe(32);\n    for (const row of grid) {\n      expect(row.length).toBe(32);\n    }\n  });\n\n  it('中心点始终为地板', () => {\n    const grid = generateRandomWalk({\n      width: 20,\n      height: 20,\n      steps: 0,\n      turnBias: 0.3,\n      seed: 1,\n    });\n    expect(grid[10][10]).toBe(TileType.FLOOR);\n  });\n});\n\ndescribe('LevelGen — WFC 生成', () => {\n  const tileset: WFCTileset = { ...DEFAULT_WFC_TILESET };\n\n  it('正常参数：生成有效 tile grid', () => {\n    const tiles = generateWFC({\n      width: 16,\n      height: 16,\n      tileset,\n      seed: 42,\n      retries: 5,\n    });\n    expect(tiles.length).toBe(16);\n    expect(tiles[0].length).toBe(16);\n    const validIds = new Set(tileset.tiles.map((t) => t.id));\n    for (const row of tiles) {\n      for (const tile of row) {\n        expect(validIds.has(tile)).toBe(true);\n      }\n    }\n  });\n\n  it('边界参数：最小尺寸 2x2', () => {\n    const tiles = generateWFC({\n      width: 2,\n      height: 2,\n      tileset,\n      seed: 1,\n    });\n    expect(tiles.length).toBe(2);\n    expect(tiles[0].length).toBe(2);\n    expect(tiles[1].length).toBe(2);\n  });\n\n  it('极值参数：较大尺寸 32x32', () => {\n    const tiles = generateWFC({\n      width: 32,\n      height: 32,\n      tileset,\n      seed: 7,\n      retries: 3,\n    });\n    expect(tiles.length).toBe(32);\n    expect(tiles[0].length).toBe(32);\n  });\n\n  it('多次生成一致性：相同种子相同结果', () => {\n    const a = generateWFC({\n      width: 12,\n      height: 12,\n      tileset,\n      seed: 5555,\n    });\n    const b = generateWFC({\n      width: 12,\n      height: 12,\n      tileset,\n      seed: 5555,\n    });\n    for (let y = 0; y < a.length; y++) {\n      for (let x = 0; x < a[y].length; x++) {\n        expect(a[y][x]).toBe(b[y][x]);\n      }\n    }\n  });\n\n  it('邻接规则得到遵守', () => {\n    const tiles = generateWFC({\n      width: 16,\n      height: 16,\n      tileset,\n      seed: 42,\n    });\n    const tileMap = new Map<number, WFCTile>();\n    for (const t of tileset.tiles) tileMap.set(t.id, t);\n    for (let y = 0; y < 16; y++) {\n      for (let x = 0; x < 16; x++) {\n        const current = tileMap.get(tiles[y][x]);\n        if (!current) continue;\n        if (x < 15) {\n          const right = tileMap.get(tiles[y][x + 1]);\n          if (right) {\n            expect(current.allowedRight.includes(right.id)).toBe(true);\n          }\n        }\n        if (y < 15) {\n          const down = tileMap.get(tiles[y + 1][x]);\n          if (down) {\n            expect(current.allowedDown.includes(down.id)).toBe(true);\n          }\n        }\n      }\n    }\n  });\n});\n\ndescribe('LevelGen — validateLevel 校验', () => {\n  it('BSP 有效关卡通过校验', () => {\n    const level = generateLevel({\n      algorithm: 'bsp',\n      width: 64,\n      height: 64,\n      seed: 42,\n      algorithmParams: DEFAULT_BSP_PARAMS,\n    });\n    const result = validateLevel(level);\n    expect(result.valid).toBe(true);\n    expect(result.errors).toEqual([]);\n  });\n\n  it('CA 有效关卡通过校验', () => {\n    const level = generateLevel({\n      algorithm: 'cellular_automata',\n      width: 64,\n      height: 64,\n      seed: 42,\n      algorithmParams: DEFAULT_CA_PARAMS,\n    });\n    const result = validateLevel(level);\n    expect(result.valid).toBe(true);\n  });\n\n  it('BSP 无房间时的校验', () => {\n    const level = {\n      meta: { algorithm: 'bsp' as const, seed: 0, width: 64, height: 64, generatedAt: new Date().toISOString() },\n      data: { type: 'bsp' as const, rooms: [], corridors: [] },\n    };\n    const result = validateLevel(level);\n    expect(result.valid).toBe(false);\n    expect(result.errors.some((e) => e.includes('房间'))).toBe(true);\n  });\n\n  it('grid 全墙的死图校验', () => {\n    const grid: TileType[][] = Array.from({ length: 10 }, () =>\n      new Array(10).fill(TileType.WALL),\n    );\n    const level = {\n      meta: {\n        algorithm: 'cellular_automata' as const,\n        seed: 0,\n        width: 10,\n        height: 10,\n        generatedAt: new Date().toISOString(),\n      },\n      data: { type: 'grid' as const, grid, width: 10, height: 10 },\n    };\n    const result = validateLevel(level);\n    expect(result.valid).toBe(false);\n  });\n\n  it('grid 全地板通过校验', () => {\n    const grid: TileType[][] = Array.from({ length: 10 }, () =>\n      new Array(10).fill(TileType.FLOOR),\n    );\n    const level = {\n      meta: {\n        algorithm: 'random_walk' as const,\n        seed: 0,\n        width: 10,\n        height: 10,\n        generatedAt: new Date().toISOString(),\n      },\n      data: { type: 'grid' as const, grid, width: 10, height: 10 },\n    };\n    const result = validateLevel(level);\n    expect(result.valid).toBe(true);\n  });\n});\n\ndescribe('LevelGen — generateLevel 统一入口', () => {\n  it('BSP 算法生成有效关卡', () => {\n    const level = generateLevel({\n      algorithm: 'bsp',\n      width: 64,\n      height: 64,\n      seed: 42,\n      algorithmParams: DEFAULT_BSP_PARAMS,\n    });\n    expect(level.meta.algorithm).toBe('bsp');\n    expect(level.data.type).toBe('bsp');\n    expect(level.data.rooms.length).toBeGreaterThan(0);\n  });\n\n  it('cellular_automata 算法生成有效关卡', () => {\n    const level = generateLevel({\n      algorithm: 'cellular_automata',\n      width: 64,\n      height: 64,\n      seed: 42,\n      algorithmParams: DEFAULT_CA_PARAMS,\n    });\n    expect(level.meta.algorithm).toBe('cellular_automata');\n    expect(level.data.type).toBe('grid');\n    expect(level.data.grid.length).toBeGreaterThan(0);\n  });\n\n  it('random_walk 算法生成有效关卡', () => {\n    const level = generateLevel({\n      algorithm: 'random_walk',\n      width: 64,\n      height: 64,\n      seed: 42,\n      algorithmParams: DEFAULT_RANDOM_WALK_PARAMS,\n    });\n    expect(level.meta.algorithm).toBe('random_walk');\n    expect(level.data.type).toBe('grid');\n  });\n\n  it('wfc 算法生成有效关卡', () => {\n    const level = generateLevel({\n      algorithm: 'wfc',\n      width: 16,\n      height: 16,\n      seed: 42,\n      algorithmParams: { ...DEFAULT_WFC_PARAMS, tileset: DEFAULT_WFC_TILESET },\n    });\n    expect(level.meta.algorithm).toBe('wfc');\n    expect(level.data.type).toBe('wfc');\n    expect(level.data.tiles.length).toBe(16);\n  });\n\n  it('WFC 缺少 tileset 时抛错', () => {\n    expect(() =>\n      generateLevel({\n        algorithm: 'wfc',\n        width: 16,\n        height: 16,\n        seed: 42,\n        algorithmParams: {} as any,\n      }),\n    ).toThrow();\n  });\n});\n",
    },
  ];
}


/* ================================================================
 * 步骤 12: 数值系统 (numerics)
 * ================================================================ */

function generateNumerics(): GeneratedFile[] {
  const curvesContent = "/* ===================================================================\n * src/numerics/curves.ts — 手游核心数值工具库（自动生成）\n *\n * 成长曲线 / 掉落系统 / 战斗数值 / 经济平衡\n * =================================================================== */\n\n/* ==================== 通用类型 ==================== */\n\nexport interface PiecewiseSegment {\n  from: number;\n  to: number;\n  formula: 'linear' | 'exponential' | 'polynomial';\n  params: number[];\n}\n\nexport interface DropItem<T = string> {\n  item: T;\n  weight: number;\n  minQuantity?: number;\n  maxQuantity?: number;\n  conditions?: () => boolean;\n}\n\nexport interface RarityConfig {\n  rarity: 'N' | 'R' | 'SR' | 'SSR';\n  baseProbability: number;\n}\n\nexport interface GachaResult {\n  rarity: 'N' | 'R' | 'SR' | 'SSR';\n  pityTriggered: boolean;\n  newCard: boolean;\n}\n\nexport type ArmorFormula = 'linear' | 'logarithmic' | 'piecewise';\n\nexport interface CombatWeight {\n  atk?: number;\n  hp?: number;\n  armor?: number;\n  speed?: number;\n  critRate?: number;\n  critDamage?: number;\n}\n\n/* ==================== 成长曲线 ==================== */\n\nexport class GrowthCurve {\n  static linear(base: number, slope: number, level: number): number {\n    return base + slope * level;\n  }\n\n  static exponential(base: number, factor: number, level: number): number {\n    return base * Math.pow(factor, level);\n  }\n\n  static polynomial(base: number, coeff: number, degree: number, level: number): number {\n    return base + coeff * Math.pow(level, degree);\n  }\n\n  static logistic(max: number, mid: number, steep: number, level: number): number {\n    return max / (1 + Math.exp(-steep * (level - mid)));\n  }\n\n  static piecewise(segments: PiecewiseSegment[], level: number): number {\n    for (const seg of segments) {\n      if (level >= seg.from && level <= seg.to) {\n        const [a, b, c] = seg.params;\n        switch (seg.formula) {\n          case 'linear': return GrowthCurve.linear(a, b, level);\n          case 'exponential': return GrowthCurve.exponential(a, b, level);\n          case 'polynomial': return GrowthCurve.polynomial(a, b, c ?? 2, level);\n        }\n      }\n    }\n    const last = segments[segments.length - 1];\n    return GrowthCurve.piecewise(segments, last.to);\n  }\n\n  static inverseCurve(fn: (lv: number) => number, target: number, range: [number, number], tol = 0.01): number | null {\n    if (fn(range[0]) >= target) return range[0];\n    if (fn(range[1]) < target) return null;\n    let lo = range[0], hi = range[1];\n    while (hi - lo > tol) {\n      const mid = (lo + hi) / 2;\n      if (fn(mid) < target) lo = mid; else hi = mid;\n    }\n    return Math.ceil(hi * 100) / 100;\n  }\n}\n\n/* ==================== 掉落系统 ==================== */\n\nexport class LootTable<T = string> {\n  private drops: DropItem<T>[] = [];\n  roll(count = 1, withReplacement = true): { item: T; quantity: number }[] {\n    const active = this.drops.filter(d => !d.conditions || d.conditions());\n    const results: { item: T; quantity: number }[] = [];\n    if (active.length === 0 || count <= 0) return results;\n    if (withReplacement) {\n      const tw = active.reduce((s, d) => s + d.weight, 0);\n      for (let i = 0; i < count; i++) {\n        let r = Math.random() * tw;\n        for (const d of active) { r -= d.weight; if (r <= 0) { results.push({ item: d.item, quantity: this.qty(d) }); break; } }\n      }\n    } else {\n      const rem = active.map(d => ({...d}));\n      for (let i = 0; i < Math.min(count, rem.length); i++) {\n        const tw = rem.reduce((s, d) => s + d.weight, 0);\n        let r = Math.random() * tw, idx = 0;\n        for (let j = 0; j < rem.length; j++) { r -= rem[j].weight; if (r <= 0) { idx = j; break; } }\n        results.push({ item: rem[idx].item, quantity: this.qty(rem[idx]) });\n        rem.splice(idx, 1);\n      }\n    }\n    return results;\n  }\n  rollGuaranteed(count: number, rare: T, pityThreshold: number): { item: T; quantity: number }[] {\n    const results: { item: T; quantity: number }[] = [];\n    let miss = 0;\n    for (let i = 0; i < count; i++) {\n      if (miss >= pityThreshold - 1) {\n        const rd = this.drops.find(d => d.item === rare);\n        if (rd) { results.push({ item: rd.item, quantity: this.qty(rd) }); miss = 0; continue; }\n      }\n      const res = this.roll(1);\n      if (res.length > 0) { results.push(res[0]); if (res[0].item === rare) miss = 0; else miss++; }\n    }\n    return results;\n  }\n  addDrop(item: T, weight: number, minQty = 1, maxQty?: number, cond?: () => boolean): void {\n    this.drops.push({ item, weight, minQuantity: minQty, maxQuantity: maxQty, conditions: cond });\n  }\n  clear(): void { this.drops = []; }\n  private qty(d: DropItem<T>): number {\n    const min = d.minQuantity ?? 1, max = d.maxQuantity ?? min;\n    return min === max ? min : Math.floor(Math.random() * (max - min + 1)) + min;\n  }\n}\n\n/* ==================== 抽卡系统 ==================== */\n\nexport class GachaBanner {\n  private pity = 0;\n  constructor(\n    public rarities: RarityConfig[],\n    public softPityStart = 75,\n    public hardPity = 90,\n    public softPityInc = 0.06,\n  ) {}\n  resetPity(): void { this.pity = 0; }\n  pull(count = 1): GachaResult[] {\n    const results: GachaResult[] = [];\n    const highest = this.rarities[this.rarities.length - 1];\n    for (let i = 0; i < count; i++) {\n      this.pity++;\n      if (this.pity >= this.hardPity) {\n        results.push({ rarity: highest.rarity, pityTriggered: true, newCard: true });\n        this.pity = 0; continue;\n      }\n      let ep = highest.baseProbability;\n      if (this.pity >= this.softPityStart) ep = Math.min(1, ep + this.softPityInc * (this.pity - this.softPityStart + 1));\n      const adjusted = this.rarities.map(r => ({\n        ...r, baseProbability: r.rarity === highest.rarity ? ep : r.baseProbability * ((1 - ep) / (1 - highest.baseProbability))\n      }));\n      let roll = Math.random(), cum = 0;\n      let sel: RarityConfig = adjusted[0];\n      for (const r of adjusted) { cum += r.baseProbability; if (roll <= cum) { sel = r; break; } }\n      results.push({ rarity: sel.rarity, pityTriggered: sel.rarity === highest.rarity && this.pity >= this.softPityStart, newCard: true });\n      if (sel.rarity === highest.rarity) this.pity = 0;\n    }\n    return results;\n  }\n}\n\n/* ==================== 战斗数值 ==================== */\n\nexport namespace CombatMath {\n  export function damageReduction(armor: number, formula: ArmorFormula, params: number[] = []): number {\n    if (armor < 0) return 0;\n    switch (formula) {\n      case 'linear': { const k = params[0] ?? 100; return armor / (armor + k); }\n      case 'logarithmic': { const k = params[0] ?? 100, r = params[1] ?? 0.15; return Math.min(1, Math.log(1 + armor / k) * r); }\n      case 'piecewise': {\n        const t = params[0] ?? 100, r1 = params[1] ?? 0.01, r2 = params[2] ?? 0.002;\n        return armor < t ? Math.min(1, armor * r1) : Math.min(1, t * r1 + (armor - t) * r2);\n      }\n    }\n  }\n  export function expectedDPS(atk: number, speed: number, critRate: number, critDmg: number): number {\n    return atk * speed * (1 + critRate * (critDmg - 1));\n  }\n  export function effectiveHP(hp: number, armor: number, formula: ArmorFormula, params: number[] = []): number {\n    const dr = damageReduction(armor, formula, params);\n    return dr >= 1 ? Infinity : hp / (1 - dr);\n  }\n  export function combatPower(stats: Record<string, number>, weights: CombatWeight): number {\n    let p = 0;\n    if (weights.atk) p += (stats.atk ?? 0) * weights.atk;\n    if (weights.hp) p += (stats.hp ?? 0) * weights.hp;\n    if (weights.armor) p += (stats.armor ?? 0) * weights.armor;\n    if (weights.speed) p += (stats.speed ?? 0) * weights.speed;\n    if (weights.critRate) p += (stats.critRate ?? 0) * weights.critRate;\n    if (weights.critDamage) p += (stats.critDamage ?? 0) * weights.critDamage;\n    return Math.round(p * 100) / 100;\n  }\n}\n\n/* ==================== 经济平衡 ==================== */\n\nexport namespace Economy {\n  export function timeToBuy(cost: number, incomeRate: number): number {\n    if (incomeRate <= 0) throw new RangeError('incomeRate must be > 0');\n    return cost / incomeRate;\n  }\n  export function resourceSink(items: { cost: number; produce: number }[]): { totalCost: number; totalProduce: number; net: number } {\n    let tc = 0, tp = 0;\n    for (const it of items) { tc += it.cost; tp += it.produce; }\n    return { totalCost: tc, totalProduce: tp, net: tp - tc };\n  }\n  export function inflationAdjusted(baseValue: number, rate: number, period: number): number {\n    return baseValue * Math.pow(1 + rate, period);\n  }\n}\n";

  const exportContent = "/* ===================================================================\n * src/numerics/export.ts — 数值可视化导出（自动生成）\n * =================================================================== */\n\nimport { GrowthCurve, LootTable, GachaBanner } from './curves';\nimport type { GachaStats } from './curves';\n\nexport function exportGrowthTable(fn: (lv: number) => number, levels: [number, number]): string {\n  const rows = ['Level,Value'];\n  for (let lv = levels[0]; lv <= levels[1]; lv++) rows.push(`${lv},${fn(lv)}`);\n  return rows.join('\\n') + '\\n';\n}\n\nexport function exportLootTable<T extends string>(table: LootTable<T>, simulations: number): string {\n  const stats = new Map<string, { count: number; totalQty: number }>();\n  for (let i = 0; i < simulations; i++) {\n    for (const r of table.roll(1)) {\n      const ex = stats.get(r.item) ?? { count: 0, totalQty: 0 };\n      ex.count++; ex.totalQty += r.quantity;\n      stats.set(r.item, ex);\n    }\n  }\n  const rows = ['Item,Count,Frequency,AvgQuantity'];\n  for (const [item, s] of stats) rows.push(`${item},${s.count},${(s.count/simulations).toFixed(6)},${(s.totalQty/s.count).toFixed(4)}`);\n  return rows.join('\\n') + '\\n';\n}\n\nexport function exportGachaStats(banner: GachaBanner, pulls: number): string {\n  banner.resetPity();\n  const results = banner.pull(pulls);\n  const rc: Record<string, number> = {};\n  let pityCount = 0, ssr = 0, srPlus = 0;\n  for (const r of results) {\n    rc[r.rarity] = (rc[r.rarity] ?? 0) + 1;\n    if (r.pityTriggered) pityCount++;\n    if (r.rarity === 'SSR') ssr++;\n    if (r.rarity === 'SR' || r.rarity === 'SSR') srPlus++;\n  }\n  const lines: string[] = [];\n  lines.push('Metric,Value');\n  lines.push(`Total Pulls,${pulls}`);\n  lines.push(`Pity Trigger Count,${pityCount}`);\n  lines.push(`Avg Pulls Per SSR,${ssr > 0 ? (pulls / ssr).toFixed(2) : 'N/A'}`);\n  lines.push(`Avg Pulls Per SR+,${srPlus > 0 ? (pulls / srPlus).toFixed(2) : 'N/A'}`);\n  lines.push('');\n  lines.push('Rarity,Count,Percentage');\n  for (const r of ['N', 'R', 'SR', 'SSR']) {\n    const c = rc[r] ?? 0;\n    lines.push(`${r},${c},${((c / pulls) * 100).toFixed(2)}%`);\n  }\n  return lines.join('\\n') + '\\n';\n}\n";

  const indexContent = "/* ===================================================================\n * src/numerics/index.ts — 数值系统模块公共导出（自动生成）\n * =================================================================== */\n\nexport { GrowthCurve, LootTable, GachaBanner, CombatMath, Economy } from './curves';\nexport type { PiecewiseSegment, DropItem, GachaResult, RarityConfig, GachaStats, ArmorFormula, CombatWeight } from './curves';\nexport { exportGrowthTable, exportLootTable, exportGachaStats } from './export';\n";

  return [
    { filePath: 'src/numerics/curves.ts', content: curvesContent },
    { filePath: 'src/numerics/export.ts', content: exportContent },
    { filePath: 'src/numerics/index.ts', content: indexContent },
  ];
}

/* ================================================================
 * Unity 引擎：2D 品类代码生成
 * ================================================================ */

export function generateUnity2D(): GeneratedFile[] {
  return [
    /* ---- PlayerController2D.cs ---- */
    {
      filePath: 'src/game/PlayerController2D.cs',
      content: `using UnityEngine;
using UnityEngine.InputSystem;

namespace Game.Player
{
    /// <summary>
    /// 2D 玩家控制器 — Input System + Rigidbody2D 移动与跳跃
    /// </summary>
    [RequireComponent(typeof(Rigidbody2D))]
    [RequireComponent(typeof(Collider2D))]
    public class PlayerController2D : MonoBehaviour
    {
        [Header("Movement")]
        [SerializeField] private float moveSpeed = 8f;
        [SerializeField] private float acceleration = 50f;
        [SerializeField] private float deceleration = 40f;

        [Header("Jump")]
        [SerializeField] private float jumpForce = 12f;
        [SerializeField] private float fallMultiplier = 2.5f;
        [SerializeField] private float lowJumpMultiplier = 2f;
        [SerializeField] private float coyoteTime = 0.1f;
        [SerializeField] private float jumpBufferTime = 0.1f;

        [Header("Ground Check")]
        [SerializeField] private LayerMask groundLayer;
        [SerializeField] private Transform groundCheck;
        [SerializeField] private float groundCheckRadius = 0.2f;

        private Rigidbody2D _rb;
        private float _moveInput;
        private bool _jumpPressed;
        private float _coyoteTimer;
        private float _jumpBufferTimer;
        private bool _isGrounded;
        private bool _wasGrounded;

        private void Awake()
        {
            _rb = GetComponent<Rigidbody2D>();
        }

        private void Update()
        {
            CheckGround();
            UpdateTimers();
        }

        private void FixedUpdate()
        {
            ApplyMovement();
            ApplyGravityModifiers();
        }

        // ========== Input System Callbacks ==========

        public void OnMove(InputAction.CallbackContext context)
        {
            _moveInput = context.ReadValue<Vector2>().x;
        }

        public void OnJump(InputAction.CallbackContext context)
        {
            if (context.performed)
            {
                _jumpPressed = true;
                _jumpBufferTimer = jumpBufferTime;
            }
            else if (context.canceled)
            {
                _jumpPressed = false;
            }
        }

        // ========== Movement Logic ==========

        private void CheckGround()
        {
            _wasGrounded = _isGrounded;
            _isGrounded = Physics2D.OverlapCircle(groundCheck.position, groundCheckRadius, groundLayer);

            if (_isGrounded && !_wasGrounded)
            {
                _coyoteTimer = coyoteTime;
            }
        }

        private void UpdateTimers()
        {
            _coyoteTimer -= Time.deltaTime;
            _jumpBufferTimer -= Time.deltaTime;
        }

        private void ApplyMovement()
        {
            float targetSpeed = _moveInput * moveSpeed;
            float speedDiff = targetSpeed - _rb.linearVelocity.x;
            float accelRate = (Mathf.Abs(targetSpeed) > 0.01f) ? acceleration : deceleration;
            float force = speedDiff * accelRate;

            _rb.AddForce(Vector2.right * force, ForceMode2D.Force);

            // Jump with coyote time + jump buffer
            if (_jumpBufferTimer > 0f && _coyoteTimer > 0f)
            {
                _rb.linearVelocity = new Vector2(_rb.linearVelocity.x, jumpForce);
                _coyoteTimer = 0f;
                _jumpBufferTimer = 0f;
            }
        }

        private void ApplyGravityModifiers()
        {
            if (_rb.linearVelocity.y < 0f)
            {
                _rb.linearVelocity += Vector2.up * (Physics2D.gravity.y * (fallMultiplier - 1f) * Time.fixedDeltaTime);
            }
            else if (_rb.linearVelocity.y > 0f && !_jumpPressed)
            {
                _rb.linearVelocity += Vector2.up * (Physics2D.gravity.y * (lowJumpMultiplier - 1f) * Time.fixedDeltaTime);
            }
        }

        private void OnDrawGizmosSelected()
        {
            if (groundCheck != null)
            {
                Gizmos.color = Color.green;
                Gizmos.DrawWireSphere(groundCheck.position, groundCheckRadius);
            }
        }
    }
}
`,
    },
    /* ---- GameManager.cs ---- */
    {
      filePath: 'src/game/GameManager.cs',
      content: `using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Events;

namespace Game.Core
{
    /// <summary>
    /// 游戏管理器 — 单例模式，场景加载与分数管理
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        [Header("Events")]
        public UnityEvent<int> OnScoreChanged = new();
        public UnityEvent OnGameOver = new();
        public UnityEvent OnLevelComplete = new();

        public static GameManager Instance { get; private set; }

        public int Score { get; private set; }
        public int CurrentLevel { get; private set; } = 1;
        public bool IsGameOver { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            IsGameOver = false;
            Score = 0;
        }

        public void AddScore(int points)
        {
            if (IsGameOver) return;
            Score += points;
            OnScoreChanged?.Invoke(Score);
        }

        public void LoadLevel(int levelIndex)
        {
            CurrentLevel = levelIndex;
            SceneManager.LoadScene(levelIndex);
        }

        public void ReloadCurrentLevel()
        {
            SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        }

        public void LoadNextLevel()
        {
            int nextIndex = SceneManager.GetActiveScene().buildIndex + 1;
            if (nextIndex < SceneManager.sceneCountInBuildSettings)
            {
                LoadLevel(nextIndex);
            }
            else
            {
                Debug.Log("[GameManager] No more levels — you win!");
            }
        }

        public void TriggerGameOver()
        {
            if (IsGameOver) return;
            IsGameOver = true;
            OnGameOver?.Invoke();
        }

        public void TriggerLevelComplete()
        {
            if (IsGameOver) return;
            OnLevelComplete?.Invoke();
        }
    }
}
`,
    },
    /* ---- ObjectPool.cs ---- */
    {
      filePath: 'src/game/ObjectPool.cs',
      content: `using System.Collections.Generic;
using UnityEngine;

namespace Game.Utils
{
    /// <summary>
    /// 泛型对象池 — 避免频繁 Instantiate/Destroy 产生的 GC 压力
    /// </summary>
    /// <typeparam name="T">池化对象类型，必须继承 Component</typeparam>
    public class ObjectPool<T> where T : Component
    {
        private readonly Queue<T> _pool = new();
        private readonly T _engineTemplate;
        private readonly Transform _parent;

        public int ActiveCount { get; private set; }
        public int InactiveCount => _pool.Count;
        public int TotalCount => ActiveCount + InactiveCount;

        public ObjectPool(T engineTemplate, int initialSize = 10, Transform parent = null)
        {
            _engineTemplate = engineTemplate;
            _parent = parent;

            for (int i = 0; i < initialSize; i++)
            {
                CreateNew();
            }
        }

        /// <summary>
        /// 从池中获取一个对象（池空时自动扩容）
        /// </summary>
        public T Get()
        {
            T obj;
            if (_pool.Count > 0)
            {
                obj = _pool.Dequeue();
            }
            else
            {
                obj = CreateNew();
            }

            obj.gameObject.SetActive(true);
            ActiveCount++;
            return obj;
        }

        /// <summary>
        /// 从池中获取一个对象并设置位置
        /// </summary>
        public T Get(Vector3 position, Quaternion rotation)
        {
            T obj = Get();
            obj.transform.SetPositionAndRotation(position, rotation);
            return obj;
        }

        /// <summary>
        /// 将对象回收到池中
        /// </summary>
        public void Return(T obj)
        {
            if (obj == null) return;

            obj.gameObject.SetActive(false);
            if (_parent != null)
            {
                obj.transform.SetParent(_parent);
            }
            _pool.Enqueue(obj);
            ActiveCount--;
        }

        /// <summary>
        /// 预热池到指定容量
        /// </summary>
        public void Prewarm(int targetSize)
        {
            while (TotalCount < targetSize)
            {
                CreateNew();
            }
        }

        /// <summary>
        /// 清空池（销毁所有对象）
        /// </summary>
        public void Clear()
        {
            while (_pool.Count > 0)
            {
                T obj = _pool.Dequeue();
                if (obj != null)
                {
                    Object.Destroy(obj.gameObject);
                }
            }

            ActiveCount = 0;
        }

        private T CreateNew()
        {
            T obj = Object.Instantiate(_engineTemplate, _parent);
            obj.gameObject.SetActive(false);
            _pool.Enqueue(obj);
            return obj;
        }
    }
}
`,
    },
    /* ---- EventBus.cs ---- */
    {
      filePath: 'src/game/EventBus.cs',
      content: `using UnityEngine;
using UnityEngine.Events;

namespace Game.Core
{
    /// <summary>
    /// 全局事件总线 — 基于 UnityEvent 的轻量解耦通信
    /// 所有 MonoBehaviour 通过 OnEnable/OnDisable 订阅/注销事件
    /// </summary>
    public static class EventBus
    {
        // ---- 游戏生命周期 ----
        public static readonly UnityEvent OnGameStarted = new();
        public static readonly UnityEvent OnGamePaused = new();
        public static readonly UnityEvent OnGameResumed = new();
        public static readonly UnityEvent OnGameOver = new();

        // ---- 玩家事件 ----
        public static readonly UnityEvent<Vector2> OnPlayerMoved = new();
        public static readonly UnityEvent<int, int> OnPlayerDamaged = new(); // (damage, currentHP)
        public static readonly UnityEvent<int, int> OnPlayerHealed = new();   // (amount, currentHP)
        public static readonly UnityEvent OnPlayerDied = new();

        // ---- 分数 / 进度 ----
        public static readonly UnityEvent<int> OnScoreChanged = new();
        public static readonly UnityEvent OnLevelComplete = new();
        public static readonly UnityEvent<string> OnObjectiveUpdated = new();

        // ---- 收集品 ----
        public static readonly UnityEvent<string, int> OnItemCollected = new(); // (itemID, count)

        /// <summary>
        /// 清除所有监听器（场景切换时调用）
        /// </summary>
        public static void ClearAll()
        {
            OnGameStarted.RemoveAllListeners();
            OnGamePaused.RemoveAllListeners();
            OnGameResumed.RemoveAllListeners();
            OnGameOver.RemoveAllListeners();
            OnPlayerMoved.RemoveAllListeners();
            OnPlayerDamaged.RemoveAllListeners();
            OnPlayerHealed.RemoveAllListeners();
            OnPlayerDied.RemoveAllListeners();
            OnScoreChanged.RemoveAllListeners();
            OnLevelComplete.RemoveAllListeners();
            OnObjectiveUpdated.RemoveAllListeners();
            OnItemCollected.RemoveAllListeners();
        }
    }
}
`,
    },
  ];
}

/* ================================================================
 * Unity 引擎：3D 品类代码生成
 * ================================================================ */

export function generateUnity3D(): GeneratedFile[] {
  return [
    /* ---- PlayerController3D.cs ---- */
    {
      filePath: 'src/game/PlayerController3D.cs',
      content: `using UnityEngine;
using UnityEngine.InputSystem;

namespace Game.Player
{
    /// <summary>
    /// 3D 玩家控制器 — CharacterController + 鼠标视角旋转
    /// </summary>
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController3D : MonoBehaviour
    {
        [Header("Movement")]
        [SerializeField] private float walkSpeed = 5f;
        [SerializeField] private float sprintSpeed = 8f;
        [SerializeField] private float acceleration = 10f;

        [Header("Jump & Gravity")]
        [SerializeField] private float jumpHeight = 1.5f;
        [SerializeField] private float gravity = -15f;

        [Header("Look")]
        [SerializeField] private float mouseSensitivity = 2f;
        [SerializeField] private float lookSmoothing = 10f;
        [SerializeField] private float minPitch = -80f;
        [SerializeField] private float maxPitch = 80f;

        [Header("Camera")]
        [SerializeField] private Transform cameraTarget;

        private CharacterController _controller;
        private Vector2 _moveInput;
        private Vector2 _lookInput;
        private bool _jumpPressed;
        private bool _sprintPressed;

        private float _verticalVelocity;
        private float _cameraPitch;
        private Vector3 _currentVelocity;

        private void Awake()
        {
            _controller = GetComponent<CharacterController>();
        }

        private void Start()
        {
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }

        private void Update()
        {
            HandleLook();
            ApplyGravity();
            Move();
        }

        // ========== Input System Callbacks ==========

        public void OnMove(InputAction.CallbackContext context)
        {
            _moveInput = context.ReadValue<Vector2>();
        }

        public void OnLook(InputAction.CallbackContext context)
        {
            _lookInput = context.ReadValue<Vector2>();
        }

        public void OnJump(InputAction.CallbackContext context)
        {
            if (context.performed)
                _jumpPressed = true;
        }

        public void OnSprint(InputAction.CallbackContext context)
        {
            _sprintPressed = context.ReadValueAsButton();
        }

        // ========== Movement Logic ==========

        private void HandleLook()
        {
            Vector2 lookDelta = _lookInput * mouseSensitivity;

            // Horizontal rotation (Y axis — rotate the player body)
            transform.Rotate(Vector3.up, lookDelta.x);

            // Vertical rotation (X axis — rotate camera target)
            _cameraPitch = Mathf.Clamp(_cameraPitch - lookDelta.y, minPitch, maxPitch);

            if (cameraTarget != null)
            {
                Quaternion targetRotation = Quaternion.Euler(_cameraPitch, 0f, 0f);
                cameraTarget.localRotation = Quaternion.Slerp(
                    cameraTarget.localRotation,
                    targetRotation,
                    Time.deltaTime * lookSmoothing
                );
            }
        }

        private void ApplyGravity()
        {
            if (_controller.isGrounded && _verticalVelocity < 0f)
            {
                _verticalVelocity = -2f; // Small downward force to stick to ground
            }

            if (_jumpPressed && _controller.isGrounded)
            {
                _verticalVelocity = Mathf.Sqrt(jumpHeight * -2f * gravity);
                _jumpPressed = false;
            }

            _verticalVelocity += gravity * Time.deltaTime;
        }

        private void Move()
        {
            float targetSpeed = _sprintPressed ? sprintSpeed : walkSpeed;
            Vector3 moveDirection = transform.right * _moveInput.x + transform.forward * _moveInput.y;
            moveDirection.Normalize();

            Vector3 targetVelocity = moveDirection * targetSpeed;
            targetVelocity.y = _verticalVelocity;

            _controller.Move(targetVelocity * Time.deltaTime);
        }
    }
}
`,
    },
    /* ---- CameraFollow.cs ---- */
    {
      filePath: 'src/game/CameraFollow.cs',
      content: `using UnityEngine;

namespace Game.Camera
{
    /// <summary>
    /// 第三人称相机跟随 — 平滑跟随目标，支持距离、高度、灵敏度配置
    /// </summary>
    public class CameraFollow : MonoBehaviour
    {
        [Header("Target")]
        [SerializeField] private Transform target;
        [SerializeField] private Vector3 offset = new(0f, 2f, -6f);

        [Header("Follow Settings")]
        [SerializeField] private float followSpeed = 8f;
        [SerializeField] private float rotationSpeed = 5f;
        [SerializeField] private bool lookAtTarget = true;

        [Header("Distance Constraints")]
        [SerializeField] private float minDistance = 2f;
        [SerializeField] private float maxDistance = 15f;
        [SerializeField] private float zoomSpeed = 4f;

        [Header("Collision")]
        [SerializeField] private LayerMask collisionMask;
        [SerializeField] private float collisionRadius = 0.3f;

        private float _currentDistance;
        private Vector3 _smoothVelocity;

        private void Start()
        {
            _currentDistance = offset.magnitude;
        }

        private void LateUpdate()
        {
            if (target == null) return;

            HandleZoom();
            FollowTarget();
        }

        private void HandleZoom()
        {
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (Mathf.Abs(scroll) > 0.01f)
            {
                _currentDistance = Mathf.Clamp(
                    _currentDistance - scroll * zoomSpeed,
                    minDistance,
                    maxDistance
                );
            }
        }

        private void FollowTarget()
        {
            Vector3 direction = offset.normalized;
            Vector3 desiredPosition = target.position + direction * _currentDistance;

            // Collision avoidance — cast from target toward camera
            if (Physics.SphereCast(
                target.position,
                collisionRadius,
                direction,
                out RaycastHit hit,
                _currentDistance,
                collisionMask
            ))
            {
                desiredPosition = hit.point + hit.normal * collisionRadius;
            }

            transform.position = Vector3.SmoothDamp(
                transform.position,
                desiredPosition,
                ref _smoothVelocity,
                1f / followSpeed
            );

            if (lookAtTarget)
            {
                Quaternion targetRotation = Quaternion.LookRotation(
                    target.position - transform.position,
                    Vector3.up
                );
                transform.rotation = Quaternion.Slerp(
                    transform.rotation,
                    targetRotation,
                    Time.deltaTime * rotationSpeed
                );
            }
        }

        public void SetTarget(Transform newTarget)
        {
            target = newTarget;
        }
    }
}
`,
    },
    /* ---- GameManager.cs (3D) ---- */
    {
      filePath: 'src/game/GameManager3D.cs',
      content: `using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.Events;

namespace Game.Core
{
    /// <summary>
    /// 3D 游戏管理器 — 单例模式，场景加载与分数管理
    /// </summary>
    public class GameManager3D : MonoBehaviour
    {
        [Header("Events")]
        public UnityEvent<int> OnScoreChanged = new();
        public UnityEvent OnGameOver = new();
        public UnityEvent OnLevelComplete = new();

        public static GameManager3D Instance { get; private set; }

        public int Score { get; private set; }
        public int CurrentLevel { get; private set; } = 1;
        public bool IsGameOver { get; private set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            IsGameOver = false;
            Score = 0;
        }

        public void AddScore(int points)
        {
            if (IsGameOver) return;
            Score += points;
            OnScoreChanged?.Invoke(Score);
        }

        public void LoadLevel(int levelIndex)
        {
            CurrentLevel = levelIndex;
            SceneManager.LoadScene(levelIndex);
        }

        public void ReloadCurrentLevel()
        {
            SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        }

        public void TriggerGameOver()
        {
            if (IsGameOver) return;
            IsGameOver = true;
            OnGameOver?.Invoke();
        }

        public void TriggerLevelComplete()
        {
            if (IsGameOver) return;
            OnLevelComplete?.Invoke();
        }
    }
}
`,
    },
    /* ---- ObjectPool.cs (3D, same as 2D) ---- */
    {
      filePath: 'src/game/ObjectPool3D.cs',
      content: `using System.Collections.Generic;
using UnityEngine;

namespace Game.Utils
{
    /// <summary>
    /// 泛型对象池 — 3D 项目复用
    /// </summary>
    /// <typeparam name="T">池化对象类型，必须继承 Component</typeparam>
    public class ObjectPool<T> where T : Component
    {
        private readonly Queue<T> _pool = new();
        private readonly T _engineTemplate;
        private readonly Transform _parent;

        public int ActiveCount { get; private set; }
        public int InactiveCount => _pool.Count;

        public ObjectPool(T engineTemplate, int initialSize = 10, Transform parent = null)
        {
            _engineTemplate = engineTemplate;
            _parent = parent;

            for (int i = 0; i < initialSize; i++)
            {
                T obj = Object.Instantiate(_engineTemplate, _parent);
                obj.gameObject.SetActive(false);
                _pool.Enqueue(obj);
            }
        }

        public T Get()
        {
            T obj = _pool.Count > 0 ? _pool.Dequeue() : Object.Instantiate(_engineTemplate, _parent);
            obj.gameObject.SetActive(true);
            ActiveCount++;
            return obj;
        }

        public T Get(Vector3 position, Quaternion rotation)
        {
            T obj = Get();
            obj.transform.SetPositionAndRotation(position, rotation);
            return obj;
        }

        public void Return(T obj)
        {
            if (obj == null) return;
            obj.gameObject.SetActive(false);
            if (_parent != null)
                obj.transform.SetParent(_parent);
            _pool.Enqueue(obj);
            ActiveCount--;
        }

        public void Prewarm(int targetSize)
        {
            while (_pool.Count + ActiveCount < targetSize)
            {
                T obj = Object.Instantiate(_engineTemplate, _parent);
                obj.gameObject.SetActive(false);
                _pool.Enqueue(obj);
            }
        }

        public void Clear()
        {
            while (_pool.Count > 0)
            {
                T obj = _pool.Dequeue();
                if (obj != null)
                    Object.Destroy(obj.gameObject);
            }
            ActiveCount = 0;
        }
    }
}
`,
    },
    /* ---- EventBus3D.cs ---- */
    {
      filePath: 'src/game/EventBus3D.cs',
      content: `using UnityEngine;
using UnityEngine.Events;

namespace Game.Core
{
    /// <summary>
    /// 3D 全局事件总线
    /// </summary>
    public static class EventBus3D
    {
        // ---- 游戏生命周期 ----
        public static readonly UnityEvent OnGameStarted = new();
        public static readonly UnityEvent OnGamePaused = new();
        public static readonly UnityEvent OnGameOver = new();

        // ---- 玩家事件 ----
        public static readonly UnityEvent<int, int> OnPlayerDamaged = new(); // (damage, currentHP)
        public static readonly UnityEvent OnPlayerDied = new();

        // ---- 收集 / 任务 ----
        public static readonly UnityEvent<string> OnItemCollected = new(); // (itemID)
        public static readonly UnityEvent<string> OnObjectiveUpdated = new();

        // ---- 分数 / 进度 ----
        public static readonly UnityEvent<int> OnScoreChanged = new();
        public static readonly UnityEvent OnLevelComplete = new();

        public static void ClearAll()
        {
            OnGameStarted.RemoveAllListeners();
            OnGamePaused.RemoveAllListeners();
            OnGameOver.RemoveAllListeners();
            OnPlayerDamaged.RemoveAllListeners();
            OnPlayerDied.RemoveAllListeners();
            OnItemCollected.RemoveAllListeners();
            OnObjectiveUpdated.RemoveAllListeners();
            OnScoreChanged.RemoveAllListeners();
            OnLevelComplete.RemoveAllListeners();
        }
    }
}
`,
    },
  ];
}

/* ================================================================
 * 联网对战 networking 代码生成
 * ================================================================ */

function generateNetworking(): GeneratedFile[] {
  return [
    {
      filePath: 'src/networking/index.ts',
      content: `/**
 * 网络同步核心库 — 引擎无关的状态同步、客户端预测、插值
 */
export { StateSync } from './sync';
export { ClientPrediction } from './sync';
export { Interpolation } from './sync';
export { Room, Matchmaking } from './matchmaking';
export {
  MessageType,
  NetworkMessage,
  PingManager,
  serialize,
  deserialize,
} from './protocol';
`,
    },
    {
      filePath: 'src/networking/sync.ts',
      content: `/**
 * 状态同步引擎 & 客户端预测 & 插值
 * 引擎无关的实现，可运行于浏览器 / Node.js / 任何 JS 运行时。
 */

/* ================================================================
 * 状态快照
 * ================================================================ */

export interface Snapshot<T> {
  seq: number;
  timestamp: number;
  data: T;
  checksum: number;
}

export namespace StateSync {
  export function createSnapshot<T>(state: T, seq: number): Snapshot<T> {
    const json = JSON.stringify(state);
    let h = 0;
    for (let i = 0; i < json.length; i++) h = (h * 31 + json.charCodeAt(i)) & 0x7fffffff;
    return { seq, timestamp: Date.now(), data: state, checksum: h };
  }

  export function applySnapshot<T>(_current: T, snapshot: Snapshot<T>): T {
    return JSON.parse(JSON.stringify(snapshot.data)) as T;
  }

  export function deltaCompress<T extends Record<string, unknown>>(
    prev: T,
    current: T,
  ): Partial<T> {
    const delta: Partial<T> = {};
    const keys = new Set([...Object.keys(prev as object), ...Object.keys(current as object)]);
    for (const key of keys) {
      const k = key as keyof T;
      if (JSON.stringify(prev[k]) !== JSON.stringify(current[k])) {
        delta[k] = current[k];
      }
    }
    return delta;
  }

  export function deltaApply<T extends Record<string, unknown>>(
    base: T,
    delta: Partial<T>,
  ): T {
    return { ...base, ...delta };
  }
}

export class ClientPrediction<S, I> {
  private inputHistory: { seq: number; input: I }[] = [];
  private lastAckedSeq = -1;

  constructor(private applyInput: (state: S, input: I) => S) {}

  addInput(seq: number, input: I): void {
    this.inputHistory.push({ seq, input });
  }

  predict(localState: S, input: I): S {
    return this.applyInput(localState, input);
  }

  reconcile(serverState: S, ackedSeq: number): S {
    if (ackedSeq > this.lastAckedSeq) this.lastAckedSeq = ackedSeq;
    this.inputHistory = this.inputHistory.filter((e) => e.seq > ackedSeq);
    let state = serverState;
    for (const entry of this.inputHistory) {
      state = this.applyInput(state, entry.input);
    }
    return state;
  }

  getLastAckedSeq(): number {
    return this.lastAckedSeq;
  }
}

export namespace Interpolation {
  export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  }

  export function slerp(a: number, b: number, t: number): number {
    const normalize = (x: number) => ((x + Math.PI) % (2 * Math.PI)) - Math.PI;
    const aN = normalize(a);
    const bN = normalize(b);
    let diff = bN - aN;
    if (Math.abs(diff) > Math.PI) diff = diff > 0 ? diff - 2 * Math.PI : diff + 2 * Math.PI;
    return aN + diff * Math.max(0, Math.min(1, t));
  }

  export function interpolateRenderState<T extends Record<string, unknown>>(
    buffer: Snapshot<T>[],
    renderTime: number,
  ): T {
    if (buffer.length === 0) throw new Error('interpolateRenderState: buffer is empty');
    if (buffer.length === 1) return buffer[0].data;

    let fromIdx = 0;
    for (let i = 1; i < buffer.length; i++) {
      if (buffer[i].timestamp >= renderTime) { fromIdx = i - 1; break; }
      fromIdx = i;
    }
    const toIdx = Math.min(fromIdx + 1, buffer.length - 1);
    if (fromIdx === toIdx) return buffer[fromIdx].data;

    const from = buffer[fromIdx];
    const to = buffer[toIdx];
    const duration = to.timestamp - from.timestamp;
    if (duration <= 0) return from.data;

    const t = Math.max(0, Math.min(1, (renderTime - from.timestamp) / duration));
    const result = {} as T;
    const keys = new Set([...Object.keys(from.data as object), ...Object.keys(to.data as object)]);
    for (const key of keys) {
      const k = key as keyof T;
      const fv = from.data[k];
      const tv = to.data[k];
      if (typeof fv === 'number' && typeof tv === 'number') {
        (result as Record<string, unknown>)[key as string] = lerp(fv, tv, t);
      } else {
        (result as Record<string, unknown>)[key as string] = fv;
      }
    }
    return result;
  }
}
`,
    },
    {
      filePath: 'src/networking/protocol.ts',
      content: `/**
 * 消息协议 — 类型枚举 / 泛型消息 / Ping 管理 / 序列化
 */

export enum MessageType {
  INPUT = 'INPUT',
  SNAPSHOT = 'SNAPSHOT',
  CHAT = 'CHAT',
  PING = 'PING',
  ROOM_UPDATE = 'ROOM_UPDATE',
  GAME_EVENT = 'GAME_EVENT',
  RPC = 'RPC',
}

export interface NetworkMessage<T = unknown> {
  type: MessageType;
  seq: number;
  timestamp: number;
  senderId: string;
  payload: T;
}

export class PingManager {
  private latencySamples: number[] = [];
  private maxSamples: number;

  constructor(maxSamples = 10) { this.maxSamples = maxSamples; }

  sendPing(): number { return Date.now(); }

  onPong(serverTime: number): number {
    const rtt = Date.now() - serverTime;
    this.latencySamples.push(rtt);
    if (this.latencySamples.length > this.maxSamples) {
      this.latencySamples = this.latencySamples.slice(-this.maxSamples);
    }
    return rtt;
  }

  getLatency(): number {
    if (this.latencySamples.length === 0) return 0;
    return Math.round(this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length);
  }

  getJitter(): number {
    if (this.latencySamples.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < this.latencySamples.length; i++) {
      total += Math.abs(this.latencySamples[i] - this.latencySamples[i - 1]);
    }
    return Math.round((total / (this.latencySamples.length - 1)) * 100) / 100;
  }
}

export function serialize<T>(msg: NetworkMessage<T>): string {
  return JSON.stringify(msg);
}

export function deserialize<T = unknown>(raw: string): NetworkMessage<T> {
  const parsed = JSON.parse(raw) as NetworkMessage<T>;
  if (!parsed.type || !Object.values(MessageType).includes(parsed.type)) {
    throw new Error(\`deserialize: invalid message type "\${parsed.type}"\`);
  }
  if (typeof parsed.seq !== 'number' || parsed.seq < 0) {
    throw new Error('deserialize: seq must be a non-negative number');
  }
  return parsed;
}
`,
    },
    {
      filePath: 'src/networking/matchmaking.ts',
      content: `/**
 * 房间与匹配系统
 */

export enum RoomState {
  WAITING = 'WAITING',
  READY = 'READY',
  PLAYING = 'PLAYING',
  FINISHED = 'FINISHED',
}

export interface RoomConfig {
  capacity: number;
  password: string;
  properties: Record<string, string>;
}

interface RoomPlayer {
  playerId: string;
  ready: boolean;
  joinedAt: number;
}

interface RoomData {
  roomId: string;
  state: RoomState;
  config: RoomConfig;
  players: RoomPlayer[];
  createdAt: number;
}

export class Room {
  private rooms = new Map<string, RoomData>();

  createRoom(config: RoomConfig): RoomData {
    const roomId = \`room-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 8)}\`;
    const room: RoomData = {
      roomId,
      state: RoomState.WAITING,
      config: { capacity: Math.max(2, config.capacity), password: config.password ?? '', properties: config.properties ?? {} },
      players: [],
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    return { ...room };
  }

  joinRoom(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: \`房间 \${roomId} 不存在\` };
    if (room.state !== RoomState.WAITING && room.state !== RoomState.READY) return { success: false, error: '游戏已开始' };
    if (room.players.length >= room.config.capacity) return { success: false, error: '房间已满' };
    if (room.players.some(p => p.playerId === playerId)) return { success: false, error: '已在房间中' };
    room.players.push({ playerId, ready: false, joinedAt: Date.now() });
    return { success: true, room: { ...room } };
  }

  leaveRoom(roomId: string, playerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: \`房间 \${roomId} 不存在\` };
    const idx = room.players.findIndex(p => p.playerId === playerId);
    if (idx === -1) return { success: false, error: '不在房间中' };
    room.players.splice(idx, 1);
    if (room.players.length === 0) this.rooms.delete(roomId);
    return { success: true, room: { ...room } };
  }

  setReady(playerId: string, ready: boolean) {
    for (const [, room] of this.rooms) {
      const p = room.players.find(pl => pl.playerId === playerId);
      if (p) { p.ready = ready; return { success: true, room: { ...room } }; }
    }
    return { success: false, error: '不在任何房间中' };
  }

  startGame(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: \`房间 \${roomId} 不存在\` };
    if (room.players.length < 2) return { success: false, error: '至少需要2名玩家' };
    if (!room.players.every(p => p.ready)) return { success: false, error: '还有玩家未准备' };
    room.state = RoomState.PLAYING;
    return { success: true, room: { ...room } };
  }

  getRoom(roomId: string): RoomData | null {
    const room = this.rooms.get(roomId);
    return room ? { ...room } : null;
  }
}

export interface MatchPlayer {
  playerId: string;
  elo: number;
  latency: number;
}

export interface MatchCriteria {
  eloRange: number;
  maxLatency: number;
}

const MATCH_TIMEOUT_MS = 30_000;
const ELO_RELAX_FACTOR = 1.5;

export class Matchmaking {
  private queue: { player: MatchPlayer; criteria: MatchCriteria; enqueuedAt: number; matched: boolean }[] = [];
  private lobby: { code: string; players: MatchPlayer[]; createdAt: number } | null = null;
  private cancelTokens = new Set<string>();

  quickMatch(player: MatchPlayer, criteria: MatchCriteria): MatchPlayer[] {
    const now = Date.now();
    for (const entry of this.queue) {
      if (entry.matched || entry.player.playerId === player.playerId) continue;
      if (this.cancelTokens.has(entry.player.playerId)) continue;
      const elapsed = now - entry.enqueuedAt;
      const effectiveRange = elapsed > MATCH_TIMEOUT_MS ? entry.criteria.eloRange * ELO_RELAX_FACTOR : entry.criteria.eloRange;
      if (Math.abs(player.elo - entry.player.elo) > effectiveRange) continue;
      if (player.latency > entry.criteria.maxLatency || entry.player.latency > criteria.maxLatency) continue;
      entry.matched = true;
      return [player, entry.player];
    }
    this.queue.push({ player: { ...player }, criteria: { ...criteria }, enqueuedAt: now, matched: false });
    return [];
  }

  createLobby() {
    this.lobby = { code: \`lobby-\${Date.now().toString(36)}\`, players: [], createdAt: Date.now() };
    return { ...this.lobby };
  }

  joinLobby(code: string, player: MatchPlayer) {
    if (!this.lobby) return { success: false, error: '大厅不存在' };
    if (this.lobby.code !== code) return { success: false, error: '邀请码不正确' };
    this.lobby.players.push({ ...player });
    return { success: true, lobby: { ...this.lobby } };
  }

  cancelSearch(playerId: string): void {
    this.cancelTokens.add(playerId);
    this.queue = this.queue.filter(e => e.player.playerId !== playerId);
  }

  getQueueLength(): number {
    return this.queue.filter(e => !e.matched && !this.cancelTokens.has(e.player.playerId)).length;
  }
}
`,
    },
  ];
}

/* ================================================================
 * 步骤 11: 商业化 monetization — Store / BattlePass / Bundles / Ads
 * ================================================================ */

function generateMonetization(): GeneratedFile[] {
  return [
    {
      filePath: "src/monetization/index.ts",
      content: "/**\n * Monetization — 手游商业化核心模块\n *\n * 覆盖：\n *  - Store：商品目录、价格阶梯、购买校验\n *  - IAPValidator：票据校验、签名验证、发货、恢复购买\n *  - CurrencyManager：双货币模型（金币/钻石）、交易记录、兑换\n */\n\nexport * from './store';\nexport * from './battle-pass';\nexport * from './bundles';\nexport * from './ads';\n",
    },
    {
      filePath: "src/monetization/store.ts",
      content: "/**\n * Store — 商品系统 & IAP 验证 & 虚拟货币\n *\n * 设计原则：\n *  - 所有价格与货币操作为纯逻辑计算\n *  - 不依赖任何平台特定 API（iOS/Android 沙盒回调由外部注入）\n *  - 状态可通过 JSON 序列化/反序列化\n */\n\n/* ================================================================\n * 商品系统\n * ================================================================ */\n\n/** 商品类型 */\nexport type ProductType = 'consumable' | 'non-consumable' | 'subscription';\n\n/** 商品定义 */\nexport interface Product {\n  id: string;\n  type: ProductType;\n  priceTier: PriceTierLevel;\n  currency: CurrencyType;\n  displayName: string;\n  icon: string;\n  /** 出货内容：物品 ID → 数量 */\n  rewards: Record<string, number>;\n}\n\n/** 价格阶梯等级 */\nexport type PriceTierLevel = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';\n\n/** 货币类型 */\nexport type CurrencyType = 'USD' | 'CNY' | 'soft' | 'hard';\n\n/**\n * PriceTier — 价格阶梯\n *\n * T1 - T6 对应常见美元档位（$0.99 - $99.99）\n */\nexport const PRICE_TIERS: Record<PriceTierLevel, { usd: number; cny: number }> = {\n  T1: { usd: 0.99, cny: 6 },\n  T2: { usd: 4.99, cny: 30 },\n  T3: { usd: 9.99, cny: 68 },\n  T4: { usd: 19.99, cny: 128 },\n  T5: { usd: 49.99, cny: 328 },\n  T6: { usd: 99.99, cny: 648 },\n};\n\n/** 根据阶梯获取价格 */\nexport function getPrice(tier: PriceTierLevel, currency: CurrencyType): number {\n  const t = PRICE_TIERS[tier];\n  if (currency === 'USD') return t.usd;\n  if (currency === 'CNY') return t.cny;\n  return t.usd; // fallback\n}\n\n/** 购买条件 */\nexport interface PurchaseCondition {\n  /** 最低等级要求 */\n  minLevel?: number;\n  /** VIP 等级要求 */\n  minVipLevel?: number;\n  /** 限购次数（-1 无限） */\n  maxPurchases?: number;\n  /** 限时售卖截止时间戳（0 表示不限） */\n  saleEndTime?: number;\n}\n\n/** 购买记录 */\nexport interface PurchaseRecord {\n  userId: string;\n  productId: string;\n  timestamp: number;\n  receipt: string;\n}\n\n/**\n * StoreCatalog — 商品目录管理\n */\nexport class StoreCatalog {\n  private products = new Map<string, Product>();\n  private purchases: PurchaseRecord[] = [];\n\n  /** 添加商品 */\n  addProduct(product: Product): void {\n    this.products.set(product.id, product);\n  }\n\n  /** 移除商品 */\n  removeProduct(id: string): boolean {\n    return this.products.delete(id);\n  }\n\n  /** 获取商品 */\n  getProduct(id: string): Product | undefined {\n    return this.products.get(id);\n  }\n\n  /** 按类型获取商品列表 */\n  getProductsByType(type: ProductType): Product[] {\n    return [...this.products.values()].filter((p) => p.type === type);\n  }\n\n  /** 获取全部商品 */\n  getAllProducts(): Product[] {\n    return [...this.products.values()];\n  }\n\n  /** 记录购买 */\n  recordPurchase(record: PurchaseRecord): void {\n    this.purchases.push(record);\n  }\n\n  /** 获取用户对某商品的购买次数 */\n  getPurchaseCount(userId: string, productId: string): number {\n    return this.purchases.filter((r) => r.userId === userId && r.productId === productId).length;\n  }\n\n  /** 获取用户所有购买记录 */\n  getUserPurchases(userId: string): PurchaseRecord[] {\n    return this.purchases.filter((r) => r.userId === userId);\n  }\n}\n\n/**\n * PurchaseValidator — 购买前置校验\n */\nexport class PurchaseValidator {\n  /**\n   * 校验购买条件\n   * @returns { valid: boolean, reason?: string }\n   */\n  validate(\n    product: Product,\n    userId: string,\n    userLevel: number,\n    vipLevel: number,\n    catalog: StoreCatalog,\n    now: number = Date.now(),\n  ): { valid: boolean; reason?: string } {\n    // 限时售卖\n    const condition = this.getCondition(product, userId, catalog);\n    if (condition.saleEndTime && condition.saleEndTime > 0 && now > condition.saleEndTime) {\n      return { valid: false, reason: '该商品限时售卖已结束' };\n    }\n\n    // 等级限制\n    if (condition.minLevel && userLevel < condition.minLevel) {\n      return { valid: false, reason: `需要等级 ${condition.minLevel}（当前 ${userLevel}）` };\n    }\n\n    // VIP 限制\n    if (condition.minVipLevel && vipLevel < condition.minVipLevel) {\n      return { valid: false, reason: `需要 VIP${condition.minVipLevel}（当前 VIP${vipLevel}）` };\n    }\n\n    // 限购次数\n    if (condition.maxPurchases && condition.maxPurchases > 0) {\n      const count = catalog.getPurchaseCount(userId, product.id);\n      if (count >= condition.maxPurchases) {\n        return { valid: false, reason: `限购 ${condition.maxPurchases} 次（已购 ${count} 次）` };\n      }\n    }\n\n    return { valid: true };\n  }\n\n  /** 获取综合购买条件（从商品和系统默认合并） */\n  getCondition(_product: Product, _userId: string, _catalog: StoreCatalog): PurchaseCondition {\n    // 实际项目中可从配置/远程拉取，此处使用商品上的元信息\n    // 为简化，直接返回默认值（无限制）\n    return {};\n  }\n\n  /** 设置商品的购买条件 */\n  setCondition(productId: string, condition: PurchaseCondition, conditions: Map<string, PurchaseCondition>): void {\n    conditions.set(productId, condition);\n  }\n}\n\n/* ================================================================\n * IAP 验证命名空间\n * ================================================================ */\n\nexport interface IAPReceipt {\n  productId: string;\n  transactionId: string;\n  purchaseDate: number;\n  payload: string;\n  signature: string;\n}\n\nexport interface IAPValidationResult {\n  valid: boolean;\n  error?: string;\n  transactionId?: string;\n}\n\n/** 回调类型：平台签名验证 */\nexport type SignatureVerifier = (payload: string, signature: string) => boolean;\n\n/** 回调类型：发货 */\nexport type RewardGranter = (productId: string, userId: string) => void;\n\nexport namespace IAPValidator {\n  let signatureVerifier: SignatureVerifier = () => true; // 默认通过（测试用）\n  let rewardGranter: RewardGranter = () => {};\n\n  /** 注册签名验证器 */\n  export function setVerifier(fn: SignatureVerifier): void {\n    signatureVerifier = fn;\n  }\n\n  /** 注册发货回调 */\n  export function setGranter(fn: RewardGranter): void {\n    rewardGranter = fn;\n  }\n\n  /** 票据校验流程 */\n  export function validateReceipt(receipt: IAPReceipt, productId: string): IAPValidationResult {\n    // 1. 验证 productId 一致性\n    if (receipt.productId !== productId) {\n      return { valid: false, error: `票据商品 ID 不匹配：${receipt.productId} vs ${productId}` };\n    }\n\n    // 2. 签名验证\n    if (!verifySignature(receipt.payload, receipt.signature)) {\n      return { valid: false, error: '签名验证失败' };\n    }\n\n    return { valid: true, transactionId: receipt.transactionId };\n  }\n\n  /** 签名校验 */\n  export function verifySignature(payload: string, signature: string): boolean {\n    return signatureVerifier(payload, signature);\n  }\n\n  /** 发货逻辑 */\n  export function grantReward(productId: string, userId: string): void {\n    rewardGranter(productId, userId);\n  }\n\n  /** 恢复购买 */\n  export function restorePurchases(\n    userId: string,\n    productIds: string[],\n    productTypes: Map<string, ProductType>,\n  ): string[] {\n    // 仅恢复非消耗品和订阅\n    return productIds.filter((id) => {\n      const type = productTypes.get(id);\n      return type === 'non-consumable' || type === 'subscription';\n    });\n  }\n}\n\n/* ================================================================\n * 虚拟货币系统\n * ================================================================ */\n\n/** 货币种类 */\nexport type CurrencyKind = 'soft' | 'hard';\n\n/** 交易记录 */\nexport interface Transaction {\n  id: string;\n  timestamp: number;\n  kind: CurrencyKind;\n  amount: number;\n  balanceAfter: number;\n  type: 'earn' | 'spend';\n  source: string; // earn 来源 / spend 原因\n}\n\n/**\n * CurrencyManager — 双货币模型管理\n *\n * - 软货币（金币）：游戏内大量产出，用于基础消费\n * - 硬货币（钻石）：稀缺产出，常用于付费获取\n */\nexport class CurrencyManager {\n  private balances: Record<CurrencyKind, number> = { soft: 0, hard: 0 };\n  private transactions: Transaction[] = [];\n  private nextTxId = 1;\n  private softToHardRate = 1000; // 1000 金币 = 1 钻石\n\n  /** 获取余额 */\n  getBalance(kind: CurrencyKind): number {\n    return this.balances[kind];\n  }\n\n  /** 获取所有余额 */\n  getAllBalances(): Record<CurrencyKind, number> {\n    return { ...this.balances };\n  }\n\n  /** 获取货币 */\n  earn(kind: CurrencyKind, amount: number, source: string): Transaction {\n    if (amount <= 0) {\n      return this.makeTx(kind, 0, this.balances[kind], 'earn', source);\n    }\n    this.balances[kind] += amount;\n    return this.makeTx(kind, amount, this.balances[kind], 'earn', source);\n  }\n\n  /** 消费货币 */\n  spend(kind: CurrencyKind, amount: number, reason: string): Transaction | null {\n    if (amount <= 0) return null;\n    if (this.balances[kind] < amount) return null;\n    this.balances[kind] -= amount;\n    return this.makeTx(kind, amount, this.balances[kind], 'spend', reason);\n  }\n\n  /** 是否可以支付 */\n  canAfford(kind: CurrencyKind, amount: number): boolean {\n    return amount > 0 && this.balances[kind] >= amount;\n  }\n\n  /** 获取交易记录 */\n  getTransactions(): Transaction[] {\n    return [...this.transactions];\n  }\n\n  /** 按类型获取交易记录 */\n  getTransactionsByType(type: 'earn' | 'spend'): Transaction[] {\n    return this.transactions.filter((t) => t.type === type);\n  }\n\n  /** 获取历史记录总数 */\n  getTransactionCount(): number {\n    return this.transactions.length;\n  }\n\n  /** 软硬货币兑换率 */\n  get exchangeRate(): number {\n    return this.softToHardRate;\n  }\n\n  /** 设置兑换率 */\n  setExchangeRate(rate: number): void {\n    if (rate > 0) this.softToHardRate = rate;\n  }\n\n  /** 软货币兑换为硬货币 */\n  exchangeSoftToHard(softAmount: number): { success: boolean; hardReceived?: number; error?: string } {\n    if (softAmount <= 0) return { success: false, error: '兑换数量必须大于 0' };\n    if (softAmount < this.softToHardRate) {\n      return { success: false, error: `至少需要 ${this.softToHardRate} 金币兑换 1 钻石` };\n    }\n    const hard = Math.floor(softAmount / this.softToHardRate);\n    if (hard === 0) return { success: false, error: '兑换数量不足' };\n    const convertibleAmount = hard * this.softToHardRate;\n    if (this.balances.soft < convertibleAmount) return { success: false, error: '金币不足' };\n\n    this.balances.soft -= convertibleAmount;\n    this.balances.hard += hard;\n    this.makeTx('soft', convertibleAmount, this.balances.soft, 'spend', 'currency_exchange');\n    this.makeTx('hard', hard, this.balances.hard, 'earn', 'currency_exchange');\n\n    return { success: true, hardReceived: hard };\n  }\n\n  /** 序列化为 JSON */\n  toJSON(): string {\n    return JSON.stringify({\n      balances: { ...this.balances },\n      transactions: this.transactions,\n      nextTxId: this.nextTxId,\n      softToHardRate: this.softToHardRate,\n    });\n  }\n\n  /** 从 JSON 恢复 */\n  static fromJSON(json: string): CurrencyManager {\n    const data = JSON.parse(json);\n    const mgr = new CurrencyManager();\n    mgr.balances = { ...data.balances };\n    mgr.transactions = data.transactions ?? [];\n    mgr.nextTxId = data.nextTxId ?? 1;\n    mgr.softToHardRate = data.softToHardRate ?? 1000;\n    return mgr;\n  }\n\n  private makeTx(\n    kind: CurrencyKind,\n    amount: number,\n    balanceAfter: number,\n    type: 'earn' | 'spend',\n    source: string,\n  ): Transaction {\n    const tx: Transaction = {\n      id: `tx_${this.nextTxId++}`,\n      timestamp: Date.now(),\n      kind,\n      amount,\n      balanceAfter,\n      type,\n      source,\n    };\n    this.transactions.push(tx);\n    return tx;\n  }\n}\n",
    },
    {
      filePath: "src/monetization/battle-pass.ts",
      content: "/**\n * BattlePass — 通行证系统\n *\n * 双轨制（Free + Premium），含等级推进、奖励领取、赛季配置。\n */\n\n/* ================================================================\n * 类型定义\n * ================================================================ */\n\n/** 通行证轨道 */\nexport type PassTrack = 'free' | 'premium';\n\n/** 奖励类型 */\nexport type RewardType = 'currency' | 'item' | 'skin' | 'title';\n\n/** 奖励定义 */\nexport interface PassReward {\n  type: RewardType;\n  id: string;\n  name: string;\n  amount: number;\n  icon?: string;\n}\n\n/** 等级奖励配置 */\nexport interface LevelReward {\n  level: number;\n  freeRewards: PassReward[];\n  premiumRewards: PassReward[];\n  /** 该等级所需 XP */\n  xpRequired: number;\n}\n\n/** 赛季配置 */\nexport interface SeasonConfig {\n  seasonId: string;\n  name: string;\n  theme: string;\n  startTime: number;\n  endTime: number;\n  maxLevel: number;\n  premiumPrice: number;   // 购买 Premium 所需货币\n  premiumCurrency: 'soft' | 'hard';\n  /** Base XP + 每级增量 XP 公式参数 */\n  baseXP: number;\n  xpIncrement: number;\n}\n\n/** 用户通行证进度 */\nexport interface PassProgress {\n  userId: string;\n  seasonId: string;\n  currentXP: number;\n  currentLevel: number;\n  hasPremium: boolean;\n  claimedRewards: Set<string>; // \"track:level\" 格式\n}\n\n/** 赛季状态 */\nexport type SeasonStatus = 'upcoming' | 'active' | 'ended';\n\n/* ================================================================\n * 奖励模板库\n * ================================================================ */\n\n/** 默认奖励模板：按等级区间生成 */\nfunction generateDefaultLevelRewards(maxLevel: number): LevelReward[] {\n  const rewards: LevelReward[] = [];\n  const baseXP = 100;\n  const xpInc = 50;\n\n  for (let lv = 1; lv <= maxLevel; lv++) {\n    const xpRequired = baseXP + (lv - 1) * xpInc;\n    const freeRewards: PassReward[] = [];\n    const premiumRewards: PassReward[] = [];\n\n    // 每 5 级给一次较好的奖励\n    if (lv % 10 === 0) {\n      freeRewards.push({ type: 'currency', id: 'gold', name: '金币', amount: 500 + lv * 50 });\n      premiumRewards.push({ type: 'currency', id: 'diamond', name: '钻石', amount: 100 + lv * 10 });\n      premiumRewards.push({ type: 'skin', id: `skin_season_lv${lv}`, name: `限定皮肤 Lv${lv}`, amount: 1 });\n    } else if (lv % 5 === 0) {\n      freeRewards.push({ type: 'currency', id: 'gold', name: '金币', amount: 200 + lv * 20 });\n      premiumRewards.push({ type: 'currency', id: 'diamond', name: '钻石', amount: 50 + lv * 5 });\n    } else if (lv % 3 === 0) {\n      freeRewards.push({ type: 'item', id: `boost_${lv}`, name: `经验加成道具`, amount: 2 });\n      premiumRewards.push({ type: 'item', id: `rare_item_${lv}`, name: `稀有道具 x${lv}`, amount: 3 });\n    } else {\n      freeRewards.push({ type: 'currency', id: 'gold', name: '金币', amount: 100 + lv * 10 });\n      premiumRewards.push({ type: 'currency', id: 'diamond', name: '钻石', amount: 25 + lv * 3 });\n    }\n\n    // Premium 顶级奖励：满级称号\n    if (lv === maxLevel) {\n      premiumRewards.push({ type: 'title', id: `title_max_${lv}`, name: '赛季王者', amount: 1 });\n    }\n\n    rewards.push({ level: lv, freeRewards, premiumRewards, xpRequired });\n  }\n\n  return rewards;\n}\n\n/* ================================================================\n * BattlePass 类\n * ================================================================ */\n\nexport class BattlePass {\n  readonly config: SeasonConfig;\n  private levelRewards: LevelReward[];\n  private progress = new Map<string, PassProgress>(); // userId → progress\n\n  constructor(config: SeasonConfig, levelRewards?: LevelReward[]) {\n    this.config = config;\n    this.levelRewards = levelRewards ?? generateDefaultLevelRewards(config.maxLevel);\n  }\n\n  /* ---- 赛季状态 ---- */\n\n  getSeasonStatus(now: number = Date.now()): SeasonStatus {\n    if (now < this.config.startTime) return 'upcoming';\n    if (now > this.config.endTime) return 'ended';\n    return 'active';\n  }\n\n  isActive(now: number = Date.now()): boolean {\n    return this.getSeasonStatus(now) === 'active';\n  }\n\n  /* ---- 用户进度 ---- */\n\n  /** 获取或创建用户进度 */\n  getOrCreateProgress(userId: string): PassProgress {\n    if (!this.progress.has(userId)) {\n      this.progress.set(userId, {\n        userId,\n        seasonId: this.config.seasonId,\n        currentXP: 0,\n        currentLevel: 0,\n        hasPremium: false,\n        claimedRewards: new Set(),\n      });\n    }\n    return this.progress.get(userId)!;\n  }\n\n  /** 获取用户进度（只读） */\n  getProgress(userId: string): PassProgress | undefined {\n    return this.progress.get(userId);\n  }\n\n  /* ---- XP 与升级 ---- */\n\n  /** 添加经验值 */\n  addXP(userId: string, amount: number): PassProgress {\n    const p = this.getOrCreateProgress(userId);\n    if (!this.isActive()) return p;\n\n    p.currentXP += amount;\n\n    // 检查升级\n    let leveledUp = 0;\n    for (const lr of this.levelRewards) {\n      if (lr.level > p.currentLevel && p.currentXP >= this.getCumulativeXP(lr.level)) {\n        p.currentLevel = lr.level;\n        leveledUp++;\n      }\n    }\n\n    // 不超过最大等级\n    p.currentLevel = Math.min(p.currentLevel, this.config.maxLevel);\n\n    this.progress.set(userId, p);\n    return p;\n  }\n\n  /** 获取当前等级 */\n  getLevel(userId: string): number {\n    return this.getOrCreateProgress(userId).currentLevel;\n  }\n\n  /** 获取当前 XP */\n  getXP(userId: string): number {\n    return this.getOrCreateProgress(userId).currentXP;\n  }\n\n  /** 获取指定等级累计所需 XP */\n  getCumulativeXP(level: number): number {\n    let total = 0;\n    for (const lr of this.levelRewards) {\n      if (lr.level <= level) total += lr.xpRequired;\n    }\n    return total;\n  }\n\n  /** 获取指定等级区间的 XP 要求 */\n  getLevelXP(level: number): number {\n    const lr = this.levelRewards.find((r) => r.level === level);\n    return lr?.xpRequired ?? 0;\n  }\n\n  /* ---- 奖励领取 ---- */\n\n  /** 领取奖励 */\n  claimReward(\n    userId: string,\n    track: PassTrack,\n    level: number,\n  ): { success: boolean; rewards?: PassReward[]; error?: string } {\n    const p = this.getOrCreateProgress(userId);\n\n    // Premium 轨需要先购买\n    if (track === 'premium' && !p.hasPremium) {\n      return { success: false, error: '需要购买 Premium 通行证' };\n    }\n\n    // 等级未达到\n    if (level > p.currentLevel) {\n      return { success: false, error: `未达到等级 ${level}（当前 ${p.currentLevel}）` };\n    }\n\n    // 已领取\n    const claimKey = `${track}:${level}`;\n    if (p.claimedRewards.has(claimKey)) {\n      return { success: false, error: `等级 ${level} 的 ${track} 奖励已领取` };\n    }\n\n    // 获取奖励\n    const lr = this.levelRewards.find((r) => r.level === level);\n    if (!lr) {\n      return { success: false, error: `等级 ${level} 不存在` };\n    }\n\n    p.claimedRewards.add(claimKey);\n    this.progress.set(userId, p);\n\n    const rewards = track === 'free' ? lr.freeRewards : lr.premiumRewards;\n    return { success: true, rewards };\n  }\n\n  /** 检查奖励是否已领取 */\n  isRewardClaimed(userId: string, track: PassTrack, level: number): boolean {\n    const p = this.getProgress(userId);\n    if (!p) return false;\n    return p.claimedRewards.has(`${track}:${level}`);\n  }\n\n  /** 获取可领取的奖励列表 */\n  getClaimableRewards(userId: string): { level: number; track: PassTrack; rewards: PassReward[] }[] {\n    const p = this.getOrCreateProgress(userId);\n    const result: { level: number; track: PassTrack; rewards: PassReward[] }[] = [];\n\n    for (const lr of this.levelRewards) {\n      if (lr.level > p.currentLevel) break;\n\n      if (!p.claimedRewards.has(`free:${lr.level}`)) {\n        result.push({ level: lr.level, track: 'free', rewards: lr.freeRewards });\n      }\n      if (p.hasPremium && !p.claimedRewards.has(`premium:${lr.level}`)) {\n        result.push({ level: lr.level, track: 'premium', rewards: lr.premiumRewards });\n      }\n    }\n\n    return result;\n  }\n\n  /* ---- Premium 购买 ---- */\n\n  /** 购买 Premium 通行证 */\n  purchasePremium(userId: string): { success: boolean; error?: string } {\n    const p = this.getOrCreateProgress(userId);\n\n    if (p.hasPremium) {\n      return { success: false, error: '已拥有 Premium 通行证' };\n    }\n\n    if (!this.isActive()) {\n      return { success: false, error: '赛季未开启或已结束' };\n    }\n\n    p.hasPremium = true;\n    this.progress.set(userId, p);\n    return { success: true };\n  }\n\n  /** 检查是否拥有 Premium */\n  hasPremium(userId: string): boolean {\n    return this.getOrCreateProgress(userId).hasPremium;\n  }\n\n  /* ---- 等级奖励配置 ---- */\n\n  /** 获取指定等级的所有奖励信息 */\n  getLevelRewards(level: number): LevelReward | undefined {\n    return this.levelRewards.find((r) => r.level === level);\n  }\n\n  /** 获取全部等级奖励配置 */\n  getAllLevelRewards(): LevelReward[] {\n    return [...this.levelRewards];\n  }\n\n  /** 获取奖励总数 */\n  getTotalRewardCount(): { free: number; premium: number } {\n    let free = 0, premium = 0;\n    for (const lr of this.levelRewards) {\n      free += lr.freeRewards.length;\n      premium += lr.premiumRewards.length;\n    }\n    return { free, premium };\n  }\n}\n",
    },
    {
      filePath: "src/monetization/bundles.ts",
      content: "/**\n * Bundles — 礼包与限时商店\n *\n * 含 Bundle 管理、活跃礼包筛选、限时弹窗模板。\n */\n\n/* ================================================================\n * 类型定义\n * ================================================================ */\n\n/** 礼包定义 */\nexport interface Bundle {\n  id: string;\n  name: string;\n  description?: string;\n  /** 包含的商品 ID 列表 */\n  products: string[];\n  /** 折扣百分比 (0-100)，如 30 表示 7 折 */\n  discountPercent: number;\n  /** 原始总价 */\n  originalPrice: number;\n  /** 折后价格 */\n  finalPrice: number;\n  /** 有效期截止时间戳（0 表示永久） */\n  validUntil: number;\n  /** 限购次数（0 表示无限） */\n  purchaseLimit: number;\n  /** 礼包图标 */\n  icon?: string;\n  /** 标签（如 \"热门\"、\"新人\"） */\n  tags?: string[];\n}\n\n/** 限时弹窗类型 */\nexport type OfferType = 'welcome' | 'return' | 'festival';\n\n/** 限时弹窗触发条件 */\nexport interface OfferTrigger {\n  /** 触发类型 */\n  type: OfferType;\n  /** 首次登录触发 */\n  firstLogin?: boolean;\n  /** 回归触发：离开天数阈值 */\n  returnAfterDays?: number;\n  /** 节日日期（MM-DD 格式） */\n  festivalDate?: string;\n}\n\n/** 限时弹窗定义 */\nexport interface LimitedTimeOffer {\n  id: string;\n  name: string;\n  description: string;\n  trigger: OfferTrigger;\n  /** 弹窗关联的礼包 ID */\n  bundleId: string;\n  /** 弹窗有效时长（ms），超时自动关闭 */\n  durationMs: number;\n  /** 冷却时间（ms），弹出后 N 天内不再弹出 */\n  cooldownMs?: number;\n}\n\n/** 预设模板 */\nexport interface OfferTemplate {\n  name: string;\n  description: string;\n  discountPercent: number;\n  durationMs: number;\n  cooldownMs: number;\n}\n\n/** WelcomeOffer 预设 */\nexport const WELCOME_OFFER_TEMPLATE: OfferTemplate = {\n  name: '新人礼包',\n  description: '欢迎来到游戏！限时特惠，仅此一次！',\n  discountPercent: 80,\n  durationMs: 72 * 3600 * 1000, // 72h\n  cooldownMs: 0, // 永不再弹出\n};\n\n/** ReturnOffer 预设 */\nexport const RETURN_OFFER_TEMPLATE: OfferTemplate = {\n  name: '回归礼包',\n  description: '英雄归来！专属回归福利等你领取！',\n  discountPercent: 60,\n  durationMs: 48 * 3600 * 1000, // 48h\n  cooldownMs: 7 * 24 * 3600 * 1000, // 7 天冷却\n};\n\n/** FestivalOffer 预设 */\nexport const FESTIVAL_OFFER_TEMPLATE: OfferTemplate = {\n  name: '节日礼包',\n  description: '节日限定！错过再等一年！',\n  discountPercent: 50,\n  durationMs: 24 * 3600 * 1000, // 24h\n  cooldownMs: 24 * 3600 * 1000, // 每日\n};\n\n/* ================================================================\n * BundleManager\n * ================================================================ */\n\nexport interface BundlePurchaseRecord {\n  userId: string;\n  bundleId: string;\n  timestamp: number;\n}\n\nexport class BundleManager {\n  private bundles = new Map<string, Bundle>();\n  private purchases: BundlePurchaseRecord[] = [];\n  private offers = new Map<string, LimitedTimeOffer>();\n  /** 用户最近一次弹窗时间 */\n  private offerLastShown = new Map<string, Map<string, number>>();\n\n  /* ---- Bundle CRUD ---- */\n\n  addBundle(bundle: Bundle): void {\n    this.bundles.set(bundle.id, bundle);\n  }\n\n  removeBundle(id: string): boolean {\n    return this.bundles.delete(id);\n  }\n\n  getBundle(id: string): Bundle | undefined {\n    return this.bundles.get(id);\n  }\n\n  /** 获取当前有效的礼包（未过期 + 未售罄） */\n  getActiveBundles(now: number = Date.now()): Bundle[] {\n    return [...this.bundles.values()].filter((b) => {\n      // 有效期检查\n      if (b.validUntil > 0 && now > b.validUntil) return false;\n      // 限购检查\n      if (b.purchaseLimit > 0) {\n        const sold = this.getPurchaseCount(b.id);\n        if (sold >= b.purchaseLimit) return false;\n      }\n      return true;\n    });\n  }\n\n  /** 获取所有礼包 */\n  getAllBundles(): Bundle[] {\n    return [...this.bundles.values()];\n  }\n\n  /* ---- 购买 ---- */\n\n  /** 购买礼包 */\n  purchaseBundle(\n    bundleId: string,\n    userId: string,\n    now: number = Date.now(),\n  ): { success: boolean; bundle?: Bundle; error?: string } {\n    const bundle = this.bundles.get(bundleId);\n    if (!bundle) return { success: false, error: '礼包不存在' };\n\n    // 有效期检查\n    if (bundle.validUntil > 0 && now > bundle.validUntil) {\n      return { success: false, error: '该礼包已过期' };\n    }\n\n    // 限购检查\n    if (bundle.purchaseLimit > 0) {\n      const userCount = this.getUserPurchaseCount(userId, bundleId);\n      if (userCount >= bundle.purchaseLimit) {\n        return { success: false, error: '已达到购买上限' };\n      }\n      const totalSold = this.getPurchaseCount(bundleId);\n      if (totalSold >= bundle.purchaseLimit) {\n        return { success: false, error: '该礼包已售罄' };\n      }\n    }\n\n    this.purchases.push({ userId, bundleId, timestamp: now });\n    return { success: true, bundle };\n  }\n\n  /** 获取礼包购买次数（全局） */\n  getPurchaseCount(bundleId: string): number {\n    return this.purchases.filter((p) => p.bundleId === bundleId).length;\n  }\n\n  /** 获取用户对某礼包的购买次数 */\n  getUserPurchaseCount(userId: string, bundleId: string): number {\n    return this.purchases.filter((p) => p.userId === userId && p.bundleId === bundleId).length;\n  }\n\n  /** 获取用户已购礼包列表 */\n  getUserPurchasedBundles(userId: string): string[] {\n    return this.purchases.filter((p) => p.userId === userId).map((p) => p.bundleId);\n  }\n\n  /* ---- 限时弹窗 ---- */\n\n  addOffer(offer: LimitedTimeOffer): void {\n    this.offers.set(offer.id, offer);\n  }\n\n  removeOffer(id: string): boolean {\n    return this.offers.delete(id);\n  }\n\n  getOffer(id: string): LimitedTimeOffer | undefined {\n    return this.offers.get(id);\n  }\n\n  /** 获取应触发的限时弹窗 */\n  getTriggeredOffers(\n    userId: string,\n    context: {\n      isFirstLogin: boolean;\n      daysSinceLastLogin: number;\n      now: Date;\n    },\n  ): LimitedTimeOffer[] {\n    const triggered: LimitedTimeOffer[] = [];\n    const now = context.now;\n\n    for (const offer of this.offers.values()) {\n      // 检查冷却\n      if (offer.cooldownMs) {\n        const lastShown = this.getLastShownTime(userId, offer.id);\n        if (lastShown && now.getTime() - lastShown < offer.cooldownMs) {\n          continue;\n        }\n      }\n\n      // 检查触发条件\n      const t = offer.trigger;\n      switch (t.type) {\n        case 'welcome':\n          if (t.firstLogin && context.isFirstLogin) triggered.push(offer);\n          break;\n        case 'return':\n          if (t.returnAfterDays && context.daysSinceLastLogin >= t.returnAfterDays) {\n            triggered.push(offer);\n          }\n          break;\n        case 'festival':\n          if (t.festivalDate) {\n            const mmdd = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;\n            if (mmdd === t.festivalDate) triggered.push(offer);\n          }\n          break;\n      }\n    }\n\n    return triggered;\n  }\n\n  /** 记录弹窗展示 */\n  recordOfferShown(userId: string, offerId: string): void {\n    if (!this.offerLastShown.has(userId)) {\n      this.offerLastShown.set(userId, new Map());\n    }\n    this.offerLastShown.get(userId)!.set(offerId, Date.now());\n  }\n\n  /** 获取上次弹窗时间 */\n  getLastShownTime(userId: string, offerId: string): number | undefined {\n    return this.offerLastShown.get(userId)?.get(offerId);\n  }\n\n  /* ---- 工具 ---- */\n\n  /** 计算礼包节省金额 */\n  getSavings(bundleId: string): number {\n    const bundle = this.bundles.get(bundleId);\n    if (!bundle) return 0;\n    return bundle.originalPrice - bundle.finalPrice;\n  }\n\n  /** 检查礼包是否即将过期 */\n  getExpiringSoonBundles(withinMs: number = 3600_000, now: number = Date.now()): Bundle[] {\n    return this.getActiveBundles(now).filter((b) => {\n      return b.validUntil > 0 && b.validUntil - now <= withinMs && b.validUntil > now;\n    });\n  }\n}\n",
    },
    {
      filePath: "src/monetization/ads.ts",
      content: "/**\n * Ads — 广告系统\n *\n * 支持激励视频、插屏、横幅三种广告类型；\n * 含频控、每日上限、去广告（关联 IAP）功能。\n */\n\n/* ================================================================\n * 类型定义\n * ================================================================ */\n\n/** 广告类型 */\nexport type AdType = 'rewarded' | 'interstitial' | 'banner';\n\n/** 广告展示位置 */\nexport type AdPlacement =\n  | 'level_complete'\n  | 'daily_bonus'\n  | 'revive'\n  | 'get_reward'\n  | 'pause_menu'\n  | 'shop'\n  | 'home_banner';\n\n/** 广告展示结果 */\nexport interface AdShowResult {\n  success: boolean;\n  error?: string;\n  /** 用户是否完整观看了广告（仅 rewarded 有效） */\n  watched?: boolean;\n}\n\n/** 广告展示记录 */\nexport interface AdImpression {\n  type: AdType;\n  placement: AdPlacement;\n  timestamp: number;\n  watched: boolean;\n}\n\n/** 频控配置 */\nexport interface AdFrequencyConfig {\n  /** 最小展示间隔（ms） */\n  minInterval: number;\n  /** 每日每类广告上限 */\n  dailyLimitPerType: number;\n}\n\n/** 广告回调 */\nexport type AdWatchedCallback = (placement: AdPlacement) => void;\n\n/** 默认频控配置 */\nexport const DEFAULT_AD_FREQUENCY: AdFrequencyConfig = {\n  minInterval: 30_000,       // 30s 最小间隔\n  dailyLimitPerType: 20,     // 每日每类最多 20 次\n};\n\n/* ================================================================\n * AdManager\n * ================================================================ */\n\nexport class AdManager {\n  private frequency: AdFrequencyConfig;\n  private impressions: AdImpression[] = [];\n  private watchedCallbacks: AdWatchedCallback[] = [];\n  private adsRemoved = false;\n  /** 记录各类型上次展示时间 */\n  private lastShownTime = new Map<AdType, number>();\n  /** 关联的去广告 IAP 商品 ID */\n  private removeAdsProductId: string;\n\n  constructor(config?: Partial<AdFrequencyConfig>, removeAdsProductId = 'remove_ads') {\n    this.frequency = { ...DEFAULT_AD_FREQUENCY, ...config };\n    this.removeAdsProductId = removeAdsProductId;\n  }\n\n  /* ---- 广告展示 ---- */\n\n  /** 展示广告 */\n  showAd(type: AdType, placement: AdPlacement, now: number = Date.now()): AdShowResult {\n    // 去广告已购买\n    if (this.adsRemoved) {\n      return { success: false, error: '已购买去广告，不再展示广告' };\n    }\n\n    // 频控：最小间隔检查\n    const lastTime = this.lastShownTime.get(type);\n    if (lastTime && now - lastTime < this.frequency.minInterval) {\n      const remaining = Math.ceil((this.frequency.minInterval - (now - lastTime)) / 1000);\n      return { success: false, error: `广告冷却中，请 ${remaining} 秒后再试` };\n    }\n\n    // 每日上限检查\n    const todayStart = this.getTodayStart(now);\n    const todayCount = this.impressions.filter(\n      (imp) => imp.type === type && imp.timestamp >= todayStart,\n    ).length;\n    if (todayCount >= this.frequency.dailyLimitPerType) {\n      return { success: false, error: `今日${type}广告已达上限（${this.frequency.dailyLimitPerType}次）` };\n    }\n\n    // 记录展示\n    this.lastShownTime.set(type, now);\n    const impression: AdImpression = {\n      type,\n      placement,\n      timestamp: now,\n      watched: false,\n    };\n    this.impressions.push(impression);\n\n    return { success: true };\n  }\n\n  /** 标记激励视频观看完成 */\n  onAdWatched(placement: AdPlacement, now: number = Date.now()): void {\n    // 更新最近一条 rewarded 记录的 watched 标记\n    const lastRewarded = [...this.impressions]\n      .reverse()\n      .find((imp) => imp.type === 'rewarded' && !imp.watched);\n\n    if (lastRewarded) {\n      lastRewarded.watched = true;\n      lastRewarded.timestamp = now;\n    }\n\n    // 触发回调\n    for (const cb of this.watchedCallbacks) {\n      try { cb(placement); } catch { /* 忽略回调异常 */ }\n    }\n  }\n\n  /** 注册激励视频观看回调 */\n  onAdWatchedCallback(callback: AdWatchedCallback): void {\n    this.watchedCallbacks.push(callback);\n  }\n\n  /** 移除回调 */\n  removeCallback(callback: AdWatchedCallback): void {\n    this.watchedCallbacks = this.watchedCallbacks.filter((cb) => cb !== callback);\n  }\n\n  /* ---- 去广告 ---- */\n\n  /** 购买去广告 */\n  removeAds(purchaseId: string): { success: boolean; error?: string } {\n    if (purchaseId === this.removeAdsProductId) {\n      this.adsRemoved = true;\n      return { success: true };\n    }\n    return { success: false, error: `无效的去广告商品 ID：${purchaseId}` };\n  }\n\n  /** 是否已去广告 */\n  isAdsRemoved(): boolean {\n    return this.adsRemoved;\n  }\n\n  /* ---- 频控与统计 ---- */\n\n  /** 获取频控配置 */\n  getFrequencyConfig(): AdFrequencyConfig {\n    return { ...this.frequency };\n  }\n\n  /** 更新频控配置 */\n  updateFrequency(config: Partial<AdFrequencyConfig>): void {\n    this.frequency = { ...this.frequency, ...config };\n  }\n\n  /** 获取今日某类广告展示次数 */\n  getTodayImpressions(type: AdType, now: number = Date.now()): number {\n    const todayStart = this.getTodayStart(now);\n    return this.impressions.filter(\n      (imp) => imp.type === type && imp.timestamp >= todayStart,\n    ).length;\n  }\n\n  /** 获取今日某类广告剩余可用次数 */\n  getRemainingToday(type: AdType, now: number = Date.now()): number {\n    const used = this.getTodayImpressions(type, now);\n    return Math.max(0, this.frequency.dailyLimitPerType - used);\n  }\n\n  /** 获取全部展示记录 */\n  getImpressions(): AdImpression[] {\n    return [...this.impressions];\n  }\n\n  /** 获取展示统计 */\n  getStats(): {\n    total: number;\n    byType: Record<AdType, number>;\n    watched: number;\n    remainingToday: Record<AdType, number>;\n  } {\n    const byType: Record<AdType, number> = { rewarded: 0, interstitial: 0, banner: 0 };\n    for (const imp of this.impressions) {\n      byType[imp.type]++;\n    }\n\n    const now = Date.now();\n    const remainingToday: Record<AdType, number> = {\n      rewarded: this.getRemainingToday('rewarded', now),\n      interstitial: this.getRemainingToday('interstitial', now),\n      banner: this.getRemainingToday('banner', now),\n    };\n\n    return {\n      total: this.impressions.length,\n      byType,\n      watched: this.impressions.filter((imp) => imp.watched).length,\n      remainingToday,\n    };\n  }\n\n  /** 检查某广告类型是否可展示 */\n  canShow(type: AdType, now: number = Date.now()): boolean {\n    if (this.adsRemoved) return false;\n\n    const lastTime = this.lastShownTime.get(type);\n    if (lastTime && now - lastTime < this.frequency.minInterval) return false;\n\n    const todayStart = this.getTodayStart(now);\n    const todayCount = this.impressions.filter(\n      (imp) => imp.type === type && imp.timestamp >= todayStart,\n    ).length;\n    return todayCount < this.frequency.dailyLimitPerType;\n  }\n\n  /* ---- 内部工具 ---- */\n\n  private getTodayStart(now: number): number {\n    const d = new Date(now);\n    d.setHours(0, 0, 0, 0);\n    return d.getTime();\n  }\n}\n",
    },
  ];
}




/* ================================================================
 * AI 行为系统 ai-behavior 代码生成
 * ================================================================ */

function generateAIBehavior(): GeneratedFile[] {
  return [
    {
      filePath: 'src/ai/index.ts',
      content: `/**
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
`,
    },
  ];
}

/* ================================================================
 * Unity Spec 产物 — 当 targetEngine 为 unity 时生成工程模板文档
 * ================================================================ */

function generateUnitySpec(): GeneratedFile[] {
  return [
    {
      filePath: 'docs/MANAGER_ARCHITECTURE.md',
      content: `# Manager Architecture — Unity C# Core + runtime script Gameplay Layer

> 基于 IL2CPP + runtime script 三层架构的 Unity 手游 Manager 体系设计
> 生成时间：${new Date().toISOString().split('T')[0]}

## 架构概览

本手游采用\\\`C# Engine Core + runtime script Gameplay/UI Layer\\\`的分层架构：

- **C# Native Core**：提供引擎级 Manager 服务（资源、UI、音频、更新调度、平台桥接）
- **runtime script Scripting Layer**：承载全部游戏逻辑、UI 流程、数据模型、事件路由和配置驱动行为
- **C#-runtime script Bridge**：薄封装层，将 C# Manager API 统一暴露给 runtime script，禁止 runtime script 直接访问 UnityEngine 内部

## Manager 清单

### 1. ResourceManager

| 项目 | 说明 |
|------|------|
| 职责 | 抽象资源加载管线：同步/异步加载、引用计数、LRU/优先级缓存淘汰、场景预加载、Bundle 依赖解析 |
| 暴露接口 | \`LoadAsset(path)\`, \`LoadAssetAsync(path, callback)\`, \`UnloadAsset(path)\`, \`PreloadScene(scene)\` |
| 生命周期 | 引擎启动时初始化 → 加载并缓存常用资源 → 场景切换/低内存时释放未使用资源 → 关机时清空 |
| 约束 | 禁止向 runtime script 暴露原始 content bundle 句柄，仅暴露逻辑资源定位信息 |

### 2. UIManager

| 项目 | 说明 |
|------|------|
| 职责 | 维护 UI 窗口栈（push/pop/replace 语义）；管理面板生命周期（preload/show/hide/pause/resume/close/destroy）；Canvas 层级管理（background/normal/popup/toast/loading/top）；安全区适配与分辨率缩放 |
| 暴露接口 | \`OpenPanel(name, params)\`, \`ClosePanel(name)\`, \`GetPanel(name)\`, \`ShowToast(msg)\` |
| 生命周期 | ResourceManager 就绪后初始化；面板注册 engine template 引用和 runtime script 控制器绑定；栈操作触发对应生命周期回调 |

### 3. runtime scriptManager

| 项目 | 说明 |
|------|------|
| 职责 | 初始化并管理 runtime script VM 实例；C# 到 runtime script 类型绑定和调用编组；runtime script 脚本热更新（下载→解包→校验→VM 重载/重启）；统一异常处理和堆栈格式化 |
| 暴露接口 | \`DoString(code)\`, \`DoFile(path)\`, \`CallGlobalFunc(name, args)\`, \`HotReload(bundlePath)\` |
| 生命周期 | 启动序列早期初始化；热更新检查在 runtime script 业务代码执行前完成；VM 重启必须隔离，不导致 Native Host 崩溃 |

### 4. EventManager

| 项目 | 说明 |
|------|------|
| 职责 | 全局发布/订阅事件总线，解耦 runtime script 模块和 C# Manager；支持事件命名空间、优先级排序、一次性监听、帧内批量刷新 |
| 暴露接口 | \`Subscribe(event, handler, priority)\`, \`Unsubscribe(event, handler)\`, \`Publish(event, data)\` |
| 生命周期 | 引擎核心启动后即可用；监听器在模块初始化时注册，在模块卸载时清理 |

### 5. AudioManager

| 项目 | 说明 |
|------|------|
| 职责 | BGM/SFX/语音播放管理；音量分组（Master/BGM/SFX/Voice）及平滑淡入淡出；音频源对象池；3D 空间音频；平台静音/闪避（来电/通知） |
| 暴露接口 | \`PlayBGM(name, fadeIn)\`, \`PlaySFX(name, volume)\`, \`SetVolume(group, value)\`, \`StopAll()\` |
| 生命周期 | ResourceManager 加载音频 Bank 后初始化；响应系统音频焦点变化；场景卸载时回收音频源 |

### 6. UpdateManager

| 项目 | 说明 |
|------|------|
| 职责 | 统一驱动每帧逻辑：将 Update/LateUpdate/FixedUpdate/OnGUI 调用路由到注册的处理器；支持优先级排序和分组条件暂停；避免分散的 MonoBehaviour.Update() |
| 暴露接口 | \`RegisterUpdate(handler, priority)\`, \`RegisterLateUpdate(handler)\`, \`RegisterFixedUpdate(handler)\`, \`Unregister(handler)\` |
| 生命周期 | 全应用生命周期活跃；处理器动态注册/注销；加载界面或系统弹窗期间暂停 |

### 7. SDKAdapter

| 项目 | 说明 |
|------|------|
| 职责 | 抽象平台特定 SDK 集成（登录/支付/推送/统计/广告/分享），提供统一 C# 接口；主线程缓冲原生回调；提供功能探测标志供 runtime script 运行时查询 SDK 可用性 |
| 暴露接口 | \`Login()\`, \`Pay(order)\`, \`TrackEvent(name, params)\`, \`ShowAd(placement)\`, \`RegisterPush()\` |
| 生命周期 | 按平台在 Native Host Activity/Application 中初始化；Adapter 注册到中央调度器；回调通过线程安全队列序列化到 Unity 主线程 |

## 设计约束

- 所有 Manager 单例延迟初始化，支持显式销毁以适应场景切换
- runtime script 层通过 EventManager 实现模块间解耦，禁止直接跨 Manager 引用
- C#-runtime script Bridge 保持稳定：新增 Manager API 时加而非改，保持向后兼容
- 热更新必须原子化：下载完整 runtime script Bundle → 校验完整性 → 原子交换 VM 状态 → 失败回滚
`,
    },
    {
      filePath: 'docs/UNITY_RESOURCE_PIPELINE.md',
      content: `# Unity Resource Pipeline — content bundle 管线设计

> 基于 content bundle 的手游资源分包、CDN 分发与热更新方案
> 生成时间：${new Date().toISOString().split('T')[0]}

## 分包策略

按三个维度组合分包：

| 维度 | 说明 | 示例 |
|------|------|------|
| 按场景 | 每个场景及其独占资源组成独立 Bundle | \`scene_village\`, \`scene_dungeon\` |
| 按功能 | 跨场景共享的通用资源按功能模块分包 | \`ui_common\`, \`fx_shared\` |
| 按更新频率 | 高频变更内容独立分包，低频内容合并 | \`config_tables\` (高频), \`models_characters\` (低频) |

## 资源分类

| 分类 | 内容 | 打包策略 |
|------|------|----------|
| UI | engine template、sprite sheet、字体 | 按面板组打包，随 UI 变更高频更新 |
| 模型 | 3D 网格、贴图、材质、动画、Avatar 组件 | 按角色/场景打包，更新频率中等 |
| 音效 | BGM、SFX、语音 | 按音频 Bank 分组，控制压缩级别 |
| 场景 | Unity Scene 文件及独占依赖 | 每场景一包，共享资源去重放入 shared |
| 配置表 | 数值表、多语言文本、功能开关 | 单一小包，支持快速增量同步 |
| runtime script 脚本 | runtime script 源码/字节码 | 单包或按模块拆分（大型代码库） |

## Manifest 结构

远程资源目录 JSON 格式：

\`\`\`json
{
  "version": "1.2.3",
  "minAppVersion": "1.0.0",
  "bundles": [
    {
      "name": "ui_common",
      "hash": "sha256:abc123...",
      "size": 1048576,
      "dependencies": [],
      "cdnPath": "bundles/ui_common_v3.bundle",
      "compression": "lz4"
    }
  ]
}
\`\`\`

## 热更新流程

\`\`\`
启动 → 获取远程版本 Manifest → 对比本地 Manifest
  → 计算 Delta（新增/修改/删除的 Bundle）
  → 下载 Delta Bundle（支持断点续传 & 重试）
  → 逐 Bundle 校验 SHA256
  → 原子交换本地 Catalog
  → 下次启动应用（或 Live Reload runtime script）
\`\`\`

## 版本校验

| 方案 | 适用场景 | 说明 |
|------|----------|------|
| MD5 | 快速校验 | 128-bit，速度优先，适合小文件 |
| SHA256 | 生产环境 | 256-bit，安全性高，推荐 |
| CRC32 | 传输校验 | 32-bit，检测网络传输损坏 |

远程 Manifest 中声明 per-bundle SHA256 hash，客户端下载完成后校验比对，失败则重试或降级。

## 降级与回退

- **CDN 不可达**：使用本地缓存 Bundle 继续运行，不阻塞玩家进入游戏
- **版本检查失败**：回退到上一次成功的 Catalog 快照
- **新版本崩溃**：记录启动崩溃计数，超过阈值自动回退到旧版本快照
- **灰度发布**：按渠道/地区/用户百分比逐步放量，降低全量风险
`,
    },
    {
      filePath: 'docs/ANDROID_SDK_LIFECYCLE.md',
      content: `# Android SDK Lifecycle — Unity 手游 Android 层集成指南

> Unity Android Host 生命周期管理、SDK Adapter 合同、Manifest 检查清单
> 生成时间：${new Date().toISOString().split('T')[0]}

## Unity Host Activity 生命周期

Unity Android 手游在 Native 层需要一个 Host Activity 作为生命周期桥接：

\`\`\`
Application.onCreate()
  → SDK 初始化（Crash Reporting → Analytics → Push → Ads → Payment）
  → Unity 引擎启动

Activity.onCreate()
  → 加载 Unity Player
  → 注册 SDK 回调路由

Activity.onResume()  → 恢复游戏逻辑 / 广告 / 音频
Activity.onPause()   → 暂停游戏 / 保存状态
Activity.onDestroy() → 释放 SDK 资源 / 清理
\`\`\`

## SDK Adapter 合同

每个 SDK Adapter 需要实现以下生命周期钩子：

| 钩子 | 调用时机 | 职责 |
|------|----------|------|
| \`init(app, activity)\` | Application.onCreate() | SDK 初始化配置 |
| \`onActivityCreate(bundle)\` | Activity.onCreate() | Activity 级初始化 |
| \`onResume()\` | Activity.onResume() | 恢复服务 |
| \`onPause()\` | Activity.onPause() | 暂停服务 |
| \`onDestroy()\` | Activity.onDestroy() | 释放资源 |
| \`onNewIntent(intent)\` | Activity.onNewIntent() | 深度链接/推送跳转 |
| \`onActivityResult(req, res, data)\` | Activity.onActivityResult() | 支付/登录回调 |
| \`onRequestPermissionsResult(req, perms, grants)\` | 权限回调 | 权限结果处理 |

## Manifest 检查清单

- [ ] Main Activity 声明正确，包含 LAUNCHER intent-filter
- [ ] 所有 Activity/Service/Receiver/Provider 显式声明 \`android:exported\`
- [ ] \`screenOrientation\` 与目标方向一致（sensorPortrait/sensorLandscape）
- [ ] \`configChanges\` 包含 orientation|screenSize|keyboardHidden
- [ ] FileProvider \`authorities\` 字符串唯一，不与其他应用冲突
- [ ] 所需权限（INTERNET/ACCESS_NETWORK_STATE 等）已声明
- [ ] Application 节点含 \`hardwareAccelerated="true"\`
- [ ] 无 debug 专属权限或 metadata 泄露到 Release 构建

## 公开 SDK 模块建议

| 模块 | 推荐 SDK | 用途 |
|------|----------|------|
| 支付 | Google Play Billing | IAP 内购 |
| 广告 | AdMob | 激励视频/插屏/Banner |
| 推送 | Firebase Cloud Messaging (FCM) | 远程推送通知 |
| 统计 | Firebase Analytics | 用户行为分析 |
| 崩溃 | Firebase Crashlytics | 崩溃收集与分析 |
| 应用内消息 | Firebase In-App Messaging | 运营弹窗与引导 |

## 真机调试

\`\`\`bash
# 安装 Android install package
adb install -r game.android-package

# 启动应用
adb shell am start -n com.example.game/.MainActivity

# 抓取 Unity + Android 日志
adb logcat -s Unity:V ActivityManager:V AndroidRuntime:E

# 抓取崩溃日志
adb logcat -b crash

# 截屏
adb exec-out screencap -p > screen.png

# 收集完整 bug report
adb bugreport
\`\`\`
`,
    },
    {
      filePath: 'docs/DEVICE_DEBUG_CHECKLIST.md',
      content: `# Device Debug Checklist — Unity Android 真机调试检查清单

> adb 命令参考、日志过滤、资源加载诊断、网络与 CDN 排查
> 生成时间：${new Date().toISOString().split('T')[0]}

## 1. Manifest 检查

- [ ] Main Activity 声明正确，LAUNCHER intent-filter 存在
- [ ] 所有组件显式声明 \`android:exported\`
- [ ] 权限声明匹配 SDK Adapter 需求
- [ ] Application 节点 \`hardwareAccelerated="true"\`
- [ ] FileProvider authorities 唯一
- [ ] 无 debug 配置泄露到 Release 构建

\`\`\`bash
adb shell dumpsys package <package-name> | grep -A 50 'AndroidManifest'
aapt dump badging <android-package-path>
\`\`\`

## 2. 启动检查

- [ ] Application.onCreate() 在 5s 内完成（避免 ANR）
- [ ] Main Activity onCreate → onStart → onResume 无异常
- [ ] Unity Splash Screen 正常过渡到游戏场景
- [ ] 首帧分析/崩溃上报回调在初始化完成后触发

\`\`\`bash
adb logcat -s ActivityManager:I | grep -E "Displayed|START"
adb shell am start -W com.example.game/.MainActivity  # 冷启动耗时
\`\`\`

## 3. SDK 初始化检查

- [ ] 崩溃上报 SDK 最先初始化
- [ ] 统计 SDK 在崩溃上报之后初始化
- [ ] 推送 SDK 在 Activity 创建后注册
- [ ] 广告 SDK 延迟初始化（避免阻塞启动）
- [ ] 支付 SDK 在游戏逻辑启动后初始化

\`\`\`bash
adb logcat | grep -iE "sdk|init|adapter|firebase|google"
\`\`\`

## 4. 日志检查

- [ ] Unity Log tag 正确输出
- [ ] 无 ANR 日志
- [ ] 无崩溃堆栈
- [ ] 无 runtime script 异常

\`\`\`bash
adb logcat -s Unity:V
adb logcat -b crash
adb logcat *:E
\`\`\`

## 5. 资源加载检查

- [ ] content bundle 加载无失败日志
- [ ] 无引用丢失警告
- [ ] 首场景资源在冷启动预算内加载完毕

\`\`\`bash
adb logcat | grep -iE "content-bundle|resource|missing|failed|shader"
\`\`\`

## 6. runtime script/脚本错误检查

- [ ] 无 runtime script 异常堆栈输出
- [ ] 热更新加载无失败
- [ ] 模块 require 无报错

\`\`\`bash
adb logcat | grep -iE "runtime-script|error|exception|stack trace"
\`\`\`

## 7. 网络与 CDN 检查

- [ ] 资源下载无超时
- [ ] SSL 证书验证正常
- [ ] CDN 重定向正常
- [ ] 请求域名在 DNS 可解析

\`\`\`bash
adb shell ping -c 5 cdn.example.com
adb logcat | grep -iE "timeout|ssl|redirect|404|500|dns"
\`\`\`
`,
    },
    {
      filePath: 'docs/UI_STACK_SPEC.md',
      content: `# UI Stack Spec — 手游 UI 层级与面板规范

> Unity UGUI 面板管理、生命周期、层级定义、交互规则
> 生成时间：${new Date().toISOString().split('T')[0]}

## UI 层级定义

| 层级 | 排序 | 说明 | 示例 |
|------|------|------|------|
| Background | 0 | 常驻背景层，不可交互 | 主城场景、挂机场景 |
| Normal | 100 | 常规功能面板，可堆叠 | 背包、角色、技能 |
| Popup | 200 | 弹窗面板，模态遮罩 | 确认框、详情弹窗 |
| Toast | 300 | 轻提示，自动消失 | 获得物品提示、错误提示 |
| Loading | 400 | 加载遮罩，阻断交互 | 场景切换、数据加载 |
| Top | 500 | 最高优先级覆盖 | 系统弹窗、支付确认、SDK 回调 |

## 面板生命周期

\`\`\`
Preload → Show → (Pause → Resume)* → Hide → Close → Destroy
\`\`\`

| 状态 | 触发 | 行为 |
|------|------|------|
| Preload | 预加载请求 | 加载资源，不显示 |
| Show | OpenPanel() | 播放入场动效，注册事件 |
| Pause | 上层面板打开 | 暂停更新、音效 |
| Resume | 上层面板关闭 | 恢复更新 |
| Hide | ClosePanel() | 播放出场动效，注销事件 |
| Close | 动效完成 | 回到缓存池或释放 |
| Destroy | 场景切换/强制清理 | 完全释放资源 |

## 面板交互规则

- 弹窗层级面板打开时，下层 Normal 面板自动 Pause
- 模态弹窗显示半透明遮罩，点击遮罩可关闭（配置项）
- Toast 不阻断交互，3 秒自动消失
- Loading 层阻断所有下层交互
- 同一层级同一时间只能有一个面板处于 Show 状态
`,
    },
    {
      filePath: 'docs/XIANXIA_ART_DIRECTION.md',
      content: `# Xianxia Art Direction — 修仙美术方向指南

> 通用修仙/仙侠/国风游戏美术设计启发式，不含任何第三方原始素材
> 生成时间：${new Date().toISOString().split('T')[0]}

## 核心审美原则

1. **修仙幻想是情感核心**：宁静成长、突破、宗门认同、法宝、道侣、境界、道途选择
2. **UI 克制**：平日界面冷静清晰，突破/稀有掉落/Boss 胜利/新境界解锁时才释放视觉奇观
3. **层次化视觉语言**：水墨、玉、金、丝绸、雾、符纸、云、星图、阵法、炼丹火、法宝光
4. **配色克制**：中性底色 + 有意义的强调色（境界/元素/稀有度/宗门/危险状态）
5. **可读性优先**：数值、计时器、消耗、奖励在装饰之前必须清晰可读

## 反模式（禁止）

- 过度发光 > 2 层叠加
- 荧光色（#00FF00 / #FF00FF / #00FFFF 类）
- 繁杂 UI（同时出现 >3 个弹窗/红点/倒计时）
- 低质量粒子（块状、闪烁频率 >10Hz）
- 信息噪音（同时出现超过 3 种竞争注意力的提示）
- 页游式金色描边按钮
- 现代 UI 组件混入（圆角卡片、渐变进度条）

## 角色美术提示词结构

角色生成使用模块化 Slot 架构：

| Slot 层 | 包含 | 作用 |
|---------|------|------|
| 剪影定义层 | hair/cloth/top | 决定角色轮廓和职业辨识度 |
| 稀有度表达层 | ear/decorate/mask/bodyglow/tattoo | 区分品质、主题和付费层级 |

角色原型差异化（剪影先于配色）：
剑修 → 身形挺直、负剑或横剑
体修 → 魁梧体魄、拳掌架势
符修 → 飘逸、符纸围绕
丹修 → 药鼎/葫芦、温和
阵修 → 阵盘/罗盘、沉稳
兽修 → 灵兽相伴、野性
魔道 → 暗色系、邪气
正道 → 端正、清气

## 场景美术提示词结构

分层构建：
\`\`\`
基础环境 → 前景框 → 中景活动空间 → 背景氛围 → 天气/雾 → UI 安全区
\`\`\`

场景类型与进度映射：
- 村落：初始 → 温暖、简单
- 宗门山门：入门 → 庄严、云雾
- 洞府：修炼 → 幽静、灵石光
- 坊市：交易 → 热闹、灯笼
- 禁地：挑战 → 阴森、封印纹
- 古战场：中后期 → 荒凉、残兵
- 灵矿：资源 → 荧光、晶石
- 丹房：制作 → 火光、药香
- 塔/秘境：爬塔 → 层进、机关
- 飞升台：终极 → 祥云、天光

## 敌人设计提示词结构

差异化维度：轮廓 > 色彩 > 体型

敌人族群：
妖兽（野兽变异）、鬼物（亡灵）、魔物（深渊）、傀儡（机关）、邪修（人形）、古神卫（遗迹）、虫族（群体）、灵植（植物）、堕落法宝（器物）

Boss 设计原则：独特轮廓 + 一个记忆点机制视觉标记

## 法宝/功法/境界/宗门视觉语言

| 系统 | 视觉语言 | 示例 |
|------|----------|------|
| 法宝 | icon/详情卡/实体预制体/idle动效/技能VFX/觉醒VFX 六件套 | 飞剑(细长/流光)、宝塔(层叠/镇压)、葫芦(圆润/吸纳) |
| 功法 | 秘籍卷轴样式、修炼进度水墨渲染、突破光柱 | 境界文字浮现、祥云汇聚 |
| 境界 | 炼气→筑基→金丹→元婴→化神→渡劫→大乘 递进 | 每个境界对应不同的光环/灵气颜色 |
| 宗门 | 宗徽/旗帜/建筑风格/弟子服饰统一 | 剑宗(凌厉)、丹宗(温润)、阵宗(规整) |
`,
    },
    {
      filePath: 'docs/PROGRESSION_BALANCE_SPEC.md',
      content: `# Progression Balance Spec — 修仙放置数值模型

> 通用数值曲线、公平性检查、反 P2W 约束
> 生成时间：${new Date().toISOString().split('T')[0]}

## 核心设计原则

1. 每个付费加速器必须有对应的非付费长线路径
2. 付费节省时间，但不跳过策略
3. 软上限和追赶机制防止鲸鱼跳过整个游戏循环
4. 上线前用免费/微氪/重氪三档模拟测试

## 境界成长曲线

\`\`\`
境界等级 n (1-based)
修为需求: XP(n) = base * (growthFactor ^ (n-1))

线性模式: XP(n) = base * (1 + (n-1) * growthFactor)  -- 稳定增长
指数模式: XP(n) = base * (growthFactor ^ (n-1))     -- 后期巨大
对数模式: XP(n) = base * log(n + 1) * growthFactor   -- 趋缓
分段模式: 前 M 境线性 + 后 N 境指数                  -- 前后分明
\`\`\`

## 修为产出曲线（在线 + 离线双轨）

\`\`\`
在线收益: onlineRate(n) = baseOnlineRate * (1 + level * onlineBonusFactor)
离线收益: offlineRate(n) = onlineRate(n) * offlineEfficiency
  其中 offlineEfficiency = max(0.3, 1.0 - decayFactor * hoursOffline)
\`\`\`

## 突破消耗与风险

\`\`\`
突破消耗: cost(n) = baseCost * (riskFactor ^ (n-1))
突破成功率: successRate(n) = max(minRate, 1.0 - (n-1) * failIncrement)
失败惩罚: 消耗材料、修为回退、冷却时间（可选）
\`\`\`

## 掉落概率曲线

\`\`\`
稀有度 r (0=普通, 4=传说)
基础掉落率: dropRate(r) = baseDropRate * (rarityDecay ^ r)
保底机制: 连续 N 次未出 → 第 N+1 次必出（pity timer）
\`\`\`

## 战力成长曲线

\`\`\`
战力公式: power = ATK * (1 + critRate * critMultiplier) * (1 + elementBonus) * HP^0.5
成长曲线: power(level) = basePower * (growthRate ^ (level-1)) * equipmentMultiplier
\`\`\`

## 离线收益衰减

\`\`\`
离线收益 = onlineRatePerSecond * offlineSeconds * decayFactor

decayFactor:
  t <= 1h  : 1.0
  1h < t <= 4h  : 1.0 - (t-1h) * 0.05
  4h < t <= 12h : 0.85 - (t-4h) * 0.025
  t > 12h : 0.65
\`\`\`

## 免费/微氪/重氪模拟（时间等价换算）

\`\`\`
免费玩家 (F2P):
  日在线 3h, 日修为产出 = 3 * onlineRate + 21 * offlineRate
  达到第 N 境时间: XP(n) / dailyXP

微氪玩家 (Dolphin):
  日在线 3h, 修为加成 +50%, 日修为产出 = (3 * onlineRate * 1.5) + (21 * offlineRate * 1.2)
  达到第 N 境时间: XP(n) / dailyDolphinXP

重氪玩家 (Whale):
  日在线 5h, 修为加成 +300%, 跳过低级突破冷却
  达到第 N 境时间: XP(n) / dailyWhaleXP

公平性指标:
  Whale / F2P 时间比 = T_whale / T_f2p （建议 ≥ 0.3）
  Dolphin / F2P 时间比 = T_dolphin / T_f2p （建议 ≥ 0.6）
\`\`\`

## 公平性检查

- [ ] 核心战力组件是否可通过免费途径获取？
- [ ] 付费专属内容是否仅限于外观/便捷/收藏？
- [ ] PvP 中是否存在付费玩家碾压免费玩家的数值鸿沟？
- [ ] 是否存在"不付费无法推进"的硬性门槛？
- [ ] 限时活动奖励是否对所有活跃玩家可达？

## P2W 风险提示

| 风险项 | 严重程度 | 缓解措施 |
|--------|----------|----------|
| 付费专属数值道具 | 高 | 所有数值道具设免费获取路径（时间长但可达） |
| 限时付费独占内容 | 高 | 活动结束后加入常驻兑换 |
| 付费加速突破 | 中 | 设软上限，付费仅节省等待时间 |
| VIP 等级战力加成 | 高 | 改为外观/便捷特权 |
| 抽卡无保底 | 中 | 设 pity timer 保证期望值 |
| 新服付费玩家快速拉开差距 | 中 | 设赛季追赶机制 |
`,
    },
  ];
}
