---
name: engine-web
version: 1.0.0
description: Web 技术栈手游开发技能 — 专精 React + Vite + Tailwind CSS 技术栈的轻量手游开发
engines:
  - react-vite-tailwind
triggers:
  - web
  - react
  - vite
  - tailwind
  - h5
  - capacitor
capabilities:
  - project-scaffold
  - game-engine
  - numeric-system
  - ui-components
  - local-storage
  - apk-packaging
---

# engine-web Skill 规格说明

## 身份
Web 技术栈手游开发技能 — 专精 React + Vite + Tailwind CSS 技术栈的轻量手游开发。

## 触发条件
当用户的技术选型结果是 Web 技术栈（React/Vite/Tailwind/Capacitor），或用户明确要求使用 Web 方式开发手游时加载本 Skill。

## 能力边界

### 覆盖范围
- 项目脚手架生成（React + Vite + Tailwind + Capacitor）
- 游戏核心逻辑模板生成（放置/卡牌/休闲/文字冒险 等品类）
- 数值系统建模与平衡辅助
- UI 组件库（游戏风格 Tailwind 组件）
- 本地存储方案（localStorage / IndexedDB）
- APK 打包流程（Capacitor → Android Studio）
- 性能优化建议（WebView 动画优化、内存管理）
- 触摸手势适配

### 不覆盖范围
- 3D 渲染（应使用 Godot/Unity Skill）
- 复杂物理引擎
- 实时多人网络同步

## 模板品类

| 模板 ID | 品类 | 特征 |
|---------|------|------|
| `idle` | 放置类 | 点击+自动收益、升级树、离线收益、成就系统 |
| `card` | 卡牌类 | 抽卡、卡组构建、回合制对战 |
| `casual` | 休闲类 | 消除、合并、三消 |
| `text-adventure` | 文字冒险 | 分支剧情、属性检定、多结局 |
| `tower-defense` | 塔防 | 路径规划、塔升级、波次系统 |

## 目录结构规范

```
项目根目录/
├── src/
│   ├── game/
│   │   ├── types.ts          # 游戏数据类型
│   │   ├── GameEngine.ts     # 纯逻辑引擎（无 UI 依赖）
│   │   └── components/       # 游戏 UI 组件
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── capacitor.config.ts       # APK 打包配置（生成时自动创建）
```

## 与主 Agent 的协作协议

1. 主 Agent 通过技术选型决策引擎确定本项目使用 Web 技术栈
2. 主 Agent 根据游戏品类选择对应模板 ID
3. engine-web Skill 生成项目代码
4. engine-web Skill 返回项目路径 + 品类特征清单给主 Agent
5. 后续迭代中，主 Agent 将数值调优、UI 修改等任务派发回 engine-web Skill
