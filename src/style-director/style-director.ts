/**
 * UI Style Director — 审美与动效系统
 *
 * 职责：
 * 1. 根据游戏需求和风格包 ID 生成 UI_STYLE_GUIDE.md 和 MOTION_GUIDE.md
 * 2. 管理风格包库（pixel-loot-neon / xianxia-ink-premium / cozy-idle-workshop）
 * 3. 提供 getSuggestedStylePackage() 根据游戏类型推荐风格包
 *
 * 引擎适配：
 * - Web: 直接输出 CSS tokens / React motion 建议
 * - Godot: 翻译为 Tween / AnimationPlayer / Theme / Particles2D
 * - Unity: 翻译为 DOTween / Animator / Shader Graph / ParticleSystem
 */

import type {
  StylePackage,
  StyleGuideOutput,
  MotionToken,
  RarityMotionSlot,
} from './types';
import { BASE_MOTION_TOKENS, DEFAULT_RARITY_SLOTS } from './types';
import { generateArtDirection, getArtDirectionPackage } from './art-direction-generator';
import { readFileSync, existsSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

/* ===================== 修仙质量知识卡加载 ===================== */

interface XianxiaQualityBar {
  designPrinciples: string[];
  uiRules: string[];
  characterArtRules: string[];
  sceneArtRules: string[];
  enemyArtRules: string[];
  progressionRules: string[];
  schemas: Array<{ name: string; fields: string[] }>;
  antiP2WRules?: string[];
  antiGlowRules?: string[];
  antiNoiseRules?: string[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const XIANXIA_QUALITY_BAR_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'knowledge',
  'public',
  'xianxia-idle-quality-bar.json',
);

function loadXianxiaQualityBar(): XianxiaQualityBar | null {
  try {
    if (!existsSync(XIANXIA_QUALITY_BAR_PATH)) return null;
    const raw = readFileSync(XIANXIA_QUALITY_BAR_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    // 支持数组或对象格式
    const card = Array.isArray(parsed) ? parsed[0] : parsed;
    return {
      designPrinciples: card.designPrinciples ?? [],
      uiRules: card.uiRules ?? [],
      characterArtRules: card.characterArtRules ?? [],
      sceneArtRules: card.sceneArtRules ?? [],
      enemyArtRules: card.enemyArtRules ?? [],
      progressionRules: card.progressionRules ?? [],
      schemas: card.schemas ?? [],
      antiP2WRules: card.antiP2WRules ?? [],
      antiGlowRules: card.antiGlowRules ?? [],
      antiNoiseRules: card.antiNoiseRules ?? [],
    };
  } catch {
    return null;
  }
}

function buildXianxiaQualitySection(): string {
  const bar = loadXianxiaQualityBar();
  if (!bar) return '';

  const sections: string[] = [];

  if (bar.designPrinciples.length > 0) {
    sections.push('## 设计原则', ...bar.designPrinciples.map((p) => `- ${p}`));
  }
  if (bar.uiRules.length > 0) {
    sections.push('## UI 质量规则', ...bar.uiRules.map((r) => `- ${r}`));
  }
  if (bar.characterArtRules.length > 0) {
    sections.push('## 角色美术规则', ...bar.characterArtRules.map((r) => `- ${r}`));
  }
  if (bar.sceneArtRules.length > 0) {
    sections.push('## 场景美术规则', ...bar.sceneArtRules.map((r) => `- ${r}`));
  }
  if (bar.enemyArtRules.length > 0) {
    sections.push('## 敌人设计规则', ...bar.enemyArtRules.map((r) => `- ${r}`));
  }
  if (bar.progressionRules.length > 0) {
    sections.push('## 数值/成长规则', ...bar.progressionRules.map((r) => `- ${r}`));
  }
  if (bar.antiGlowRules && bar.antiGlowRules.length > 0) {
    sections.push('## 反过度发光规则', ...bar.antiGlowRules.map((r) => `- ${r}`));
  }
  if (bar.antiNoiseRules && bar.antiNoiseRules.length > 0) {
    sections.push('## 反信息噪音规则', ...bar.antiNoiseRules.map((r) => `- ${r}`));
  }
  if (bar.antiP2WRules && bar.antiP2WRules.length > 0) {
    sections.push('## 反 P2W 设计约束', ...bar.antiP2WRules.map((r) => `- ${r}`));
  }

  return sections.length > 0 ? sections.join('\n\n') : '';
}

/* ===================== 风格包库 ===================== */

const PIXEL_LOOT_NEON: StylePackage = {
  id: 'pixel-loot-neon',
  name: '像素刷宝霓虹',
  applicableGenres: ['loot-arpg', '地牢', '像素', '动作', 'rpg'],
  styleKeywords: ['像素边框', '清晰稀有度', '短促反馈', '少量霓虹强调'],
  antiPatterns: [
    '禁止满屏渐变光效',
    '禁止高饱和背景色',
    '禁止仙侠页游式金色描边按钮',
    '禁止过度模糊和投影（与像素风格冲突）',
    '禁止非像素字体的 UI 文字',
  ],
  palette: {
    primary: '#00ff88',
    accent: '#ff6b6b',
    danger: '#ff4444',
    background: '#1a1a2e',
    surface: '#16213e',
    textPrimary: '#e0e0e0',
    textSecondary: '#a0a0a0',
    rarity: {
      common: '#9e9e9e',
      uncommon: '#4caf50',
      rare: '#2196f3',
      epic: '#9c27b0',
      legendary: '#ff9800',
    },
  },
  typography: {
    headingFont: 'Press Start 2P / pixel font',
    bodyFont: 'monospace / pixel font small',
    digitFont: 'monospace bold',
    titleSize: 24,
    subtitleSize: 16,
    h2Size: 14,
    h3Size: 12,
    bodySize: 10,
    captionSize: 8,
    rules: [
      '所有 UI 文字使用像素字体',
      '数字使用等宽加粗，确保对齐',
      '标题用全大写 + 字间距 2px',
      '禁止使用衬线字体',
    ],
  },
  componentRules: {
    hud: '顶部 HP/MP 条用像素细条 + 荧光色填充，左下角技能栏方形图标 3×3 格',
    inventory: '正方形格子网格 5×n，选中格高亮边框（2px 霓虹色），物品图标像素风',
    equipmentCard: '像素边框卡片，稀有度颜色边框（1-2px），装备槽位形状示意',
    dropPopup: '掉落弹窗从物品位置飞出到屏幕中央，稀有度光柱（像素粒子），标题闪烁',
    combatFeedback: '伤害数字像素字体飘出，暴击加大+震动；受击闪白 3 帧',
    emptyState: '空状态用像素点阵绘制占位图，下方小字"暂无物品"',
  },
  motionTokens: BASE_MOTION_TOKENS.filter((t) =>
    ['button-press', 'panel-enter', 'panel-exit', 'item-pickup', 'rare-drop', 'combat-hit', 'level-up', 'ui-toggle'].includes(t.name),
  ),
  raritySlots: [
    {
      tier: 'common',
      color: '#9e9e9e',
      glowColor: 'transparent',
      duration: { ms: 0 },
      easing: 'linear',
      description: '普通：无特效，仅文字颜色区分',
    },
    {
      tier: 'uncommon',
      color: '#4caf50',
      glowColor: 'rgba(76,175,80,0.3)',
      duration: { ms: 100 },
      easing: 'ease-out',
      description: '非凡：绿色描边闪烁 1 次',
    },
    {
      tier: 'rare',
      color: '#2196f3',
      glowColor: 'rgba(33,150,243,0.5)',
      duration: { ms: 250 },
      easing: 'ease-out',
      description: '稀有：蓝色光柱 + 弹跳落地',
    },
    {
      tier: 'epic',
      color: '#9c27b0',
      glowColor: 'rgba(156,39,176,0.6)',
      duration: { ms: 450 },
      easing: 'ease-out-back',
      description: '史诗：紫色脉冲 + 光柱 + 音效提示',
    },
    {
      tier: 'legendary',
      color: '#ff9800',
      glowColor: 'rgba(255,152,0,0.7)',
      duration: { ms: 700 },
      easing: 'ease-out-bounce',
      description: '传说：金橙光柱 + 弹跳 + 全屏暗角 + 文字公告',
    },
  ],
  engineNotes: '像素风格在 Godot 中使用 Viewport stretch mode=viewport + scale 整数倍；Unity 使用 Pixel Perfect Camera。动效全部在低分辨率下保持清晰，禁止亚像素移动。',
};

const XIANXIA_INK_PREMIUM: StylePackage = {
  id: 'xianxia-ink-premium',
  name: '修仙水墨典雅',
  applicableGenres: ['修仙', '放置', '国风', 'rpg'],
  styleKeywords: ['水墨留白', '玉石绢帛质感', '低饱和色', '克制粒子', '留白构图'],
  antiPatterns: [
    '禁止页游式金色描边按钮',
    '禁止满屏飘字和廉价光效',
    '禁止高饱和配色',
    '禁止现代 UI 组件（如圆角卡片、渐变进度条）',
    '禁止超过 3 种主色同时出现',
  ],
  palette: {
    primary: '#5d4e37',
    accent: '#c9a96e',
    danger: '#8b2500',
    background: '#f5f0e8',
    surface: '#ede4d3',
    textPrimary: '#3c2f1f',
    textSecondary: '#8c7a6b',
    rarity: {
      common: '#8c7a6b',
      uncommon: '#5d8a5d',
      rare: '#4a6fa5',
      epic: '#7b4fa0',
      legendary: '#c9a96e',
    },
  },
  typography: {
    headingFont: 'Noto Serif SC / 思源宋体',
    bodyFont: 'Noto Sans SC / 思源黑体',
    digitFont: 'monospace',
    titleSize: 28,
    subtitleSize: 18,
    h2Size: 16,
    h3Size: 14,
    bodySize: 13,
    captionSize: 11,
    rules: [
      '标题使用宋体/楷体，正文用黑体',
      '字号层级明显，标题与正文差距 ≥ 4px',
      '数字统一用等宽字体',
      '行间距 ≥ 1.6',
      '禁止使用艺术字效果',
    ],
  },
  componentRules: {
    hud: '顶部横向卷轴式状态栏，水墨勾边，数值用毛笔字体',
    inventory: '中式百宝格样式，每格有细微绢帛纹理，选中格有印章标记',
    equipmentCard: '纵向卷轴卡片，标题用印章红，描述用墨色小字，边框有轻微做旧',
    dropPopup: '掉落物化作光点飞入背包，落地时泛起墨韵涟漪',
    combatFeedback: '伤害数字为毛笔字体飘出，暴击有墨迹炸开效果',
    emptyState: '空状态用水墨简笔画出物件轮廓 + "囊中羞涩" 文案',
  },
  motionTokens: BASE_MOTION_TOKENS.filter((t) =>
    ['button-press', 'panel-enter', 'panel-exit', 'item-pickup', 'hover-lift', 'level-up', 'ui-toggle'].includes(t.name),
  ),
  raritySlots: [
    {
      tier: 'common', color: '#8c7a6b', glowColor: 'transparent',
      duration: { ms: 0 }, easing: 'linear',
      description: '凡品：无特效',
    },
    {
      tier: 'uncommon', color: '#5d8a5d', glowColor: 'rgba(93,138,93,0.15)',
      duration: { ms: 200 }, easing: 'ease-out',
      description: '良品：淡绿微光，如玉石温润',
    },
    {
      tier: 'rare', color: '#4a6fa5', glowColor: 'rgba(74,111,165,0.2)',
      duration: { ms: 350 }, easing: 'ease-out',
      description: '珍品：蓝光如琉璃，墨韵扩散',
    },
    {
      tier: 'epic', color: '#7b4fa0', glowColor: 'rgba(123,79,160,0.3)',
      duration: { ms: 500 }, easing: 'ease-out-back',
      description: '仙品：紫气东来，光晕流转',
    },
    {
      tier: 'legendary', color: '#c9a96e', glowColor: 'rgba(201,169,110,0.4)',
      duration: { ms: 800 }, easing: 'ease-out-bounce',
      description: '神品：金光万丈，全屏祥云纹',
    },
  ],
  engineNotes: 'Web 端优先使用 CSS filter + SVG 纹理模拟水墨；Godot 使用 CanvasItem shader + 噪点纹理模拟宣纸质感；Unity 使用 Shader Graph 水墨风格后处理。',
};

const COZY_IDLE_WORKSHOP: StylePackage = {
  id: 'cozy-idle-workshop',
  name: '休闲工坊舒适',
  applicableGenres: ['放置', '休闲', '经营', '合成'],
  styleKeywords: ['柔和材质', '清楚数值', '轻弹性', '舒适低压', '圆润形状'],
  antiPatterns: [
    '禁止刺眼的纯白/纯黑背景',
    '禁止尖锐的直角边框（全部圆角 8px+）',
    '禁止字体过小（正文 ≥ 14px）',
    '禁止高频闪烁和剧烈震动',
    '禁止信息密度过高',
  ],
  palette: {
    primary: '#a8d8ea',
    accent: '#ffd3b6',
    danger: '#ff8b94',
    background: '#faf3e0',
    surface: '#ffffff',
    textPrimary: '#4a4a4a',
    textSecondary: '#9a9a9a',
    rarity: {
      common: '#c0c0c0',
      uncommon: '#a8d8ea',
      rare: '#aa96da',
      epic: '#ffd3b6',
      legendary: '#f8e473',
    },
  },
  typography: {
    headingFont: 'Nunito / 圆体',
    bodyFont: 'Nunito / 圆体',
    digitFont: 'Nunito Bold',
    titleSize: 22,
    subtitleSize: 16,
    h2Size: 15,
    h3Size: 14,
    bodySize: 14,
    captionSize: 12,
    rules: [
      '全部使用圆体/无衬线字体',
      '正文不小于 14px',
      '数字用 Bold 变体突出',
      '行间距 ≥ 1.5',
    ],
  },
  componentRules: {
    hud: '顶部柔和色条，数值大字居中显示，货币图标可爱圆润风格',
    inventory: '圆角卡片网格，物品图标柔和插画风，选中时轻微放大 + 弹性动画',
    equipmentCard: '柔和阴影卡片，圆角 12px，装备图标居中，名称下方小字',
    dropPopup: '物品从掉落点轻柔弹跳到屏幕中央，弹簧缓动，轻微粒子飘落',
    combatFeedback: '没有传统"伤害数字"，用表情/动画反馈状态变化',
    emptyState: '空状态用柔和插画 + 引导语，如"点击这里开始冒险吧~"',
  },
  motionTokens: BASE_MOTION_TOKENS.filter((t) =>
    ['button-press', 'panel-enter', 'panel-exit', 'item-pickup', 'hover-lift', 'level-up', 'ui-toggle'].includes(t.name),
  ).map((t) => {
    // 休闲风格下将所有动效调整得更柔和
    if (t.id === 'mt-button-press') {
      return { ...t, duration: { ms: 180, label: 'slow-quick' }, description: '按钮按压：轻柔缩小至 97% 后弹回' };
    }
    if (t.id === 'mt-level-up') {
      return { ...t, duration: { ms: 700, label: 'slow' }, easing: 'ease-out' as const, description: '升级：柔和放大 + 数值跳动 + 彩带飘落' };
    }
    return t;
  }),
  raritySlots: [
    {
      tier: 'common', color: '#c0c0c0', glowColor: 'transparent',
      duration: { ms: 0 }, easing: 'linear', description: '普通：无特效',
    },
    {
      tier: 'uncommon', color: '#a8d8ea', glowColor: 'rgba(168,216,234,0.2)',
      duration: { ms: 200 }, easing: 'ease-out', description: '非凡：淡蓝柔光',
    },
    {
      tier: 'rare', color: '#aa96da', glowColor: 'rgba(170,150,218,0.3)',
      duration: { ms: 350 }, easing: 'ease-out', description: '稀有：紫色柔光 + 弹性放大',
    },
    {
      tier: 'epic', color: '#ffd3b6', glowColor: 'rgba(255,211,182,0.4)',
      duration: { ms: 500 }, easing: 'ease-out-back', description: '史诗：粉橙光晕 + 彩带粒子',
    },
    {
      tier: 'legendary', color: '#f8e473', glowColor: 'rgba(248,228,115,0.5)',
      duration: { ms: 700 }, easing: 'ease-out-bounce', description: '传说：金光 + 彩虹粒子 + 全屏庆祝',
    },
  ],
  engineNotes: '全平台保持柔和调性。Web 使用 CSS spring easing；Godot 使用 TRANS_SPRING；Unity 使用 DOTween Ease.OutElastic。粒子数量控制在 20 以内，避免杂乱。',
};

/** 风格包注册表 */
const STYLE_PACKAGES: Record<string, StylePackage> = {
  'pixel-loot-neon': PIXEL_LOOT_NEON,
  'xianxia-ink-premium': XIANXIA_INK_PREMIUM,
  'cozy-idle-workshop': COZY_IDLE_WORKSHOP,
};

/* ===================== Style Director ===================== */

/**
 * 根据游戏类型推荐风格包。
 * 优先级：精确匹配 > 类型匹配 > 默认（pixel-loot-neon）
 */
export function getSuggestedStylePackage(gameType: string, artStyle?: string): string {
  const lower = gameType.toLowerCase();

  // artStyle 显式指定
  if (artStyle) {
    const artLower = artStyle.toLowerCase();
    if (artLower.includes('像素') || artLower.includes('pixel')) return 'pixel-loot-neon';
    if (artLower.includes('水墨') || artLower.includes('国风') || artLower.includes('修仙')) return 'xianxia-ink-premium';
    if (artLower.includes('休闲') || artLower.includes('可爱') || artLower.includes('cozy')) return 'cozy-idle-workshop';
  }

  // gameType 匹配
  if (/loot|arpg|刷宝|地牢|dungeon|像素|动作|战斗/.test(lower)) return 'pixel-loot-neon';
  if (/修仙|国风|仙侠|江湖/.test(lower)) return 'xianxia-ink-premium';
  if (/放置.*休闲|经营|合成|农场|cozy/.test(lower)) return 'cozy-idle-workshop';

  // 默认
  if (/放置|idle/.test(lower)) return 'xianxia-ink-premium';
  return 'pixel-loot-neon';
}

/**
 * 获取风格包定义。
 */
export function getStylePackage(packageId: string): StylePackage {
  return STYLE_PACKAGES[packageId] ?? PIXEL_LOOT_NEON;
}

/**
 * 生成 UI_STYLE_GUIDE.md 内容。
 */
export function generateStyleGuide(pkg: StylePackage, gameName: string): string {
  const rarityTable = pkg.raritySlots
    .map((r) => `| ${r.tier} | \`${r.color}\` | ${r.description} |`)
    .join('\n');

  const motionTable = pkg.motionTokens
    .map((m) => `| ${m.name} | ${m.category} | ${m.duration.ms}ms | ${m.easing} | ${m.description} |`)
    .join('\n');

  const antiList = pkg.antiPatterns.map((a) => `- ${a}`).join('\n');
  const keywordList = pkg.styleKeywords.map((k) => `- ${k}`).join('\n');
  const typoRules = pkg.typography.rules.map((r) => `- ${r}`).join('\n');

  return `# UI Style Guide — ${gameName}

> 风格包：${pkg.name}（\`${pkg.id}\`）
> 生成时间：${new Date().toISOString().split('T')[0]}

## 1. 风格关键词

${keywordList}

## 2. 禁止的反模式

${antiList}

## 3. 配色方案

| 角色 | 色值 |
|------|------|
| 主色 | \`${pkg.palette.primary}\` |
| 强调色 | \`${pkg.palette.accent}\` |
| 危险色 | \`${pkg.palette.danger}\` |
| 背景色 | \`${pkg.palette.background}\` |
| 表面色 | \`${pkg.palette.surface}\` |
| 主文字 | \`${pkg.palette.textPrimary}\` |
| 次文字 | \`${pkg.palette.textSecondary}\` |

### 稀有度颜色

${rarityTable}

## 4. 排版规则

| 层级 | 字号 | 字体 |
|------|------|------|
| 标题 | ${pkg.typography.titleSize}px | ${pkg.typography.headingFont} |
| 副标题 | ${pkg.typography.subtitleSize}px | ${pkg.typography.headingFont} |
| H2 | ${pkg.typography.h2Size}px | ${pkg.typography.headingFont} |
| H3 | ${pkg.typography.h3Size}px | ${pkg.typography.bodyFont} |
| 正文 | ${pkg.typography.bodySize}px | ${pkg.typography.bodyFont} |
| 标注 | ${pkg.typography.captionSize}px | ${pkg.typography.bodyFont} |
| 数字 | — | ${pkg.typography.digitFont} |

### 排版约束

${typoRules}

## 5. 组件规则

### HUD
${pkg.componentRules.hud}

### 背包
${pkg.componentRules.inventory}

### 装备卡
${pkg.componentRules.equipmentCard}

### 掉落弹窗
${pkg.componentRules.dropPopup}

### 战斗反馈
${pkg.componentRules.combatFeedback}

### 空状态
${pkg.componentRules.emptyState}

## 6. 引擎适配备注

${pkg.engineNotes}

## 7. 动效语法（详见 MOTION_GUIDE.md）

| Token | 分类 | 时长 | 缓动 | 描述 |
|-------|------|------|------|------|
${motionTable}
`;
}

/**
 * 生成 MOTION_GUIDE.md 内容。
 */
export function generateMotionGuide(pkg: StylePackage, engine: string): string {
  let engineSection = '';

  if (engine === 'godot' || engine === 'godot-2d') {
    engineSection = `## Godot 4.x 动效实现

所有动效 Token 在 Godot 中的推荐实现方式：

| 需求 | Godot 实现 |
|------|-----------|
| 缩放/位移动画 | \`Tween\` + \`tween_property()\` |
| 序列动画 | \`AnimationPlayer\` + Animation 资源 |
| UI 过渡 | \`Tween\` + Control 节点属性 |
| 粒子效果 | \`GPUParticles2D\` / \`CPUParticles2D\` |
| 颜色/透明度 | \`modulate\` / \`self_modulate\` Tween |
| 主题样式 | \`Theme\` 资源 + \`ThemeTypeVariation\` |

关键约束：
- 动效时长控制在 Token 定义的 duration 范围内
- 使用 \`TRANS_BACK\` / \`TRANS_BOUNCE\` 对应 CSS ease-out-back / ease-out-bounce
- 像素风格禁止亚像素移动，所有 position Tween 取整
- UI 动效在 \`_ready()\` 中设置初始状态，避免首帧闪烁`;
  } else if (engine === 'unity' || engine === 'unity-2d') {
    engineSection = `## Unity 动效实现

所有动效 Token 在 Unity 中的推荐实现方式：

| 需求 | Unity 实现 |
|------|-----------|
| Transform 动画 | DOTween (DOTween Pro) |
| UI 动画 | DOTween + RectTransform / CanvasGroup |
| 动画序列 | Animator + Animation Clip |
| 粒子效果 | ParticleSystem / Shuriken |
| 材质特效 | Shader Graph + MaterialPropertyBlock |
| 主题管理 | ScriptableObject Theme 配置 |

关键约束：
- 优先使用 DOTween，避免 Animator 过度使用
- DOTween.Ease 映射：Ease.OutBack ↔ ease-out-back, Ease.OutBounce ↔ ease-out-bounce
- 像素风格使用 Pixel Perfect Camera (2D Pixel Perfect package)
- Pool 动效对象，避免频繁 Instantiate/Destroy`;
  } else {
    engineSection = `## Web (React + Tailwind) 动效实现

所有动效 Token 在 Web 端的推荐实现方式：

| 需求 | Web 实现 |
|------|---------|
| CSS 过渡 | Tailwind \`transition-*\` + \`duration-*\` |
| CSS 动画 | \`@keyframes\` + \`animation-*\` |
| 复杂动效 | framer-motion / Motion One |
| Canvas 粒子 | PixiJS ParticleContainer |
| SVG 动效 | CSS animation / SMIL |

关键约束：
- GPU 加速属性优先（transform、opacity），避免动画 width/height
- \`will-change\` 仅在动画前后设置，避免内存泄漏
- 60fps 目标：单页面同时在运动元素 ≤ 20`;
  }

  const tokenSection = pkg.motionTokens.map((t) => {
    const staggerInfo = t.stagger
      ? `\n- 交错延迟：基础 ${t.stagger.baseMs}ms + 每个子元素 ${t.stagger.perChildMs}ms`
      : '';
    return `### ${t.id} — ${t.name}

- **分类**：${t.category}
- **时长**：${t.duration.ms}ms${t.duration.label ? ` (${t.duration.label})` : ''}
- **缓动**：${t.easing}
- **描述**：${t.description}${staggerInfo}

**Web**：\`${t.engineNotes.web}\`

**Godot**：\`${t.engineNotes.godot}\`

**Unity**：\`${t.engineNotes.unity}\`
`;
  }).join('\n');

  return `# Motion Guide — ${pkg.name}

> 风格包：${pkg.id}
> 引擎：${engine}
> 生成时间：${new Date().toISOString().split('T')[0]}

## 动效 Token 目录

${tokenSection}

${engineSection}
`;
}

/**
 * 生成完整的 UI_STYLE_GUIDE.md + MOTION_GUIDE.md + ART_DIRECTION.md。
 */
export function generateStyleAndMotion(
  gameType: string,
  gameName: string,
  engine: string,
  artStyle?: string,
): StyleGuideOutput {
  const packageId = getSuggestedStylePackage(gameType, artStyle);
  const pkg = getStylePackage(packageId);

  const result: StyleGuideOutput = {
    styleGuide: generateStyleGuide(pkg, gameName),
    motionGuide: generateMotionGuide(pkg, engine),
    packageId,
  };

  // 修仙/仙侠/RPG 品类自动生成美术方向指南 + 注入质量知识卡规则
  if (/修仙|仙侠|国风|rpg|放置|江湖/.test(gameType.toLowerCase())) {
    const artPkg = getArtDirectionPackage();
    result.artDirection = generateArtDirection(artPkg);

    // 读取 xianxia-idle-quality-bar.json 并注入到 Style Guide
    const qualitySection = buildXianxiaQualitySection();
    if (qualitySection) {
      result.styleGuide += '\n\n---\n\n' + qualitySection;
    }
  }

  return result;
}

/** 导出所有风格包供外部检索 */
export { STYLE_PACKAGES };
