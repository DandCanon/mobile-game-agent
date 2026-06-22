---
name: godot
version: 1.0.0
description: Godot Engine 4.x 游戏开发助手
engines:
  - godot-4
triggers:
  - godot
  - gdscript
  - godot engine
  - 2d game
  - 3d game
  - 场景
  - 节点
  - signal
capabilities:
  - GDScript 代码生成（类型安全、静态类型）
  - 场景树设计建议（Node2D/Node3D/Control 层级）
  - Signal 连接与自动订阅
  - Resource 文件生成（.tres 格式）
  - 导出预设（Android/iOS/Web/Desktop）
  - 物理/动画/UI 系统最佳实践
---

# godot

## 身份

Godot Engine 4.x 游戏开发助手 — 为 mgai 补充 Godot 生态系统能力，
使其能辅助 GDScript 代码生成、场景搭建建议、节点树设计和导出配置。

## 触发条件

当用户任务涉及 Godot、GDScript、2D/3D 游戏开发、场景设计、节点操作、
信号连接等关键词时匹配本 Skill。

## 能力边界

### 覆盖范围
- GDScript 2.0 代码生成（类型注解、`@export`、静态类型）
- 场景树设计（Node2D / Node3D / Control 层级关系）
- Signal 连接模式与 AutoLoad 单例
- Resource 文件（.tres）生成
- `.godot` 导出预设配置
- 2D 物理（Area2D / CharacterBody2D / TileMap）
- 3D 物理（CharacterBody3D / Camera3D / 光照）
- 动画系统（AnimationPlayer / AnimationTree）
- UI 系统（Control 节点层级）

### 不覆盖范围
- C# / C++ 绑定开发（GDExtension）
- 自定义渲染管线
- 多人网络同步模块
- Godot 3.x 兼容代码

---

## Godot 4.x 核心概念速览

### 节点 (Node)

Godot 的一切都是节点。每个节点是一个对象，有属性和方法。
节点通过**场景树**组织成层级结构，树根是 `SceneTree`。

| 节点类 | 用途 | 关键属性 |
|--------|------|---------|
| `Node2D` | 2D 场景基类 | `position`, `rotation`, `scale` |
| `Node3D` | 3D 场景基类 | `position`, `rotation`, `scale` |
| `Control` | UI 元素基类 | `anchor`, `margin`, `rect_size` |
| `Area2D` / `Area3D` | 检测区域 | `body_entered`, `area_entered` |
| `CharacterBody2D` / `CharacterBody3D` | 物理角色 | `velocity`, `move_and_slide()` |
| `Sprite2D` / `Sprite3D` | 精灵渲染 | `texture`, `flip_h` |
| `Camera2D` / `Camera3D` | 相机 | `zoom`, `current` |

### 场景 (Scene)

场景是保存为 `.tscn` 文件的节点树。场景可被实例化为其他场景的子节点，
形成"子场景"模式，是 Godot 推荐的项目组织方式。

```
Player.tscn          → 可在 Level.tscn 中实例化
  CharacterBody2D
    Sprite2D
    CollisionShape2D
    AnimationPlayer
```

### 信号 (Signal)

Godot 使用观察者模式：节点发出信号，其他节点连接信号并响应。
这是解耦节点通信的核心机制。

```gdscript
# 声明信号
signal health_changed(new_health: int)

# 发出信号
health_changed.emit(current_health)

# 连接信号（代码方式）
button.pressed.connect(_on_button_pressed)

# 自动连接（通过编辑器 UI 或命名约定）
func _on_area_2d_body_entered(body: Node2D) -> void:
    pass
```

### 资源 (Resource)

`.tres` 文件是 Godot 的资源配置格式，用于定义独立于节点的数据对象。
例如角色属性、道具定义、关卡数据等。

---

## 代码生成约定

### 类型注解

GDScript 2.0 支持静态类型，生成的代码必须包含完整类型注解：

```gdscript
# ✅ 推荐
var speed: float = 200.0
var direction: Vector2 = Vector2.ZERO
func take_damage(amount: int) -> void:
    pass

# ❌ 避免
var speed = 200.0
func take_damage(amount):
    pass
```

### 类名规范

- 文件名使用 `snake_case.gd`
- 类名使用 `class_name` 声明时使用 PascalCase
- 场景根节点脚本命名与场景名一致

```gdscript
# player.gd
class_name Player
extends CharacterBody2D
```

### 文件命名

| 类型 | 命名规则 | 示例 |
|------|---------|------|
| 场景 | `PascalCase.tscn` | `Player.tscn`, `MainMenu.tscn` |
| 脚本 | `snake_case.gd` | `player.gd`, `game_manager.gd` |
| 资源 | `snake_case.tres` | `player_stats.tres` |
| 纹理 | `snake_case.png` | `player_idle.png` |

---

## 常用模式

### 1. 单例 Autoload

在 Project Settings → Autoload 注册，全局访问。

```gdscript
# global/event_bus.gd (Autoload 为 EventBus)
extends Node

signal player_died
signal score_changed(new_score: int)
signal level_complete

# 任意脚本中
EventBus.player_died.emit()
EventBus.player_died.connect(_on_player_died)
```

### 2. 状态机

```gdscript
# player.gd
enum State { IDLE, RUN, JUMP, ATTACK }

var current_state: State = State.IDLE

func _physics_process(delta: float) -> void:
    match current_state:
        State.IDLE:
            _handle_idle(delta)
        State.RUN:
            _handle_run(delta)
        State.JUMP:
            _handle_jump(delta)
```

### 3. 事件总线

通过 Autoload 的全局信号，替代节点间的直接引用：

```gdscript
# 松耦合通信
EventBus.enemy_killed.emit(enemy_position, score_value)
# UI 层
EventBus.enemy_killed.connect(_on_enemy_killed)
```

---

## 性能优化建议

- **对象池**：频繁创建/销毁的场景实例（子弹、敌人）使用对象池复用
- **可见性裁剪**：`VisibleOnScreenNotifier2D` / `VisibleOnScreenEnabler3D` 减少不可见节点计算
- **避免 `_process` 中的重计算**：将路径查找等昂贵操作移到 Timer 或分帧执行
- **TileMap 分层**：大量 TileMap 时使用多个 Layer 而非多个 TileMap 节点
- **Resource 预加载**：使用 `preload()` 而非 `load()` 处理确定的资源定位信息
- **禁用不用的物理处理**：静态装饰性节点关闭 `_physics_process`

---

## 与主 Agent 的协作协议

1. 主 Agent 通过技术选型决策引擎确定本项目使用 Godot 4.x
2. 主 Agent 根据游戏类型（2D/3D）选择对应模板
3. godot Skill 生成 GDScript 脚本和 project.godot 配置
4. godot Skill 返回场景结构建议和节点清单给主 Agent
5. 后续迭代中，主 Agent 将代码修改、场景调整等任务派发回 godot Skill

## 资源关联

- `templates/` — GDScript 模板文件（可选）
- `scripts/` — 辅助脚本（可选）
