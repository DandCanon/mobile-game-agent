/**
 * Android SDK 集成规划器
 *
 * 当目标平台包含 Android 且引擎为 Unity 时，自动生成
 * docs/ANDROID_SDK_INTEGRATION.md，包含 Unity Host Activity 生命周期、
 * SDK Adapter 合同、Manifest checklist、权限说明、模块建议、真机调试步骤。
 *
 * 所有 SDK 名称均为通用公开名称，不含私有包名、类名或密钥。
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type AndroidSdkIntegrationConfig,
  type SdkAdapterSpec,
  createPresetAdapters,
  createDefaultIntegrationConfig,
} from './types.js';

/* ===================== 公开接口 ===================== */

/**
 * 为 Unity Android 项目生成 ANDROID_SDK_INTEGRATION.md。
 *
 * @param workspacePath 项目工作区根路径
 * @param config SDK 集成配置（部分字段可自动补全）
 * @returns 生成的文件绝对路径
 */
export function generateAndroidSdkDoc(
  workspacePath: string,
  config: Partial<AndroidSdkIntegrationConfig> = {},
): string {
  const merged = { ...createDefaultIntegrationConfig(), ...config };
  if (merged.adapters.length === 0) {
    merged.adapters = createPresetAdapters();
  }

  const docContent = buildIntegrationDoc(merged);
  const docsDir = join(workspacePath, 'docs');
  mkdirSync(docsDir, { recursive: true });

  const docPath = join(docsDir, 'ANDROID_SDK_INTEGRATION.md');
  writeFileSync(docPath, docContent, 'utf-8');
  return docPath;
}

/** 判断项目是否需要 Android SDK 集成步骤 */
export function shouldInjectAndroidSdkStep(
  targetEngine: string,
  platforms: string[],
  userRequest: string,
): boolean {
  // 仅当引擎为 Unity 且平台含 Android
  if (targetEngine !== 'unity') return false;
  if (!platforms.includes('Android')) return false;

  // 关键词匹配：Unity、Android、SDK、支付、广告、推送、统计、真机、logcat、Android install package、上架、渠道包
  const triggerKeywords = [
    'android', '安卓', 'sdk', '支付', '广告', '推送', '统计',
    '真机', 'logcat', 'android-package', '上架', '渠道包', 'unity',
    'google play', 'admob', 'firebase', 'bugly',
  ];
  const lower = userRequest.toLowerCase();
  return triggerKeywords.some((kw) => lower.includes(kw));
}

/* ===================== 文档生成 ===================== */

function buildIntegrationDoc(cfg: AndroidSdkIntegrationConfig): string {
  const adapterSections = cfg.adapters
    .map((a) => buildAdapterSection(a))
    .join('\n');

  const enabledAdapters = cfg.adapters.filter((a) => a.enabled);
  const manifestComponents = enabledAdapters.flatMap((a) => a.manifestRequirements);
  const allPermissions = [
    ...new Set([
      ...cfg.permissions,
      ...enabledAdapters.flatMap((a) => a.permissions),
    ]),
  ];

  return [
    `# Android SDK Integration Guide`,
    ``,
    `> 自动生成於 ${new Date().toISOString().split('T')[0]}`,
    `> 项目包名: \`${cfg.packageName}\``,
    ``,
    `---`,
    ``,
    `## 1. Unity Host Activity 生命周期`,
    ``,
    `Unity Android 项目的主 Activity 继承自 \`UnityPlayerActivity\`。`,
    `SDK Adapter 通过钩子函数在关键生命周期节点插入初始化与清理逻辑：`,
    ``,
    `| 生命周期方法 | SDK 钩子 | 典型用途 |`,
    `|---|---|---|`,
    `| \`onCreate(Bundle)\` | \`init()\` + \`onActivityCreate()\` | SDK 初始化、清单解析、支付服务绑定 |`,
    `| \`onResume()\` | \`onResume()\` | 恢复广告展示、日志上报、前台统计 |`,
    `| \`onPause()\` | \`onPause()\` | 暂停广告、缓存状态 |`,
    `| \`onDestroy()\` | \`onDestroy()\` | 释放资源、解绑服务、关闭数据库连接 |`,
    `| \`onNewIntent(Intent)\` | \`onNewIntent()\` | 推送通知点击、Deep Link 处理 |`,
    `| \`onActivityResult(...)\` | \`onActivityResult()\` | 支付结果、权限请求回调 |`,
    `| \`onRequestPermissionsResult(...)\` | \`onRequestPermissionsResult()\` | 权限授予结果 |`,
    ``,
    ``,
    `## 2. SDK Adapter 合同`,
    ``,
    `每个 SDK Adapter 实现统一的接口契约：`,
    ``,
    `\`\`\`typescript`,
    `interface UnitySdkAdapter {`,
    `  // 生命周期钩子`,
    `  init(application: Application, activity: Activity): void;`,
    `  onActivityCreate(bundle: Bundle?): void;`,
    `  onResume(): void;`,
    `  onPause(): void;`,
    `  onDestroy(): void;`,
    `  onNewIntent(intent: Intent): void;`,
    `  onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): void;`,
    `  onRequestPermissionsResult(requestCode: Int, permissions: String[], grantResults: Int[]): void;`,
    ``,
    `  // 可选能力`,
    `  login?(): void;`,
    `  logout?(): void;`,
    `  pay?(productId: String): void;`,
    `  showRewardedAd?(placement: String): void;`,
    `  trackEvent?(name: String, params: Map<String, Any>): void;`,
    `  registerPush?(): void;`,
    `  openCustomerService?(): void;`,
    `  collectBugBundle?(): String;`,
    `}`,
    `\`\`\``,
    ``,
    ``,
    `## 3. 可用 SDK Adapter 清单`,
    ``,
    adapterSections,
    ``,
    `---`,
    ``,
    `## 4. Manifest Checklist`,
    ``,
    `### 4.1 基础检查项`,
    ``,
    `- [ ] Main Activity 存在且声明为 \`UnityPlayerActivity\``,
    `- [ ] Unity Activity \`<meta-data>\` 声明（\`unityplayer.UnityActivity\` 等）`,
    `- [ ] \`screenOrientation\` 与目标方向一致（\`${cfg.screenOrientation}\`）`,
    `- [ ] \`configChanges\` 包含 \`orientation|screenSize|keyboardHidden\``,
    `- [ ] 所有组件 \`android:exported\` 显式声明`,
    `- [ ] FileProvider \`android:authorities\` 使用 \`\${applicationId}.fileprovider\` 模式防止冲突`,
    ``,
    `### 4.2 权限声明`,
    ``,
    `\`\`\`xml`,
    allPermissions.map((p) => `  <uses-permission android:name="${p}" />`).join('\n'),
    `\`\`\``,
    ``,
    `### 4.3 SDK 组件声明`,
    ``,
    manifestComponents.length > 0
      ? manifestComponents
          .map(
            (m) =>
              `- [ ] \`<${m.type} android:name="${m.className}" android:exported="${m.exported}">\` — ${m.purpose} (${m.adapterId})`,
          )
          .join('\n')
      : '无需额外组件声明',
    ``,
    `### 4.4 安全提醒`,
    ``,
    `- [ ] Manifest 中不包含真实 production secrets / API keys（密钥应通过环境变量或安全配置中心注入）`,
    `- [ ] \`android:debuggable\` 仅在 debug buildType 下为 \`true\``,
    `- [ ] 敏感权限（位置、联系人、通话记录）需附使用说明`,
    ``,
    ``,
    `---`,
    ``,
    `## 5. 各模块建议`,
    ``,
    `| 模块 | 推荐 SDK | 说明 |`,
    `|---|---|---|`,
    `| 支付 | **Google Play Billing** | Android 官方内购方案，支持消耗品/非消耗品/订阅 |`,
    `| 广告 | **AdMob** | 激励视频、插屏、横幅，Google 官方广告平台 |`,
    `| 推送 | **Firebase Cloud Messaging (FCM)** | 免费、与 Firebase 生态深度集成 |`,
    `| 统计 | **Firebase Analytics** | 事件追踪、用户属性、漏斗分析 |`,
    `| 崩溃 | **Firebase Crashlytics** | 实时崩溃报告、堆栈聚合、NDK 支持 |`,
    `| 客服 | **Firebase In-App Messaging** | 应用内消息投放，精准触达用户 |`,
    ``,
    `> 以上均为 Google 官方公开 SDK，文档完善、社区活跃、无厂商锁定风险。`,
    ``,
    ``,
    `---`,
    ``,
    `## 6. 真机调试与 Logcat 验证步骤`,
    ``,
    `### 6.1 环境准备`,
    ``,
    `\`\`\`bash`,
    `# 确认设备连接`,
    `adb devices`,
    ``,
    `# 确认设备为开发者模式并开启 USB 调试`,
    `# 设置 → 关于手机 → 连点 7 次「版本号」→ 开发者选项 → USB 调试`,
    `\`\`\``,
    ``,
    `### 6.2 安装与启动`,
    ``,
    `\`\`\`bash`,
    `# 安装 Android install package`,
    `adb install -r path/to/your-game.android-package`,
    ``,
    `# 通过 Activity Manager 启动 Unity 游戏`,
    `adb shell am start -n ${cfg.packageName}/com.unity3d.player.UnityPlayerActivity`,
    ``,
    `# 或使用 monkey 启动`,
    `adb shell monkey -p ${cfg.packageName} -c android.intent.category.LAUNCHER 1`,
    `\`\`\``,
    ``,
    `### 6.3 日志收集`,
    ``,
    `\`\`\`bash`,
    `# 实时查看 Unity 日志（过滤 Unity + SDK 标签）`,
    `adb logcat -s Unity:V AdMob:V Firebase:V GooglePlay:V`,
    ``,
    `# 保存完整日志到文件`,
    `adb logcat -d > logcat_full.txt`,
    ``,
    `# 仅保存崩溃日志`,
    `adb logcat -d -b crash > crash_log.txt`,
    ``,
    `# 过滤特定包名的日志`,
    `adb logcat --pid=$(adb shell pidof ${cfg.packageName})`,
    `\`\`\``,
    ``,
    `### 6.4 截图与 UI 调试`,
    ``,
    `\`\`\`bash`,
    `# 截图`,
    `adb exec-out screencap -p > screenshot.png`,
    ``,
    `# UI 层级抓取`,
    `adb shell uiautomator dump`,
    `adb pull /sdcard/window_dump.xml`,
    `\`\`\``,
    ``,
    `### 6.5 完整 Bug Report`,
    ``,
    `\`\`\`bash`,
    `# 生成 bugreport 压缩包`,
    `adb bugreport bugreport_$(date +%Y%m%d_%H%M%S).zip`,
    `\`\`\``,
    ``,
    `### 6.6 调试检查清单`,
    ``,
    `- [ ] Android install package 可正常安装（adb install 成功）`,
    `- [ ] 启动无崩溃（logcat 无 FATAL EXCEPTION）`,
    `- [ ] Unity 场景加载完成（logcat 含 "Unity Player" 初始化日志）`,
    `- [ ] Logcat 中每个已启用 SDK 的初始化日志可见`,
    `- [ ] 支付流程可走通（测试环境）`,
    `- [ ] 推送通知可接收`,
    `- [ ] 截图功能正常（screencap 可拉取）`,
    ``,
  ].join('\n');
}

function buildAdapterSection(adapter: SdkAdapterSpec): string {
  const status = adapter.enabled ? '已启用' : '未启用';
  return [
    `### ${adapter.displayName} (\`${adapter.id}\`) — ${status}`,
    ``,
    `- **分类**: ${adapter.category}`,
    `- **生命周期钩子**: ${adapter.hooks.map((h) => `\`${h}()\``).join(', ')}`,
    `- **可选能力**: ${adapter.capabilities.length > 0 ? adapter.capabilities.map((c) => `\`${c}\``).join(', ') : '无'}`,
    `- **权限**: ${adapter.permissions.length > 0 ? adapter.permissions.map((p) => `\`${p}\``).join(', ') : '无'}`,
    `- **初始化参数占位符**:`,
    ...Object.entries(adapter.initPlaceholders).map(
      ([key, value]) => `  - \`${key}\`: \`${value}\``,
    ),
    adapter.notes ? `- **参考文档**: ${adapter.notes}` : '',
    adapter.manifestRequirements.length > 0
      ? [
          `- **Manifest 组件声明**:`,
          ...adapter.manifestRequirements.map(
            (m) =>
              `  - \`<${m.type} android:name="${m.className}" android:exported="${m.exported}">\` — ${m.purpose}`,
          ),
        ].join('\n')
      : '',
    ``,
  ].join('\n');
}
