/**
 * Skill Loader — Skill 插件自动扫描注册机制
 *
 * 职责：
 * 1. 递归扫描 skills/ 目录，解析 SKILL.md 的 YAML frontmatter
 * 2. 提供 Skill 加载、匹配、列表、缓存、重载功能
 * 3. 为 Planner 和 MCP Server 提供 Skill 元信息查询
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* ===================== 类型定义 ===================== */

/** Skill 元信息清单 */
export interface SkillManifest {
  /** Skill 名称（来自 frontmatter 的 name 字段，或目录名） */
  name: string;
  /** 版本号 */
  version: string;
  /** Skill 功能描述 */
  description: string;
  /** 适配的游戏引擎列表 */
  engines: string[];
  /** 触发关键词（用于匹配用户需求） */
  triggers: string[];
  /** 能力列表 */
  capabilities: string[];
  /** Skill 目录的绝对路径 */
  skillDir: string;
}

/** 完整加载的 Skill（含正文 + 关联资源路径） */
export interface Skill extends SkillManifest {
  /** SKILL.md 正文内容（去除 frontmatter 后） */
  content: string;
  /** templates/ 目录下的文件绝对路径列表 */
  templates: string[];
  /** scripts/ 目录下的文件绝对路径列表 */
  scripts: string[];
}

/* ===================== YAML Frontmatter 解析 ===================== */

/** 简易 YAML frontmatter 解析结果 */
interface ParsedFrontmatter {
  meta: Record<string, unknown>;
  body: string;
}

/**
 * 解析 SKILL.md 的 YAML frontmatter。
 * 支持格式：
 *   ---
 *   key: value
 *   list: [a, b, c]
 *   multi:
 *     - item1
 *     - item2
 *   ---
 *   正文内容...
 */
function parseFrontmatter(text: string): ParsedFrontmatter {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: text };
  }
  return {
    meta: parseSimpleYaml(match[1]),
    body: match[2],
  };
}

/** 解析简易 YAML（仅支持 string / string[] 类型值） */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split(/\r?\n/);
  let currentKey = '';
  let currentArray: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    // 多行数组项：  - item
    const arrayItemMatch = line.match(/^\s+-\s+(.+)$/);
    if (arrayItemMatch && currentKey) {
      currentArray.push(arrayItemMatch[1].trim());
      continue;
    }

    // 遇到新 key：先冲刷旧数组
    if (currentKey && currentArray.length > 0) {
      result[currentKey] = currentArray;
      currentArray = [];
    }
    currentKey = '';

    // key: value 行
    const kvMatch = line.match(/^(\w[\w-]*)\s*:\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1];
      const value = kvMatch[2].trim();

      // 内联数组：[a, b, c]
      if (value.startsWith('[') && value.endsWith(']')) {
        result[key] = value
          .slice(1, -1)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        result[key] = value;
        // 可能下一行是多行数组，暂存 key
        currentKey = key;
      }
    }
  }

  // 冲刷最后的数组
  if (currentKey && currentArray.length > 0) {
    result[currentKey] = currentArray;
  }

  return result;
}

/** 安全提取字符串数组 */
function extractStringArray(
  meta: Record<string, unknown>,
  key: string,
): string[] {
  const val = meta[key];
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === 'string') return [val];
  return [];
}

/* ===================== 缓存 ===================== */

let skillCache: SkillManifest[] | null = null;

/* ===================== 公共 API ===================== */

/**
 * 扫描 skills/ 目录，返回所有 Skill 的元信息清单。
 * 首次调用后结果缓存在内存中，后续调用直接返回缓存。
 *
 * @param skillsDir skills 目录的绝对路径
 */
export function scanSkills(skillsDir: string): SkillManifest[] {
  if (skillCache) return skillCache;

  if (!existsSync(skillsDir)) {
    skillCache = [];
    return skillCache;
  }

  const manifests: SkillManifest[] = [];
  let entries;

  try {
    entries = readdirSync(skillsDir, { withFileTypes: true });
  } catch {
    skillCache = [];
    return skillCache;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // 跳过非 Skill 的目录（如 .git、node_modules 等隐藏目录，或 README.md 所在的根）
    if (entry.name.startsWith('.')) continue;

    const skillDir = join(skillsDir, entry.name);
    const skillMdPath = join(skillDir, 'SKILL.md');

    if (!existsSync(skillMdPath)) continue;

    let content: string;
    try {
      content = readFileSync(skillMdPath, 'utf-8');
    } catch {
      continue; // 读取失败则跳过
    }

    const { meta } = parseFrontmatter(content);

    manifests.push({
      name: (meta.name as string) || entry.name,
      version: (meta.version as string) || '0.1.0',
      description: (meta.description as string) || '',
      engines: extractStringArray(meta, 'engines'),
      triggers: extractStringArray(meta, 'triggers'),
      capabilities: extractStringArray(meta, 'capabilities'),
      skillDir,
    });
  }

  skillCache = manifests;
  return skillCache;
}

/**
 * 加载指定 Skill 的完整内容，包括 SKILL.md 正文以及
 * templates/ 和 scripts/ 目录下的所有关联文件路径。
 *
 * @param name Skill 名称（对应 frontmatter 中的 name）
 * @param skillsDir skills 目录（缓存为空时需要）
 * @returns 完整的 Skill 对象，未找到时返回 null
 */
export function loadSkill(name: string, skillsDir?: string): Skill | null {
  const manifests =
    skillCache ?? (skillsDir ? scanSkills(skillsDir) : []);
  const manifest = manifests.find((m) => m.name === name);
  if (!manifest) return null;

  const skillMdPath = join(manifest.skillDir, 'SKILL.md');
  const rawContent = readFileSync(skillMdPath, 'utf-8');
  const { body } = parseFrontmatter(rawContent);

  // 扫描 templates/ 目录
  const templatesDir = join(manifest.skillDir, 'templates');
  const templates: string[] = [];
  if (existsSync(templatesDir)) {
    try {
      const files = readdirSync(templatesDir, { recursive: true }) as string[];
      for (const f of files) {
        const fullPath = join(templatesDir, f);
        if (statSync(fullPath).isFile()) {
          templates.push(fullPath);
        }
      }
    } catch {
      // 扫描失败忽略
    }
  }

  // 扫描 scripts/ 目录
  const scriptsDir = join(manifest.skillDir, 'scripts');
  const scripts: string[] = [];
  if (existsSync(scriptsDir)) {
    try {
      const files = readdirSync(scriptsDir, { recursive: true }) as string[];
      for (const f of files) {
        const fullPath = join(scriptsDir, f);
        if (statSync(fullPath).isFile()) {
          scripts.push(fullPath);
        }
      }
    } catch {
      // 扫描失败忽略
    }
  }

  return {
    ...manifest,
    content: body.trim(),
    templates,
    scripts,
  };
}

/**
 * 根据需求文本匹配相关 Skill。
 * 匹配策略：将 Skill 的 name / description / triggers 按空白/标点拆分为 token，
 * 然后检查这些 token 是否出现在需求文本中（反向匹配，兼容中英文混合场景）。
 *
 * @param requirement 用户需求文本
 * @returns 匹配的 Skill 清单列表（按原扫描顺序）
 */
export function matchSkills(requirement: string): SkillManifest[] {
  const manifests = skillCache ?? [];
  const trimmed = requirement.trim();
  if (!trimmed) return [...manifests];

  const lowered = trimmed.toLowerCase();

  return manifests.filter((m) => {
    const tokens = [
      m.name,
      m.description,
      ...m.triggers,
    ]
      .join(' ')
      .toLowerCase()
      .split(/[\s,，、]+/)
      .filter((t) => t.length >= 2);
    return tokens.some((t) => lowered.includes(t));
  });
}

/**
 * 列出所有已扫描的 Skill 清单。
 *
 * @returns Skill 清单列表（浅拷贝）
 */
export function listSkills(): SkillManifest[] {
  return [...(skillCache ?? [])];
}

/**
 * 强制重扫 skills/ 目录，清除缓存后重新扫描。
 *
 * @param skillsDir skills 目录的绝对路径
 * @returns 重新扫描后的 Skill 清单列表
 */
export function reload(skillsDir: string): SkillManifest[] {
  resetCache();
  return scanSkills(skillsDir);
}

/**
 * 清除内存缓存（仅供测试或强制重扫场景使用）。
 * 调用后下一次 scanSkills / loadSkill 将重新读取磁盘。
 */
export function resetCache(): void {
  skillCache = null;
}
