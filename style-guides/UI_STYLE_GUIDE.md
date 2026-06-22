# UI Style Guide — 开发一款游戏

> 风格包：像素刷宝霓虹（`pixel-loot-neon`）
> 生成时间：2026-06-22

## 1. 风格关键词

- 像素边框
- 清晰稀有度
- 短促反馈
- 少量霓虹强调

## 2. 禁止的反模式

- 禁止满屏渐变光效
- 禁止高饱和背景色
- 禁止仙侠页游式金色描边按钮
- 禁止过度模糊和投影（与像素风格冲突）
- 禁止非像素字体的 UI 文字

## 3. 配色方案

| 角色 | 色值 |
|------|------|
| 主色 | `#00ff88` |
| 强调色 | `#ff6b6b` |
| 危险色 | `#ff4444` |
| 背景色 | `#1a1a2e` |
| 表面色 | `#16213e` |
| 主文字 | `#e0e0e0` |
| 次文字 | `#a0a0a0` |

### 稀有度颜色

| common | `#9e9e9e` | 普通：无特效，仅文字颜色区分 |
| uncommon | `#4caf50` | 非凡：绿色描边闪烁 1 次 |
| rare | `#2196f3` | 稀有：蓝色光柱 + 弹跳落地 |
| epic | `#9c27b0` | 史诗：紫色脉冲 + 光柱 + 音效提示 |
| legendary | `#ff9800` | 传说：金橙光柱 + 弹跳 + 全屏暗角 + 文字公告 |

## 4. 排版规则

| 层级 | 字号 | 字体 |
|------|------|------|
| 标题 | 24px | Press Start 2P / pixel font |
| 副标题 | 16px | Press Start 2P / pixel font |
| H2 | 14px | Press Start 2P / pixel font |
| H3 | 12px | monospace / pixel font small |
| 正文 | 10px | monospace / pixel font small |
| 标注 | 8px | monospace / pixel font small |
| 数字 | — | monospace bold |

### 排版约束

- 所有 UI 文字使用像素字体
- 数字使用等宽加粗，确保对齐
- 标题用全大写 + 字间距 2px
- 禁止使用衬线字体

## 5. 组件规则

### HUD
顶部 HP/MP 条用像素细条 + 荧光色填充，左下角技能栏方形图标 3×3 格

### 背包
正方形格子网格 5×n，选中格高亮边框（2px 霓虹色），物品图标像素风

### 装备卡
像素边框卡片，稀有度颜色边框（1-2px），装备槽位形状示意

### 掉落弹窗
掉落弹窗从物品位置飞出到屏幕中央，稀有度光柱（像素粒子），标题闪烁

### 战斗反馈
伤害数字像素字体飘出，暴击加大+震动；受击闪白 3 帧

### 空状态
空状态用像素点阵绘制占位图，下方小字"暂无物品"

## 6. 引擎适配备注

像素风格在 Godot 中使用 Viewport stretch mode=viewport + scale 整数倍；Unity 使用 Pixel Perfect Camera。动效全部在低分辨率下保持清晰，禁止亚像素移动。

## 7. 动效语法（详见 MOTION_GUIDE.md）

| Token | 分类 | 时长 | 缓动 | 描述 |
|-------|------|------|------|------|
| button-press | press | 120ms | ease-out-back | 按钮按压：缩小至 95% 后弹回 100% |
| panel-enter | enter | 250ms | ease-out | 面板进入：从下方向上滑入 + 淡入，子元素依次出现 |
| panel-exit | exit | 180ms | ease-in | 面板退出：淡出 + 轻微上移 |
| item-pickup | reward | 400ms | ease-out-back | 物品拾取：从掉落点飞出至背包/HUD 位置，轻微弹跳 |
| rare-drop | rarity | 600ms | ease-out-bounce | 稀有掉落：发光脉冲 + 掉落弹跳 + 稀有度光柱 |
| combat-hit | combat | 80ms | ease-out | 受击反馈：短暂闪白 + 轻微位移 |
| level-up | upgrade | 500ms | ease-out-back | 升级：全屏脉冲 + 数值飞涨 + 粒子爆发 |
| ui-toggle | ui-toggle | 180ms | ease-in-out | UI 开关：平滑展开/收起 |
