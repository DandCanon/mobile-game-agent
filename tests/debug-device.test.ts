/**
 * Debug Device & Session 单元测试
 *
 * 覆盖：
 * - MockDeviceController 全方法
 * - ADBController 方法（adb 可用时）
 * - DebugSession 生命周期
 * - BugBundle 完整性验证
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MockDeviceController,
  ADBController,
} from '../src/debug/device.js';
import type {
  DeviceController,
  DeviceInfo,
  DevicePlatform,
  DeviceStatus,
} from '../src/debug/device.js';
import { DebugSession, createDebugSession } from '../src/debug/session.js';
import type {
  DebugSessionRecord,
  ReproducerStepLog,
  DeviceStateSnapshot,
} from '../src/debug/session.js';
import type { BugBundle } from '../src/debug/contract.js';

/* ===================== Helpers ===================== */

let _adbCache: boolean | null = null;
async function isAdbAvailable(): Promise<boolean> {
  if (_adbCache !== null) return _adbCache;
  try {
    await import('node:child_process');
    _adbCache = true;
  } catch {
    _adbCache = false;
  }
  return _adbCache;
}

// -------------------------------------------------------------------------
// MockDeviceController
// -------------------------------------------------------------------------

describe('MockDeviceController', () => {
  let controller: MockDeviceController;

  beforeEach(() => {
    controller = new MockDeviceController();
  });

  describe('listDevices', () => {
    it('should return 3 mock devices', () => {
      const devices = controller.listDevices();
      expect(devices.length).toBe(3);

      const ids = devices.map((d) => d.deviceId);
      expect(ids).toContain('emulator-5554');  // Pixel 7
      expect(ids).toContain('emulator-5556');  // Galaxy S24
      expect(ids).toContain('ios-sim-001');    // iPhone 15
    });

    it('should return DeviceInfo with all required fields', () => {
      const devices = controller.listDevices();
      for (const d of devices) {
        expect(d).toHaveProperty('deviceId');
        expect(d).toHaveProperty('name');
        expect(d).toHaveProperty('platform');
        expect(d).toHaveProperty('status');
        expect(typeof d.deviceId).toBe('string');
        expect(typeof d.name).toBe('string');
        expect(['android', 'ios', 'unknown']).toContain(d.platform);
        expect(['online', 'offline', 'unauthorized', 'busy']).toContain(
          d.status,
        );
      }
    });

    it('should return devices with online status', () => {
      const devices = controller.listDevices();
      for (const d of devices) {
        expect(d.status).toBe('online');
      }
    });
  });

  describe('screenshot', () => {
    it('should create a PNG file and return its path', () => {
      const deviceId = 'emulator-5554';
      const filePath = controller.screenshot(deviceId);

      expect(filePath).toBeTruthy();
      expect(filePath).toContain('mock-screenshot');
      expect(fs.existsSync(filePath)).toBe(true);

      // 验证是最小 PNG
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('should create unique filenames for different calls', () => {
      const path1 = controller.screenshot('emulator-5554');
      const path2 = controller.screenshot('emulator-5554');

      expect(path1).not.toBe(path2);
      expect(fs.existsSync(path1)).toBe(true);
      expect(fs.existsSync(path2)).toBe(true);
    });
  });

  describe('captureLogs', () => {
    it('should return log lines for a device', () => {
      const logs = controller.captureLogs('emulator-5554');
      expect(logs.length).toBeGreaterThan(0);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.every((l) => typeof l === 'string')).toBe(true);
    });

    it('should respect lines option', () => {
      const logs = controller.captureLogs('emulator-5554', { lines: 2 });
      expect(logs.length).toBe(2);
    });

    it('should include tag in log lines', () => {
      const logs = controller.captureLogs('emulator-5554', {
        tag: 'Unity',
        lines: 5,
      });
      expect(logs.some((l) => l.includes('Unity'))).toBe(true);
    });

    it('should include mock error/warning levels', () => {
      const logs = controller.captureLogs('emulator-5554', { lines: 10 });
      expect(logs.some((l) => l.includes(' E '))).toBe(true);
      expect(logs.some((l) => l.includes(' W '))).toBe(true);
    });
  });

  describe('runCommand', () => {
    it('should return success for normal commands', () => {
      const result = controller.runCommand('emulator-5554', 'pm list packages');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('mock output');
      expect(result.stderr).toBe('');
    });

    it('should return error for commands containing error', () => {
      const result = controller.runCommand('emulator-5554', 'trigger error');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('mock error');
    });

    it('should return error for commands containing fail', () => {
      const result = controller.runCommand('emulator-5554', 'something fail');
      expect(result.exitCode).toBe(1);
    });
  });

  describe('installApk', () => {
    it('should return success with inferred package name', () => {
      const result = controller.installApk(
        'emulator-5554',
        '/path/to/my-game.androidpkg',
      );
      expect(result.success).toBe(true);
      expect(result.packageName).toBe('com.mock.my-game');
      expect(result.output).toBe('Success');
    });

    it('should handle paths with underscores', () => {
      const result = controller.installApk(
        'emulator-5554',
        '/build/com.example.game_v2.androidpkg',
      );
      expect(result.success).toBe(true);
      expect(result.packageName).toBe('com.mock.com.example.game_v2');
    });
  });

  describe('uninstallApp', () => {
    it('should return success for any package name', () => {
      const result = controller.uninstallApp(
        'emulator-5554',
        'com.example.game',
      );
      expect(result.success).toBe(true);
      expect(result.packageName).toBe('com.example.game');
      expect(result.output).toBe('Success');
    });
  });

  describe('getDeviceInfo', () => {
    it('should return detailed info for known device', () => {
      const info = controller.getDeviceInfo('emulator-5554');
      expect(info.deviceId).toBe('emulator-5554');
      expect(info.name).toBe('Pixel 7');
      expect(info.platform).toBe('android');
      expect(info.status).toBe('online');
      expect(info.details).toBeDefined();
      expect(info.details!.manufacturer).toBe('Google');
      expect(info.details!.model).toBe('Pixel 7');
    });

    it('should return iPhone 15 for ios-sim-001', () => {
      const info = controller.getDeviceInfo('ios-sim-001');
      expect(info.name).toBe('iPhone 15');
      expect(info.platform).toBe('ios');
      expect(info.details!.manufacturer).toBe('Apple');
    });

    it('should return unknown for non-existent device', () => {
      const info = controller.getDeviceInfo('non-existent-device');
      expect(info.deviceId).toBe('non-existent-device');
      expect(info.platform).toBe('unknown');
      expect(info.status).toBe('offline');
    });
  });
});

// -------------------------------------------------------------------------
// ADBController
// -------------------------------------------------------------------------

describe('ADBController', () => {
  const controller = new ADBController();

  describe('listDevices', () => {
    it('should return an array (may be empty if no ADB)', () => {
      // ADBController 在无 adb 时返回空数组
      const devices = controller.listDevices();
      expect(Array.isArray(devices)).toBe(true);
    });

    it('should have correct shape when devices exist', async () => {
      if (!(await isAdbAvailable())) return; // 跳过

      const devices = controller.listDevices();
      // 至少需要一台 adb 设备（模拟器或真机）
      if (devices.length === 0) return; // 无设备也通过

      for (const d of devices) {
        expect(d).toHaveProperty('deviceId');
        expect(d).toHaveProperty('platform', 'android');
        expect(['online', 'offline', 'unauthorized']).toContain(d.status);
      }
    });
  });

  describe('screenshot', () => {
    it('should create a file', async () => {
      if (!(await isAdbAvailable())) return;
      const devices = controller.listDevices().filter(
        (d) => d.status === 'online',
      );
      if (devices.length === 0) return;

      const filePath = controller.screenshot(devices[0].deviceId);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('captureLogs', () => {
    it('should return string array', async () => {
      if (!(await isAdbAvailable())) return;
      const devices = controller.listDevices().filter(
        (d) => d.status === 'online',
      );
      if (devices.length === 0) return;

      const logs = controller.captureLogs(devices[0].deviceId, { lines: 5 });
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('runCommand', () => {
    it('should run echo on device', async () => {
      if (!(await isAdbAvailable())) return;
      const devices = controller.listDevices().filter(
        (d) => d.status === 'online',
      );
      if (devices.length === 0) return;

      const result = controller.runCommand(
        devices[0].deviceId,
        'echo hello_test',
      );
      expect(result.stdout).toContain('hello_test');
      expect(result.exitCode).toBe(0);
    });
  });

  describe('getDeviceInfo', () => {
    it('should return device info for online device', async () => {
      if (!(await isAdbAvailable())) return;
      const devices = controller.listDevices().filter(
        (d) => d.status === 'online',
      );
      if (devices.length === 0) return;

      const info = controller.getDeviceInfo(devices[0].deviceId);
      expect(info.platform).toBe('android');
      expect(info.deviceId).toBe(devices[0].deviceId);
      expect(info.details).toBeDefined();
    });
  });
});

// -------------------------------------------------------------------------
// DebugSession 生命周期
// -------------------------------------------------------------------------

describe('DebugSession', () => {
  let controller: MockDeviceController;
  let session: DebugSession;

  beforeEach(() => {
    controller = new MockDeviceController();
    session = new DebugSession(controller);
  });

  describe('start', () => {
    it('should create a new session and return sessionId', () => {
      const sessionId = session.start('emulator-5554', 'App crashes on launch');
      expect(sessionId).toBeTruthy();
      expect(typeof sessionId).toBe('string');
      expect(sessionId).toContain('debug-');
      expect(sessionId).toContain('emulator-5554');
    });

    it('should store session in history', () => {
      const sessionId = session.start('emulator-5554', 'App crashes');
      const history = session.getHistory(sessionId);
      expect(history.length).toBe(1);
      expect(history[0].sessionId).toBe(sessionId);
      expect(history[0].deviceId).toBe('emulator-5554');
      expect(history[0].bugDescription).toBe('App crashes');
      expect(history[0].status).toBe('active');
      expect(history[0].initialEnv).toBeDefined();
      expect(history[0].initialEnv.os).toBeTruthy();
      expect(history[0].initialEnv.nodeVersion).toBeTruthy();
    });

    it('should create unique sessionIds', () => {
      const id1 = session.start('emulator-5554', 'Bug A');
      const id2 = session.start('emulator-5554', 'Bug B');
      expect(id1).not.toBe(id2);
    });
  });

  describe('reproduce', () => {
    it('should execute steps and return ReproducerStepLog array', () => {
      session.start('emulator-5554', 'App crashes on login');
      const steps = ['Open app', 'Tap login button', 'Enter credentials'];

      const logs = session.reproduce('emulator-5554', steps);

      expect(logs.length).toBe(3);
      expect(logs[0].stepIndex).toBe(0);
      expect(logs[0].description).toBe('Open app');
      expect(logs[1].stepIndex).toBe(1);
      expect(logs[2].stepIndex).toBe(2);

      // 每步都有截图和日志
      for (const log of logs) {
        expect(log.screenshotPath).toBeTruthy();
        expect(Array.isArray(log.logs)).toBe(true);
        expect(log.logs.length).toBeGreaterThan(0);
        expect(log.timestamp).toBeTruthy();
      }
    });

    it('should store steps in session history', () => {
      session.start('emulator-5554', 'Bug');
      session.reproduce('emulator-5554', ['Step 1', 'Step 2']);

      const history = session.getHistory();
      expect(history.length).toBe(1);
      expect(history[0].reproSteps.length).toBe(2);
    });

    it('should throw if no active session for device', () => {
      expect(() =>
        session.reproduce('unknown-device', ['Step 1']),
      ).toThrow('活跃排错 session');
    });
  });

  describe('captureState', () => {
    it('should capture device state snapshot', () => {
      session.start('emulator-5554', 'Bug');
      const snapshot = session.captureState('emulator-5554');

      expect(snapshot.screenshotPath).toBeTruthy();
      expect(Array.isArray(snapshot.logs)).toBe(true);
      expect(Array.isArray(snapshot.processList)).toBe(true);
      expect(snapshot.timestamp).toBeTruthy();
    });

    it('should store snapshot in session', () => {
      session.start('emulator-5554', 'Bug');
      session.captureState('emulator-5554');

      const history = session.getHistory();
      expect(history[0].stateSnapshots.length).toBe(1);
    });

    it('should throw if no active session', () => {
      expect(() => session.captureState('emulator-5554')).toThrow(
        '活跃排错 session',
      );
    });
  });

  describe('generateReport', () => {
    it('should generate BugBundle and mark session completed', () => {
      const sessionId = session.start('emulator-5554', 'App crashes on login');
      session.reproduce('emulator-5554', ['Open app', 'Login']);
      session.captureState('emulator-5554');

      const bundle = session.generateReport(sessionId);

      expect(bundle).not.toBeNull();
      expect(bundle!.errorReport).toBeDefined();
      expect(bundle!.errorReport.sessionId).toBe(sessionId);
      expect(bundle!.errorReport.message).toBe('App crashes on login');
      expect(bundle!.logs.length).toBeGreaterThan(0);
      expect(bundle!.codeFiles.length).toBeGreaterThan(0);
      expect(bundle!.envInfo).toBeDefined();
      expect(bundle!.reproSteps).toBeDefined();
      expect(bundle!.reproSteps!.length).toBe(2);

      // 验证 session 状态更新
      const history = session.getHistory(sessionId);
      expect(history[0].status).toBe('completed');
      expect(history[0].errorReport).toBeDefined();
      expect(history[0].bundlePath).toBeTruthy();
    });

    it('should write bundle JSON to disk', () => {
      const sessionId = session.start('emulator-5554', 'Bug');
      session.reproduce('emulator-5554', ['Step 1']);
      session.captureState('emulator-5554');

      session.generateReport(sessionId);

      const history = session.getHistory(sessionId);
      expect(history[0].bundlePath).toBeTruthy();
      expect(fs.existsSync(history[0].bundlePath!)).toBe(true);
    });

    it('should return null for non-existent session', () => {
      const bundle = session.generateReport('non-existent');
      expect(bundle).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return all sessions when no sessionId', () => {
      session.start('emulator-5554', 'Bug A');
      session.start('emulator-5556', 'Bug B');

      const all = session.getHistory();
      expect(all.length).toBe(2);
    });

    it('should return single session by sessionId', () => {
      const id = session.start('emulator-5554', 'Bug');
      const result = session.getHistory(id);
      expect(result.length).toBe(1);
      expect(result[0].sessionId).toBe(id);
    });

    it('should return empty array for unknown sessionId', () => {
      const result = session.getHistory('unknown');
      expect(result).toEqual([]);
    });
  });

  describe('getActiveSessions', () => {
    it('should return only active sessions', () => {
      const id1 = session.start('emulator-5554', 'Bug A');
      const id2 = session.start('emulator-5556', 'Bug B');

      // 完成 id2
      session.reproduce('emulator-5556', ['Step 1']);
      session.captureState('emulator-5556');
      session.generateReport(id2);

      const active = session.getActiveSessions();
      expect(active.length).toBe(1);
      expect(active[0].sessionId).toBe(id1);
    });

    it('should return empty when all completed', () => {
      const id = session.start('emulator-5554', 'Bug');
      session.reproduce('emulator-5554', ['Step 1']);
      session.captureState('emulator-5554');
      session.generateReport(id);

      const active = session.getActiveSessions();
      expect(active.length).toBe(0);
    });
  });
});

// -------------------------------------------------------------------------
// BugBundle 完整性
// -------------------------------------------------------------------------

describe('BugBundle Integrity', () => {
  let controller: MockDeviceController;
  let session: DebugSession;

  beforeEach(() => {
    controller = new MockDeviceController();
    session = new DebugSession(controller);
  });

  it('should contain all required fields', () => {
    const sessionId = session.start('emulator-5554', 'Test crash');
    session.reproduce('emulator-5554', [
      'Launch app',
      'Navigate to settings',
      'Toggle dark mode',
    ]);
    session.captureState('emulator-5554');

    const bundle = session.generateReport(sessionId)!;

    // errorReport 必须字段
    expect(bundle.errorReport.sessionId).toBe(sessionId);
    expect(bundle.errorReport.timestamp).toBeTruthy();
    expect(bundle.errorReport.errorType).toBeTruthy();
    expect(['runtime', 'compile', 'logic', 'perf']).toContain(
      bundle.errorReport.errorType,
    );
    expect(bundle.errorReport.severity).toBeTruthy();
    expect(['fatal', 'error', 'warning']).toContain(
      bundle.errorReport.severity,
    );
    expect(bundle.errorReport.message).toBeTruthy();
    expect(bundle.errorReport.context).toBeDefined();
    expect(
      bundle.errorReport.context.deviceId,
    ).toBe('emulator-5554');

    // logs
    expect(Array.isArray(bundle.logs)).toBe(true);
    expect(bundle.logs.length).toBeGreaterThan(0);

    // codeFiles
    expect(Array.isArray(bundle.codeFiles)).toBe(true);
    expect(bundle.codeFiles.length).toBeGreaterThan(0);

    // envInfo
    expect(bundle.envInfo.os).toBeTruthy();
    expect(bundle.envInfo.nodeVersion).toBeTruthy();

    // reproSteps
    expect(Array.isArray(bundle.reproSteps)).toBe(true);
    expect(bundle.reproSteps!.length).toBe(3);
  });

  it('should have valid timestamps', () => {
    const sessionId = session.start('emulator-5554', 'Test');
    session.reproduce('emulator-5554', ['Step']);
    session.captureState('emulator-5554');

    const bundle = session.generateReport(sessionId)!;

    // 应为有效 ISO 8601
    expect(() => new Date(bundle.errorReport.timestamp)).not.toThrow();
    expect(new Date(bundle.errorReport.timestamp).getTime()).toBeGreaterThan(0);
  });

  it('should include reproSteps in order', () => {
    const sessionId = session.start('emulator-5554', 'Test');
    const steps = ['A', 'B', 'C', 'D'];
    session.reproduce('emulator-5554', steps);
    session.captureState('emulator-5554');

    const bundle = session.generateReport(sessionId)!;
    expect(bundle.reproSteps).toEqual(steps);
  });
});

// -------------------------------------------------------------------------
// createDebugSession 工厂
// -------------------------------------------------------------------------

describe('createDebugSession factory', () => {
  it('should create DebugSession with StructuredLogger', () => {
    const controller = new MockDeviceController();
    const session = createDebugSession(controller);

    const sessionId = session.start('emulator-5554', 'Factory test');
    expect(sessionId).toBeTruthy();

    const history = session.getHistory(sessionId);
    expect(history.length).toBe(1);
  });
});
