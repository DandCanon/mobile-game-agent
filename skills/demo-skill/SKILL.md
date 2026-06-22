---
name: demo-skill
version: 0.1.0
description: 测试用 Skill，用于验证 Skill 插件系统的扫描、加载、匹配、缓存和重载功能
engines:
  - react-vite-tailwind
triggers:
  - demo
  - test
  - 测试
  - 验证
capabilities:
  - demo
  - test
---

# demo-skill

## 身份

测试用 Skill，不提供实际游戏开发能力，仅用于验证 Skill 插件系统的基础功能。

## 触发条件

当用户任务中包含 "demo"、"test"、"测试"、"验证" 等关键词时可能被匹配。

## 能力边界

### 覆盖范围
- 提供测试输出，验证 Skill 系统各 API 正常工作

### 不覆盖范围
- 不提供任何实际游戏开发能力

## 测试验证项

1. `scanSkills()` 应能发现本 Skill
2. `loadSkill("demo-skill")` 应返回完整的 SKILL.md 正文
3. `matchSkills("运行 demo 测试")` 应包含本 Skill
4. `listSkills()` 应列出本 Skill
5. `reload()` 应能重新扫描

## 关联资源

本 Skill 的 `templates/` 和 `scripts/` 目录为可选，测试时可选择性地在其中放置文件以验证 `loadSkill()` 的资源发现功能。
