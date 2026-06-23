/**
 * Android SDK Adapter 类型定义
 *
 * 为 Unity 手游的 Android 平台集成提供稳定的类型契约。
 * 所有 SDK 名称使用通用公开名称，不含任何私有包名、类名或密钥。
 */

/* ===================== SDK Adapter 合同 ===================== */

/** SDK Adapter 生命周期钩子 */
export type UnityLifecycleHook =
  | 'init'
  | 'onActivityCreate'
  | 'onResume'
  | 'onPause'
  | 'onDestroy'
  | 'onNewIntent'
  | 'onActivityResult'
  | 'onRequestPermissionsResult';

/** SDK 可选能力 */
export type SdkOptionalCapability =
  | 'login'
  | 'logout'
  | 'pay'
  | 'showRewardedAd'
  | 'trackEvent'
  | 'registerPush'
  | 'openCustomerService'
  | 'collectBugBundle';

/** 单个 SDK Adapter 规格 */
export interface SdkAdapterSpec {
  /** Adapter 唯一标识（如 "google-play-billing"） */
  id: string;
  /** 显示名称（如 "Google Play Billing"） */
  displayName: string;
  /** SDK 分类 */
  category: 'payment' | 'ads' | 'analytics' | 'crash' | 'push' | 'customer-service' | 'other';
  /** 是否启用此 Adapter */
  enabled: boolean;
  /** 实现的生命周期钩子 */
  hooks: UnityLifecycleHook[];
  /** 支持的可选能力 */
  capabilities: SdkOptionalCapability[];
  /** 所需 Android 权限 */
  permissions: string[];
  /** Manifest 中需要声明的组件 */
  manifestRequirements: AndroidManifestRequirement[];
  /** 初始化参数占位符说明（不含真实值） */
  initPlaceholders: Record<string, string>;
  /** 备注/文档链接 */
  notes?: string;
}

/* ===================== AndroidManifest 要求 ===================== */

/** AndroidManifest 组件声明类型 */
export type ManifestComponentType = 'activity' | 'service' | 'receiver' | 'provider';

/** 单个 Manifest 组件声明要求 */
export interface AndroidManifestRequirement {
  /** 组件类型 */
  type: ManifestComponentType;
  /** 组件完整类名（通用公开名称） */
  className: string;
  /** 是否声明 android:exported */
  exported: boolean | 'conditionally';
  /** 是否需要 intent-filter */
  hasIntentFilter: boolean;
  /** 描述此组件用途 */
  purpose: string;
  /** 所属 SDK Adapter ID */
  adapterId: string;
}

/* ===================== SDK 回调路由 ===================== */

/** SDK 回调路由定义 */
export interface SdkCallbackRoute {
  /** 路由来源（SDK Adapter ID） */
  source: string;
  /** 回调事件名 */
  event: string;
  /** 目标处理方式 */
  target: 'unity-message' | 'native-broadcast' | 'adapter-internal';
  /** Unity GameObject 名称（target=unity-message 时） */
  unityGameObject?: string;
  /** Unity 方法名（target=unity-message 时） */
  unityMethod?: string;
  /** 数据格式 */
  dataFormat: 'json' | 'string' | 'binary';
}

/* ===================== Android SDK 集成配置 ===================== */

/** Android SDK 集成配置类型 */
export interface AndroidSdkIntegrationConfig {
  /** 目标包名（占位符，不含真实值） */
  packageName: string;
  /** 最低 SDK 版本 */
  minSdkVersion: number;
  /** 目标 SDK 版本 */
  targetSdkVersion: number;
  /** 目标屏幕方向 */
  screenOrientation: 'portrait' | 'landscape' | 'sensorLandscape' | 'sensorPortrait' | 'fullSensor';
  /** 启用的 SDK Adapter 列表 */
  adapters: SdkAdapterSpec[];
  /** 回调路由表 */
  callbackRoutes: SdkCallbackRoute[];
  /** 所需权限汇总 */
  permissions: string[];
  /** FileProvider authority（占位符） */
  fileProviderAuthority: string;
}

/* ===================== 预设 SDK Adapter 模板 ===================== */

/** 创建公开安全的预设 SDK Adapter 列表 */
export function createPresetAdapters(): SdkAdapterSpec[] {
  return [
    // 支付
    {
      id: 'google-play-billing',
      displayName: 'Google Play Billing',
      category: 'payment',
      enabled: false,
      hooks: ['init', 'onActivityCreate', 'onDestroy'],
      capabilities: ['pay'],
      permissions: ['com.android.vending.BILLING'],
      manifestRequirements: [],
      initPlaceholders: {
        PUBLIC_KEY: 'YOUR_BASE64_RSA_PUBLIC_KEY',
        ENABLE_PENDING_PURCHASES: 'true',
      },
      notes: '参考: https://developer.android.com/google/play/billing/integrate',
    },
    // 广告
    {
      id: 'admob',
      displayName: 'AdMob',
      category: 'ads',
      enabled: false,
      hooks: ['init', 'onActivityCreate', 'onResume', 'onPause', 'onDestroy'],
      capabilities: ['showRewardedAd'],
      permissions: [
        'android.permission.INTERNET',
        'android.permission.ACCESS_NETWORK_STATE',
      ],
      manifestRequirements: [
        {
          type: 'activity',
          className: 'com.google.android.gms.ads.AdActivity',
          exported: false,
          hasIntentFilter: false,
          purpose: 'AdMob 全屏广告展示 Activity',
          adapterId: 'admob',
        },
      ],
      initPlaceholders: {
        APP_ID: 'ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX',
        AD_UNIT_ID_REWARDED: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      },
      notes: '参考: https://developers.google.com/admob/android/quick-start',
    },
    // 推送
    {
      id: 'firebase-cloud-messaging',
      displayName: 'Firebase Cloud Messaging',
      category: 'push',
      enabled: false,
      hooks: ['init', 'onActivityCreate', 'onNewIntent'],
      capabilities: ['registerPush'],
      permissions: [
        'android.permission.POST_NOTIFICATIONS',
        'android.permission.INTERNET',
      ],
      manifestRequirements: [
        {
          type: 'service',
          className: 'com.google.firebase.messaging.FirebaseMessagingService',
          exported: false,
          hasIntentFilter: true,
          purpose: 'FCM 消息接收服务',
          adapterId: 'firebase-cloud-messaging',
        },
      ],
      initPlaceholders: {
        DEFAULT_NOTIFICATION_CHANNEL_ID: 'default_channel',
        DEFAULT_NOTIFICATION_ICON: '@drawable/ic_notification',
      },
      notes: '需在 Firebase Console 中下载 google-services.json 并放入项目',
    },
    // 统计
    {
      id: 'firebase-analytics',
      displayName: 'Firebase Analytics',
      category: 'analytics',
      enabled: false,
      hooks: ['init', 'onActivityCreate'],
      capabilities: ['trackEvent'],
      permissions: ['android.permission.INTERNET'],
      manifestRequirements: [],
      initPlaceholders: {
        ANALYTICS_COLLECTION_ENABLED: 'true',
        SESSION_TIMEOUT_DURATION: '1800000',
      },
      notes: '与 FCM 共用 google-services.json，参考: https://firebase.google.com/docs/analytics/get-started?platform=android',
    },
    // 崩溃
    {
      id: 'firebase-crashlytics',
      displayName: 'Firebase Crashlytics',
      category: 'crash',
      enabled: false,
      hooks: ['init', 'onActivityCreate'],
      capabilities: ['collectBugBundle'],
      permissions: ['android.permission.INTERNET'],
      manifestRequirements: [],
      initPlaceholders: {
        CRASHLYTICS_COLLECTION_ENABLED: 'true',
        NATIVE_CRASH_REPORTING: 'true',
      },
      notes: '参考: https://firebase.google.com/docs/crashlytics/get-started?platform=android',
    },
    // 应用内消息 / 客服
    {
      id: 'firebase-inapp-messaging',
      displayName: 'Firebase In-App Messaging',
      category: 'customer-service',
      enabled: false,
      hooks: ['init', 'onActivityCreate', 'onPause', 'onResume'],
      capabilities: ['openCustomerService'],
      permissions: ['android.permission.INTERNET'],
      manifestRequirements: [],
      initPlaceholders: {
        IN_APP_MESSAGING_AUTO_INIT: 'true',
      },
      notes: '参考: https://firebase.google.com/docs/in-app-messaging/get-started?platform=android',
    },
  ];
}

/** 默认 SDK 集成配置（空状态，由 Planner 填充） */
export function createDefaultIntegrationConfig(): AndroidSdkIntegrationConfig {
  return {
    packageName: 'com.example.unitygame',
    minSdkVersion: 24,
    targetSdkVersion: 34,
    screenOrientation: 'sensorLandscape',
    adapters: [],
    callbackRoutes: [],
    permissions: ['android.permission.INTERNET', 'android.permission.ACCESS_NETWORK_STATE'],
    fileProviderAuthority: 'com.example.unitygame.fileprovider',
  };
}
