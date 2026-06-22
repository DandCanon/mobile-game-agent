# 手游 AI 开发 Agent — 开发计划 v4.3-dev

> 更新日期：2026-06-13 | 工作目录：`D:\Marvis\手游AI开发Agent\`
> 当前版本：0.8.0  |  `npx tsc --noEmit` 零报错 | vitest 全部通过
> 最后评审：2026-06-13（Claude + Gemini 双审 + Codex 复审，v4.1 整改方案已合入；v4.2：Phase 0-3f 全部落地）

---

## 〇、前置讨论：多引擎支持会不会让 Agent 臃肿？

**不会。关键在设计而非堆砌。**

Agent 不直接「内置」任何引擎——它内置的是**技术选型决策矩阵 + 按需加载的引擎专项 Skill**。类比：你不是把三本字典缝成一本巨书，而是做个索引目录，用户需要哪本才从书架取下哪本。

**核心原则**：
- 主 Agent 只做「推荐」，不做「执行」
- 每个引擎的实操 Skill 独立开发、独立安装、独立维护
- 新增引擎 = 新增一个 Skill，不影响现有模块
- 用户可在技术选型阶段覆盖 Agent 的推荐

---

## 一、成熟独立手游制作流程

### 完整流程总览（6 阶段 20 里程碑）

| 阶段 | 里程碑 | 核心产出 | AI 辅助度 |
|------|--------|---------|:---:|
| **立项** | M1 市场竞品分析 | 竞品报告 | ★★★ |
| | M2 核心玩法定义 | 一页纸设计文档 | ★★★ |
| | M3 技术选型 | 技术方案文档 | ★★★ |
| | M4 美术风格定调 | Mood Board | ★★☆ |
| **原型** | M5 最小可玩原型 | 可运行 Demo | ★★★ |
| | M6 核心系统设计 | 数值表+系统文档 | ★★★ |
| | M7 UI/UX 线框 | 交互流程 | ★★★ |
| | M8 技术可行性验证 | 性能基准 | ★★☆ |
| **生产** | M9 关卡/内容量产 | 配置表 | ★★★ |
| | M10 美术资产 | 角色/场景/UI | ★★★ |
| | M11 音频 | BGM/音效 | ★★☆ |
| | M12 Alpha 集成 | Alpha Build | ★★★ |
| **测试** | M13 封闭测试 | Bug 跟踪表 | ★★☆ |
| | M14 平衡调优 | 数值方案 | ★★★ |
| | M15 性能优化 | 优化报告 | ★★★ |
| **发行** | M16 商店素材 | 图标/截图/视频 | ★★★ |
| | M17 ASO 优化 | 关键词/描述 | ★★★ |
| | M18 合规审核 | 隐私政策 | ★★☆ |
| **运营** | M19 数据埋点 | 分析方案 | ★★★ |
| | M20 迭代规划 | 版本路线图 | ★★★ |

---

## 二、Agent 架构设计 v4（2026-06-13 整改后）

> **v3→v4 变更说明**：
> - ❌ 砍掉自建 Web 前端 UI → 改为 MCP Server 包装，借用 Claude/Cursor 的聊天 UI
> - ❌ 砍掉 API Gateway（JWT/限流/Token Bucket）→ 本地单用户 Agent 不需要
> - ❌ 砍掉内容审核型安全过滤（敏感词/涉政涉黄审核）→ 游戏开发工具不需要；但保留工具执行安全护栏
> - ⬆️ 观测层提权到 P1：终端彩色日志 + 结构化 .log 文件
> - ➕ 新增 MCP Server 包装层（Agent 能力暴露为 MCP Tools）
> - ➕ 新增 Skill 插件化扫描（skills/ 目录自动发现注册）
> - 🔄 Gateway 重定位为 AgentOrchestrator（多 Agent 协同路由，非鉴权网关）
> - 🔄 框架适配层 → 通过 MCP 协议兼容 MCP 客户端（Claude Code / Cursor / Continue / Reasonix / Codex 可配置 MCP 时）
> - ✅ MCP Server 实现优先使用官方 `@modelcontextprotocol/sdk`，不手写 JSON-RPC 主循环，不使用 `@anthropic-ai/sdk` 作为 MCP Server 主体

### 2.1 分层架构 v4

```
              ┌─────────────────────────────────────┐
              │      Claude Code / Cursor / 任意      │  ← 借用外部完美 UI
              │      MCP 兼容客户端（聊天界面）         │
              └────────────────┬────────────────────┘
                               │ MCP Protocol (JSON-RPC)
              ┌────────────────▼────────────────────┐
              │        MCP Server 包装层             │  ← 🆕 Phase 1
              │  Agent 能力 → MCP Tools 暴露         │
              │  (plan / execute / status / health)  │
              └────────────────┬────────────────────┘
                               │
              ┌────────────────▼────────────────────┐
              │         观测层（终端彩色日志）         │  ← 🆕 Phase 1 P1
              │  [PLANNER] 蓝 / [EXECUTOR] 绿         │
              │  [REFLECTOR] 黄 / [ERROR] 红          │
              │  完整 Context → 本地 .log 文件        │
              └────────────────┬────────────────────┘
                               │
              ┌────────────────┼────────────────────┐
              │                │                    │
    ┌─────────▼─────────┐ ┌────▼──────────┐ ┌──────▼────────────┐
    │   记忆层            │ │  编排引擎层    │ │  Skill 插件系统    │ ← 🆕 Phase 2
    │ ✅ P0-P3 已完成     │ │ ✅ 已完成      │ │  skills/ 目录      │
    │ SQLite + LRU +     │ │ P→E→R + 选型  │ │  自动扫描注册       │
    │ 摘要 + 向量RAG     │ │               │ │  热插拔引擎 Skill   │
    └────────────────────┘ └───────┬───────┘ └───────────────────┘
                                   │
                        ┌──────────▼───────────┐
                        │      工具执行层       │ ← ✅ 含 ToolCache
                        │ 文件 | 代码 | 搜索    │    需加二进制守卫
                        └──────────┬───────────┘
                                   │
                        ┌──────────▼───────────┐
                        │    Agent 协同路由      │ ← 🔄 原 Gateway 重定位
                        │  多 Agent 编排/协同    │
                        │  (非鉴权/非限流)       │
                        └───────────────────────┘
```

### 2.2 技术选型决策矩阵

| 维度 | Godot 4.x | Unity | React+Vite+Tailwind |
|:---|:---:|:---:|:---:|
| 游戏类型 | 2D/3D 通用 | 3D/重度优先 | 2D/轻中度（放置/卡牌/休闲） |
| 包体大小 | ~30MB 起步 | ~50MB 起步 | ~5MB 起步 |
| 热更新 | 需自建方案 | 需自建方案 | **天然支持** |
| 性能上限 | 高 | 最高 | 中等 |
| 跨平台 | Android/iOS/Web/PC | Android/iOS/PC/主机 | Android/iOS/Web |
| AI 生成友好度 | ★★★☆ | ★★☆☆ | ★★★★★ |
| 适合团队 | 单人~小型 | 中小型+ | 单人~小型 |

---

### 2.3 外部调用兼容性（Codex / CrewAI / MCP 客户端）

| 调用方 | 当前可行性 | 推荐接入方式 | 注意事项 |
|------|:---:|------|------|
| **Codex / OpenAI 系客户端** | ✅ 可行，但取决于宿主是否允许配置本地 MCP Server | 优先走 MCP：本地 `stdio` 或 `streamable HTTP`；若使用 OpenAI Agents SDK，可用 MCP ServerStdio/StreamableHttp 接入 | 先开放低风险工具 `mgai_plan` / `mgai_health`，再开放会写文件/执行命令的 `mgai_execute` |
| **Claude Code / Cursor / Continue** | ✅ v4 主目标 | 配置 `mgai-mcp` 为本地 MCP Server | MCP 工具命名保持稳定：`mgai_plan`、`mgai_health`、`mgai_status`、`mgai_execute` |
| **CrewAI** | ⚠️ 可包装调用，但当前不等于“多 Agent 协同已到位” | 短期：把 `mgai_plan` / `mgai_execute` 包成 CrewAI Tool；中期：通过 MCP Client Adapter 调用 mgai MCP Server | CrewAI 的多 Agent 编排需要 AgentOrchestrator、任务委派协议、日志追踪和写操作确认先就绪 |
| **任意脚本/CI** | ✅ 可行 | CLI：`mgai plan/execute/status/health` | 适合作为自动化冒烟测试和回归测试入口 |

**结论**：
- Codex 可以调用本 Agent，但前提是当前 Codex 运行环境支持配置本地 MCP Server，或通过 OpenAI Agents SDK/脚本显式连接本地 MCP。不要假设“只要写了 MCP Server，所有 Codex 环境都会自动发现”。
- CrewAI 可以把 mgai 当作 Tool 使用，但当前项目尚未完成真正的多 Agent 协同闭环。CrewAI 集成第一阶段只做“外部编排器调用 mgai 工具”，不要一开始就做 Agent Mesh。
- v0.9 MVP 的目标应收敛为：`npm run check` 全绿 + Logger + MCP 暴露 `mgai_plan` / `mgai_health` + 至少一个 MCP 客户端可成功调用。

## 三、已完成模块清单（✅）

### 3.1 协议层

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `protocol/agent-protocol.ts` | ✅ | 统一接口契约：AgentProtocol / AgentRequest / AgentResponse / StepRecord / AgentError |

### 3.2 编排引擎层

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `orchestration/planner.ts` | ✅ | 任务拆解引擎，生成 PlanStep[]（含目录结构/接口契约/数据模型/验收标准/预计工具） |
| `orchestration/planner-llm.ts` | ✅ | LLM 驱动的计划生成，注入 System Prompt 前缀（P1 集成） |
| `orchestration/executor.ts` | ✅ | 步骤执行器，按序执行 PlanStep，失败不阻塞后续无依赖步骤 |
| `orchestration/executor-llm.ts` | ✅ | LLM 驱动执行，通过工具调用生成代码/文件 |
| `orchestration/reflector.ts` | ✅ | 结果校验器：文件存在性/接口一致性/数据模型/验收标准/代码质量 |
| `orchestration/tech-selector.ts` | ✅ | 技术选型决策引擎（规则+LLM推理混合） |
| `orchestration/code-generator.ts` | ✅ | 代码生成器，按品类模板生成引擎代码（放置/卡牌/点击） |
| `orchestration/gateway.ts` | ✅ | 统一入口，P→E→R 管线编排，集成 Memory + ToolCache（P0/P1/P2） |

### 3.3 记忆层（P0-P3 全链路）

| 文件 | 状态 | Phase | 说明 |
|------|:---:|:---:|------|
| `orchestration/persistence.ts` | ✅ | P0 | SQLite 持久化：user_profile / session_summaries / error_lessons / vector_records 四表 |
| `orchestration/memory-manager.ts` | ✅ | P0-P3 | ContextTrimmer(32K)+SummaryEngine(L1→L2→L3)+ErrorLessons+RAG检索 |
| `orchestration/llm-summarizer.ts` | ✅ | P1 | LLM 摘要生成器（StepSummary 256t / MetaSummary 384t）+ 降级规则拼接 |
| `orchestration/lru-cache.ts` | ✅ | P2 | 零依赖 ES6 Map LRU（O(1) get/set/驱逐） |
| `orchestration/tool-cache.ts` | ✅ | P2 | 工具调用缓存拦截器（read_file 30s / shell_executor 120s / 写操作逐路径失效） |
| `orchestration/embedder.ts` | ✅ | P3 | 嵌入器接口 + LLMEmbedder（OpenAI compatible）+ RuleEmbedder（零LLM降级） |
| `orchestration/vector-index.ts` | ✅ | P3 | 零依赖内存 brute-force k-NN 余弦向量索引（10K容量，SQLite持久化） |

### 3.4 框架适配层

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `adapters/marvis-adapter.ts` | ✅ | Marvis 框架适配器（dispatch_task / memory_ids / present_result） |

### 3.5 CLI & 模板

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `cli/mgai.ts` | ✅ | CLI 入口：plan / execute / status / health / dashboard / test |
| `cli/run-mgai.js` | ✅ | ESM 运行时引导 |
| `templates/web-game/` | ✅ | React+Vite+Tailwind 游戏模板（放置类，含引擎/组件/离线收益） |
| `skills/engine-web/SKILL.md` | ✅ | Web 技术栈实操 Skill 规范 |

### 3.6 测试

| 文件 | 状态 | 覆盖范围 |
|------|:---:|------|
| `tests/memory.test.ts` | ✅ | MemorySystem 旧版：CRUD/搜索/排序/持久化/空状态（11 cases） |
| `tests/e2e-flow.test.ts` | ✅ | Gateway+P→E→R 全链路/安全拦截/参数校验失败/依赖跳过 |
| `tests/integration.test.ts` | ✅ | 多组件集成 |
| `e2e-test/` | ✅ | E2E 测试项目（CardEngine + GameEngine） |

### 3.7 观测层（Phase 1a）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `orchestration/logger.ts` | ✅ | 双模式彩色日志（终端 ANSI + 文件 JSON 序列化），24 tests |

### 3.8 MCP Server 包装层（Phase 1b）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `mcp/server.ts` | ✅ | MCP Server 核心，7 Tools（mgai_plan/mgai_health/mgai_status/mgai_execute 等），stdio transport，14 tests |
| `mcp/index.ts` | ✅ | MCP Server 启动入口 |

### 3.9 防御补齐（Phase 1c）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `orchestration/guard.ts` | ✅ | 工具执行安全护栏（路径边界/危险命令确认/审计日志），44 tests |
| `orchestration/binary-guard.ts` | ✅ | 大文件/二进制绕过守卫（>1MB 或非文本类型过滤），9 tests |
| `public/data/engine-matrix.json` | ✅ | 技术选型矩阵 JSON 配置（3 引擎 × 10 维度评分） |

### 3.10 Skill 插件系统（Phase 2a）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `orchestration/skill-loader.ts` | ✅ | Skill 扫描器，自动发现注册 skills/ 目录下 SKILL.md，33 tests |
| `skills/README.md` | ✅ | SKILL.md 规范文档（name/version/tools/prompts/engine 约束） |

### 3.11 Agent 协同路由（Phase 2b）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `orchestration/agent-orchestrator.ts` | ✅ | 多 Agent 协同编排器（Facade 包裹 Gateway + 任务委派协议），26 tests |

### 3.12 MCP 适配器（Phase 2c）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `adapters/mcp-client-adapter.ts` | ✅ | MCP Client 适配器，让 mgai 作为 MCP Client 调用其他 MCP Server |

### 3.13 品类模板深化（Phase 2d）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `src/game/IdleEngine.ts` | ✅ | 放置类手游引擎（点击/自动生产/多货币/升级树/成就/离线/存档/IAA/IAP），40 tests |
| `src/game/CardEngine.ts` | ✅ | 卡牌对战引擎（抽卡概率/卡组构建/PVP 匹配/排位/赛季/商店），41 tests |

### 3.14 Godot Skill（Phase 3a）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `skills/godot/SKILL.md` | ✅ | Godot 4.x 实操 Skill 规范 |
| `orchestration/code-generator.ts` | ✅ | 扩展 godot-2d / godot-3d 代码生成器，44 tests |

### 3.15 关卡生成（Phase 3b）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `src/level-gen/algorithms.ts` | ✅ | BSP / 细胞自动机 / 随机游走 / WFC 四算法 |
| `src/level-gen/types.ts` | ✅ | 关卡生成类型定义（Grid/Floor/Room/Corridor） |

### 3.16 数值系统（Phase 3c）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `src/numerics/curves.ts` | ✅ | 数值曲线系统（线性/指数/对数/多项式/Sigmoid/分段），67 tests |
| `src/numerics/export.ts` | ✅ | 数值表导出（CSV/JSON/Markdown） |

### 3.17 Unity 适配（Phase 3d）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `skills/unity/SKILL.md` | ✅ | Unity 实操 Skill 规范 |
| `orchestration/code-generator.ts` | ✅ | 扩展 unity-2d / unity-3d 代码生成器，65 tests |

### 3.18 联网对战（Phase 3e）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `src/networking/sync.ts` | ✅ | 状态同步引擎（客户端预测/服务器和解/插值），57 tests |
| `src/networking/matchmaking.ts` | ✅ | 匹配系统（ELO/MMR + 等待队列） |
| `src/networking/protocol.ts` | ✅ | 对战协议定义（消息序列化/帧同步） |

### 3.19 商业化（Phase 3f）

| 文件 | 状态 | 说明 |
|------|:---:|------|
| `src/monetization/store.ts` | ✅ | 游戏内商店系统（虚拟货币/道具/礼包） |
| `src/monetization/battle-pass.ts` | ✅ | 战令系统（免费+付费双轨/等级/奖励） |
| `src/monetization/bundles.ts` | ✅ | 捆绑包/限时礼包系统 |
| `src/monetization/ads.ts` | ✅ | 广告系统（激励视频/插屏/Banner），86 tests（monetization 全量） |

---

## 四、待完成模块与缺口

### 4.1 测试缺口（🟢 已全部解决）

| 缺口 | 影响 | 当前状态 |
|------|------|:---:|
| **测试套件未证明全绿** | 本地依赖/测试命名可能导致 vitest 未完整执行 | ✅ `npm run check` 全绿 |
| **MemoryManager 测试文件命名异常** | `memory-manager.test_20260613_002710_339.ts` 可能不会被 Vitest 默认识别 | ✅ 已重命名为 `tests/memory-manager.test.ts` |
| **Persistence 单元测试** | 文件已存在但需验证覆盖和通过状态 | ✅ SQLite 四表全覆盖 |
| **Embedder + VectorIndex 单元测试** | 文件已存在但需验证覆盖和通过状态 | ✅ embed 维度/余弦相似度/top-K/过滤 全部覆盖 |
| **LRU + ToolCache 单元测试** | 已有冒烟脚本但无 formal test | ✅ 已补充进 vitest 套件 |
| **旧版 memory.test.ts 导入路径** | `from '../orchestration/memory'` 改为 barrel 后可能断裂 | ✅ 已修正 |

### 4.2 文档缺口

| 缺口 | 说明 | 状态 |
|------|------|:---:|
| **INSTALL.md 版本需复核** | 需确认已更新至 v0.8.0，并补充 P2/P3/MCP Server 配置 | ✅ 已更新至 v0.8.0，含全模块说明 |
| **API 参考文档缺失** | 各模块无 JSDoc 外的方法签名文档 | ⚠️ 待补充 |
| **自检覆盖不全** | `mgai test --self-check` 未包含记忆层新组件的检查 | ✅ 已纳入 Persistence/MemoryManager/VectorIndex |

### 4.3 架构变更记录（v3→v4）

| 原 Phase | 层 | 原状态 | v4 决策 |
|:---:|------|:---:|------|
| Phase 1c | 前端交互层 | ❌ 未完成 | **砍掉** — 改用 MCP Server 包装，借用 Claude/Cursor 聊天 UI |
| Phase 2 | API Gateway（鉴权/限流） | ❌ 未完成 | **砍掉** — 本地单用户 Agent 不需要 JWT/Token Bucket；Gateway 重定位为 AgentOrchestrator |
| Phase 3 | 内容审核型安全过滤层 | ❌ 未完成 | **砍掉内容审核，保留工具安全护栏** — 路径边界/大文件二进制守卫/危险命令确认/写操作审计仍要做 |
| Phase 3 | 观测层 | ❌ 未完成 | **⬆️ 提权到 P1** — 终端彩色日志 + .log 文件序列化（非 SaaS 重型方案） |
| Phase 4 | 多框架适配器 | ❌ 仅 Marvis | **变更** — 通过 MCP 协议天然兼容，不再手写每个框架的 Adapter |

### 4.4 新增模块（v4 整改引入 — 全部 ✅ 已完成）

| 模块 | 说明 | Phase | 状态 |
|------|------|:---:|:---:|
| `mcp/server.ts` | MCP Server 包装层，Agent 能力暴露为 MCP Tools（7 Tools, 14 tests） | Phase 1b | ✅ |
| `mcp/index.ts` | MCP Server 启动入口 | Phase 1b | ✅ |
| `orchestration/logger.ts` | 终端彩色日志系统 + .log 文件序列化（24 tests） | Phase 1a | ✅ |
| `orchestration/guard.ts` | 工具执行安全护栏（44 tests） | Phase 1c | ✅ |
| `orchestration/binary-guard.ts` | 大文件/二进制绕过守卫（9 tests） | Phase 1c | ✅ |
| `orchestration/skill-loader.ts` | Skill 插件扫描器，自动发现注册 skills/ 目录（33 tests） | Phase 2a | ✅ |
| `orchestration/agent-orchestrator.ts` | Gateway 封装版：多 Agent 协同路由（26 tests） | Phase 2b | ✅ |
| `public/data/engine-matrix.json` | 技术选型矩阵抽离为 JSON 配置 | Phase 1c | ✅ |
| `adapters/mcp-client-adapter.ts` | 让 mgai 作为 MCP Client 调用其他 MCP Server | Phase 2c | ✅ |

### 4.5 引擎 Skill & 品类模板

| 项目 | 状态 |
|------|:---:|
| engine-web Skill | ✅ 基础模板（放置/卡牌/肉鸽品类已扩展） |
| engine-godot Skill | ✅ `skills/godot/SKILL.md` + code-generator godot-2d/godot-3d（44 tests） |
| engine-unity Skill | ✅ `skills/unity/SKILL.md` + code-generator unity-2d/unity-3d（65 tests） |
| 放置类模板 | ✅ `src/game/IdleEngine.ts`（40 tests） |
| 卡牌类模板 | ✅ `src/game/CardEngine.ts`（41 tests） |
| 关卡生成 | ✅ `src/level-gen/` BSP/CA/RW/WFC 四算法 |
| 数值系统 | ✅ `src/numerics/` 曲线系统 + 导出（67 tests） |
| 联网对战 | ✅ `src/networking/` 同步/匹配/协议（57 tests） |
| 商业化 | ✅ `src/monetization/` 商店/战令/礼包/广告（86 tests） |
| 美术 Prompt 工程 | ❌ |
| UI 生成 Skill | ❌ |
| QA 辅助（测试用例生成+Bug模板） | ❌ |
| 性能分析 | ❌ |
| ASO 与商店素材 | ❌ |
| APK 打包 Skill | ❌ |
| 数据埋点 | ❌ |
| 迭代规划 | ❌ |

### 4.6 工程卫生

| 项目 | 状态 |
|------|:---:|
| `@lancedb/lancedb` 依赖 | ✅ 当前 `package.json` 未声明该依赖 |
| `package.json` version | ✅ 当前为 `0.8.0` |
| `node_modules` 完整性 | ✅ 依赖完整，vitest 正常启动 |
| `vitest` 测试套件覆盖率 | ✅ `npm run check` 全绿（tsc 零错 + vitest 全部通过） |

---

## 五、项目目录结构（v4 整改后）

```
D:\Marvis\手游AI开发Agent\
├── README.md
├── 手游AI开发Agent计划.md          # 本文件（v4 整改方案已合入）
├── 架构设计文档.md
├── INSTALL.md                       # ✅ v0.8.0 + MCP 配置说明（已复核）
├── package.json                     # ✅ version 0.8.0，未声明 lancedb
├── tsconfig.json
├── dashboard.html                   # 🔴 已废弃（改用 MCP Server，保留作参考）
│
├── protocol/
│   └── agent-protocol.ts            # ✅ 统一接口契约（含 AgentToAgentMessage）
│
├── orchestration/                   # ✅ 核心编排层
│   ├── planner.ts                   #     任务拆解（3 品类模板）
│   ├── planner-llm.ts               #     LLM 计划生成 + 降级回退
│   ├── executor.ts                  #     步骤执行
│   ├── executor-llm.ts              #     LLM ReAct 循环执行
│   ├── reflector.ts                 #     结果校验 + 错误截断
│   ├── gateway.ts                   # ✅ P→E→R 管线编排
│   ├── agent-orchestrator.ts        # ✅ 多 Agent 协同编排器（Facade）
│   ├── llm-client.ts                #     LLM 统一客户端
│   ├── llm-summarizer.ts            #     LLM 摘要生成
│   ├── tech-selector.ts             # ✅ 从 engine-matrix.json 加载矩阵
│   ├── code-generator.ts            # ✅ 支持 godot-2d/3d + unity-2d/3d
│   ├── logger.ts                    # ✅ 双模式彩色日志
│   ├── guard.ts                     # ✅ 工具执行安全护栏
│   ├── binary-guard.ts              # ✅ 大文件/二进制绕过守卫
│   ├── skill-loader.ts              # ✅ Skill 插件扫描器
│   ├── memory.ts                    #     Barrel 导出
│   ├── memory-system.ts             #     旧版文件级 JSON 记忆
│   ├── memory-manager.ts            #     P0-P3 全联动管理器
│   ├── persistence.ts               #     SQLite 四表持久化
│   ├── lru-cache.ts                 #     LRU 缓存
│   ├── tool-cache.ts                #     ⚠️ 待加二进制守卫（已有 binary-guard 独立文件）
│   ├── embedder.ts                  #     嵌入器接口+实现
│   └── vector-index.ts              #     零依赖向量索引
│
├── mcp/                              # ✅ Phase 1b
│   ├── server.ts                     #     MCP Server 核心（7 Tools）
│   └── index.ts                      #     启动入口
│
├── adapters/
│   ├── marvis-adapter.ts            # ✅ Marvis 框架适配器
│   └── mcp-client-adapter.ts        # ✅ Phase 2c — MCP Client 适配器
│
├── cli/
│   ├── mgai.ts                      # ✅ CLI 入口
│   └── run-mgai.js                  # ✅ ESM 运行时
│
├── skills/                           # ✅ Phase 2a — 插件化 Skill 目录
│   ├── README.md                     #     SKILL.md 规范文档
│   ├── engine-web/
│   │   └── SKILL.md                  # ✅ Web 技术栈 Skill
│   ├── godot/
│   │   └── SKILL.md                  # ✅ Phase 3a — Godot 4.x Skill
│   └── unity/
│       └── SKILL.md                  # ✅ Phase 3d — Unity Skill
│
├── src/                              # ✅ 品类模板 + 领域模块
│   ├── game/
│   │   ├── IdleEngine.ts            # ✅ Phase 2d — 放置类引擎（40 tests）
│   │   └── CardEngine.ts            # ✅ Phase 2d — 卡牌引擎（41 tests）
│   ├── level-gen/
│   │   ├── algorithms.ts            # ✅ Phase 3b — BSP/CA/RW/WFC
│   │   └── types.ts                  # ✅ Phase 3b — 关卡类型定义
│   ├── numerics/
│   │   ├── curves.ts                # ✅ Phase 3c — 数值曲线（67 tests）
│   │   └── export.ts                # ✅ Phase 3c — 数值表导出
│   ├── networking/
│   │   ├── sync.ts                  # ✅ Phase 3e — 状态同步（57 tests）
│   │   ├── matchmaking.ts           # ✅ Phase 3e — 匹配系统
│   │   └── protocol.ts              # ✅ Phase 3e — 对战协议
│   └── monetization/
│       ├── store.ts                 # ✅ Phase 3f — 商店（86 tests）
│       ├── battle-pass.ts           # ✅ Phase 3f — 战令
│       ├── bundles.ts               # ✅ Phase 3f — 捆绑包
│       └── ads.ts                   # ✅ Phase 3f — 广告系统
│
├── templates/
│   └── web-game/                     # ✅ React+Vite+Tailwind 模板
│
├── public/data/                      # ✅ Phase 1c
│   └── engine-matrix.json            #     技术选型矩阵（3 引擎 × 10 维度）
│
├── logs/                             # ✅ Phase 1a
│   └── session-{timestamp}.log       #     结构化会话日志
│
├── tests/
│   ├── memory.test.ts                # ✅ 导入路径已修正
│   ├── e2e-flow.test.ts              # ✅ 端到端管线测试
│   ├── integration.test.ts           # ✅ 集成测试
│   ├── persistence.test.ts           # ✅ Phase 0
│   ├── memory-manager.test.ts        # ✅ 已重命名
│   └── vector.test.ts                # ✅ Phase 0
│
└── e2e-*/                            # E2E 测试项目
```

---

## 六、整改路线图 v4（Claude + Gemini 双审融合方案）

> 核心原则：
> 1. **不重复造轮子** — 不写 Web UI（MCP 借壳）、不写鉴权（本地单用户）、不写内容审核（游戏工具不需要）
> 2. **先止血再扩展** — 测试→文档→观测→MCP→插件化，顺序不可乱
> 3. **借力生态** — MCP 协议让 Agent 对接 Claude Code / Cursor / Continue / Reasonix / Codex 可配置 MCP 的环境
> 4. **数据驱动配置** — 评分矩阵、品类模板等抽离为 JSON，改配置不改代码
> 5. **安全不做内容审核，但必须做工具护栏** — 路径边界、大文件/二进制绕过、危险命令确认、写操作审计必须保留

---

### ✅ Phase 0: 止血 — 测试 + 文档 + 卫生（已完成）

> 目标：让项目从""看起来已补齐""到""被自动化验证确实可交付""。

| # | 任务 | 文件 | 状态 | 实际产出 |
|:---:|------|------|:---:|------|
| P0-1 | **依赖完整性修复** | `package-lock.json` / `node_modules` | ✅ | 依赖完整，vitest 正常启动 |
| P0-2 | **MemoryManager 测试重命名** | `tests/memory-manager.test_*.ts` → `tests/memory-manager.test.ts` | ✅ | 测试文件重命名完成，Vitest 默认收集 |
| P0-3 | **Persistence / Vector 测试复核** | `tests/persistence.test.ts` / `tests/vector.test.ts` | ✅ | SQLite 四表 / embed 维度 / 余弦相似度 / top-K 全部覆盖 |
| P0-4 | **LRU + ToolCache 正式单测** | vitest 套件补充 | ✅ | get/set/驱逐 O(1) / 写操作逐路径失效 / TTL 过期 |
| P0-5 | **修正 memory.test.ts 导入路径** | `tests/memory.test.ts` | ✅ | 导入路径已修正 |
| P0-6 | **更新 INSTALL.md → v0.8.0 + MCP** | `INSTALL.md` | ✅ | 已更新至 v0.8.0，含 MCP Server 配置说明 |
| P0-7 | **package.json 状态确认** | `package.json` | ✅ | version 0.8.0，无 lancedb 依赖 |
| P0-8 | **计划文档状态同步** | `手游AI开发Agent计划.md` | ✅ | 版本号/模块状态已同步 |
| P0-9 | **自检覆盖更新** | `cli/mgai.ts` | ✅ | 纳入 Persistence/MemoryManager/VectorIndex |

**完成标准达成**：`npm run check` 全绿（tsc 零错 + vitest 全部通过）


---

### ✅ Phase 1: 可观测 + 可连接（已完成）

> 目标：Agent 不再是""黑盒""，用户能看见每一步在做什么。同时通过 MCP 让 Agent 能被任何 MCP 客户端调用。

#### ✅ Phase 1a: 观测层

| # | 任务 | 文件 | 状态 | 实际产出 |
|:---:|------|------|:---:|------|
| P1-1 | **终端彩色日志系统** | `orchestration/logger.ts` | ✅ | 双模式彩色日志（终端 ANSI + 文件 JSON 序列化），24 tests |
| P1-2 | **结构化 .log 文件序列化** | `orchestration/logger.ts` | ✅ | 每次会话完整 Context 序列化到 `logs/session-{timestamp}.log` |
| P1-3 | **接入 Gateway→Logger** | `orchestration/gateway.ts` | ✅ | P→E→R 每个阶段自动打 log |
| P1-4 | **日志轮转** | `orchestration/logger.ts` | ✅ | 保留最近 50 个 .log 文件，自动清理旧文件 |

#### ✅ Phase 1b: MCP Server 包装

| # | 任务 | 文件 | 状态 | 实际产出 |
|:---:|------|------|:---:|------|
| P1-5 | **MCP Server 核心** | `mcp/server.ts` | ✅ | 基于 `@modelcontextprotocol/sdk` 实现 stdio transport，7 Tools，14 tests |
| P1-6 | **低风险 MCP Tools 映射** | `mcp/server.ts` | ✅ | mgai_plan / mgai_health / mgai_status / mgai_execute 等 7 个 Tool |
| P1-7 | **MCP Server 启动入口** | `mcp/index.ts` + `package.json` bin | ✅ | `npx mgai mcp` 或 `mgai-mcp` 即可启动 |
| P1-8 | **客户端集成文档** | `mcp/README.md` / `INSTALL.md` | ✅ | Claude Code / Cursor / Codex stdio 配置方式已文档化 |
| P1-9 | **执行类工具二阶段开放** | `mcp/server.ts` | ✅ | mgai_execute 在安全护栏通过后已开放 |

**Phase 1 完成标准达成**：
- 终端执行 `mgai execute ""开发一个放置手游""` 能看到彩色分阶段的日志输出 ✅
- `logs/` 目录下能找到完整的结构化日志文件 ✅
- MCP 客户端可成功调用 mgai 工具 ✅

#### ✅ Phase 1c: 防御性补齐

| # | 任务 | 文件 | 状态 | 实际产出 |
|:---:|------|------|:---:|------|
| P1-10 | **大文件/二进制守卫** | `orchestration/binary-guard.ts` | ✅ | >1MB 或非文本类型直接 Bypass，9 tests |
| P1-11 | **工具执行安全护栏** | `orchestration/guard.ts` | ✅ | 路径边界/危险命令确认/审计日志，44 tests |
| P1-12 | **技术选型矩阵抽离为 JSON** | `public/data/engine-matrix.json` | ✅ | 3 引擎 × 10 维度评分 JSON 配置 |


---

### ✅ Phase 2: 插件化 + 多 Agent 协同（已完成）

> 目标：Agent 从""单体应用""变成""可扩展平台""。新增引擎或功能只需丢文件夹。

#### ✅ Phase 2a: Skill 插件系统

| # | 任务 | 文件 | 状态 | 实际产出 |
|:---:|------|------|:---:|------|
| P2-1 | **Skill 扫描器** | `orchestration/skill-loader.ts` | ✅ | 启动时自动扫描 `skills/` 目录，33 tests |
| P2-2 | **Skill 清单接口** | `skill-loader.ts` | ✅ | `listSkills()` 返回所有已注册 Skill |
| P2-3 | **Gateway 集成 SkillLoader** | `gateway.ts` | ✅ | 启动时自动加载 skills |
| P2-4 | **SKILL.md 规范文档** | `skills/README.md` | ✅ | name/version/tools/prompts/engine 字段规范已定义 |

**验收标准达成**：新增 Skill 文件夹后 `mgai status` 能自动发现 ✅

#### ✅ Phase 2b: 多 Agent 协同

| # | 任务 | 文件 | 状态 | 实际产出 |
|:---:|------|------|:---:|------|
| P2-5 | **AgentOrchestrator Facade** | `orchestration/agent-orchestrator.ts` | ✅ | 稳定 facade 包裹 Gateway + 任务委派协议，26 tests |
| P2-6 | **Agent ↔ Agent 通信协议** | `protocol/agent-protocol.ts` | ✅ | `AgentToAgentMessage` 类型定义 |
| P2-7 | **主 Agent 委派子 Agent** | `orchestration/agent-orchestrator.ts` | ✅ | 任务委派/结果回传/状态同步已实现 |

#### ✅ Phase 2c: MCP 适配器

| # | 任务 | 文件 | 状态 | 实际产出 |
|:---:|------|------|:---:|------|
| P2-8 | **MCP Client 适配器** | `adapters/mcp-client-adapter.ts` | ✅ | mgai 可作为 MCP Client 调用其他 MCP Server |

#### ✅ Phase 2d: 品类模板深化

| # | 任务 | 文件 | 状态 | 实际产出 |
|:---:|------|------|:---:|------|
| P2-10 | **放置类模板深化** | `src/game/IdleEngine.ts` | ✅ | 点击/自动生产/多货币/升级树/成就/离线/存档/UI/IAA/IAP，40 tests |
| P2-11 | **放置类代码生成器同步** | `orchestration/code-generator.ts` | ✅ | IdleEngine 代码生成器同步更新 |
| P2-12 | **卡牌类模板深化** | `src/game/CardEngine.ts` | ✅ | 抽卡概率/卡组构建/PVP 匹配/排位/赛季/商店，41 tests |


---

### ✅ Phase 3: 生态扩展（大部分已完成）

> 以下功能已按需求启动并落地。

| 优先级 | 项目 | 状态 | 实际产出 |
|:---:|------|:---:|------|
| P3-1 | **Godot 实操 Skill** | ✅ (Phase 3a) | `skills/godot/SKILL.md` + code-generator godot-2d/godot-3d，44 tests |
| P3-2 | **关卡生成** | ✅ (Phase 3b) | `src/level-gen/algorithms.ts` + `types.ts`（BSP/CA/RW/WFC 四算法） |
| P3-3 | **数值系统** | ✅ (Phase 3c) | `src/numerics/curves.ts` + `export.ts`，67 tests |
| P3-4 | **美术 Prompt 工程 Skill** | ⬜ | 待触发 |
| P3-5 | **ASO 与商店素材 Skill** | ⬜ | 待触发 |
| P3-6 | **APK 打包 Skill**（Capacitor 自动化） | ⬜ | 待触发 |
| P3-7 | **Unity 实操 Skill** | ✅ (Phase 3d) | `skills/unity/SKILL.md` + code-generator unity-2d/unity-3d，65 tests |

#### ✅ Phase 3e: 联网对战

| 任务 | 文件 | 状态 | 实际产出 |
|------|------|:---:|------|
| **状态同步引擎** | `src/networking/sync.ts` | ✅ | 客户端预测/服务器和解/插值 |
| **匹配系统** | `src/networking/matchmaking.ts` | ✅ | ELO/MMR + 等待队列 |
| **对战协议** | `src/networking/protocol.ts` | ✅ | 消息序列化/帧同步 |
| networking 全量测试 | — | ✅ | 57 tests |

#### ✅ Phase 3f: 商业化

| 任务 | 文件 | 状态 | 实际产出 |
|------|------|:---:|------|
| **游戏内商店** | `src/monetization/store.ts` | ✅ | 虚拟货币/道具/礼包 |
| **战令系统** | `src/monetization/battle-pass.ts` | ✅ | 免费+付费双轨/等级/奖励 |
| **捆绑包/礼包** | `src/monetization/bundles.ts` | ✅ | 限时礼包系统 |
| **广告系统** | `src/monetization/ads.ts` | ✅ | 激励视频/插屏/Banner |
| monetization 全量测试 | — | ✅ | 86 tests |


### 架构决策记录（ADR）

| 决策 | 原方案 | 新方案 | 理由 |
|------|--------|--------|------|
| 前端交互 | 自建 Web UI（React 状态机） | **MCP Server 包装** | 借力 Claude/Cursor 的聊天 UI，工作量从 2-3 周降为 2-3 天 |
| Gateway | API Gateway（鉴权/限流/路由） | **AgentOrchestrator**（多 Agent 协同） | 本地单用户不需要鉴权；多 Agent 协同是核心差异化能力 |
| 安全过滤层 | 敏感词/输入净化/输出校验混在一起 | **砍掉内容审核，保留工具安全护栏** | 游戏开发工具不需要敏感词审核，但本地文件/命令执行必须有路径边界、危险命令确认和审计 |
| MCP 实现 | 手写 JSON-RPC 或误用模型 SDK | **官方 `@modelcontextprotocol/sdk`** | 降低协议细节错误，便于 stdio/HTTP transport 扩展 |
| 框架适配 | 每个框架手写 Adapter | **MCP 协议优先兼容** | 支持 MCP 的客户端/框架可直接调用 mgai；不支持 MCP 时用 CLI/SDK 包装 |
| 技术选型矩阵 | 硬编码在 `tech-selector.ts` | **抽离为 `matrix.json`** | 新增引擎只需改 JSON，不动 TS 逻辑代码 |
| Skill 加载 | 手动 import 引用 | **skills/ 目录自动扫描（先元数据，后执行）** | 新增引擎 Skill 先用于发现/推荐，待安全护栏稳定后再允许注册可执行工具 |
| 观测 | Phase 3 重型方案（OTEL/Prometheus） | **终端彩色日志 + .log 文件** | 本地 Agent 不需要 SaaS 级可观测性，轻量方案够用 |
| CrewAI 协同 | mgai 内部一次性实现 Agent Mesh | **先作为 CrewAI Tool 被外部编排** | 当前阶段先验证工具可组合性，内部多 Agent 委派放到 Phase 2b |

---

### 建议执行顺序（强依赖关系）— 全部已完成 ✅

```
Phase 0 (止血) ✅ — 已完成
  ├─ tsc 零报错、vitest 全部通过
  ├─ 测试文件重命名、导入路径修复
  └─ 文档+版本号+依赖清理全部就绪

Phase 1 (可观测+可连接) ✅ — 已完成
  ├─ Phase 1a (观测层): logger.ts 24 tests
  ├─ Phase 1b (MCP Server): mcp/server.ts 7 Tools 14 tests
  └─ Phase 1c (防御补齐): guard.ts 44 tests + binary-guard.ts 9 tests

Phase 2 (插件化+协同) ✅ — 已完成
  ├─ Phase 2a (Skill 插件): skill-loader.ts 33 tests
  ├─ Phase 2b (Agent 协同): agent-orchestrator.ts 26 tests
  ├─ Phase 2c (MCP 适配器): mcp-client-adapter.ts
  └─ Phase 2d (模板深化): IdleEngine.ts 40 tests + CardEngine.ts 41 tests

Phase 3 (生态扩展) ✅ — 已完成
  ├─ Phase 3a (Godot Skill): skills/godot/SKILL.md 44 tests
  ├─ Phase 3b (关卡生成): src/level-gen/ BSP/CA/RW/WFC
  ├─ Phase 3c (数值系统): src/numerics/ 67 tests
  ├─ Phase 3d (Unity Skill): skills/unity/SKILL.md 65 tests
  ├─ Phase 3e (联网对战): src/networking/ 57 tests
  └─ Phase 3f (商业化): src/monetization/ 86 tests
```

---

## 七、v4.3 后续推进方式：从 Phase 改为 Track / Milestone

> v4.2 已经把 Phase 0-3f 做完。继续追加 Phase 4/5/6 会让计划文档越来越重，开发 AI 也更容易迷失在长列表里。
> 从 v4.3 开始，建议改成 **Track（方向）+ Milestone（可验收里程碑）**：
>
> - Track 只描述长期方向，不要求一次做完。
> - Milestone 必须能在 0.5-2 天内完成，并有明确验收标准。
> - 每次只激活 1-2 个 Milestone，完成后再新增下一个。
> - 已完成内容归档到“完成记录”，不要继续塞进主路线图。

### 7.1 当前建议的 6 条 Track

| Track | 名称 | 优先级 | 目标 | 近期建议 |
|------|------|:---:|------|------|
| T1 | Memory v2：五层记忆体系 | 高 | 让 Agent 记忆从“摘要存储”升级为“按用途检索与注入” | 先做 Schema/接口，不急着迁移全部历史数据 |
| T2 | Hybrid Reflector：规则优先，LLM 兜底 | 最高 | 降低 token 成本，提高校验稳定性 | 优先实现确定性 Rule Checks |
| T3 | Knowledge Memory：外部教程索引与成长型知识库 | 中高 | 接入高质量知识源和项目经验，但避免上下文膨胀 | 先索引 build-your-own-x 的游戏相关条目 |
| T4 | Device Debug Agent：实机日志与自动排错 | 高 | 让生成 App 在真机阶段可观测、可复现、可由 AI 辅助修复 | 先做 Debug Contract + bug bundle，再做 Android ADB |
| T5 | Engine-native Genre Pipelines：引擎原生品类纵切 | 最高 | 把 Godot/Unity 从通用脚手架升级为可落地的品类开发流 | 先做 Godot 4.x + 2D 像素刷宝纵切 |
| T6 | Game Feel & UI Aesthetic System：审美与动效系统 | 最高 | 让 Agent 生成的游戏 UI 有明确艺术指导、动效语法和反馈品质 | 先做 UI Style Director + Motion Token + 3 套风格包 |

> v4.2 全部 Phase 已落地，v4.3 采用 Track/Milestone 轻量推进体系。

---

## 八、Track T1：Memory v2 五层记忆体系

### 8.1 结论

建议从当前“会话摘要 + 错误教训 + 用户画像 + 向量记录”的实现，升级为：

```
Working Memory
  → Conversation Memory
  → Project Memory
  → Knowledge Memory
  → Profile Memory
```

这不是简单换名字，而是把记忆按 **时效性、作用域、检索方式、注入优先级** 分层。

### 8.2 分层定义

| 层级 | 保存内容 | 生命周期 | 注入策略 |
|------|------|------|------|
| Working Memory | 当前任务、当前步骤、临时状态、未完成事项、最近工具结果 | 单次任务/短会话 | 高频、少量、必注入 |
| Conversation Memory | 当前会话摘要、用户本轮关键决策、最近上下文压缩结果 | 单会话到多会话 | 摘要注入 |
| Project Memory | 项目架构、技术选型、目录结构、模块状态、错误教训、ADR | 项目周期 | 按项目相关性注入 |
| Knowledge Memory | Skill、教程索引、开发模式、引擎经验、常见问题、项目沉淀知识 | 长期成长 | RAG 命中才注入 |
| Profile Memory | 用户偏好、代码风格、常用引擎、长期习惯 | 长期稳定 | 极少量稳定注入 |

### 8.3 关键约束

- Knowledge Memory 可以像 Obsidian 一样成长，但不能像 Obsidian 一样全部摊开给 LLM。
- 知识库只负责“存得多”，Prompt 注入必须“取得少”。
- 每条长期知识必须有元数据：`type`、`source`、`tags`、`projectId`、`confidence`、`lastUsedAt`、`hitCount`。
- 自动生成的知识默认低置信度；重复命中、测试验证或人工确认后才能晋升。
- Profile Memory 只存稳定偏好，不存临时需求，避免用户画像污染具体项目判断。
- error-lessons 目录（`knowledge/error-lessons/`）中的 JSON 卡片应进入 Knowledge Memory，每条卡片含 `id`/`title`/`symptoms`/`rootCause`/`fix`/`prevention`/`tags`/`validationCommands` 字段。检索时按 `tags` 匹配，单次最多召回 1-3 条，禁止整篇注入上下文。

### 8.4 建议 Milestone

| Milestone | 任务 | 验收标准 |
|------|------|------|
| T1-M1 | 定义 Memory v2 类型与接口 | 新增 `MemoryScope` / `MemoryKind` / `MemoryRecord` 类型，测试覆盖序列化 |
| T1-M2 | 扩展 SQLite schema | 增加统一 `memory_records` 表，保留旧表兼容 |
| T1-M3 | 实现注入策略 | `buildPromptMemoryPack(task)` 能按 Working→Conversation→Project→Knowledge→Profile 顺序组装 |
| T1-M4 | 迁移旧数据 | 旧 `session_summaries` / `error_lessons` / `user_profile` 能映射到新结构 |

---

## 九、Track T2：Hybrid Reflector（Rule Based 优先，LLM 兜底）

### 9.1 结论

强烈建议采用。确定性检查不应该先调用 LLM。

当前 Reflector 已经有规则检查雏形，但部分检查仍是“假设成功”或“待外部执行”。下一步应把 Reflector 改成真正的 Rule-first Pipeline：

```
Executor 完成
  → Rule Reflector 跑确定性检查
  → 全部通过：直接通过，不调用 LLM
  → 有失败：截断错误日志
  → LLM 只分析失败原因和修复建议
  → 必要时回到 Executor
```

### 9.2 Rule Checks 建议清单

| Rule | 工具/方式 | 是否需要 LLM |
|------|------|:---:|
| 文件/目录是否存在 | `fs.existsSync` | 否 |
| JSON 是否合法 | `JSON.parse` | 否 |
| TypeScript 是否通过 | `tsc --noEmit` | 否 |
| Vitest/Jest 是否通过 | `npm test` / `vitest run` | 否 |
| Pytest 是否通过 | `pytest` | 否 |
| ESLint 是否通过 | `eslint` | 否 |
| package 依赖是否缺失 | `npm ls` / import resolution | 否 |
| 路径是否越界 | `guard.ts` | 否 |
| 产物是否生成 | artifact manifest + 文件系统 | 否 |
| 架构/玩法/体验是否合理 | LLM review | 是 |
| 错误根因解释与修复建议 | LLM review | 失败时才需要 |

### 9.3 预期收益

- 成功路径不再消耗 Reflector LLM token。
- 失败路径只把压缩后的错误、相关文件和 Rule 结果交给 LLM。
- 校验结果更可复现，CI 也能独立运行。
- 对代码生成类任务，Reflector token 预计可下降 60%-90%。

### 9.4 建议 Milestone

| Milestone | 任务 | 验收标准 |
|------|------|------|
| T2-M1 | 新增 `orchestration/rule-reflector.ts` | 支持 file/json/tsc/test/eslint/path/artifact checks |
| T2-M2 | 扩展 `AcceptanceCriterion.verifyBy` | 支持 `json-valid` / `eslint` / `pytest` / `command` / `artifact-exists` |
| T2-M3 | 接入 LLM 兜底 | 只有 Rule 失败时才调用 LLM 生成 corrections |
| T2-M4 | 日志与报告 | 每次 Reflector 输出 `reflection-report.json`，包含规则结果和 LLM 建议 |

---

## 十、Track T3：Knowledge Memory 与 build-your-own-x 索引

### 10.1 结论

`codecrafters-io/build-your-own-x` 适合接入 Knowledge Memory，但应接入为“教程索引 + 标签 + 摘要 + 链接”，不要全文抓取。

该仓库是高质量教程目录，包含游戏、渲染器、物理引擎、体素引擎、数据库、网络协议等大量“从零实现”资料。它对 Agent 的帮助主要在规划和技术选型阶段：

- 用户要做体素地图时，召回 voxel / renderer / spatial partitioning 相关条目。
- 用户要做物理碰撞时，召回 physics engine / collision / raycasting 相关条目。
- 用户要做联网对战时，召回 networking / protocol / distributed system 相关条目。

> **T1/T3 边界**：T3 是 T1 Knowledge Memory 架构层的首批内容源接入，负责填充外部知识索引卡片；T1 负责定义 Memory v2 的五层 schema 和注入策略，两者互补不冲突。

### 10.2 接入边界

- 只索引 `title`、`url`、`category`、`tags`、`shortSummary`、`applicability`。
- 不默认复制外部教程全文，因为外链教程有各自许可。
- RAG 命中后只注入 1-3 条卡片摘要，不注入长文。
- 对游戏开发无关或低相关条目降权。

### 10.3 建议记录结构

```json
{
  "source": "build-your-own-x",
  "type": "tutorial-index",
  "title": "Build your own 3D renderer",
  "url": "https://...",
  "tags": ["renderer", "graphics", "engine"],
  "applicability": "适合图形渲染、3D 管线、引擎底层学习",
  "confidence": 0.7,
  "licenseNote": "index only; external content has its own license"
}
```

### 10.4 建议 Milestone

| Milestone | 任务 | 验收标准 |
|------|------|------|
| T3-M1 | 新增知识源 schema | `KnowledgeSource` / `KnowledgeCard` 类型完成 |
| T3-M2 | 导入 build-your-own-x 索引 | 只导入游戏/图形/物理/网络/引擎相关条目 |
| T3-M3 | RAG 检索接入 Planner | 新任务规划时可召回最多 3 条知识卡片 |
| T3-M4 | 知识晋升机制 | 被多次命中或人工确认后提高 confidence |

---

## 十一、Track T4：Device Debug Agent 与实机排错闭环

### 11.1 结论

强烈建议做。真机问题是 APP/手游开发里最容易拖慢进度的部分，应该在生成项目时就注入 Debug Contract。

第一阶段不要直接追求“AI 完全操控手机”，先让 App 能稳定产出可分析的 bug bundle。只要日志、设备信息、截图、存档状态和复现步骤完整，AI 修 bug 的效率就会明显提高。

### 11.2 Debug Contract 产物

每个生成 App 建议自动包含：

```
docs/DEBUGGING.md
docs/BUG_REPORT_TEMPLATE.md
src/debug/logger.ts
src/debug/diagnostics.ts
src/debug/build-info.ts
```

### 11.3 Bug Bundle 格式

```text
bug-report.zip
├── user-feedback.md
├── app.log
├── crash.log
├── device-info.json
├── save-state.json
├── screenshot.png
└── reproduction-steps.md
```

### 11.4 Android 实机控制方向

优先 Android，因为 ADB 可控性高、落地快：

| 能力 | 推荐工具 |
|------|------|
| 安装 APK | `adb install` |
| 启动 App | `adb shell monkey` / activity manager |
| 抓日志 | `adb logcat` |
| 截图/录屏 | `adb exec-out screencap` / `screenrecord` |
| UI 树 | `uiautomator dump` |
| 点击/滑动/输入 | `adb shell input tap/swipe/text` |
| 拉取 bug 包 | `adb pull` |

iOS 也可做，但依赖 Mac、签名、Xcode、WebDriverAgent/XCUITest，建议放在 Android MVP 之后。

### 11.5 建议 Milestone

| Milestone | 任务 | 验收标准 |
|------|------|------|
| T4-M1 | 生成 Debug Contract | 新项目自动带 `DEBUGGING.md`、logger、diagnostics、bug 模板 |
| T4-M2 | 结构化日志 SDK | App 能输出 screen/action/state/error/build/device 字段 |
| T4-M3 | Bug Bundle 生成器 | 一条命令收集日志、设备信息、截图、存档、用户反馈 |
| T4-M4 | Android ADB Device Tool | 支持 list/install/launch/screenshot/logcat/tap/swipe/dump-ui |
| T4-M5 | AI Debug Loop | AI 读取 bug bundle → 定位问题 → 修改代码 → 跑回归 |

---

## 十二、Track T5：Engine-native Genre Pipelines 引擎原生品类纵切

### 12.1 结论

Godot 和 Unity 当前不是空白，但还停留在“通用 Skill + 通用脚手架”层级，不能算完整的引擎原生开发流。`skills/godot/SKILL.md`、`skills/unity/SKILL.md`、`planner.ts` 中的 `godot-2d` / `unity-2d` 模板已经能做基础工程初始化、移动控制、事件总线和配置文件，但对“2D 像素风格刷宝游戏”这种具体品类，还缺少装备掉落、词缀、背包、战斗手感、敌人生成、关卡循环、HUD 和掉落反馈等核心模块。

所以这不是“Godot/Unity 完全没做”，而是“只做了引擎入口，没有做品类纵切”。当前完整度最高的仍然是 React+Vite+Tailwind 的 Web 游戏流，尤其是放置、卡牌、轻量肉鸽类。下一步如果要让 Agent 真正能开发手游，建议优先补一条 Godot 4.x 的 2D 像素刷宝纵切，再把经验迁移到 Unity。

### 12.2 需要修正的当前问题

- `mgai_generate_plan` 只有 `requirement` 和 `gameType`，没有显式 `targetEngine`、`artStyle`、`camera`、`platforms` 等参数，导致“我要 Godot/Unity 做像素刷宝”无法稳定进入正确模板。
- `inferGameType()` 应补充 `刷宝`、`loot`、`looter`、`ARPG`、`像素`、`装备`、`词缀`、`掉落`、`地牢刷装` 等关键词。
- 计划模板应新增 `loot-arpg` 或 `刷宝` 品类，而不是把它粗略归到 `动作` 或 `rpg`。
- Godot/Unity 模板不能只生成 PlayerController，还要生成可测试的核心玩法模块和数据模型。
- `summarizePlanForMCP()` 不应在详细步骤、风险或工期为空时静默返回，应把空计划视为降级失败并给出可诊断原因。

### 12.3 Godot 4.x 2D 像素刷宝纵切建议

建议把第一条完整引擎原生纵切定义为：

```text
目标：Godot 4.x 2D Pixel Loot ARPG
核心循环：移动 → 战斗 → 掉落 → 拾取 → 装备替换 → 变强 → 进入下一层
首屏目标：可移动、可攻击、可掉装、可穿装、HUD 可反馈
```

建议生成文件：

```text
project.godot
scenes/Main.tscn
scenes/Player.tscn
scenes/Enemy.tscn
scenes/HUD.tscn
scripts/PlayerController2D.gd
scripts/CombatController.gd
scripts/EnemySpawner.gd
scripts/LootTable.gd
scripts/Inventory.gd
scripts/Equipment.gd
scripts/AffixSystem.gd
scripts/DropPopup.gd
scripts/PixelCamera.gd
data/items.json
data/affixes.json
docs/GAME_LOOP.md
docs/UI_STYLE_GUIDE.md
```

### 12.4 Unity 后续迁移方向

Unity 不建议和 Godot 同时深挖。先用 Godot 做出完整品类纵切，验证 Planner、CodeGenerator、Reflector、StyleGuide 的接口后，再迁移 Unity 版本：

```text
Assets/Scripts/PlayerController2D.cs
Assets/Scripts/CombatController.cs
Assets/Scripts/LootSystem.cs
Assets/Scripts/InventorySystem.cs
Assets/Scripts/EquipmentSystem.cs
Assets/Scripts/AffixGenerator.cs
Assets/Scripts/EnemyAI.cs
Assets/Scripts/UI/HudPresenter.cs
Assets/Resources/items.json
Assets/Resources/affixes.json
```

### 12.5 建议 Milestone

| Milestone | 任务 | 验收标准 | 状态 |
|------|------|------|------|
| T5-M1 | 扩展 MCP 入参与品类推断 | `mgai_generate_plan` 支持 `targetEngine` / `artStyle` / `platforms`；“2D像素刷宝”稳定识别为 `loot-arpg` | ✅ 已完成 — 见 [mcp/server.ts](<mcp/server.ts>) / [gateway.ts](<orchestration/gateway.ts>) |
| T5-M2 | 新增 `LOOT_ARPG_TEMPLATE` | 计划步骤、风险清单、工期预估均非空；至少覆盖战斗、掉落、词缀、背包、装备、HUD | ✅ 已完成 — 6 步骤 3 阶段，见 [planner.ts](<orchestration/planner.ts>) L637-L869 |
| T5-M3 | Godot 纵切代码生成 | `mgai_generate_code` 能生成 Godot 2D Pixel Loot ARPG 的核心脚本、数据和场景骨架 | |
| T5-M4 | 品类级规则校验 | 检查核心文件存在、JSON 合法、GDScript 基础语法/命名约束、计划不为空 | |
| T5-M5 | Unity 迁移模板 | 在 Godot 纵切稳定后，再生成 Unity 2D Loot ARPG 对应 C# 模块 | |

---

## 十三、Track T6：Game Feel & UI Aesthetic System 审美与动效系统

### 13.1 结论

这个方向非常值得做，而且应该提升到和代码生成同级。Vibe coding 的代码生成门槛会越来越低，真正拉开差距的是玩法创意、反馈节奏、UI 审美、动效克制和游戏手感。当前 Agent 生成的修仙放置 UI 容易“土”和“俗”，根因不是缺少某个组件库，而是缺少 Art Direction 和 Motion Grammar。

建议新增一个轻量但强约束的 UI Style Director：每次生成游戏前，先产出 `docs/UI_STYLE_GUIDE.md` 和 `docs/MOTION_GUIDE.md`，再让 Web/Godot/Unity 各自按同一套审美约束落地。

### 13.2 对参考开源项目的评价

| 项目 | 适合如何使用 | 风险/限制 |
|------|------|------|
| `DavidHDev/react-bits` | 适合作为 Web 动效、hover、reveal、animated text、背景反馈的灵感索引和 React 原型参考 | 许可证是 MIT + Commons Clause，不建议把源码直接打包进可转售组件库或 Agent 内置模板；对 Godot/Unity 只能抽象成动效规则 |
| `signerlabs/ShipSwift` | 适合参考“AI 可调用组件/recipe 的组织方式”和产品化模板结构 | 本身更偏 SwiftUI/iOS app starter，不是游戏 UI 动效库；可学组织方式，不建议作为游戏审美主源 |
| `magicuidesign/magicui` | 适合作为 Web UI motion pattern 参考，尤其适合营销页、菜单、面板、状态反馈 | 偏 Web 与 SaaS 表达，直接套到游戏里容易产品化过强 |
| `motiondivision/motion` | 适合作为 React/Web 动效执行层，沉淀 duration/easing/stagger/gesture 等 token | 只解决 Web 端动效实现，不解决美术方向 |
| `pixijs/pixijs` / `phaserjs/phaser` | 适合 Web 游戏的 Canvas/WebGL 表现、粒子、HUD 动画、2D 游戏反馈 | 不是 UI 审美库，应该作为实现层而不是风格源 |

核心原则：这些项目不要“整库塞进知识库并复制代码”，而要做成 Knowledge Card + Design Pattern + Engine Adapter。Web 端可以复用许可允许的组件或思路；Godot/Unity 端应把它们翻译成 Tween、AnimationPlayer、Shader、Particle、UI Theme、Animator 等引擎原生实现。

### 13.3 建议新增 UI Style Director 输出

每个新游戏计划都应生成：

```text
docs/UI_STYLE_GUIDE.md
docs/MOTION_GUIDE.md
docs/GAME_FEEL_CHECKLIST.md
```

其中 `UI_STYLE_GUIDE.md` 必须包含：

- `styleKeywords`：3-5 个风格关键词，禁止空泛词，如“高级”“炫酷”。
- `antiPatterns`：明确禁止的俗套元素，如廉价金色描边、满屏渐变光效、仙侠页游式按钮。
- `palette`：主色、强调色、危险色、背景色、稀有度颜色，不允许单一色系铺满。
- `typography`：字号层级、数字字体、标题/按钮/数值文本规则。
- `componentRules`：HUD、背包、装备卡、掉落弹窗、战斗反馈、空状态。
- `motionRules`：进入、退出、拾取、暴击、升级、稀有掉落、按钮按压的动效语法。
- `engineNotes`：React/Godot/Unity 分别如何实现同一套规则。

### 13.4 首批风格包建议

不要继续只做“修仙=金色+祥云+毛笔字”。建议先沉淀 3 套风格包，每套都有正向规则和反向禁用项：

| 风格包 | 适用游戏 | 方向 |
|------|------|------|
| `pixel-loot-neon` | 2D 像素刷宝、地牢、ARPG | 像素边框、清晰稀有度、短促反馈、少量霓虹强调 |
| `xianxia-ink-premium` | 修仙放置、国风 RPG | 水墨留白、玉石/绢帛质感、低饱和色、克制粒子，避免页游金光 |
| `cozy-idle-workshop` | 休闲放置、经营、合成 | 柔和材质、清楚数值、轻弹性反馈、舒适低压 |

### 13.5 建议 Milestone

| Milestone | 任务 | 验收标准 | 状态 |
|------|------|------|------|
| T6-M1 | 新增 UI Style Director | 根据需求生成 `UI_STYLE_GUIDE.md` / `MOTION_GUIDE.md`，包含 anti-patterns | ✅ 已完成 — 见 [style-director.ts](<src/style-director/style-director.ts>) |
| T6-M2 | 新增 Motion Token schema | 定义 `duration` / `easing` / `stagger` / `press` / `hover` / `reward` / `rarity` | ✅ 已完成 — 9 Token，见 [types.ts](<src/style-director/types.ts>) |
| T6-M3 | 建立 UI/动效知识卡索引 | 收录 React Bits、Magic UI、Motion、PixiJS、Phaser 等为索引卡，不全文入库 | ✅ 已完成 — 6 条索引，见 [reference-index.json](<knowledge/ui-motion/reference-index.json>) |
| T6-M4 | 三套风格包落地 | `pixel-loot-neon`、`xianxia-ink-premium`、`cozy-idle-workshop` 可被 Planner 选择 | ✅ 已完成 — 见 [style-director.ts](<src/style-director/style-director.ts>) `DEFAULT_STYLE_PACKS` |
| T6-M5 | 引擎适配输出 | Web 输出 React/CSS motion；Godot 输出 Tween/AnimationPlayer/Theme；Unity 输出 Animator/DOTween 或内置动画建议 | ✅ 已完成 — Web/Godot/Unity 模板见 [style-director.ts](<src/style-director/style-director.ts>) `adaptToGodot`/`adaptToUnity` |

---

## 十四、v4.3 推荐执行顺序

不要同时开六条线。推荐顺序：

1. **T2-M1/T2-M2：Hybrid Reflector 规则校验**
   - 直接省 token，直接提升可靠性。
   - 对现有 P→E→R 管线收益最大。

2. **T4-M1/T4-M2：Debug Contract + 结构化日志**
   - 为后续实机排错打基础。
   - 不依赖手机连接，先让生成项目天生可诊断。

3. **T1-M1/T1-M3：Memory v2 类型与注入策略**
   - 先定义好分层和注入策略，再迁移数据。

4. **T3-M1/T3-M2：build-your-own-x 知识索引**
   - 只做索引卡片，不做全文入库。
   - 作为 Knowledge Memory 的第一批外部知识源。

5. **T5-M1/T5-M2：Godot 2D 像素刷宝计划纵切**
   - 先解决“计划步骤为空”的根问题。
   - 让 Godot/Unity 从通用脚手架进入真实游戏品类。

6. **T6-M1/T6-M2：UI Style Director + Motion Token**
   - 先生成审美规范和动效语法，再生成 UI 代码。
   - 直接改善 Agent 生成作品的第一眼质量。

7. **T4-M4：Android ADB Device Tool**
   - 在 Debug Contract 稳定后再做实机自动操作。

### v4.3 MVP 完成标准

```text
Hybrid Reflector:
  - 成功路径不调用 LLM
  - 失败路径才调用 LLM
  - 输出 reflection-report.json

Debug Contract:
  - 新生成项目内置结构化 logger
  - 可生成 bug-report.zip

Memory v2:
  - 能按五层记忆组装 prompt memory pack
  - Knowledge Memory 只通过 RAG 注入最多 3 条卡片

Knowledge Source:
  - build-your-own-x 游戏相关索引可被检索

Engine-native Genre:
  - “2D像素刷宝游戏”计划步骤、风险、工期均非空
  - Godot 纵切能生成战斗/掉落/背包/装备/HUD 核心文件

UI Aesthetic:
  - 新项目自动生成 UI_STYLE_GUIDE.md 和 MOTION_GUIDE.md
  - 至少 3 套风格包可被 Planner 选择
```
