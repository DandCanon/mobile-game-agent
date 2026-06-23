/**
 * Manifest 规则校验器
 *
 * 对 Unity Android 项目的 AndroidManifest.xml 进行结构化校验，
 * 覆盖 Activity 完整性、元数据、权限、导出声明、组件唯一性等维度。
 *
 * 本模块不解析真实 XML 文件；它提供规则函数，供 Planner/Reflector
 * 在代码生成与自检阶段调用。
 *
 * 所有规则均为公开安全的最佳实践，不含私有内容。
 */

/* ===================== 数据结构 ===================== */

/** 单条校验结果 */
export interface ManifestValidationIssue {
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion: string;
}

/** Manifest 校验输入 */
export interface ManifestValidationInput {
  /** 主 Activity 类名 */
  mainActivityClass?: string;
  /** Unity 相关 metadata 键列表 */
  unityMetadataKeys: string[];
  /** 声明的屏幕方向 */
  screenOrientation?: string;
  /** configChanges 设置 */
  configChanges?: string;
  /** 所有组件的 exported 声明情况（组件清名 → 是否显式声明 exported） */
  componentExportedMap: Record<string, boolean>;
  /** FileProvider authorities 列表 */
  fileProviderAuthorities: string[];
  /** 已声明的权限列表 */
  permissions: string[];
  /** SDK Adapter 组件清单（组件类型/类名） */
  sdkComponents: Array<{ type: string; className: string }>;
  /** 是否在模板中检测到疑似真实密钥（超过一定长度且非占位符的字符串） */
  containsPotentialSecrets: boolean;
  /** 是否已生成真机 smoke test 文档 */
  smokeTestDocExists: boolean;
}

/** Manifest 校验结果 */
export interface ManifestValidationResult {
  /** 是否全部通过（无 error 级别的问题） */
  passed: boolean;
  /** 问题列表 */
  issues: ManifestValidationIssue[];
  /** 校验摘要 */
  summary: string;
}

/* ===================== 校验规则 ===================== */

/**
 * 对 AndroidManifest 进行完整校验。
 *
 * @param input 校验输入
 * @returns 包含问题列表和通过状态的校验结果
 */
export function validateManifest(
  input: ManifestValidationInput,
): ManifestValidationResult {
  const issues: ManifestValidationIssue[] = [];

  // 规则 1: Main Activity 是否存在
  if (!input.mainActivityClass || input.mainActivityClass.trim() === '') {
    issues.push({
      rule: 'MAIN_ACTIVITY_EXISTS',
      severity: 'error',
      message: '未声明 Main Activity',
      suggestion:
        '在 manifest 中声明 Unity 主 Activity，例如 com.unity3d.player.UnityPlayerActivity',
    });
  }

  // 规则 2: Unity Activity metadata 是否存在
  if (input.unityMetadataKeys.length === 0) {
    issues.push({
      rule: 'UNITY_METADATA_EXISTS',
      severity: 'warning',
      message: '未找到 Unity 相关 metadata 声明',
      suggestion:
        '确保包含 unityplayer.UnityActivity 等 Unity 引擎所需的 meta-data 标签',
    });
  }

  // 规则 3: screenOrientation / configChanges 校验
  if (!input.screenOrientation) {
    issues.push({
      rule: 'SCREEN_ORIENTATION_DECLARED',
      severity: 'warning',
      message: 'Main Activity 未声明 android:screenOrientation',
      suggestion:
        '显式声明屏幕方向（portrait / landscape / sensorLandscape / sensorPortrait / fullSensor）',
    });
  }

  if (!input.configChanges || !input.configChanges.includes('orientation')) {
    issues.push({
      rule: 'CONFIG_CHANGES_COMPLETE',
      severity: 'warning',
      message: 'configChanges 未包含 orientation|screenSize|keyboardHidden',
      suggestion:
        'Unity 项目建议设置 configChanges="orientation|screenSize|keyboardHidden" 避免 Activity 重建',
    });
  }

  // 规则 4: android:exported 显式声明
  const componentsWithoutExported = Object.entries(
    input.componentExportedMap,
  ).filter(([, exported]) => !exported);
  if (componentsWithoutExported.length > 0) {
    issues.push({
      rule: 'EXPORTED_EXPLICIT',
      severity: 'error',
      message: `以下组件未显式声明 android:exported: ${componentsWithoutExported
        .map(([name]) => name)
        .join(', ')}`,
      suggestion:
        'Android 12+ (API 31+) 要求所有 intent-filter 组件显式设置 android:exported。对其他组件也建议显式声明以提升安全性。',
    });
  }

  // 规则 5: FileProvider authorities 是否唯一
  if (input.fileProviderAuthorities.length > 1) {
    const duplicates = findDuplicates(input.fileProviderAuthorities);
    if (duplicates.length > 0) {
      issues.push({
        rule: 'FILEPROVIDER_AUTHORITY_UNIQUE',
        severity: 'error',
        message: `FileProvider authorities 存在重复: ${duplicates.join(', ')}`,
        suggestion:
          '使用 ${applicationId}.fileprovider 模式确保多包名环境下的唯一性',
      });
    }
  }

  // 规则 6: SDK Adapter 组件声明完整性
  if (input.sdkComponents.length > 0) {
    for (const sdkComp of input.sdkComponents) {
      const found = Object.keys(input.componentExportedMap).some(
        (declared) =>
          declared.includes(sdkComp.className) ||
          declared.endsWith(sdkComp.className),
      );
      if (!found) {
        issues.push({
          rule: 'SDK_COMPONENT_DECLARED',
          severity: 'warning',
          message: `SDK 组件 ${sdkComp.className} (${sdkComp.type}) 未在 manifest 中声明`,
          suggestion: `在 <application> 中添加 <${sdkComp.type} android:name="${sdkComp.className}">`,
        });
      }
    }
  }

  // 规则 7: 敏感权限说明
  const sensitivePermissions = [
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.READ_CONTACTS',
    'android.permission.WRITE_CONTACTS',
    'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO',
    'android.permission.READ_PHONE_STATE',
    'android.permission.CALL_PHONE',
    'android.permission.READ_SMS',
    'android.permission.SEND_SMS',
    'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE',
    'android.permission.MANAGE_EXTERNAL_STORAGE',
  ];
  const declaredSensitive = input.permissions.filter((p) =>
    sensitivePermissions.includes(p),
  );
  if (declaredSensitive.length > 0) {
    issues.push({
      rule: 'SENSITIVE_PERMISSION_JUSTIFICATION',
      severity: 'info',
      message: `声明了 ${declaredSensitive.length} 项敏感权限: ${declaredSensitive.join(', ')}`,
      suggestion:
        '请确保在应用说明文档或 Google Play 数据安全表单中为每项敏感权限提供使用说明。如非必要，建议移除。',
    });
  }

  // 规则 8: 模板中不能包含真实 production secrets
  if (input.containsPotentialSecrets) {
    issues.push({
      rule: 'NO_PRODUCTION_SECRETS',
      severity: 'error',
      message:
        '模板或配置中疑似包含真实 production secrets（密钥/证书/Token）',
      suggestion:
        '所有密钥应通过环境变量或安全配置中心注入，模板中仅保留占位符（如 YOUR_API_KEY）',
    });
  }

  // 规则 9: 真机 smoke test 文档
  if (!input.smokeTestDocExists) {
    issues.push({
      rule: 'SMOKE_TEST_DOC_EXISTS',
      severity: 'warning',
      message: '未生成 Android 真机 smoke test 文档',
      suggestion:
        '运行 Device Debug Agent 自动生成 docs/DEBUGGING.md 和 docs/BUG_REPORT_TEMPLATE.md',
    });
  }

  // 判定结果
  const hasErrors = issues.some((i) => i.severity === 'error');
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  const summary = hasErrors
    ? `Manifest 校验未通过: ${errorCount} 错误, ${warningCount} 警告, ${infoCount} 提示`
    : `Manifest 校验通过 (${warningCount} 警告, ${infoCount} 提示)`;

  return {
    passed: !hasErrors,
    issues,
    summary,
  };
}

/**
 * 从适配器列表生成校验输入。
 *
 * @param adapters 已启用的 SDK Adapter 规格列表
 * @param manifestInput 基础 Manifest 数据
 * @returns 合并后的校验输入
 */
export function buildValidationInput(
  adapters: Array<{
    manifestRequirements: Array<{ type: string; className: string }>;
    permissions: string[];
  }>,
  manifestInput: Partial<ManifestValidationInput>,
): ManifestValidationInput {
  const sdkComponents = adapters.flatMap((a) => a.manifestRequirements);
  const permissionSet = new Set<string>();
  adapters.forEach((a) => a.permissions.forEach((p) => permissionSet.add(p)));

  return {
    mainActivityClass:
      manifestInput.mainActivityClass ?? 'com.unity3d.player.UnityPlayerActivity',
    unityMetadataKeys: manifestInput.unityMetadataKeys ?? [],
    screenOrientation: manifestInput.screenOrientation ?? undefined,
    configChanges: manifestInput.configChanges ?? undefined,
    componentExportedMap: manifestInput.componentExportedMap ?? {},
    fileProviderAuthorities: manifestInput.fileProviderAuthorities ?? [],
    permissions: [...permissionSet, ...(manifestInput.permissions ?? [])],
    sdkComponents,
    containsPotentialSecrets: manifestInput.containsPotentialSecrets ?? false,
    smokeTestDocExists: manifestInput.smokeTestDocExists ?? false,
  };
}

/* ===================== 辅助函数 ===================== */

function findDuplicates(arr: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of arr) {
    if (seen.has(item)) {
      duplicates.add(item);
    } else {
      seen.add(item);
    }
  }
  return [...duplicates];
}
