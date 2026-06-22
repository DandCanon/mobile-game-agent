# 手游 AI 开发 Agent

> 以「全流程管线」为骨骼、「AI 推理」为大脑、「模块化 Skill」为手脚、「多框架适配」为皮肤的生产级手游开发副驾驶。

## 架构文档

完整分层架构和接口契约 → [架构设计文档.md](./架构设计文档.md)

核心分层：
```
前端交互层 → API Gateway → 编排引擎(Planner/Executor/Reflector) → 工具层 → 框架适配层
                                ↑                    ↑
                           记忆层              安全过滤层 + 观测层
```

## 快速开始

### 试用 Web 游戏模板（Phase 1a 已交付）

```bash
cd templates/web-game
npm install && npm run dev
```

### 打包 APK

```bash
npm run android:init && npm run android:add && npm run android:sync && npm run android:open
```

## 路线图

| Phase | 状态 | 内容 |
|:---:|:---:|------|
| 0 | 待开始 | Agent 接口协议 `agent-protocol` npm 包 |
| 1a | ✅ | Web 放置手游模板（React+Vite+Tailwind）|
| 1b | **下一步** | Planner + Executor + Reflector + 技术选型决策 |
| 1c | 待开始 | 记忆层 + 前端状态机 + 流式输出 |
| 2 | 待开始 | API Gateway + Marvis→Claude Code 适配器 |
| 3 | 待开始 | 安全过滤 + 观测 + 测试体系 |
| 4 | 待开始 | Codex/Hermes/Coze 适配器 + 多引擎模板 |

## 项目结构

```
手游AI开发Agent/
├── 架构设计文档.md            # 生产级分层设计
├── 手游AI开发Agent计划.md      # 制作流程与初始计划
├── protocol/                  # Agent 接口契约（Phase 0）
├── orchestration/             # Planner/Executor/Reflector（Phase 1b）
├── adapters/                  # 框架适配器（Phase 2+）
├── templates/web-game/        # Web 技术栈游戏模板
├── skills/                    # Agent Skill 定义
├── docs/                      # 设计文档
└── tests/                     # 测试
```
