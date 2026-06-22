/**
 * skill-loader.test.ts — Skill 插件系统单元测试
 *
 * 覆盖：扫描/加载/匹配/列表/缓存/重载
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  scanSkills,
  loadSkill,
  matchSkills,
  listSkills,
  reload,
  resetCache,
} from '../orchestration/skill-loader';

let TEST_ROOT: string;
let SKILLS_DIR: string;

function createSkill(
  name: string,
  frontmatter: Record<string, unknown>,
  body = '',
): string {
  const dir = join(SKILLS_DIR, name);
  mkdirSync(dir, { recursive: true });

  let md = '---\n';
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      md += `${key}:\n`;
      for (const item of value) {
        md += `  - ${item}\n`;
      }
    } else {
      md += `${key}: ${value}\n`;
    }
  }
  md += '---\n';
  if (body) {
    md += '\n' + body;
  }
  writeFileSync(join(dir, 'SKILL.md'), md, 'utf-8');
  return dir;
}

function createTemplateFile(skillName: string, fileName: string): string {
  const dir = join(SKILLS_DIR, skillName, 'templates');
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, fileName);
  writeFileSync(filePath, '// template content', 'utf-8');
  return filePath;
}

function createScriptFile(skillName: string, fileName: string): string {
  const dir = join(SKILLS_DIR, skillName, 'scripts');
  mkdirSync(dir, { recursive: true });
  const filePath = join(dir, fileName);
  writeFileSync(filePath, '#!/usr/bin/env node', 'utf-8');
  return filePath;
}

beforeEach(() => {
  TEST_ROOT = join(tmpdir(), `mgai-skill-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  SKILLS_DIR = join(TEST_ROOT, 'skills');
  mkdirSync(SKILLS_DIR, { recursive: true });
  resetCache();
});

afterEach(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

/* ===================== scanSkills ===================== */

describe('scanSkills', () => {
  it('空目录返回空数组', () => {
    const result = scanSkills(SKILLS_DIR);
    expect(result).toEqual([]);
  });

  it('不存在的目录返回空数组', () => {
    const result = scanSkills(join(TEST_ROOT, 'nonexistent'));
    expect(result).toEqual([]);
  });

  it('扫描到单个 Skill', () => {
    createSkill('my-skill', {
      name: 'my-skill',
      version: '1.2.3',
      description: '一个测试 Skill',
      engines: ['react-vite-tailwind'],
      triggers: ['web', 'react'],
      capabilities: ['scaffold'],
    });

    const result = scanSkills(SKILLS_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('my-skill');
    expect(result[0].version).toBe('1.2.3');
    expect(result[0].description).toBe('一个测试 Skill');
    expect(result[0].engines).toEqual(['react-vite-tailwind']);
    expect(result[0].triggers).toEqual(['web', 'react']);
    expect(result[0].capabilities).toEqual(['scaffold']);
    expect(result[0].skillDir).toBe(join(SKILLS_DIR, 'my-skill'));
  });

  it('扫描到多个 Skill', () => {
    createSkill('skill-a', { name: 'skill-a', version: '1.0.0' });
    createSkill('skill-b', { name: 'skill-b', version: '2.0.0' });

    const result = scanSkills(SKILLS_DIR);
    expect(result).toHaveLength(2);
  });

  it('无 name 字段时使用目录名', () => {
    createSkill('dir-named-skill', { version: '1.0.0' });

    const result = scanSkills(SKILLS_DIR);
    expect(result[0].name).toBe('dir-named-skill');
  });

  it('缺少字段使用默认值', () => {
    createSkill('minimal-skill', {});

    const result = scanSkills(SKILLS_DIR);
    expect(result[0].name).toBe('minimal-skill');
    expect(result[0].version).toBe('0.1.0');
    expect(result[0].description).toBe('');
    expect(result[0].engines).toEqual([]);
    expect(result[0].triggers).toEqual([]);
    expect(result[0].capabilities).toEqual([]);
  });

  it('无 SKILL.md 的目录被跳过', () => {
    mkdirSync(join(SKILLS_DIR, 'empty-dir'), { recursive: true });
    createSkill('has-skill', { name: 'has-skill' });

    const result = scanSkills(SKILLS_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('has-skill');
  });

  it('跳过隐藏目录（以 . 开头）', () => {
    const dotDir = join(SKILLS_DIR, '.hidden');
    mkdirSync(dotDir, { recursive: true });
    writeFileSync(join(dotDir, 'SKILL.md'), '---\nname: hidden\n---\n', 'utf-8');

    createSkill('visible', { name: 'visible' });

    const result = scanSkills(SKILLS_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('visible');
  });

  it('内联数组格式解析正确', () => {
    const dir = join(SKILLS_DIR, 'inline-array');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\nname: inline\nengines: [react-vite-tailwind, godot]\ntriggers: [one, two, three]\n---\n',
      'utf-8',
    );

    const result = scanSkills(SKILLS_DIR);
    expect(result[0].engines).toEqual(['react-vite-tailwind', 'godot']);
    expect(result[0].triggers).toEqual(['one', 'two', 'three']);
  });

  it('多行数组格式解析正确', () => {
    createSkill('multi-array', {
      name: 'multi-array',
      engines: ['react-vite-tailwind', 'godot', 'unity'],
      capabilities: ['scaffold', 'engine', 'ui'],
    });

    const result = scanSkills(SKILLS_DIR);
    expect(result[0].engines).toEqual(['react-vite-tailwind', 'godot', 'unity']);
    expect(result[0].capabilities).toEqual(['scaffold', 'engine', 'ui']);
  });
});

/* ===================== loadSkill ===================== */

describe('loadSkill', () => {
  it('加载存在的 Skill 返回完整内容', () => {
    createSkill(
      'full-skill',
      { name: 'full-skill', version: '1.0.0', description: '测试' },
      '# 正文标题\n\n正文内容。',
    );

    scanSkills(SKILLS_DIR);
    const skill = loadSkill('full-skill');

    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('full-skill');
    expect(skill!.version).toBe('1.0.0');
    expect(skill!.content).toBe('# 正文标题\n\n正文内容。');
    expect(skill!.templates).toEqual([]);
    expect(skill!.scripts).toEqual([]);
  });

  it('加载不存在的 Skill 返回 null', () => {
    scanSkills(SKILLS_DIR);
    const skill = loadSkill('nonexistent');
    expect(skill).toBeNull();
  });

  it('加载带 templates 的 Skill', () => {
    createSkill('with-templates', { name: 'with-templates' });
    const tmplPath = createTemplateFile('with-templates', 'component.tsx');

    scanSkills(SKILLS_DIR);
    const skill = loadSkill('with-templates');

    expect(skill!.templates).toHaveLength(1);
    expect(skill!.templates[0]).toBe(tmplPath);
  });

  it('加载带 scripts 的 Skill', () => {
    createSkill('with-scripts', { name: 'with-scripts' });
    const scriptPath = createScriptFile('with-scripts', 'setup.ps1');

    scanSkills(SKILLS_DIR);
    const skill = loadSkill('with-scripts');

    expect(skill!.scripts).toHaveLength(1);
    expect(skill!.scripts[0]).toBe(scriptPath);
  });

  it('加载带 templates 和 scripts 的 Skill', () => {
    createSkill('with-both', { name: 'with-both' });
    const tmplPath1 = createTemplateFile('with-both', 'a.tsx');
    const tmplPath2 = createTemplateFile('with-both', 'b.ts');
    const scriptPath = createScriptFile('with-both', 'run.sh');

    scanSkills(SKILLS_DIR);
    const skill = loadSkill('with-both');

    expect(skill!.templates).toHaveLength(2);
    expect(skill!.templates).toContain(tmplPath1);
    expect(skill!.templates).toContain(tmplPath2);
    expect(skill!.scripts).toHaveLength(1);
    expect(skill!.scripts[0]).toBe(scriptPath);
  });

  it('无缓存时传入 skillsDir 可正常加载', () => {
    createSkill('no-cache', { name: 'no-cache', version: '2.0.0' });

    resetCache();

    const skill = loadSkill('no-cache', SKILLS_DIR);
    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('no-cache');
    expect(skill!.version).toBe('2.0.0');
  });
});

/* ===================== matchSkills ===================== */

describe('matchSkills', () => {
  beforeEach(() => {
    createSkill('web-skill', {
      name: 'web-skill',
      description: 'Web 技术栈开发',
      triggers: ['web', 'react', 'vite'],
    });
    createSkill('card-skill', {
      name: 'card-skill',
      description: '卡牌游戏引擎',
      triggers: ['卡牌', 'card', '抽卡'],
    });
    createSkill('idle-skill', {
      name: 'idle-skill',
      description: '放置类游戏',
      triggers: ['放置', 'idle', '点击'],
    });
    scanSkills(SKILLS_DIR);
  });

  it('按关键词匹配单个 Skill', () => {
    const result = matchSkills('web 前端开发');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('web-skill');
  });

  it('按中文关键词匹配', () => {
    const result = matchSkills('做一个卡牌对战游戏');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('card-skill');
  });

  it('匹配多个 Skill', () => {
    const result = matchSkills('用 web 技术开发放置游戏');
    expect(result).toHaveLength(2);
  });

  it('无匹配时返回空数组', () => {
    const result = matchSkills('3D 射击游戏');
    expect(result).toEqual([]);
  });

  it('空需求文本返回全部 Skill', () => {
    const result = matchSkills('');
    expect(result).toHaveLength(3);
  });

  it('缓存为空时返回空数组', () => {
    resetCache();
    const result = matchSkills('测试');
    expect(result).toEqual([]);
  });
});

/* ===================== listSkills ===================== */

describe('listSkills', () => {
  it('返回已扫描的 Skill 列表', () => {
    createSkill('skill-1', { name: 'skill-1' });
    createSkill('skill-2', { name: 'skill-2' });
    scanSkills(SKILLS_DIR);

    const result = listSkills();
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name).sort()).toEqual(['skill-1', 'skill-2']);
  });

  it('未扫描时返回空数组', () => {
    resetCache();
    const result = listSkills();
    expect(result).toEqual([]);
  });

  it('返回的是浅拷贝（修改不影响内部缓存）', () => {
    createSkill('copy-test', { name: 'copy-test' });
    scanSkills(SKILLS_DIR);

    const result1 = listSkills();
    result1.pop(); // 修改返回的数组

    const result2 = listSkills();
    expect(result2).toHaveLength(1);
    expect(result2[0].name).toBe('copy-test');
  });
});

/* ===================== 缓存机制 ===================== */

describe('缓存机制', () => {
  it('首次扫描后命中缓存（不重复读磁盘）', () => {
    createSkill('cached', { name: 'cached' });

    const result1 = scanSkills(SKILLS_DIR);
    expect(result1).toHaveLength(1);

    // 删除源文件
    rmSync(join(SKILLS_DIR, 'cached'), { recursive: true, force: true });

    // 第二次调用应返回缓存结果
    const result2 = scanSkills(SKILLS_DIR);
    expect(result2).toHaveLength(1);
    expect(result2[0].name).toBe('cached');
  });
});

/* ===================== reload ===================== */

describe('reload', () => {
  it('reload 后反映文件系统变化', () => {
    createSkill('orig', { name: 'orig' });

    const result1 = scanSkills(SKILLS_DIR);
    expect(result1).toHaveLength(1);
    expect(result1[0].name).toBe('orig');

    // 删除旧 Skill，新建新 Skill
    rmSync(join(SKILLS_DIR, 'orig'), { recursive: true, force: true });
    createSkill('replaced', { name: 'replaced' });

    const result2 = reload(SKILLS_DIR);
    expect(result2).toHaveLength(1);
    expect(result2[0].name).toBe('replaced');
  });

  it('reload 空目录清除缓存', () => {
    createSkill('temp-skill', { name: 'temp-skill' });

    const result1 = scanSkills(SKILLS_DIR);
    expect(result1).toHaveLength(1);

    // 清空目录并 reload
    rmSync(SKILLS_DIR, { recursive: true, force: true });
    mkdirSync(SKILLS_DIR, { recursive: true });

    const result2 = reload(SKILLS_DIR);
    expect(result2).toEqual([]);
  });

  it('reload 后新增 Skill 被扫描到', () => {
    createSkill('first', { name: 'first' });

    const result1 = scanSkills(SKILLS_DIR);
    expect(result1).toHaveLength(1);

    // 新增 Skill
    createSkill('second', { name: 'second' });

    const result2 = reload(SKILLS_DIR);
    expect(result2).toHaveLength(2);
    expect(result2.map((s) => s.name).sort()).toEqual(['first', 'second']);
  });
});

/* ===================== 边界情况 ===================== */

describe('边界情况', () => {
  it('SKILL.md 无 frontmatter 时返回默认值', () => {
    const dir = join(SKILLS_DIR, 'no-frontmatter');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '# 纯 Markdown\n没有 frontmatter。', 'utf-8');

    scanSkills(SKILLS_DIR);
    const skill = loadSkill('no-frontmatter');

    expect(skill).not.toBeNull();
    expect(skill!.name).toBe('no-frontmatter');
    expect(skill!.version).toBe('0.1.0');
    expect(skill!.content).toContain('# 纯 Markdown');
  });

  it('frontmatter 只有起始 --- 无结束 ---', () => {
    const dir = join(SKILLS_DIR, 'broken-frontmatter');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), '---\nname: broken\n没有结束标记', 'utf-8');

    const result = scanSkills(SKILLS_DIR);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('broken-frontmatter');
  });

  it('YAML 注释被忽略', () => {
    const dir = join(SKILLS_DIR, 'with-comments');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\n# 这是一个注释\nname: with-comments\n# 另一个注释\nversion: 3.0.0\n---\n',
      'utf-8',
    );

    const result = scanSkills(SKILLS_DIR);
    expect(result[0].name).toBe('with-comments');
    expect(result[0].version).toBe('3.0.0');
  });

  it('单值引擎/触发词被包装为数组', () => {
    const dir = join(SKILLS_DIR, 'single-value');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      '---\nname: single-value\nengines: react-vite-tailwind\ntriggers: web\ncapabilities: scaffold\n---\n',
      'utf-8',
    );

    const result = scanSkills(SKILLS_DIR);
    expect(result[0].engines).toEqual(['react-vite-tailwind']);
    expect(result[0].triggers).toEqual(['web']);
    expect(result[0].capabilities).toEqual(['scaffold']);
  });
});
