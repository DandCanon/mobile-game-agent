/**
 * Device Controller — 设备控制原语
 *
 * T4-M4：平台无关的设备控制抽象层。
 * 定义 DeviceController 抽象接口，提供 ADBController（Android 实现）
 * 和 MockDeviceController（测试/模拟用）两种实现。
 */

import { execSync } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

/* ===================== 类型定义 ===================== */

/** 设备平台 */
export type DevicePlatform = 'android' | 'ios' | 'unknown';

/** 设备状态 */
export type DeviceStatus = 'online' | 'offline' | 'unauthorized' | 'busy';

/** 设备信息 */
export interface DeviceInfo {
  deviceId: string;
  name: string;
  platform: DevicePlatform;
  status: DeviceStatus;
  /** 硬件 / OS 详细信息（JSON 序列化） */
  details?: Record<string, unknown>;
}

/** 命令执行结果 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/** ADB 设备行解析结果 */
interface AdbDeviceLine {
  id: string;
  status: DeviceStatus;
}

/** 安装结果 */
export interface InstallResult {
  success: boolean;
  packageName?: string;
  error?: string;
  output?: string;
}

/** 卸载结果 */
export interface UninstallResult {
  success: boolean;
  packageName: string;
  error?: string;
  output?: string;
}

/* ===================== DeviceController 抽象类 ===================== */

/**
 * 设备控制器抽象接口。
 * 平台无关：Android 走 ADBController，iOS 留空扩展，
 * 测试环境使用 MockDeviceController。
 */
export abstract class DeviceController {
  /** 列出所有已连接设备 */
  abstract listDevices(): DeviceInfo[];

  /** 截取设备屏幕，保存到临时目录，返回路径 */
  abstract screenshot(deviceId: string): string;

  /** 采集设备日志 */
  abstract captureLogs(
    deviceId: string,
    options?: { tag?: string; lines?: number },
  ): string[];

  /** 在设备上执行命令 */
  abstract runCommand(deviceId: string, command: string): CommandResult;

  /** 安装 APK */
  abstract installApk(deviceId: string, apkPath: string): InstallResult;

  /** 卸载应用 */
  abstract uninstallApp(deviceId: string, packageName: string): UninstallResult;

  /** 获取设备详细信息（硬件 / OS） */
  abstract getDeviceInfo(deviceId: string): DeviceInfo;
}

/* ===================== ADB 工具函数 ===================== */

/**
 * 执行 adb 命令。
 * 默认使用系统路径中的 adb，可通过 ADB_PATH 环境变量覆盖。
 */
function adbExec(args: string[], timeoutMs = 15000): string {
  const adbPath = process.env.ADB_PATH || 'adb';
  const cmd = `${adbPath} ${args.join(' ')}`;
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

/**
 * 执行 adb 命令并返回完整结果。
 */
function adbExecFull(args: string[], timeoutMs = 15000): CommandResult {
  const adbPath = process.env.ADB_PATH || 'adb';
  const cmd = `${adbPath} ${args.join(' ')}`;
  try {
    const stdout = execSync(cmd, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number };
    return {
      stdout: (e.stdout as string) ?? '',
      stderr: (e.stderr as string) ?? '',
      exitCode: e.status ?? 1,
    };
  }
}

/** 解析 adb devices 输出为设备列表 */
function parseAdbDevices(raw: string): AdbDeviceLine[] {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  // 跳过首行 "List of devices attached"
  const devices: AdbDeviceLine[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(/\s+/);
    if (parts.length >= 2) {
      const statusMap: Record<string, DeviceStatus> = {
        device: 'online',
        offline: 'offline',
        unauthorized: 'unauthorized',
      };
      devices.push({
        id: parts[0],
        status: statusMap[parts[1]] ?? 'offline',
      });
    }
  }
  return devices;
}

/** 获取设备属性 */
function getAdbProp(deviceId: string, prop: string): string {
  return adbExec(['-s', deviceId, 'shell', 'getprop', prop]).trim();
}

/** 获取临时目录 */
function getTempDir(): string {
  const dir = path.join(
    process.env.TEMP || process.env.TMP || '/tmp',
    'mgai-screenshots',
  );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/* ===================== ADBController ===================== */

/**
 * Android 设备控制器。
 * 基于 adb 命令封装，每条方法拼装 `adb -s <deviceId> <subcommand>`。
 */
export class ADBController extends DeviceController {
  listDevices(): DeviceInfo[] {
    const raw = adbExec(['devices']);
    const lines = parseAdbDevices(raw);
    return lines.map((d) => ({
      deviceId: d.id,
      name: d.id,
      platform: 'android' as const,
      status: d.status,
    }));
  }

  screenshot(deviceId: string): string {
    const ts = Date.now();
    const filePath = path.join(getTempDir(), `screenshot-${deviceId}-${ts}.png`);
    const raw = adbExec(['-s', deviceId, 'exec-out', 'screencap', '-p']);
    fs.writeFileSync(filePath, Buffer.from(raw, 'binary'));
    return filePath;
  }

  captureLogs(
    deviceId: string,
    options?: { tag?: string; lines?: number },
  ): string[] {
    const args = ['-s', deviceId, 'logcat', '-d'];
    if (options?.tag) {
      args.push('-s', options.tag);
    }
    if (options?.lines) {
      args.push('-t', String(options.lines));
    }
    const raw = adbExec(args);
    if (!raw) return [];
    return raw.split('\n').filter((l) => l.trim().length > 0);
  }

  runCommand(deviceId: string, command: string): CommandResult {
    return adbExecFull(['-s', deviceId, 'shell', command]);
  }

  installApk(deviceId: string, apkPath: string): InstallResult {
    const result = adbExecFull([
      '-s',
      deviceId,
      'install',
      '-r',
      `"${apkPath}"`,
    ]);
    const output = result.stdout + result.stderr;
    const success = output.includes('Success');
    // 尝试从输出提取包名
    const pkgMatch = output.match(/package:([\w.]+)/);
    return {
      success,
      packageName: pkgMatch?.[1],
      output,
      error: success ? undefined : output.trim() || '安装失败',
    };
  }

  uninstallApp(deviceId: string, packageName: string): UninstallResult {
    const result = adbExecFull(['-s', deviceId, 'uninstall', packageName]);
    const output = result.stdout + result.stderr;
    const success = output.includes('Success');
    return {
      success,
      packageName,
      output,
      error: success ? undefined : output.trim() || '卸载失败',
    };
  }

  getDeviceInfo(deviceId: string): DeviceInfo {
    const manufacturer = getAdbProp(deviceId, 'ro.product.manufacturer');
    const model = getAdbProp(deviceId, 'ro.product.model');
    const sdkVersion = getAdbProp(deviceId, 'ro.build.version.sdk');
    const releaseVersion = getAdbProp(deviceId, 'ro.build.version.release');
    const name = `${manufacturer} ${model}`.trim();

    // 确认设备在线
    const devices = this.listDevices();
    const found = devices.find((d) => d.deviceId === deviceId);
    const status: DeviceStatus = found?.status ?? 'offline';

    return {
      deviceId,
      name: name || deviceId,
      platform: 'android',
      status,
      details: {
        manufacturer,
        model,
        sdkVersion,
        releaseVersion,
      },
    };
  }
}

/* ===================== MockDeviceController ===================== */

/** 预置模拟设备 */
const MOCK_DEVICES: DeviceInfo[] = [
  {
    deviceId: 'emulator-5554',
    name: 'Pixel 7',
    platform: 'android',
    status: 'online',
    details: {
      manufacturer: 'Google',
      model: 'Pixel 7',
      sdkVersion: '33',
      releaseVersion: '13',
    },
  },
  {
    deviceId: 'emulator-5556',
    name: 'Galaxy S24',
    platform: 'android',
    status: 'online',
    details: {
      manufacturer: 'Samsung',
      model: 'SM-S921B',
      sdkVersion: '34',
      releaseVersion: '14',
    },
  },
  {
    deviceId: 'ios-sim-001',
    name: 'iPhone 15',
    platform: 'ios',
    status: 'online',
    details: {
      manufacturer: 'Apple',
      model: 'iPhone 15',
      osVersion: '17.0',
    },
  },
];

/**
 * 模拟设备控制器。
 * 预置 Pixel 7 / Galaxy S24 / iPhone 15 三台模拟设备，
 * 各方法返回固定 mock 数据，用于单元测试和离线开发。
 */
export class MockDeviceController extends DeviceController {
  private lastScreenshotPath = '';
  private screenshotCounter = 0;

  listDevices(): DeviceInfo[] {
    return MOCK_DEVICES.map((d) => ({ ...d, details: { ...d.details } }));
  }

  screenshot(deviceId: string): string {
    const dir = getTempDir();
    // 使用自增计数器避免同毫秒文件名冲突
    this.screenshotCounter++;
    const filePath = path.join(
      dir,
      `mock-screenshot-${deviceId}-${Date.now()}-${this.screenshotCounter}.png`,
    );
    // 写入一个最小有效 PNG（1x1 透明像素）以便文件存在性检测通过
    const minPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
    fs.writeFileSync(filePath, minPng);
    this.lastScreenshotPath = filePath;
    return filePath;
  }

  captureLogs(
    deviceId: string,
    options?: { tag?: string; lines?: number },
  ): string[] {
    const base = [
      `06-21 10:00:01.000  1234  5678 I ActivityManager: Start proc ${deviceId}`,
      `06-21 10:00:02.000  1234  5678 D ${options?.tag ?? 'System'} : Mock log line 1`,
      `06-21 10:00:03.000  1234  5678 W ${options?.tag ?? 'System'} : Mock warning`,
      `06-21 10:00:04.000  1234  5678 E ${options?.tag ?? 'System'} : Mock error`,
    ];
    const limit = options?.lines ?? base.length;
    return base.slice(0, limit);
  }

  runCommand(_deviceId: string, command: string): CommandResult {
    if (command.includes('error') || command.includes('fail')) {
      return {
        stdout: '',
        stderr: `mock error: command failed`,
        exitCode: 1,
      };
    }
    return {
      stdout: `mock output for: ${command}`,
      stderr: '',
      exitCode: 0,
    };
  }

  installApk(deviceId: string, apkPath: string): InstallResult {
    const pkgName = path.basename(apkPath, path.extname(apkPath));
    return {
      success: true,
      packageName: `com.mock.${pkgName}`,
      output: 'Success',
    };
  }

  uninstallApp(_deviceId: string, packageName: string): UninstallResult {
    return {
      success: true,
      packageName,
      output: 'Success',
    };
  }

  getDeviceInfo(deviceId: string): DeviceInfo {
    const found = MOCK_DEVICES.find((d) => d.deviceId === deviceId);
    if (found) {
      return { ...found, details: { ...found.details } };
    }
    return {
      deviceId,
      name: deviceId,
      platform: 'unknown',
      status: 'offline',
      details: {},
    };
  }
}
