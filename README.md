# mgai — Mobile Game AI Development Agent

mgai 是一个面向手游开发的本地 MCP Agent。它可以辅助完成游戏需求拆解、技术选型、开发计划、代码生成、知识记忆、调试闭环，以及 UI/动效/游戏手感方向的设计规划。

它不是一个游戏引擎，也不是一个独立 IDE；mgai 更像是可以被 Claude Code、Codex、Cursor 等 MCP 客户端调用的“手游开发副驾驶”。

## 当前能力

- 通过 MCP 暴露本地工具：`status`、`generate_plan`、`generate_code`、`evaluate_tech`、`vector_search`、`list_skills`、`orchestrate`、`debug`。
- 支持 React + Vite + Tailwind、Godot、Unity 的技术选型和 Skill 注册。
- 内置 Planner / Executor / Reflector 编排管线。
- 内置 SQLite 记忆层、向量检索、错误经验、Skill 扫描和多 Agent 编排入口。
- 提供 Web 游戏模板作为示例工程。
- 提供 Debug Session / Bug Bundle 方向的真机排错基础能力。

## 安装与自检

```powershell
git clone https://github.com/DandCanon/mobile-game-agent.git
cd mobile-game-agent
npm install
npm run check
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

## 作为 MCP Server 使用

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

## 试用 Web 游戏模板

`templates/web-game` 是仓库自带的示例 Web 游戏工程，只适合在 **clone 本仓库后** 试用。

```powershell
cd templates/web-game
npm install
npm run dev
```

如果你是通过 npm 全局安装 mgai，或者只想在自己的项目里调用 Agent，不需要进入这个目录。

## 关于 Android 安装包构建

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

## 项目结构

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
├── INSTALL.md                # 安装与 MCP 接入说明
└── 手游AI开发Agent计划.md      # 开发计划与后续 Track / Milestone
```

## 后续路线

v0.8.0 之后不再继续堆叠长 Phase，后续开发以 Track / Milestone 推进：

- T1 Memory v2：Working / Conversation / Project / Knowledge / Profile 五层记忆。
- T2 Hybrid Reflector：规则优先，失败时再调用 LLM。
- T3 Knowledge Memory：外部知识索引与成长型知识库。
- T4 Device Debug Agent：Debug Contract、bug bundle、Android ADB 实机排错。
- T5 Engine-native Genre Pipelines：Godot / Unity 引擎原生品类纵切。
- T6 Game Feel & UI Aesthetic System：UI Style Director、Motion Token、风格包与动效知识索引。

详见：[手游AI开发Agent计划.md](./手游AI开发Agent计划.md)

## 私有知识与版权边界

公开仓库只保留通用代码、公开安全知识和示例模板。

不要提交：

- Android 安装包文件
- 私有竞品分析报告
- 原始素材、低清预览图、引擎预制体、动画工程源文件、脚本字节码
- `.memory/`、`logs/`、SQLite 数据库
- 本地私有知识库

mgai 可以在本地读取私有知识增强开发体验，但这些内容应通过 `.gitignore` 排除在公开仓库外。

## License

MIT
