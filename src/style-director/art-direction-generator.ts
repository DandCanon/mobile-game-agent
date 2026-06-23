/**
 * Art Direction Generator — 美术方向指南生成器
 *
 * 职责：
 * 1. 生成 docs/ART_DIRECTION.md，使用项目内公开安全的通用美术方向启发式
 * 2. 输出：模块化时装 Slot 清单、付费时装展示闭环、法宝视觉四件套、战斗 VFX 分类、ScenePaintingBrief 模板
 * 3. 严格禁止复制或嵌入第三方原始素材、路径、反编译数据或私有参考数据
 */

import type { ArtDirectionStylePackage } from './types';

/* ===================== 默认 Art Direction 风格包 ===================== */

const DEFAULT_ART_DIRECTION: ArtDirectionStylePackage = {
  id: 'xianxia-art-direction',
  name: '修仙美术方向',
  applicableGenres: ['修仙', '仙侠', '放置', 'RPG', '国风'],
  costumeSlots: {
    silhouetteSlots: ['hair', 'cloth', 'top'],
    accentSlots: ['hat', 'ear', 'decorate', 'mask', 'bodyglow', 'tattoo'],
    fullSlotList: [
      'hair',
      'cloth',
      'hat',
      'ear',
      'top',
      'decorate',
      'mask',
      'bodyglow',
      'tattoo',
    ],
    description:
      '角色采用模块化 slot 架构：剪影定义层 (hair/cloth/top) 决定角色轮廓；稀有度表达层 (ear/decorate/mask/bodyglow/tattoo) 区分品质与主题。',
  },
  fashionOfferSpec: {
    requiredComponents: [
      'previewScene',
      'cardBg',
      'revealMotion',
      'rarityVfx',
      'shopEntry',
      'ownedState',
    ],
    description:
      '付费时装需要完整展示闭环：预览场景(previewScene) → 卡片背景(cardBg) → 揭示动效(revealMotion) → 稀有度特效(rarityVfx) → 商店入口(shopEntry) → 已拥有状态(ownedState)。',
  },
  artifactVisualSpec: {
    requiredComponents: [
      'icon',
      'detailCard',
      'entityengine template',
      'idleMotion',
      'skillVFX',
      'awakenVFX',
    ],
    description:
      '法宝/灵宝需要视觉四件套：图标(icon) → 详情卡片(detailCard) → 实体预制体(entityengine template) → 待机动效(idleMotion) → 技能特效(skillVFX) → 觉醒特效(awakenVFX)。',
  },
  combatVfxPipeline: {
    stages: [
      'anticipation',
      'trail',
      'impact',
      'hitFlash',
      'buff',
      'debuff',
      'uiNumberFeedback',
    ],
    description:
      '战斗 VFX 分为七阶段管线：前摇提示(anticipation) → 弹道/拖尾(trail) → 命中冲击(impact) → 受击闪白(hitFlash) → 增益标记(buff) → 减益标记(debuff) → UI 数值反馈(uiNumberFeedback)。',
  },
  scenePaintingBriefs: [
    {
      name: '境界突破',
      subject: '修仙者境界突破',
      mood: '震撼、升华、天地共鸣',
      cameraAngle: '仰角或平视主角全身',
      uiSafeAreas: '顶部 15% 留标题区，底部 10% 留确认按钮区',
      palette: '以主角属性色为主，环境色由暗转明',
      animationNotes: '祥云汇聚、光柱冲天、境界文字浮现',
    },
    {
      name: '秘境进入',
      subject: '秘境入口开启',
      mood: '神秘、未知、探索欲',
      cameraAngle: '正面平视或轻微俯角展示入口全貌',
      uiSafeAreas: '中央 60% 留秘境名称和难度选择区',
      palette: '暗色基调配发光入口轮廓',
      animationNotes: '入口光纹流转、粒子向内吸入',
    },
    {
      name: 'Boss',
      subject: 'Boss 登场',
      mood: '压迫感、威胁、史诗感',
      cameraAngle: '仰角强调 Boss 体型，主角在画面下方 1/3',
      uiSafeAreas: '顶部留 Boss 名称血条区',
      palette: '暗红/暗紫基调，Boss 局部高亮',
      animationNotes: '屏幕震动、Boss 咆哮粒子、UI 血条渐显',
    },
    {
      name: '时装展示',
      subject: '时装/外观展示',
      mood: '优雅、华丽、收藏欲',
      cameraAngle: '360° 旋转展示台视角',
      uiSafeAreas: '中央主角展示区，底部购买/预览按钮区',
      palette: '深色背景突出时装主体，稀有度对应光效',
      animationNotes: '角色缓慢旋转、时装部件依次高亮、稀有度边框呼吸',
    },
    {
      name: '法宝觉醒',
      subject: '法宝/灵宝觉醒',
      mood: '神圣、力量觉醒、蜕变',
      cameraAngle: '特写法宝主体，镜头由近拉远',
      uiSafeAreas: '顶部法宝名称，底部属性变化对比区',
      palette: '法宝属性色渐变，觉醒前后明暗对比',
      animationNotes: '法宝破裂/重组动画、属性数值跳动、觉醒 VFX 爆发',
    },
    {
      name: '活动开启',
      subject: '限时活动开幕',
      mood: '热闹、紧迫、节日感',
      cameraAngle: '全景展示活动场景',
      uiSafeAreas: '中央活动标题，底部倒计时和入口按钮',
      palette: '活动主题色为主，明亮高饱和',
      animationNotes: '烟花/花瓣粒子、倒计时数字跳动、奖励预览轮播',
    },
  ],
};

/* ===================== 生成器 ===================== */

/**
 * 生成 ART_DIRECTION.md 内容。
 */
export function generateArtDirection(
  pkg: ArtDirectionStylePackage = DEFAULT_ART_DIRECTION,
): string {
  const costumeSlotsTable = pkg.costumeSlots.fullSlotList
    .map((slot) => {
      const isSilhouette = pkg.costumeSlots.silhouetteSlots.includes(slot);
      const isAccent = pkg.costumeSlots.accentSlots.includes(slot);
      const role =
        isSilhouette && isAccent
          ? '剪影+稀有度'
          : isSilhouette
            ? '剪影定义'
            : '稀有度表达';
      return `| \`${slot}\` | ${role} |`;
    })
    .join('\n');

  const fashionTable = pkg.fashionOfferSpec.requiredComponents
    .map((c) => `| \`${c}\` |`)
    .join('\n');

  const artifactTable = pkg.artifactVisualSpec.requiredComponents
    .map((c) => `| \`${c}\` |`)
    .join('\n');

  const vfxTable = pkg.combatVfxPipeline.stages
    .map((s) => `| \`${s}\` |`)
    .join('\n');

  const sceneList = pkg.scenePaintingBriefs
    .map(
      (b) => `### ${b.name}

| 属性 | 值 |
|------|-----|
| 主题 | ${b.subject} |
| 氛围 | ${b.mood} |
| 镜头角度 | ${b.cameraAngle} |
| UI 安全区 | ${b.uiSafeAreas} |
| 调色板 | ${b.palette} |
| 动画层 | ${b.animationNotes} |
`,
    )
    .join('\n');

  return `# Art Direction — ${pkg.name}

> 风格包：\`${pkg.id}\`
> 生成时间：${new Date().toISOString().split('T')[0]}
> 来源：mgai public-safe generic art heuristics

## 1. 概述

本文档定义了修仙手游的美术方向指南，基于项目内通用设计启发式生成，不包含第三方原始素材、素材路径、反编译数据或私有参考数据。

严格禁止：
- 不复制第三方原始贴图、Spine、engine template、runtime script 字节或素材路径
- 不反编译或还原第三方商业数值
- 不把低清预览图或可识别素材定位信息写入模板
- 仅使用项目自有或公开安全的结构、命名、制作管线和设计原则

## 2. 模块化时装

### 2.1 Slot 架构

${pkg.costumeSlots.description}

| Slot | 角色 |
|------|------|
${costumeSlotsTable}

### 2.2 设计原则

- 付费时装按可替换 slot 组合设计，而非单张全身皮肤
- 剪影定义层 (hair/cloth/top) 决定角色轮廓
- 稀有度表达层 (ear/decorate/mask/bodyglow/tattoo) 区分品质与主题
- bodyglow、mask、tattoo 保留给高稀有度/付费视觉差异化
- 每套时装产出风格指南：剪影、材质、主题纹样、稀有度 VFX、色彩协调、UI 卡片展示

### 2.3 付费时装展示闭环

${pkg.fashionOfferSpec.description}

| 组件 |
|------|
${fashionTable}

## 3. 法宝 / 灵宝视觉四件套

${pkg.artifactVisualSpec.description}

| 组件 |
|------|
${artifactTable}

### 设计原则

- 法宝按剪影和运动轨迹区分家族（飞剑/宝珠/幡旗/印玺/古宝），不仅靠颜色
- 法宝进阶支持：解锁、觉醒、技能预览、代币商店、槽位/装备状态
- 粒子与拖尾遮罩赋予法宝生命感，但保持 UI 卡片可读性
- 生成游戏中定义 ArtifactVisualSpec：图标、卡片边框、实体预制体、待机动效、技能 VFX、觉醒 VFX、稀有度调色板

## 4. 战斗 VFX 分类

${pkg.combatVfxPipeline.description}

| 阶段 |
|------|
${vfxTable}

### 设计原则

- 武器/技能线使用一致后缀：preview、skill、hit、trail、idle、awaken
- UI 奖励特效与战斗特效分离（时长、亮度、运动曲线不同）
- 受击特效保持短暂且保护剪影（移动端可读性）
- 大型 VFX 仅用于大招、觉醒或稀有掉落
- 每个战斗特性产出 GameFeelChecklist

## 5. ScenePaintingBrief 模板

高价值系统需要使用插画级过渡场景，而非功能菜单。过渡场景用于建立氛围和奖励幻想。

${sceneList}

## 6. UI 四层视觉架构

| 层 | 职责 | 示例 |
|----|------|------|
| Window | 全屏窗口预制体 | 商城窗口、背包窗口 |
| WindowAssets | 窗口专属资源（图集/背景） | 窗口背景 1024x2048 |
| Commonengine template | 可复用 UI 控件 | 物品图标、列表单元格、通用按钮 |
| Effects | UI 特效预制体 | 掉落光柱、稀有度边框、升级粒子 |

## 7. 反模式清单

- 禁止页游式金色描边按钮和廉价光效
- 禁止满屏飘字（移动端可读性优先）
- 禁止高饱和配色（修仙题材保持克制）
- 禁止超过 3 种主色同时出现
- 禁止用渐变色卡替代真实插画（高价值入口场景）
- 禁止在时装 UI 中使用普通背包页面的视觉框架
`;
}

/**
 * 获取默认的 Art Direction 风格包。
 */
export function getArtDirectionPackage(): ArtDirectionStylePackage {
  return DEFAULT_ART_DIRECTION;
}
