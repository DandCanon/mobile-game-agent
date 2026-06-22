# Motion Guide — 修仙水墨典雅

> 风格包：xianxia-ink-premium
> 引擎：react-vite-tailwind
> 生成时间：2026-06-22

## 动效 Token 目录

### mt-button-press — button-press

- **分类**：press
- **时长**：120ms (quick)
- **缓动**：ease-out-back
- **描述**：按钮按压：缩小至 95% 后弹回 100%

**Web**：`transform: scale(0.95); transition: transform 120ms ease-out-back`

**Godot**：`Tween scale from Vector2(1,1) to Vector2(0.95,0.95) then back, 0.12s, TRANS_BACK`

**Unity**：`DOTween: transform.DOScale(0.95f, 0.06f).SetEase(Ease.OutBack).OnComplete(() => transform.DOScale(1f, 0.06f))`

### mt-panel-enter — panel-enter

- **分类**：enter
- **时长**：250ms (medium)
- **缓动**：ease-out
- **描述**：面板进入：从下方向上滑入 + 淡入，子元素依次出现
- 交错延迟：基础 40ms + 每个子元素 30ms

**Web**：`opacity 0→1 + translateY 8px→0, stagger via animation-delay`

**Godot**：`Tween modulate.a 0→1 + position.y offset, 0.25s, stagger via Tween.interval`

**Unity**：`CanvasGroup alpha 0→1 + RectTransform anchoredPosition offset, DOTween stagger`

### mt-panel-exit — panel-exit

- **分类**：exit
- **时长**：180ms (quick)
- **缓动**：ease-in
- **描述**：面板退出：淡出 + 轻微上移

**Web**：`opacity 1→0 + translateY 0→-4px`

**Godot**：`Tween modulate.a 1→0 + position.y offset, 0.18s, TRANS_LINEAR`

**Unity**：`CanvasGroup alpha 1→0 + slight upward move, 0.18s`

### mt-item-pickup — item-pickup

- **分类**：reward
- **时长**：400ms (medium)
- **缓动**：ease-out-back
- **描述**：物品拾取：从掉落点飞出至背包/HUD 位置，轻微弹跳

**Web**：`CSS transition transform + top/left, ease-out-back 400ms`

**Godot**：`Tween position from dropPoint to inventorySlot, 0.4s, TRANS_BACK, EASE_OUT`

**Unity**：`DOTween: rectTransform.DOAnchorPos(target, 0.4f).SetEase(Ease.OutBack)`

### mt-hover-lift — hover-lift

- **分类**：hover
- **时长**：200ms (quick)
- **缓动**：ease-out
- **描述**：悬停浮起：卡片轻微上浮 + 阴影加深

**Web**：`transform: translateY(-2px); box-shadow increase. transition 200ms ease-out`

**Godot**：`Tween position.y -2px + modulate shadow overlay. 0.2s, TRANS_SINE`

**Unity**：`DOTween: rectTransform.DOAnchorPosY(-2f, 0.2f).SetEase(Ease.OutSine)`

### mt-level-up — level-up

- **分类**：upgrade
- **时长**：500ms (long)
- **缓动**：ease-out-back
- **描述**：升级：全屏脉冲 + 数值飞涨 + 粒子爆发

**Web**：`keyframe pulse + counter tween + particle burst`

**Godot**：`AnimationPlayer: scale pulse + counter increment. Particles2D burst`

**Unity**：`DOTween: scale pulse (1→1.1→1) + counter increment. ParticleSystem burst`

### mt-ui-toggle — ui-toggle

- **分类**：ui-toggle
- **时长**：180ms (quick)
- **缓动**：ease-in-out
- **描述**：UI 开关：平滑展开/收起

**Web**：`max-height transition + opacity, 180ms ease-in-out`

**Godot**：`Tween rect_size.y + modulate.a, 0.18s`

**Unity**：`DOTween: RectTransform.DOSizeDelta + CanvasGroup.DOFade, 0.18f`


## Web (React + Tailwind) 动效实现

所有动效 Token 在 Web 端的推荐实现方式：

| 需求 | Web 实现 |
|------|---------|
| CSS 过渡 | Tailwind `transition-*` + `duration-*` |
| CSS 动画 | `@keyframes` + `animation-*` |
| 复杂动效 | framer-motion / Motion One |
| Canvas 粒子 | PixiJS ParticleContainer |
| SVG 动效 | CSS animation / SMIL |

关键约束：
- GPU 加速属性优先（transform、opacity），避免动画 width/height
- `will-change` 仅在动画前后设置，避免内存泄漏
- 60fps 目标：单页面同时在运动元素 ≤ 20
