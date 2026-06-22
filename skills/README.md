# Skill 目录结构规范

## 概述

Skill 是手游 AI 开发 Agent 的插件化能力模块。每个 Skill 以独立目录的形式存放在 `skills/` 下，Agent 启动时自动扫描并注册。

## 目录结构

```
skills/{skill-name}/
├── SKILL.md        # Skill 定义文件（必须）
├── templates/      # 可选：关联的代码模板
└── scripts/        # 可选：关联的脚本
```

### SKILL.md 格式

SKILL.md 是 Skill 的核心定义文件，采用 **YAML frontmatter + Markdown 正文** 格式：

```markdown
---
name: skill-name
version: 1.0.0
description: Skill 功能描述
engines:
  - react-vite-tailwind
  - godot
triggers:
  - 关键词1
  - 关键词2
capabilities:
  - 能力1
  - 能力2
---

# Skill 正文

这里写 Skill 的使用说明、工作流、约束条件等 Markdown 内容。
```

### YAML Frontmatter 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | string | 否 | Skill 名称。未指定时使用目录名 |
| `version` | string | 否 | 语义化版本号，默认 `0.1.0` |
| `description` | string | 否 | Skill 功能描述，用于匹配和展示 |
| `engines` | string[] | 否 | 适配的游戏引擎列表 |
| `triggers` | string[] | 否 | 触发关键词，用于 matchSkills() 匹配 |
| `capabilities` | string[] | 否 | 能力标签列表 |

### templates/ 目录（可选）

存放与该 Skill 关联的代码模板文件（如 `.tsx`、`.ts`、`.html` 等）。`loadSkill()` 会返回该目录下所有文件的绝对路径。

### scripts/ 目录（可选）

存放与该 Skill 关联的脚本文件（如 `.py`、`.sh`、`.ps1` 等）。`loadSkill()` 会返回该目录下所有文件的绝对路径。

## 已有 Skill 列表

| Skill | 版本 | 描述 |
|-------|------|------|
| `engine-web` | 1.0.0 | Web 技术栈手游开发（React + Vite + Tailwind） |
| `demo-skill` | 0.1.0 | 测试用 Skill，用于验证插件系统功能 |

## 添加新 Skill

1. 在 `skills/` 下创建 `{skill-name}/` 目录
2. 创建 `SKILL.md` 并填写 YAML frontmatter
3. （可选）添加 `templates/` 和 `scripts/` 目录
4. Agent 重启后自动发现并注册
