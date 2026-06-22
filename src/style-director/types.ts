/**
 * Motion Token — 动效语法标记系统
 *
 * 为所有引擎（Web/Godot/Unity）提供统一的动效描述语言。
 * Web 端直接映射到 CSS/JS，Godot 端翻译为 Tween/AnimationPlayer，
 * Unity 端翻译为 DOTween/Animator。
 *
 * 设计原则：
 * - 零外部依赖
 * - 每个 token 都是可量化的数值或枚举
 * - engineNotes 描述各引擎的具体实现映射
 */

/* ===================== 动效 Token 核心 ===================== */

/** 缓动函数（对应 CSS easing-function / Godot Tween.TransitionType） */
export type EasingType =
  | 'ease-out'
  | 'ease-in'
  | 'ease-in-out'
  | 'ease-out-back'
  | 'ease-out-bounce'
  | 'linear'
  | 'spring';

/** 动效持续时间（毫秒） */
export interface Duration {
  /** 持续时间 ms */
  ms: number;
  /** 语义标签：用于风格包内引用 */
  label?: string;
}

/** 交错延迟配置 */
export interface Stagger {
  /** 基础延迟 ms */
  baseMs: number;
  /** 每个子元素间隔 ms */
  perChildMs: number;
}

/** 动效 Token — 单个动效语法单元 */
export interface MotionToken {
  /** Token 唯一 ID */
  id: string;
  /** 语义名称，如 'button-press' / 'item-pickup' / 'rare-drop' */
  name: string;
  /** 动效分类 */
  category: MotionCategory;
  /** 持续时间 */
  duration: Duration;
  /** 缓动函数 */
  easing: EasingType;
  /** 交错延迟（列表/网格场景） */
  stagger?: Stagger;
  /** 动效描述（人类可读） */
  description: string;
  /** 各引擎实现说明 */
  engineNotes: EngineMotionNotes;
}

export type MotionCategory =
  | 'enter'       // 进入动画
  | 'exit'        // 退出动画
  | 'hover'       // 悬停/焦点
  | 'press'       // 按钮按压
  | 'reward'      // 奖励/拾取
  | 'rarity'      // 稀有度（按品质差异化）
  | 'combat'      // 战斗反馈
  | 'upgrade'     // 升级/强化
  | 'ui-toggle'   // 面板开关/切换
  | 'background'; // 背景/环境

/** 各引擎实现映射 */
export interface EngineMotionNotes {
  web: string;
  godot: string;
  unity: string;
}

/* ===================== 品质层级对应的稀有度动效 ===================== */

export type RarityTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface RarityMotionSlot {
  tier: RarityTier;
  color: string;
  glowColor: string;
  duration: Duration;
  easing: EasingType;
  description: string;
}

/* ===================== 风格包类型 ===================== */

export interface StylePackage {
  /** 风格包 ID */
  id: string;
  /** 风格包名称 */
  name: string;
  /** 适用游戏类型标签 */
  applicableGenres: string[];
  /** 风格关键词（3-5 个具体词，禁止空泛词） */
  styleKeywords: string[];
  /** 禁止的反模式 */
  antiPatterns: string[];
  /** 配色方案 */
  palette: StylePalette;
  /** 排版规则 */
  typography: TypographyRules;
  /** 组件规则 */
  componentRules: ComponentRules;
  /** 动效语法 */
  motionTokens: MotionToken[];
  /** 稀有度动效 */
  raritySlots: RarityMotionSlot[];
  /** 引擎适配备注 */
  engineNotes: string;
}

export interface StylePalette {
  primary: string;
  accent: string;
  danger: string;
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  rarity: Record<RarityTier, string>;
}

export interface TypographyRules {
  headingFont: string;
  bodyFont: string;
  digitFont: string;
  titleSize: number;
  subtitleSize: number;
  h2Size: number;
  h3Size: number;
  bodySize: number;
  captionSize: number;
  rules: string[];
}

export interface ComponentRules {
  hud: string;
  inventory: string;
  equipmentCard: string;
  dropPopup: string;
  combatFeedback: string;
  emptyState: string;
}

/* ===================== UI Style Guide 生成结果 ===================== */

export interface StyleGuideOutput {
  styleGuide: string;    // UI_STYLE_GUIDE.md 内容
  motionGuide: string;   // MOTION_GUIDE.md 内容
  packageId: string;
  artDirection?: string; // ART_DIRECTION.md 内容
}

/* ===================== Art Direction 相关类型 ===================== */

/** 模块化时装 Slot 清单 */
export interface CostumeSlotManifest {
  /** 剪影定义层（决定角色轮廓） */
  silhouetteSlots: string[];
  /** 稀有度表达层（区分品质与主题） */
  accentSlots: string[];
  /** 完整 Slot 列表 */
  fullSlotList: string[];
  /** 架构描述 */
  description: string;
}

/** 付费时装展示闭环规格 */
export interface FashionOfferSpec {
  /** 必需组件列表 */
  requiredComponents: string[];
  /** 展示闭环描述 */
  description: string;
}

/** 法宝/灵宝视觉四件套规格 */
export interface ArtifactVisualSpec {
  /** 必需组件 */
  requiredComponents: string[];
  /** 视觉闭环描述 */
  description: string;
}

/** 战斗 VFX 管线 */
export interface CombatVfxPipeline {
  /** 管线阶段列表 */
  stages: string[];
  /** 管线描述 */
  description: string;
}

/** 过渡场景原画 Brief */
export interface ScenePaintingBrief {
  /** 场景名称 */
  name: string;
  /** 画面主题 */
  subject: string;
  /** 氛围/情绪 */
  mood: string;
  /** 镜头角度 */
  cameraAngle: string;
  /** UI 安全区说明 */
  uiSafeAreas: string;
  /** 调色板建议 */
  palette: string;
  /** 动画层备注 */
  animationNotes: string;
}

/** Art Direction 风格包 */
export interface ArtDirectionStylePackage {
  id: string;
  name: string;
  applicableGenres: string[];
  costumeSlots: CostumeSlotManifest;
  fashionOfferSpec: FashionOfferSpec;
  artifactVisualSpec: ArtifactVisualSpec;
  combatVfxPipeline: CombatVfxPipeline;
  scenePaintingBriefs: ScenePaintingBrief[];
}

/* ===================== 动效系统预设 Token 集 ===================== */

/** 全品类通用基础动效 Token */
export const BASE_MOTION_TOKENS: MotionToken[] = [
  {
    id: 'mt-button-press',
    name: 'button-press',
    category: 'press',
    duration: { ms: 120, label: 'quick' },
    easing: 'ease-out-back',
    description: '按钮按压：缩小至 95% 后弹回 100%',
    engineNotes: {
      web: 'transform: scale(0.95); transition: transform 120ms ease-out-back',
      godot: 'Tween scale from Vector2(1,1) to Vector2(0.95,0.95) then back, 0.12s, TRANS_BACK',
      unity: 'DOTween: transform.DOScale(0.95f, 0.06f).SetEase(Ease.OutBack).OnComplete(() => transform.DOScale(1f, 0.06f))',
    },
  },
  {
    id: 'mt-panel-enter',
    name: 'panel-enter',
    category: 'enter',
    duration: { ms: 250, label: 'medium' },
    easing: 'ease-out',
    stagger: { baseMs: 40, perChildMs: 30 },
    description: '面板进入：从下方向上滑入 + 淡入，子元素依次出现',
    engineNotes: {
      web: 'opacity 0→1 + translateY 8px→0, stagger via animation-delay',
      godot: 'Tween modulate.a 0→1 + position.y offset, 0.25s, stagger via Tween.interval',
      unity: 'CanvasGroup alpha 0→1 + RectTransform anchoredPosition offset, DOTween stagger',
    },
  },
  {
    id: 'mt-panel-exit',
    name: 'panel-exit',
    category: 'exit',
    duration: { ms: 180, label: 'quick' },
    easing: 'ease-in',
    description: '面板退出：淡出 + 轻微上移',
    engineNotes: {
      web: 'opacity 1→0 + translateY 0→-4px',
      godot: 'Tween modulate.a 1→0 + position.y offset, 0.18s, TRANS_LINEAR',
      unity: 'CanvasGroup alpha 1→0 + slight upward move, 0.18s',
    },
  },
  {
    id: 'mt-item-pickup',
    name: 'item-pickup',
    category: 'reward',
    duration: { ms: 400, label: 'medium' },
    easing: 'ease-out-back',
    description: '物品拾取：从掉落点飞出至背包/HUD 位置，轻微弹跳',
    engineNotes: {
      web: 'CSS transition transform + top/left, ease-out-back 400ms',
      godot: 'Tween position from dropPoint to inventorySlot, 0.4s, TRANS_BACK, EASE_OUT',
      unity: 'DOTween: rectTransform.DOAnchorPos(target, 0.4f).SetEase(Ease.OutBack)',
    },
  },
  {
    id: 'mt-rare-drop',
    name: 'rare-drop',
    category: 'rarity',
    duration: { ms: 600, label: 'long' },
    easing: 'ease-out-bounce',
    description: '稀有掉落：发光脉冲 + 掉落弹跳 + 稀有度光柱',
    engineNotes: {
      web: 'box-shadow glow pulse + translateY bounce, 600ms ease-out-bounce',
      godot: 'Tween modulate pulse + position.y bounce, 0.6s, TRANS_BOUNCE. Light2D/particle beam',
      unity: 'DOTween: scale pulse + bounce, 0.6s. ParticleSystem beam effect',
    },
  },
  {
    id: 'mt-hover-lift',
    name: 'hover-lift',
    category: 'hover',
    duration: { ms: 200, label: 'quick' },
    easing: 'ease-out',
    description: '悬停浮起：卡片轻微上浮 + 阴影加深',
    engineNotes: {
      web: 'transform: translateY(-2px); box-shadow increase. transition 200ms ease-out',
      godot: 'Tween position.y -2px + modulate shadow overlay. 0.2s, TRANS_SINE',
      unity: 'DOTween: rectTransform.DOAnchorPosY(-2f, 0.2f).SetEase(Ease.OutSine)',
    },
  },
  {
    id: 'mt-combat-hit',
    name: 'combat-hit',
    category: 'combat',
    duration: { ms: 80, label: 'instant' },
    easing: 'ease-out',
    description: '受击反馈：短暂闪白 + 轻微位移',
    engineNotes: {
      web: 'filter: brightness(2) 80ms + translateX shake',
      godot: 'modulate = Color.WHITE briefly, Tween position shake, 0.08s',
      unity: 'SpriteRenderer.color flash white, transform.DOShakePosition(0.08f)',
    },
  },
  {
    id: 'mt-level-up',
    name: 'level-up',
    category: 'upgrade',
    duration: { ms: 500, label: 'long' },
    easing: 'ease-out-back',
    description: '升级：全屏脉冲 + 数值飞涨 + 粒子爆发',
    engineNotes: {
      web: 'keyframe pulse + counter tween + particle burst',
      godot: 'AnimationPlayer: scale pulse + counter increment. Particles2D burst',
      unity: 'DOTween: scale pulse (1→1.1→1) + counter increment. ParticleSystem burst',
    },
  },
  {
    id: 'mt-ui-toggle',
    name: 'ui-toggle',
    category: 'ui-toggle',
    duration: { ms: 180, label: 'quick' },
    easing: 'ease-in-out',
    description: 'UI 开关：平滑展开/收起',
    engineNotes: {
      web: 'max-height transition + opacity, 180ms ease-in-out',
      godot: 'Tween rect_size.y + modulate.a, 0.18s',
      unity: 'DOTween: RectTransform.DOSizeDelta + CanvasGroup.DOFade, 0.18f',
    },
  },
];

/** 默认稀有度动效槽（common→legendary 五级） */
export const DEFAULT_RARITY_SLOTS: RarityMotionSlot[] = [
  {
    tier: 'common',
    color: '#9e9e9e',
    glowColor: 'transparent',
    duration: { ms: 0, label: 'none' },
    easing: 'linear',
    description: '普通品质：无特效',
  },
  {
    tier: 'uncommon',
    color: '#4caf50',
    glowColor: 'rgba(76,175,80,0.15)',
    duration: { ms: 150, label: 'quick' },
    easing: 'ease-out',
    description: '非凡品质：淡绿色微光',
  },
  {
    tier: 'rare',
    color: '#2196f3',
    glowColor: 'rgba(33,150,243,0.25)',
    duration: { ms: 300, label: 'medium' },
    easing: 'ease-out',
    description: '稀有品质：蓝色光晕 + 微弹跳',
  },
  {
    tier: 'epic',
    color: '#9c27b0',
    glowColor: 'rgba(156,39,176,0.35)',
    duration: { ms: 500, label: 'long' },
    easing: 'ease-out-back',
    description: '史诗品质：紫色脉冲 + 光柱',
  },
  {
    tier: 'legendary',
    color: '#ff9800',
    glowColor: 'rgba(255,152,0,0.45)',
    duration: { ms: 800, label: 'long' },
    easing: 'ease-out-bounce',
    description: '传说品质：金橙光柱 + 弹跳 + 全屏提示',
  },
];
