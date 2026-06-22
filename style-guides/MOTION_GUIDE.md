# Motion Guide — 像素刷宝霓虹

> 风格包：pixel-loot-neon
> 引擎：godot
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

### mt-rare-drop — rare-drop

- **分类**：rarity
- **时长**：600ms (long)
- **缓动**：ease-out-bounce
- **描述**：稀有掉落：发光脉冲 + 掉落弹跳 + 稀有度光柱

**Web**：`box-shadow glow pulse + translateY bounce, 600ms ease-out-bounce`

**Godot**：`Tween modulate pulse + position.y bounce, 0.6s, TRANS_BOUNCE. Light2D/particle beam`

**Unity**：`DOTween: scale pulse + bounce, 0.6s. ParticleSystem beam effect`

### mt-combat-hit — combat-hit

- **分类**：combat
- **时长**：80ms (instant)
- **缓动**：ease-out
- **描述**：受击反馈：短暂闪白 + 轻微位移

**Web**：`filter: brightness(2) 80ms + translateX shake`

**Godot**：`modulate = Color.WHITE briefly, Tween position shake, 0.08s`

**Unity**：`SpriteRenderer.color flash white, transform.DOShakePosition(0.08f)`

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


## Godot 4.x 动效实现

所有动效 Token 在 Godot 中的推荐实现方式：

| 需求 | Godot 实现 |
|------|-----------|
| 缩放/位移动画 | `Tween` + `tween_property()` |
| 序列动画 | `AnimationPlayer` + Animation 资源 |
| UI 过渡 | `Tween` + Control 节点属性 |
| 粒子效果 | `GPUParticles2D` / `CPUParticles2D` |
| 颜色/透明度 | `modulate` / `self_modulate` Tween |
| 主题样式 | `Theme` 资源 + `ThemeTypeVariation` |

关键约束：
- 动效时长控制在 Token 定义的 duration 范围内
- 使用 `TRANS_BACK` / `TRANS_BOUNCE` 对应 CSS ease-out-back / ease-out-bounce
- 像素风格禁止亚像素移动，所有 position Tween 取整
- UI 动效在 `_ready()` 中设置初始状态，避免首帧闪烁
