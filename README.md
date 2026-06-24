# mgai — Mobile Game AI Development Agent

mgai 是一个面向手游开发的本地 MCP Agent。它可以辅助完成游戏需求拆解、技术选型、开发计划、代码生成、知识记忆、调试闭环，以及 UI/动效/游戏手感方向的设计规划。

它不是一个游戏引擎，也不是一个独立 IDE；mgai 更像是可以被 Claude Code、Codex、Cursor 等 MCP 客户端调用的“手游开发副驾驶”。

## Features

- 通过 MCP 暴露本地工具：`status`、`generate_plan`、`generate_code`、`evaluate_tech`、`vector_search`、`list_skills`、`orchestrate`、`debug`。
- 支持 React + Vite + Tailwind、Godot、Unity 的技术选型和 Skill 注册。
- 内置 Planner / Executor / Reflector 编排管线。
- 内置 SQLite 记忆层、向量检索、错误经验、Skill 扫描和多 Agent 编排入口。
- 提供 Web 游戏模板作为示例工程。
- 提供 Debug Session / Bug Bundle 方向的真机排错基础能力。

## Install

```powershell
git clone https://github.com/DandCanon/mobile-game-agent.git
cd mobile-game-agent
npm install
npm run typecheck
npm run self-check
```

常用开发命令：

```powershell
npx tsx cli/mgai.ts --help
npx tsx cli/mgai.ts status
npx tsx cli/mgai.ts health
npx tsx cli/mgai.ts plan "开发一款修仙放置手游"
npx tsx cli/mgai.ts execute "开发一款卡牌对战手游，有抽卡和排位系统"
```

也可以使用 npm script：

```powershell
npm run cli -- status
npm run cli -- plan "开发一款 2D 像素刷宝游戏"
npm run self-check
```

## 开发者完整验证

### 快速确定性校验（提交前运行，< 30 秒）

```powershell
npm run check
```

该命令包含三个快速校验步骤：
- `check:encoding` — 编码检查：遍历所有 .ts/.tsx/.js/.jsx/.json/.md/.mjs/.cjs 文件，确保无 UTF-16 LE BOM，避免 Windows PowerShell 编码问题
- `check:typecheck` — TypeScript 类型检查（`tsc --noEmit`）
- `check:unit` — 纯单元测试（无副作用、无网络、无真实 MCP 连接，超时 10 秒）

**check 不执行 npm install、dev server、真实 MCP、网络请求、设备调试。**

### 集成测试

```powershell
npm run test:integration
```

集成测试允许临时目录文件 I/O，超时 30 秒。包含真实 MCP 服务启动、知识索引构建、E2E 流程等测试，环境变量 `MGAI_INTEGRATION_MODE=true`。

### 全部测试

```powershell
npm run test:all
```

依次运行 `check:unit` + `test:integration`，覆盖全部测试套件。

## MCP Server

mgai 的主要使用方式是作为本地 MCP Server 接入支持 MCP 的 AI 客户端。

推荐阅读：[INSTALL.md](./INSTALL.md)

Codex 示例配置：

```toml
[mcp_servers.mgai]
command = "D:\\path\\to\\mobile-game-agent\\mcp\\run-mcp.cmd"
args = []
env = { MGAI_PROJECT_ROOT = "D:\\path\\to\\mobile-game-agent" }
startup_timeout_sec = 120
```

Claude Code 示例配置：

```json
{
  "mcpServers": {
    "mgai": {
      "command": "npx",
      "args": ["tsx", "D:\\path\\to\\mobile-game-agent\\mcp\\run.ts"],
      "env": {
        "MGAI_PROJECT_ROOT": "D:\\path\\to\\mobile-game-agent"
      }
    }
  }
}
```

> Windows 路径请替换为你本机的项目目录。

## LLM 配置

mgai 可以不配置 LLM，默认使用本地规则、知识库和向量检索。
如果你希望它像 Chatbox / 中转站客户端一样调用外部模型，可以直接在 MCP 里配置，不需要反复重启 Codex/Claude。

1. 在 MCP 客户端里调用 `mgai_llm_configure`，传入 URL 和令牌：

```json
{
  "baseURL": "https://your-router.example.com/v1",
  "apiKey": "your-api-key"
}
```

mgai 会把配置写入 `.env.local`，刷新当前 MCP 进程，并返回模型列表。

2. 从返回的 `models` 里选择一个，再调用一次 `mgai_llm_configure`：

```json
{
  "model": "your-model-name"
}
```

模型会立即在当前 MCP 进程生效，无需重启。配置也会保存在 `.env.local`，下次启动自动读取。

你也可以手动复制 `.env.example` 为 `.env.local` 后填写：

```env
MGAI_LLM_BASE_URL=https://your-router.example.com/v1
MGAI_LLM_API_KEY=your-api-key
MGAI_LLM_MODEL=your-model-name
```

手动改完后调用 `mgai_llm_list_models`，当前 MCP 进程会重新读取配置。
`.env.local` 已被 `.gitignore` 排除，不要把真实令牌提交到 GitHub。

## Web Template

`templates/web-game` 是仓库自带的示例 Web 游戏工程，只适合在 **clone 本仓库后** 试用。

```powershell
cd templates/web-game
npm install
npm run dev
```

如果你是通过 npm 全局安装 mgai，或者只想在自己的项目里调用 Agent，不需要进入这个目录。

## Android Build

README 里提到的 Android 打包不是“安装 mgai”，也不是 mgai 自身需要构建成 Android 应用。

它指的是：当你使用 mgai 或模板生成了一个 Web 技术栈游戏后，可以选择用 Capacitor 把这个 Web 游戏工程打包成 Android 项目，再由 Android Studio 构建安装包。

仅在 `templates/web-game` 或你自己的 Web 游戏工程中使用：

```powershell
npm run build
npm run android:init
npm run android:add
npm run android:sync
npm run android:open
```

注意：

- 第一次执行需要本机已安装 Android Studio、Android SDK、JDK。
- `android:init` / `android:add` 通常只需要执行一次。
- 后续修改 Web 代码后，一般执行 `npm run build && npm run android:sync`。
- Godot / Unity 项目的 Android 包构建应走各自引擎的官方导出流程，不使用这里的 Capacitor 命令。

## Structure

```text
mobile-game-agent/
├── protocol/                 # Agent 接口契约
├── orchestration/            # Planner / Executor / Reflector / Memory / Orchestrator
├── mcp/                      # MCP Server 入口
├── adapters/                 # Marvis / MCP Client 等适配器
├── cli/                      # CLI 入口
├── skills/                   # Godot / Unity / Web 等 Skill
├── src/                      # 品类模块：放置、卡牌、关卡、数值、联网、商业化等
├── public/data/              # 技术选型矩阵等公开数据
├── knowledge/                # 公开安全的知识索引
├── templates/web-game/       # 可选 Web 游戏示例工程
├── tests/                    # 单元测试与集成测试
└── INSTALL.md                # 安装与 MCP 接入说明
```

## Knowledge Cards vs Vector Index

mgai 同时使用知识卡和向量索引，它们不是重复功能：

- **知识卡** 是结构化专家知识：包含来源层级、适用引擎、领域标签、触发词、设计规则、mgai 用法和可执行建议。它适合承载“成功项目里沉淀出来的设计方式、系统结构、UI/数值/玩法经验”。
- **向量索引** 是检索加速层：把知识卡、记忆和项目经验变成可搜索记录，用来从大量内容里找到最相关的几条。

简单说：知识卡负责“知识是什么、怎么用”，向量索引负责“怎么快速找到它”。没有知识卡，向量库只是一堆相似文本；没有向量索引，知识卡多了以后很难高效召回。

## Multi-Agent Collaboration

mgai 可以作为 Codex / Claude Code / GPT 系列模型的手游开发协作 Agent。它不是只能做顾问，也可以生成代码、生成 patch 规格、提供实现建议；但它的优势是带着知识卡、项目扫描和垂类经验来执行。

推荐协作方式：

1. 主开发 Agent 负责读写代码、运行测试、提交改动。
2. mgai 负责项目扫描、知识召回、玩法/UI/数值审查、代码目标定位和交叉验证。
3. 需要协作简报时调用 `mgai_collaboration_brief`。
4. 需要 UI/玩法专项判断时调用 `mgai_ui_review` / `mgai_design_review`。
5. 需要生成代码或 patch 规格时调用 `mgai_generate_code`。

## mgai 与 CCGS 的关系

mgai 的设计灵感部分来自 [Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (MIT License) 的 Studio Workflow 思想——将游戏开发划分为 discovery → concept → systems-design → technical-setup → pre-production → production → polish → release 七个阶段，每个阶段有明确的产物、质量门槛和推荐工具。

但 mgai 是一个独立项目：

- **CCGS** 是 Claude Code 的专属游戏开发工作流（49 agents / 73 skills）
- **mgai** 是通用 MCP 手游开发副驾驶，不绑定特定客户端，可以在 Codex、Claude Code、Cursor、Marvis 等任何支持 MCP 的宿主中运行
- mgai 借鉴了阶段制思路，但做了 MCP Tool 化改造：通过 `mgai_project_stage_detect` / `mgai_gate_check` / `mgai_create_story` / `mgai_dev_story_brief` 等工具实现了 Studio Workflow，但 Agent 数量远少于 CCGS
- CCGS 引用文本遵循 MIT License。mgai 的 Studio Workflow 实现为独立编写，不复制 CCGS 原文

## Existing Project / Brownfield 使用

mgai 不只是"从零开始生成模板"的工具。如果有已有项目，mgai 会自动识别并进入续建模式：

1. 调用 `mgai_analyze_project` 扫描项目结构、已有功能、测试状态、构建脚本。
2. 调用 `mgai_generate_plan` 并传 `mode=continue` + `workspacePath`，自动输出基于现有项目的续建计划。
3. 计划中包含 `existingState`（现有状态）、`gapAnalysis`（缺口分析）、`nextSteps`（下一步）和 `targetFiles`（目标文件）。

已有项目特征识别：

- 检测到 `package.json` / `src/` / `tests/` → Web 项目续建
- 检测到 `godot.project` / `Assets/` → Godot 项目续建
- 检测到 `Assets/` / `ProjectSettings/` → Unity 项目续建
- 自动跳过"初始化模板"阶段，直接进入功能缺口分析和下一步开发建议

## reviewMode: solo / lean / full

所有重型工具（`mgai_gate_check`、`mgai_collaboration_brief`、`mgai_design_review`、`mgai_ui_review`）支持三种审查模式：

| 模式 | 行为 | 是否调用 LLM | 适用场景 |
|------|------|-------------|---------|
| `solo` | 仅执行规则检查（文件存在性、构建通过性、JSON/schema 合法性等） | 否 | 快速自检、CI 流水线 |
| `lean` | 规则检查 + 项目扫描 + 知识卡匹配 | 否（默认） | 日常开发、PR 审查 |
| `full` | 规则检查 + 知识卡 + LLM 多角色深度审查 | 是 | 里程碑检查、发行前审查 |

示例：

```json
// 快速规则检查
{ "reviewMode": "solo" }

// 默认模式（规则 + 知识卡）
{ "reviewMode": "lean" }

// 深度审查
{ "reviewMode": "full" }
```

## Knowledge Cards 如何进入 Story / UI / Gate 流程

mgai 的知识卡不是独立存在——它们被深度嵌入到开发流程的每个环节：

| 流程工具 | 知识卡作用 | 转化形式 |
|---------|-----------|---------|
| `mgai_project_stage_detect` | 根据项目阶段召回对应 playbook | 阶段建议 |
| `mgai_create_story` | 转为 acceptance criteria 和实现约束 | DevStory.acceptanceCriteria |
| `mgai_dev_story_brief` | 转为代码建议和测试建议 | StoryBrief.knowledgeExcerpts + constraints |
| `mgai_ui_review` | 转为组件级建议和 engine-specific tips | TeamUIReport.codeTargets |
| `mgai_design_review` | 转为结构化 Domain Spec | UIInteractionSpec / ProgressionSpec / DungeonSpec 等 |
| `mgai_gate_check` | 转为质量检查项 | blockingItems + suggestions |

每次知识卡召回后，输出中都会标注：

- `usedKnowledgeCards[]`：每张卡的 `cardId` / `title` / `sourceLayer`
- `whyRelevant`：为什么这张卡与当前任务相关
- `appliedAs`：以什么形式应用（`rule` / `suggestion` / `acceptance` / `implementationHint`）

## License

MIT
