import { describe, it, expect } from 'vitest';
import { generateGodot2D, generateGodot3D } from '../orchestration/code-generator';

/* ==================== Godot 2D 代码生成 ==================== */

describe('Godot 2D Code Generator — 输出格式', () => {
  const files = generateGodot2D();

  it('生成 4 个文件', () => {
    expect(files.length).toBe(4);
  });

  it('包含 Main.gd 主场景脚本', () => {
    const main = files.find((f) => f.filePath === 'src/game/Main.gd');
    expect(main).toBeDefined();
    expect(main!.content).toContain('extends Node2D');
    expect(main!.content).toContain('func _ready()');
    expect(main!.content).toContain('func _process(delta');
    expect(main!.content).toContain('func _input(event');
  });

  it('Main.gd 包含相机/玩家/HUD 初始化调用', () => {
    const main = files.find((f) => f.filePath === 'src/game/Main.gd')!;
    expect(main.content).toContain('_setup_camera()');
    expect(main.content).toContain('_setup_tilemap()');
    expect(main.content).toContain('_setup_player()');
    expect(main.content).toContain('_setup_hud()');
    expect(main.content).toContain('_connect_signals()');
  });

  it('包含 player.gd — CharacterBody2D 移动脚本', () => {
    const player = files.find((f) => f.filePath === 'src/game/player.gd');
    expect(player).toBeDefined();
    expect(player!.content).toContain('class_name Player2D');
    expect(player!.content).toContain('extends CharacterBody2D');
    expect(player!.content).toContain('@export var speed');
    expect(player!.content).toContain('@export var jump_velocity');
    expect(player!.content).toContain('move_and_slide()');
    expect(player!.content).toContain('func _physics_process');
  });

  it('player.gd 包含冲刺逻辑', () => {
    const player = files.find((f) => f.filePath === 'src/game/player.gd')!;
    expect(player.content).toContain('is_dashing');
    expect(player.content).toContain('dash_speed');
    expect(player.content).toContain('dash_cooldown');
    expect(player.content).toContain('_start_dash()');
  });

  it('player.gd 包含 Coyote Timer 逻辑', () => {
    const player = files.find((f) => f.filePath === 'src/game/player.gd')!;
    expect(player.content).toContain('coyote_timer');
  });

  it('包含 event_bus.gd — 全局事件总线', () => {
    const bus = files.find((f) => f.filePath === 'src/game/global/event_bus.gd');
    expect(bus).toBeDefined();
    expect(bus!.content).toContain('extends Node');
    expect(bus!.content).toContain('signal game_started');
    expect(bus!.content).toContain('signal game_over');
    expect(bus!.content).toContain('signal player_died');
    expect(bus!.content).toContain('signal score_changed');
    expect(bus!.content).toContain('signal level_complete');
  });

  it('event_bus.gd 至少定义 8 个 signal', () => {
    const bus = files.find((f) => f.filePath === 'src/game/global/event_bus.gd')!;
    const signalCount = (bus.content.match(/^signal /gm) || []).length;
    expect(signalCount).toBeGreaterThanOrEqual(8);
  });

  describe('project.godot 结构验证', () => {
    const projectGodot = files.find((f) => f.filePath === 'project.godot')!;

    it('project.godot 存在', () => {
      expect(projectGodot).toBeDefined();
    });

    it('含 config_version=5', () => {
      expect(projectGodot.content).toMatch(/config_version\s*=\s*5/);
    });

    it('含应用名和主场景', () => {
      expect(projectGodot.content).toContain('config/name="Godot2DGame"');
      expect(projectGodot.content).toContain('config/run/main_scene="res://src/game/Main.tscn"');
    });

    it('含 2.0 feature', () => {
      expect(projectGodot.content).toContain('"2.0"');
    });

    it('含 Autoload 注册 EventBus', () => {
      expect(projectGodot.content).toContain('[autoload]');
      expect(projectGodot.content).toMatch(/EventBus\s*=\s*"\*res:\/\/src\/game\/global\/event_bus\.gd"/);
    });

    it('含 display 分辨率设置', () => {
      expect(projectGodot.content).toContain('1280');
      expect(projectGodot.content).toContain('720');
    });

    it('含 canvas_items 拉伸模式', () => {
      expect(projectGodot.content).toContain('canvas_items');
    });

    it('含 2D 物理重力设置', () => {
      expect(projectGodot.content).toContain('[physics]');
      expect(projectGodot.content).toContain('2d/default_gravity');
    });

    it('含 forward_plus 渲染方法', () => {
      expect(projectGodot.content).toContain('forward_plus');
    });

    it('含 move_left / move_right / jump / dash 输入映射', () => {
      expect(projectGodot.content).toContain('move_left');
      expect(projectGodot.content).toContain('move_right');
      expect(projectGodot.content).toContain('jump');
      expect(projectGodot.content).toContain('dash');
    });

    it('含 [editor_plugins] 节', () => {
      expect(projectGodot.content).toContain('[editor_plugins]');
    });

    it('.gd 文件使用 Tab 缩进（非空格）', () => {
      for (const f of files) {
        if (f.filePath.endsWith('.gd')) {
          // event_bus.gd 只含 signal 声明无缩进，跳过
          if (f.filePath.includes('event_bus')) continue;
          expect(f.content).toContain('\t');
        }
      }
    });
  });
});

/* ==================== Godot 3D 代码生成 ==================== */

describe('Godot 3D Code Generator — 输出格式', () => {
  const files = generateGodot3D();

  it('生成 4 个文件', () => {
    expect(files.length).toBe(4);
  });

  it('包含 Main3D.gd 主场景脚本', () => {
    const main = files.find((f) => f.filePath === 'src/game/Main3D.gd');
    expect(main).toBeDefined();
    expect(main!.content).toContain('extends Node3D');
    expect(main!.content).toContain('func _ready()');
    expect(main!.content).toContain('func _process(_delta');
    expect(main!.content).toContain('func _physics_process(_delta');
  });

  it('Main3D.gd 包含光照和相机初始化', () => {
    const main = files.find((f) => f.filePath === 'src/game/Main3D.gd')!;
    expect(main.content).toContain('_setup_camera()');
    expect(main.content).toContain('_setup_lights()');
    expect(main.content).toContain('DirectionalLight3D');
    expect(main.content).toContain('WorldEnvironment');
  });

  it('包含 player_3d.gd — CharacterBody3D + Camera3D', () => {
    const player = files.find((f) => f.filePath === 'src/game/player_3d.gd');
    expect(player).toBeDefined();
    expect(player!.content).toContain('class_name Player3D');
    expect(player!.content).toContain('extends CharacterBody3D');
    expect(player!.content).toContain('Camera3D');
    expect(player!.content).toContain('SpringArm3D');
  });

  it('player_3d.gd 包含 WASD 移动和第三人称相机', () => {
    const player = files.find((f) => f.filePath === 'src/game/player_3d.gd')!;
    expect(player.content).toContain('move_forward');
    expect(player.content).toContain('move_back');
    expect(player.content).toContain('mouse_sensitivity');
    expect(player.content).toContain('MOUSE_MODE_CAPTURED');
  });

  it('player_3d.gd 包含冲刺和加速度', () => {
    const player = files.find((f) => f.filePath === 'src/game/player_3d.gd')!;
    expect(player.content).toContain('sprint_speed');
    expect(player.content).toContain('acceleration');
    expect(player.content).toContain('move_toward');
  });

  it('包含 event_bus_3d.gd — 事件总线', () => {
    const bus = files.find((f) => f.filePath === 'src/game/global/event_bus_3d.gd');
    expect(bus).toBeDefined();
    expect(bus!.content).toContain('extends Node');
    expect(bus!.content).toContain('signal game_started');
    expect(bus!.content).toContain('signal game_over');
    expect(bus!.content).toContain('signal player_died');
    expect(bus!.content).toContain('signal score_changed');
    expect(bus!.content).toContain('signal level_complete');
    expect(bus!.content).toContain('signal item_collected');
    expect(bus!.content).toContain('signal client_connected');
  });

  it('event_bus_3d.gd 至少 6 个 signal 含多人在线预留', () => {
    const bus = files.find((f) => f.filePath === 'src/game/global/event_bus_3d.gd')!;
    const signalCount = (bus.content.match(/^signal /gm) || []).length;
    expect(signalCount).toBeGreaterThanOrEqual(8);
  });

  describe('project.godot 结构验证 (3D)', () => {
    const projectGodot = files.find((f) => f.filePath === 'project.godot')!;

    it('project.godot 存在', () => {
      expect(projectGodot).toBeDefined();
    });

    it('含 config_version=5', () => {
      expect(projectGodot.content).toMatch(/config_version\s*=\s*5/);
    });

    it('含 3D 应用名和主场景', () => {
      expect(projectGodot.content).toContain('config/name="Godot3DGame"');
      expect(projectGodot.content).toContain('config/run/main_scene="res://src/game/Main3D.tscn"');
    });

    it('含 3.0 feature', () => {
      expect(projectGodot.content).toContain('"3.0"');
    });

    it('含 Autoload 注册 EventBus3D', () => {
      expect(projectGodot.content).toContain('[autoload]');
      expect(projectGodot.content).toMatch(/EventBus3D\s*=\s*"\*res:\/\/src\/game\/global\/event_bus_3d\.gd"/);
    });

    it('含 1080p 分辨率和 vsync 配置', () => {
      expect(projectGodot.content).toContain('1920');
      expect(projectGodot.content).toContain('1080');
      expect(projectGodot.content).toContain('vsync');
    });

    it('含 3D 物理重力设置', () => {
      expect(projectGodot.content).toContain('[physics]');
      expect(projectGodot.content).toContain('3d/default_gravity');
    });

    it('含 3D 渲染设置 — MSAA 和 SSA', () => {
      const content = projectGodot.content;
      expect(content).toContain('[rendering]');
      expect(content).toContain('msaa_3d');
      expect(content).toContain('screen_space_aa');
      expect(content).toContain('shadow_atlas');
    });

    it('含 forward_plus 渲染器', () => {
      expect(projectGodot.content).toContain('forward_plus');
    });

    it('含 WASD + jump + sprint 输入映射', () => {
      const content = projectGodot.content;
      expect(content).toContain('move_left');
      expect(content).toContain('move_right');
      expect(content).toContain('move_forward');
      expect(content).toContain('move_back');
      expect(content).toContain('jump');
      expect(content).toContain('sprint');
    });

    it('含 [editor_plugins] 节', () => {
      expect(projectGodot.content).toContain('[editor_plugins]');
    });
  });
});

/* ==================== 交叉验证 ==================== */

describe('Godot 2D/3D 交叉验证', () => {
  it('2D 和 3D 生成不同的 Main 脚本', () => {
    const files2D = generateGodot2D();
    const files3D = generateGodot3D();
    const main2D = files2D.find((f) => f.filePath === 'src/game/Main.gd')!.content;
    const main3D = files3D.find((f) => f.filePath === 'src/game/Main3D.gd')!.content;
    expect(main2D).not.toBe(main3D);
  });

  it('2D 使用 Node2D/CharacterBody2D，3D 使用 Node3D/CharacterBody3D', () => {
    const files2D = generateGodot2D();
    const files3D = generateGodot3D();

    const all2D = files2D.map((f) => f.content).join('\n');
    const all3D = files3D.map((f) => f.content).join('\n');

    expect(all2D).toContain('Node2D');
    expect(all2D).not.toContain('CharacterBody3D');
    expect(all3D).toContain('Node3D');
    expect(all3D).not.toContain('CharacterBody2D');
  });

  it('2D project.godot 不含 3D 专属渲染参数', () => {
    const files2D = generateGodot2D();
    const pg2D = files2D.find((f) => f.filePath === 'project.godot')!.content;
    expect(pg2D).not.toContain('msaa_3d');
    expect(pg2D).not.toContain('screen_space_aa');
  });

  it('3D project.godot 不含 2D 专属渲染参数', () => {
    const files3D = generateGodot3D();
    const pg3D = files3D.find((f) => f.filePath === 'project.godot')!.content;
    expect(pg3D).not.toContain('msaa_2d');
    expect(pg3D).not.toContain('canvas_items');
  });

  it('所有 .gd 文件都以 extends 声明开头', () => {
    for (const gen of [generateGodot2D, generateGodot3D]) {
      for (const f of gen()) {
        if (f.filePath.endsWith('.gd')) {
          expect(f.content).toMatch(/^extends /m);
        }
      }
    }
  });
});
