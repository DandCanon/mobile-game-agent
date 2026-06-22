import { describe, it, expect } from 'vitest';
import { generateUnity2D, generateUnity3D } from '../orchestration/code-generator';

/* ==================== Unity 2D 代码生成 ==================== */

describe('Unity 2D Code Generator — 输出格式', () => {
  const files = generateUnity2D();

  it('生成 4 个文件', () => {
    expect(files.length).toBe(4);
  });

  describe('PlayerController2D.cs', () => {
    const pc = files.find((f) => f.filePath === 'src/game/PlayerController2D.cs')!;

    it('文件存在', () => {
      expect(pc).toBeDefined();
    });

    it('含正确的 namespace', () => {
      expect(pc.content).toContain('namespace Game.Player');
    });

    it('继承 MonoBehaviour', () => {
      expect(pc.content).toContain(': MonoBehaviour');
    });

    it('含 [RequireComponent] 约束', () => {
      expect(pc.content).toContain('[RequireComponent(typeof(Rigidbody2D))]');
      expect(pc.content).toContain('[RequireComponent(typeof(Collider2D))]');
    });

    it('含 using UnityEngine', () => {
      expect(pc.content).toContain('using UnityEngine;');
    });

    it('含 using UnityEngine.InputSystem', () => {
      expect(pc.content).toContain('using UnityEngine.InputSystem;');
    });

    it('含 [SerializeField] 属性', () => {
      // Check for at least 5 SerializeField decorations
      const count = (pc.content.match(/\[SerializeField\]/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(5);
    });

    it('含 OnMove InputSystem 回调', () => {
      expect(pc.content).toContain('public void OnMove(InputAction.CallbackContext context)');
    });

    it('含 OnJump InputSystem 回调', () => {
      expect(pc.content).toContain('public void OnJump(InputAction.CallbackContext context)');
    });

    it('含 FixedUpdate 方法', () => {
      expect(pc.content).toContain('private void FixedUpdate()');
    });

    it('含 coyote / jump buffer 逻辑', () => {
      expect(pc.content).toContain('coyoteTime');
      expect(pc.content).toContain('jumpBufferTime');
    });
  });

  describe('GameManager.cs', () => {
    const gm = files.find((f) => f.filePath === 'src/game/GameManager.cs')!;

    it('文件存在', () => {
      expect(gm).toBeDefined();
    });

    it('含正确的 namespace', () => {
      expect(gm.content).toContain('namespace Game.Core');
    });

    it('单例模式 — static Instance', () => {
      expect(gm.content).toContain('public static GameManager Instance');
    });

    it('DontDestroyOnLoad 持久化', () => {
      expect(gm.content).toContain('DontDestroyOnLoad');
    });

    it('含 Awake 单例初始化逻辑', () => {
      expect(gm.content).toContain('if (Instance != null && Instance != this)');
    });

    it('含 LoadLevel 场景切换方法', () => {
      expect(gm.content).toContain('SceneManager.LoadScene');
    });

    it('含 AddScore 分数管理方法', () => {
      expect(gm.content).toContain('public void AddScore(int points)');
    });

    it('含 OnScoreChanged UnityEvent', () => {
      expect(gm.content).toContain('UnityEvent<int> OnScoreChanged');
    });
  });

  describe('ObjectPool.cs', () => {
    const pool = files.find((f) => f.filePath === 'src/game/ObjectPool.cs')!;

    it('文件存在', () => {
      expect(pool).toBeDefined();
    });

    it('含正确的 namespace', () => {
      expect(pool.content).toContain('namespace Game.Utils');
    });

    it('泛型类 ObjectPool<T> where T : Component', () => {
      expect(pool.content).toContain('class ObjectPool<T>');
      expect(pool.content).toContain('where T : Component');
    });

    it('含 Queue<T> 内部存储', () => {
      expect(pool.content).toContain('Queue<T> _pool');
    });

    it('含 Get() 方法', () => {
      expect(pool.content).toContain('public T Get()');
    });

    it('含 Return(T) 方法', () => {
      expect(pool.content).toContain('public void Return(T obj)');
    });

    it('含 Clear() 方法', () => {
      expect(pool.content).toContain('public void Clear()');
    });
  });

  describe('EventBus.cs', () => {
    const bus = files.find((f) => f.filePath === 'src/game/EventBus.cs')!;

    it('文件存在', () => {
      expect(bus).toBeDefined();
    });

    it('静态类', () => {
      expect(bus.content).toContain('public static class EventBus');
    });

    it('至少定义 8 个 UnityEvent', () => {
      const count = (bus.content.match(/UnityEvent/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(8);
    });

    it('含 ClearAll 方法', () => {
      expect(bus.content).toContain('public static void ClearAll()');
    });

    it('含 RemoveAllListeners 注销调用', () => {
      expect(bus.content).toContain('RemoveAllListeners()');
    });

    it('文件名遵循 PascalCase', () => {
      expect(bus.filePath).toBe('src/game/EventBus.cs');
    });
  });
});

/* ==================== Unity 3D 代码生成 ==================== */

describe('Unity 3D Code Generator — 输出格式', () => {
  const files = generateUnity3D();

  it('生成 5 个文件', () => {
    expect(files.length).toBe(5);
  });

  describe('PlayerController3D.cs', () => {
    const pc = files.find((f) => f.filePath === 'src/game/PlayerController3D.cs')!;

    it('文件存在', () => {
      expect(pc).toBeDefined();
    });

    it('含正确的 namespace', () => {
      expect(pc.content).toContain('namespace Game.Player');
    });

    it('继承 MonoBehaviour', () => {
      expect(pc.content).toContain(': MonoBehaviour');
    });

    it('使用 CharacterController', () => {
      expect(pc.content).toContain('CharacterController');
      expect(pc.content).toContain('[RequireComponent(typeof(CharacterController))]');
    });

    it('含 OnMove InputSystem 回调', () => {
      expect(pc.content).toContain('public void OnMove(InputAction.CallbackContext context)');
    });

    it('含 OnLook InputSystem 回调', () => {
      expect(pc.content).toContain('public void OnLook(InputAction.CallbackContext context)');
    });

    it('含鼠标灵敏度配置', () => {
      expect(pc.content).toContain('mouseSensitivity');
    });

    it('锁定鼠标游标', () => {
      expect(pc.content).toContain('CursorLockMode.Locked');
    });

    it('含 Update 方法（非 FixedUpdate）', () => {
      expect(pc.content).toContain('private void Update()');
    });

    it('含 gravity 重力变量', () => {
      expect(pc.content).toContain('gravity');
    });

    it('含 sprint 冲刺变量', () => {
      expect(pc.content).toContain('sprintSpeed');
    });
  });

  describe('CameraFollow.cs', () => {
    const cam = files.find((f) => f.filePath === 'src/game/CameraFollow.cs')!;

    it('文件存在', () => {
      expect(cam).toBeDefined();
    });

    it('含正确的 namespace', () => {
      expect(cam.content).toContain('namespace Game.Camera');
    });

    it('含 LateUpdate 方法', () => {
      expect(cam.content).toContain('private void LateUpdate()');
    });

    it('含 SmoothDamp 平滑跟随', () => {
      expect(cam.content).toContain('SmoothDamp');
    });

    it('含 Slerp 旋转插值', () => {
      expect(cam.content).toContain('Quaternion.Slerp');
    });

    it('含碰撞避让逻辑', () => {
      expect(cam.content).toContain('Physics.SphereCast');
    });

    it('含滚轮缩放', () => {
      expect(cam.content).toContain('Mouse ScrollWheel');
    });
  });

  describe('GameManager3D.cs', () => {
    const gm = files.find((f) => f.filePath === 'src/game/GameManager3D.cs')!;

    it('文件存在', () => {
      expect(gm).toBeDefined();
    });

    it('单例模式', () => {
      expect(gm.content).toContain('public static GameManager3D Instance');
    });

    it('DontDestroyOnLoad', () => {
      expect(gm.content).toContain('DontDestroyOnLoad');
    });
  });

  describe('ObjectPool3D.cs', () => {
    const pool = files.find((f) => f.filePath === 'src/game/ObjectPool3D.cs')!;

    it('文件存在', () => {
      expect(pool).toBeDefined();
    });

    it('泛型类 ObjectPool<T> where T : Component', () => {
      expect(pool.content).toContain('class ObjectPool<T>');
      expect(pool.content).toContain('where T : Component');
    });
  });

  describe('EventBus3D.cs', () => {
    const bus = files.find((f) => f.filePath === 'src/game/EventBus3D.cs')!;

    it('文件存在', () => {
      expect(bus).toBeDefined();
    });

    it('至少定义 6 个 UnityEvent', () => {
      const count = (bus.content.match(/UnityEvent/g) || []).length;
      expect(count).toBeGreaterThanOrEqual(6);
    });

    it('含 ClearAll 方法', () => {
      expect(bus.content).toContain('ClearAll()');
    });
  });
});

/* ==================== 交叉验证 ==================== */

describe('Unity 2D vs 3D 交叉检查', () => {
  const f2d = generateUnity2D();
  const f3d = generateUnity3D();

  it('2D 使用 Rigidbody2D + Collider2D', () => {
    const pc = f2d.find((f) => f.filePath === 'src/game/PlayerController2D.cs')!;
    expect(pc.content).toContain('Rigidbody2D');
    expect(pc.content).not.toContain('CharacterController');
  });

  it('3D 使用 CharacterController', () => {
    const pc = f3d.find((f) => f.filePath === 'src/game/PlayerController3D.cs')!;
    expect(pc.content).toContain('CharacterController');
    expect(pc.content).not.toContain('Rigidbody2D');
  });

  it('2D 不含 CameraFollow', () => {
    expect(f2d.some((f) => f.filePath.includes('CameraFollow'))).toBe(false);
  });

  it('3D 含 CameraFollow', () => {
    expect(f3d.some((f) => f.filePath.includes('CameraFollow'))).toBe(true);
  });

  it('2D 玩家使用 FixedUpdate，3D 玩家使用 Update', () => {
    const pc2d = f2d.find((f) => f.filePath === 'src/game/PlayerController2D.cs')!;
    const pc3d = f3d.find((f) => f.filePath === 'src/game/PlayerController3D.cs')!;
    expect(pc2d.content).toContain('FixedUpdate');
    expect(pc3d.content).toContain('private void Update()');
  });
});
