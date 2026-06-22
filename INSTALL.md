# 手游 AI 开发 Agent (mgai) — 接入文档

> 版本 0.9.0  |  2026-06-23  |  v4.3 T5/T6 落位 — Engine-native Genre Pipelines (Godot 2D 像素刷宝纵切) + Game Feel & UI Aesthetic System (Style Director / Motion Token / 3 风格包)

---

## 1. 系统要求

| 项目 | 最低要求 |
|------|----------|
| Node.js | ≥ 20.0.0（推荐 Node 22 LTS；兼容 Node 20/22/23/24/25/26） |
| npm | ≥ 9.0.0 |
| 操作系统 | Windows 10+ / macOS 12+ / Linux |
| 磁盘空间 | ~50 MB（含 node_modules） |

> **Node 版本说明**：推荐使用 Node 22 LTS 作为最稳定环境。Node 20/24 也是兼容目标。
> Windows 用户通常**不需要**安装 Visual Studio Build Tools——只要当前 Node/依赖组合有预编译包（better-sqlite3@12.x 已提供覆盖 Node 20~26 的预编译包），原生模块即可直接加载。
> 如果因特殊 Node 版本或平台导致 better-sqlite3 加载失败，系统会自动降级为 degraded 模式（无持久化），核心规划/选型/技能工具不受影响。

---

## 2. 安装

### 2.1 从源码安装（开发用）

```powershell
git clone <仓库地址> mgai
cd mgai
npm install
npm run build
```

### 2.2 全局 CLI 安装

```powershell
npm install -g ./mgai
# 或指定路径
npm install -g D:\Marvis\手游AI开发Agent
```

安装后可在任意目录使用 `mgai` 命令。

### 2.3 验证安装

```powershell
mgai --version
# 输出: mgai v0.8.0

mgai health
# 输出: 各项检查通过
```

---

## 3. CLI 命令

| 命令 | 说明 |
|------|------|
| `mgai plan "<描述>"` | 生成执行计划，仅预览不执行 |
| `mgai execute "<描述>"` | 生成计划并完整执行 P→E→R 管线 |
| `mgai status` | 查看项目文件统计 |
| `mgai health` | 环境健康检查 |
| `mgai dashboard` | 在浏览器打开仪表板 |
| `mgai test --self-check` | 运行完整自检（编译+测试） |
| `mgai --help` | 帮助信息 |

### 3.1 示例

```powershell
# 预览计划
mgai plan "开发一款修仙放置手游，挂机自动修炼，突破境界"

# 完整执行
mgai execute "卡牌对战手游，有抽卡和排位系统"

# 自检
mgai test --self-check

# 仪表板
mgai dashboard
```

---

## 4. 作为 npm 包引入

### 4.1 编程式 API

```typescript
import { getGateway } from 'mgai/orchestration/gateway';
import { MarvisAdapter } from 'mgai/adapters/marvis-adapter';

async function main() {
  // 1. 创建适配器
  const adapter = new MarvisAdapter(process.cwd());

  // 2. 获取网关并注入适配器
  const gateway = getGateway();
  gateway.setAdapter(adapter);

  // 3. 发送请求
  const response = await gateway.handleRequest(
    {
      task: '开发一款修仙放置手游',
      context: {
        workspacePath: process.cwd(),
        currentPhase: '立项',
        history: [],
        artifacts: [],
        preferences: {
          language: 'zh-CN',
          codeStyle: 'compact',
          testFramework: 'vitest',
        },
        memoryIds: [],
        errors: [],
      },
      options: { planOnly: true },
    },
    'http',
  );

  // 4. 处理结果
  console.log('计划步骤数:', response.plan?.steps.length);
  console.log('技术推荐:', response.techRecommendation?.engine);
}

main();
```

### 4.2 技术选型独立调用

```typescript
import { selectTech } from 'mgai/orchestration/tech-selector';

const result = selectTech('放置', {
  workspacePath: '.',
  currentPhase: '立项',
  history: [],
  artifacts: [],
  preferences: { language: 'zh-CN', codeStyle: 'compact', testFramework: 'vitest' },
  memoryIds: [],
  errors: [],
});

console.log('推荐引擎:', result.recommended);  // 'react-vite-tailwind'
console.log('评分:', result.scores);
```

### 4.3 记忆系统

```typescript
import { MemorySystem } from 'mgai/orchestration/memory';

const mem = new MemorySystem('./my-project');
await mem.init();

// 写入记忆
await mem.remember('修仙数值表', '炼气→筑基→金丹→元婴→化神', {
  tags: ['设计', '数值'],
  importance: 8,
});

// 召回记忆
const results = await mem.recall({ query: '数值', tags: ['设计'] });
console.log(results[0].title); // '修仙数值表'
```

---

### 4.4 LLM 驱动管线（v0.4.0 新增）

注入 LLMClient 后，Planner 和 Gateway 自动走 LLM 路径。

```typescript
import { getGateway } from 'mgai/orchestration/gateway';
import { createLLMClient } from 'mgai/orchestration/llm-client';
import { MarvisAdapter } from 'mgai/adapters/marvis-adapter';

// 1. 创建 LLM 客户端
const llm = createLLMClient({
  provider: 'openai',
  model: 'gpt-4o',
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. 注入到 Gateway
const gateway = getGateway();
gateway.setLLMClient(llm);

// 3. 此后所有 planOnly / 完整执行走 LLM 路径
// LLM 失败时自动降级到规则模板
const response = await gateway.handleRequest(
  { task: '开发塔防手游', context: ctx, options: { planOnly: true } },
  'http',
);
console.log('计划来源:', response.plan?.planId.startsWith('plan-llm') ? 'LLM' : '模板');
```

**LLMClient 独立使用**：

```typescript
import { createLLMClient, OpenAIClient } from 'mgai/orchestration/llm-client';

// 方式一：工厂函数
const client = createLLMClient({
  provider: 'openai',        // 'openai' | 'openai-compatible' | 'claude'
  model: 'gpt-4o',           // 默认 gpt-4o
  apiKey: 'sk-xxx',          // 也可通过环境变量 OPENAI_API_KEY
  timeoutMs: 60000,          // 默认 60s
});

// 方式二：直接实例化
const client2 = new OpenAIClient({ provider: 'openai' });

// 非流式调用
const result = await client.complete(
  [{ role: 'user', content: '设计塔防手游的目录结构' }],
  { temperature: 0.3, maxTokens: 4096, jsonMode: true },
);

// 流式调用
for await (const event of client.completeStream(messages)) {
  if (event.type === 'text-delta') process.stdout.write(event.content);
  if (event.type === 'done') console.log('\n完成');
}

// 带 function-calling
const toolResult = await client.complete(messages, {
  tools: [
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: '写入文件',
        parameters: { /* JSON Schema */ },
      },
    },
  ],
});
```

**LLM Planner 独立调用**：

```typescript
import { generatePlanWithLLM } from 'mgai/orchestration/planner-llm';

const { plan, source } = await generatePlanWithLLM(
  llmClient,
  '开发修仙放置手游',
  context,
);
// source: 'llm' — LLM 生成成功
// source: 'fallback' — 自动降级到规则模板
```

**LLM Executor 独立调用**：

```typescript
import { executeStepWithLLM } from 'mgai/orchestration/executor-llm';

const stepRecord: StepRecord = { /* Planner 产出的步骤 */ };
const result = await executeStepWithLLM(
  llmClient,
  stepRecord,
  invokeTool,       // ToolInvoker 函数
  availableTools,    // ToolSchema[]
  { maxCallsPerStep: 10 },
);
console.log('步骤状态:', result.status);       // 'completed' | 'failed'
console.log('工具调用:', result.result?.toolCalls.length);
```

### 4.5 人工网关 PlanGate（v0.4.0 新增）

Planner 产出计划后暂停，等待人工确认才进入 Executor。

```typescript
const response = await gateway.handleRequest(
  {
    task: '开发卡牌对战手游',
    context: ctx,
    options: {
      // planGate: true,    // 跳过确认（自动通过）
      planGate: async (plan) => {
        console.log(`计划共 ${plan.steps.length} 个步骤:`);
        plan.steps.forEach((s, i) => console.log(`  ${i + 1}. [${s.phase}] ${s.title}`));
        // 在控制台交互确认（实际场景可接入 UI 弹窗）
        const readline = require('readline').createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        return new Promise((resolve) => {
          readline.question('是否执行？(Y/n): ', (answer: string) => {
            readline.close();
            resolve(answer.toLowerCase() !== 'n');
          });
        });
      },
    },
  },
  'http',
);

// 网关被拒绝时返回:
// response.gateStatus: { invoked: true, approved: false }
// response.status: 'partial'
// response.plan: 已生成的完整计划（供审查后手动传入）
```

**GateStatus 返回值**：

```typescript
interface GateStatus {
  invoked: boolean;   // 是否调用了网关
  approved: boolean;  // 是否通过
  reason?: string;    // 拒绝原因（如有）
}
```

### 4.6 错误截断（v0.4.0 新增）

Reflector 在对步骤进行反思时，自动对 `StepResult.errors` 做截断，防止大量错误爆仓 LLM 上下文。

```typescript
import { truncateErrors } from 'mgai/orchestration/reflector';
import type { ErrorTruncationConfig } from 'mgai/orchestration/reflector';

// 截断规则：
//   - 保留前 5 个错误（可配置）
//   - 单条消息截断至 200 字符（可配置）
//   - 超出部分追加截断标记

const truncated = truncateErrors(agentErrors, {
  maxErrors: 5,
  maxMessageLength: 200,
});
console.log(`原始 ${agentErrors.length} → 截断后 ${truncated.length}`);
```

Reflector 在 `reflect()` 函数的第 7 步自动调用截断，无需手动介入。被截断后的错误列表写回 `StepResult.errors`，后续 LLM 调用获得精简的上下文。

```
手游AI开发Agent/
├── protocol/                     # 接口协议层
│   └── agent-protocol.ts        # 统一接口契约（含 AgentToAgentMessage）
├── orchestration/                # 核心编排层
│   ├── tech-selector.ts         # 技术选型决策（3 引擎 × 10 维度）
│   ├── planner.ts              # 规则模板计划生成
│   ├── planner-llm.ts          # LLM 驱动的计划生成（含降级回退）
│   ├── executor.ts             # 规则驱动步骤执行
│   ├── executor-llm.ts         # LLM ReAct 循环步骤执行
│   ├── reflector.ts            # 反思校验（含错误截断）
│   ├── gateway.ts              # API 网关（含 PlanGate + LLM 路由）
│   ├── agent-orchestrator.ts   # 多 Agent 协同编排器
│   ├── llm-client.ts           # 统一 LLM 接口（OpenAI 实现 + 工厂函数）
│   ├── llm-summarizer.ts       # LLM 摘要生成
│   ├── logger.ts               # 双模式彩色日志
│   ├── guard.ts                # 工具执行安全护栏
│   ├── binary-guard.ts         # 大文件/二进制绕过守卫
│   ├── skill-loader.ts         # Skill 插件扫描器
│   ├── memory.ts               # Barrel 导出
│   ├── memory-system.ts        # 旧版文件级 JSON 记忆
│   ├── memory-manager.ts       # P0-P3 全联动管理器
│   ├── persistence.ts          # SQLite 四表持久化
│   ├── lru-cache.ts            # LRU 缓存
│   ├── tool-cache.ts           # 工具调用缓存拦截器
│   ├── embedder.ts             # 嵌入器接口+实现
│   └── vector-index.ts         # 零依赖向量索引
├── mcp/                          # MCP Server 包装层
│   ├── server.ts               # MCP Server 核心（7 Tools）
│   └── index.ts                # 启动入口
├── adapters/                     # 框架适配器层
│   ├── marvis-adapter.ts       # Marvis 框架适配器（P→E→R 闭环）
│   └── mcp-client-adapter.ts   # MCP Client 适配器
├── cli/                          # CLI 层
│   ├── mgai.ts                 # CLI 入口
│   └── run-mgai.js             # ESM bin shim
├── skills/                       # Skill 插件目录
│   ├── README.md               # SKILL.md 规范文档
│   ├── engine-web/SKILL.md     # Web 技术栈 Skill
│   ├── godot/SKILL.md          # Godot 4.x Skill
│   └── unity/SKILL.md          # Unity Skill
├── knowledge/                    # 知识索引
│   └── ui-motion/
│       └── reference-index.json # UI 动效知识卡索引（6 条）
├── src/                          # 品类模板 + 领域模块
│   ├── game/
│   │   ├── IdleEngine.ts       # 放置类引擎
│   │   └── CardEngine.ts       # 卡牌引擎
│   ├── level-gen/
│   │   ├── algorithms.ts       # BSP/CA/RW/WFC 四算法
│   │   └── types.ts            # 关卡类型定义
│   ├── numerics/
│   │   ├── curves.ts           # 数值曲线系统
│   │   └── export.ts           # 数值表导出
│   ├── networking/
│   │   ├── sync.ts             # 状态同步引擎
│   │   ├── matchmaking.ts      # 匹配系统
│   │   └── protocol.ts         # 对战协议
│   ├── monetization/
│   │   ├── store.ts            # 商店系统
│   │   ├── battle-pass.ts      # 战令系统
│   │   ├── bundles.ts          # 捆绑包/礼包
│   │   └── ads.ts              # 广告系统
│   └── style-director/
│       ├── types.ts            # Motion Token schema / 风格包 / 稀有度定义
│       └── style-director.ts   # Style Director 引擎 (9 base tokens + 3 style packs + 5 rarity tiers)
├── public/data/
│   └── engine-matrix.json       # 技术选型矩阵 JSON
├── tests/                        # 测试
│   ├── integration.test.ts     # 集成测试
│   ├── memory.test.ts          # 记忆系统测试
│   ├── e2e-flow.test.ts        # 端到端管线测试
│   ├── persistence.test.ts     # 持久化测试
│   ├── memory-manager.test.ts  # 记忆管理器测试
│   └── vector.test.ts          # 向量索引测试
├── templates/web-game/           # 游戏模板
├── dashboard.html                # 仪表板单页应用
├── package.json
└── tsconfig.json
```

---

## 6. 架构概览

```
        CLI / HTTP / 框架
              │
              ▼
    ┌─────────────────┐
    │   Gateway 网关   │  ← 校验 · 安全 · PlanGate · LLM 路由 · 日志
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  Planner 规划器  │  ← LLM 路径（planner-llm）→ 降级至规则模板（planner）
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  Executor 执行器 │  ← LLM ReAct 循环（executor-llm）→ 规则驱动（executor）
    └────────┬────────┘
             │
    ┌────────▼────────┐
    │  Reflector 反思  │  ← 错误截断 · 5 维度校验 · 修正建议 · 最多 3 轮
    └────────┬────────┘
             │
      ┌──────┴──────┐
      │  修正? 重试   │ ← yes → 回到 Executor
      └──────┬──────┘
             │ no
             ▼
      AgentResponse
```

**技术选型矩阵**（3 引擎 × 10 维度）：

| 维度 | React+Vite+Tailwind | Godot 4.x | Unity |
|------|---------------------|-----------|-------|
| 游戏类型适配 | 放置/卡牌/肉鸽/休闲 | 横版/平台/动作 | 射击/RPG/3D |
| 包体大小 | ~5 MB | ~30 MB | ~50 MB |
| 热更新 | 10/10 | 5/10 | 4/10 |
| 性能上限 | 中 | 高 | 最高 |
| AI 生成友好度 | 最高 | 中 | 最低 |

---

## 7. 接入 Marvis 框架

如果你是 Marvis 框架使用者，Agent 已内置 Marvis 适配器：

```typescript
import { MarvisAdapter } from 'mgai/adapters/marvis-adapter';

const adapter = new MarvisAdapter(workspacePath);

// 在 Marvis dispatch 流程中调用
const response = await adapter.execute({
  task: '开发修仙放置手游',
  context: adapter.getContext(),
});
```

适配器自动完成：
- 游戏类型推断（正则匹配 9 种品类）
- 技术选型（10 维度评分）
- 计划生成（品类模板库）
- 步骤执行 + 反思校验（最多 3 轮）

### 7.1 MCP 客户端接入

mgai 提供 MCP Server（stdio transport），可接入 Codex、Claude Code、Hermes 等 MCP 客户端。

#### Codex

**推荐方式**：使用 `run-mcp.cmd` 包装脚本，自动 `cd` 到项目根目录并设置环境变量，避免 npx/cwd 解析不稳定：

```toml
[mcp_servers.mgai]
command = "D:\\Marvis\\手游AI开发Agent\\mcp\\run-mcp.cmd"
args = []
env = { MGAI_PROJECT_ROOT = "D:\\Marvis\\手游AI开发Agent" }
startup_timeout_sec = 120
```

**备选方式**：直接调用 npx + tsx：

```toml
[mcp_servers.mgai]
command = "npx.cmd"
args = ["tsx", "D:\\Marvis\\手游AI开发Agent\\mcp\\run.ts"]
env = { MGAI_PROJECT_ROOT = "D:\\Marvis\\手游AI开发Agent" }
startup_timeout_sec = 120
```

> **注意**：项目目前以 TS 源码运行（tsx），不生成 .js 产物。入口文件为 `mcp/run.ts`（通过 `mcp/run-mcp.cmd` 包装脚本启动）。
> better-sqlite3@12.x 在主流 Node 版本（20~26）上提供预编译包，正常情况下直接生效，`mgai_get_status` 返回 `memoryStatus: healthy, sqliteAvailable: true`。
> 如果 better-sqlite3 原生模块因特殊原因不可用，MCP Server 仍会正常启动（degraded 模式），核心规划/选型/技能工具不受影响。

#### Claude Code

在 Claude Code 配置中：

```json
{
  "mcpServers": {
    "mgai": {
      "command": "npx",
      "args": ["tsx", "D:\\Marvis\\手游AI开发Agent\\mcp\\run.ts"],
      "env": { "MGAI_PROJECT_ROOT": "D:\\Marvis\\手游AI开发Agent" }
    }
  }
}
```

#### Hermes

在 Hermes 配置中：

```json
{
  "mcp_servers": {
    "mgai": {
      "command": "npx",
      "args": ["tsx", "D:\\Marvis\\手游AI开发Agent\\mcp\\run.ts"],
      "env": { "MGAI_PROJECT_ROOT": "D:\\Marvis\\手游AI开发Agent" }
    }
  }
}
```

---

## 8. 自定义扩展

### 8.1 添加新品类模板

编辑 `orchestration/planner.ts`，在 `TEMPLATES` 数组中添加：

```typescript
{
  gameType: '塔防',
  phases: {
    '立项': [
      {
        title: '塔防游戏架构设计',
        description: '设计地图网格、敌人路径、塔位系统',
        directoryStructure: ['src/game/', 'src/game/entities/'],
        interfaceContracts: [
          {
            name: 'placeTower',
            signature: '(gridX: number, gridY: number, towerType: string) => Tower',
            params: [
              { name: 'gridX', type: 'number', required: true, description: '网格 X' },
              { name: 'gridY', type: 'number', required: true, description: '网格 Y' },
              { name: 'towerType', type: 'string', required: true, description: '塔类型' },
            ],
            returns: 'Tower',
            purpose: '在指定位置放置塔',
          },
        ],
        dataModels: [
          { name: 'Tower', fields: [{ name: 'range', type: 'number', nullable: false, description: '攻击范围' }], description: '塔' },
        ],
        acceptanceCriteria: [
          { id: 'td-1', description: 'placeTower 测试通过', verifyBy: 'unit-test', verifyParam: 'test: placeTower' },
        ],
        estimatedTools: ['write_file'],
        dependencies: [],
        maxCodeLines: 150,
      },
    ],
    // …原型、生产、测试等阶段
  },
}
```

### 8.2 调整技术选型权重

编辑 `orchestration/tech-selector.ts` 中的 `DEFAULT_WEIGHTS` 数组。

### 8.3 新增框架适配器

实现 `AgentProtocol` 接口 — 参考 `adapters/marvis-adapter.ts`。

---

## 9. 常见问题

### Q: `mgai` 命令不存在
确保已执行 `npm install -g` 或通过 `npx tsx cli/mgai.ts` 运行。

### Q: TypeScript 编译失败
运行 `npm install` 确保依赖完整，然后 `npx tsc --noEmit` 检查。

### Q: `Error: Cannot find module '@types/node'`
已包含在 `devDependencies` 中，运行 `npm install` 即可。

### Q: 仪表板打不开
手动双击 `dashboard.html`，或使用 `mgai dashboard` 命令。

### Q: 测试失败
运行 `npx vitest run` 查看详细失败信息。确保 Node.js ≥ 20。

### Q: Codex 中 mgai MCP 返回 Transport closed

stdio MCP 子进程被杀后，当前 Codex 聊天持有的 transport **无法原地重连**（宿主限制）。

**正确处理方式：**
- 开新聊天或重启 Codex，MCP Server 会自动重新启动
- 开发调试时**不要杀当前 Codex 正在使用的 MCP 进程**
- `codex mcp list` 和 `codex mcp get` 只检查配置文件，不检查运行态 transport，**不能用来触发重连**
- `scripts/kill-mgai-mcp.ps1` 仅用于手动清理残留进程，不应用于正在使用的 MCP

### Q: SQLite 记忆模块不可用（memoryStatus: degraded）

mgai 的记忆持久化依赖 better-sqlite3 原生模块。如果 `mgai_get_status` 返回 `sqliteAvailable: false`：

**0. 最优先：排除 ESM require 误判**

如果 `node -e "require('better-sqlite3')"` 成功，但 `mgai_get_status` 仍返回 degraded，优先检查是否正确使用 `createRequire`：

```powershell
# 注意：项目根目录下 package.json 设置了 "type": "module"，
# 因此 node -e 需明确指定 CJS 模式才能使用 require：
node --input-type=commonjs -e "require('better-sqlite3'); console.log('OK')"

# 或在项目外执行（无 package.json type 影响）：
cd C:\ && node -e "require('D:\\Marvis\\手游AI开发Agent\\node_modules\\better-sqlite3'); console.log('OK')"

# 验证 ESM 运行时加载（与 mgai 运行时一致）
npx tsx scripts/smoke-sqlite-runtime.ts
```

项目使用 `"type": "module"` + tsx 运行，ESM 作用域内 `require` 不可用。如果代码中误用裸 `require()`，会抛出 `ReferenceError` 并被误判为 better-sqlite3 加载失败。应使用 `orchestration/native-loader.ts` 中的 `createRequire` 封装。

**1. 检查 SQLite 是否能加载：**

```powershell
npx tsx scripts/smoke-sqlite-runtime.ts
```

如果输出 `SQLITE_RUNTIME_OK`，说明加载逻辑正常。

**2. 重建原生模块：**

```powershell
npm rebuild better-sqlite3
```

**3. 确认版本匹配：**

```powershell
npm ls better-sqlite3
# 应显示 better-sqlite3@12.x（当前项目要求 ^12.11.1）
```

**4. 如果仍失败：**

- 检查 Node 版本是否在 20~26 之间（`node -v`）
- Windows 用户通常不需要 VS Build Tools，预编译包已覆盖主流平台
- 如果使用非主流 Node 版本或平台，可能需要安装 C++ 编译工具链
- degraded 模式作为兜底：SQLite 不可用时 mgai 自动降级，核心规划/选型功能不受影响

> 详细 MCP/SQLite 排错见 [docs/troubleshooting/codex-mcp-sqlite.md](docs/troubleshooting/codex-mcp-sqlite.md)

### Q: mgai_get_status 查看 SQLite 状态

调用 MCP 工具 `mgai_get_status`，检查返回的 `memory.status`：
- `"healthy"` — SQLite 已启用，记忆持久化正常工作
- `"degraded"` — SQLite 加载失败，记忆不持久化但核心功能正常

---

## 10. 开发命令

```powershell
npm run build          # TypeScript 编译检查
npm test               # 运行全部测试
npm run check          # 类型检查 + 测试一键运行
npm run cli            # mgai plan/execute/status/health/dashboard/test
npm run dashboard      # 打开开发仪表板
npx tsx scripts/e2e-marvis.ts          # 端到端 P→E→R 管线
npx tsx scripts/e2e-marvis.ts "自定义任务"  # 自定义游戏需求
npx tsx scripts/smoke-sqlite.ts              # SQLite 可用性快速验证 (CJS)
npx tsx scripts/smoke-sqlite-runtime.ts       # SQLite 运行时加载验证 (ESM, 与 mgai 一致)
```

---

## 版本历史

### v0.9.0 (2026-06-23) — T5/T6: Engine Pipelines + Game Feel
- T5 Engine-native Genre Pipelines M1/M2：Planner 新增 `LOOT_ARPG_TEMPLATE`（6 步骤 3 阶段）、buildRisks 增加 loot-arpg 4 条风险、generatePlan 入参扩展 targetEngine/artStyle/platforms；MCP Server GeneratePlanSchema 同步扩展；Gateway inferGameType 扩展识别刷宝/looter/像素ARPG
- T6 Game Feel & UI Aesthetic System M1~M5：新增 `src/style-director/` 目录（types.ts + style-director.ts，含 Motion Token schema、9 个基础 Token、3 套风格包、5 级稀有度动效）；新增 `knowledge/ui-motion/reference-index.json`（6 条知识卡索引）；Planner 集成 Style Director，自动生成 UI_STYLE_GUIDE.md + MOTION_GUIDE.md；ExecutionPlan 新增 styleGuidePath/motionGuidePath 字段
- tsc 零报错；MCP smoke 4/4 + binary-guard 9/9 通过

## 后续开发路线

v0.8.0 之后不再继续堆叠长 Phase 列表。后续开发以 `手游AI开发Agent计划.md` 中的 **Track / Milestone** 为准：

- T1 Memory v2：Working / Conversation / Project / Knowledge / Profile 五层记忆
- T2 Hybrid Reflector：Rule Based 优先，失败时再调用 LLM
- T3 Knowledge Memory：接入 build-your-own-x 等外部知识索引
- T4 Device Debug Agent：Debug Contract、bug bundle、Android ADB 实机排错
- T5 Engine-native Genre Pipelines：Godot/Unity 引擎原生品类纵切，优先补齐 Godot 2D 像素刷宝
- T6 Game Feel & UI Aesthetic System：UI Style Director、Motion Token、风格包与动效知识索引

安装、接入和运行方式仍以本文档为准；具体开发任务和验收标准以计划文档为准。

---

### Phase 7 (v0.4.0) — LLM 管线 + 人工网关 + 错误截断
- 新增 `orchestration/llm-client.ts`：LLMClient 接口 + OpenAIClient 实现（fetch 直调 REST API，零 SDK 依赖）+ createLLMClient() 工厂函数，支持 complete() / completeStream() / Function Calling / JSON Mode
- 新增 `orchestration/planner-llm.ts`：generatePlanWithLLM() 通过 system prompt（含 JSON Schema）调用 LLM 生成 ExecutionPlan，LLM 异常自动降级 generatePlan()
- 新增 `orchestration/executor-llm.ts`：executeStepWithLLM() 实现 ReAct 循环（system prompt + 工具 schema → LLM function calling → 执行工具 → 结果回传），最多 10 轮
- Gateway 改造：setLLMClient() 注入后自动走 LLM 路径，planGenResult.source 透传 'llm'|'template'，统一 planOnly/PlanGate/完整执行三个分支
- 新增 PlanGate：在 agent-protocol.ts 新增 planGate 选项 + GateStatus 类型，Gateway 5b 步生成计划后调 PlanGate 审查，未通过则返回 gateStatus 拒绝
- 错误截断：reflector.ts 新增 truncateErrors() 函数（保留前 5 个错误，单条截断至 200 字符），注入 reflect() 第 7 步
- agent-protocol.ts 新增 5 个类型定义（46 个）
- 新增 `ROGUELIKE_TEMPLATE`：肉鸽地牢品类（9x9 网格 / 随机地图 / 回合移动 / 遇敌战斗 / 道具拾取 / 楼层推进 / 死亡重置）
- 肉鸽代码生成器：types（Entity/DungeonFloor/Item/CellType）/ DungeonEngine（地图生成/移动/攻击/楼层） / DungeonScreen（网格渲染/方向键/战斗日志） / App 控制按钮 + 13 项 vitest 测试
- 战斗系统：玩家攻击 → 敌人反击 → 击杀回血 → 攻击力 buff 跨层继承
- 跨品类支持从 2 模板扩展至 3 模板（放置 + 卡牌 + 肉鸽）
- TypeScript 零错误，14/14 memory tests 通过
- code-generator.ts: 1486 → 1939 行，planner.ts: 470 → 603 行

### Phase 6a (v0.2.0) — 多品类模板与 Dev Server 验证
- 新增 `CARD_GAME_TEMPLATE`：卡牌对战品类（12 张卡牌 / 4 稀有度 / 回合制战斗 / AI 对手）
- 卡牌代码生成器：types / CardEngine / BattleScreen / DeckEditor + 9 项 vitest 测试
- 新增 `验证` 阶段第三步：dev server 启动验证
- MarvisAdapter 新增 dev server 命令映射
- 跨品类支持：规划器从 1 模板扩展至 2 模板（放置 + 卡牌）
- TypeScript 零错误，14/14 memory tests 通过

### Phase 5 (v0.2.0) — 质量验证闭环
- 新增 `验证` 流水线阶段：TypeScript 类型检查 + 引擎单元测试
- 代码生成器产出 12 项 vitest 引擎单元测试（初始状态 / 点击 / 升级 / 离线收益 / 成就）
- MarvisAdapter 新增 vitest 工具调用支持
- Planner 自动追加验证阶段到所有开发计划
- E2E: 7/7 步骤通过，79/79 全量测试通过

### Phase 4 (v0.1.0) — 代码生成器
- …(略)…

### Phase 8 (v0.8.0) — P0+P1+P3: SQLite 持久化 + 滑动窗口 + 摘要 + Gateway + 向量检索 RAG
- 新增 `orchestration/llm-summarizer.ts`：基于 LLMClient 的 SummaryGenerator 实现，温度 0.1，StepSummary 256 token、MetaSummary 384 token，LLM 不可用时自动降级为规则摘要
- Planner-LLM：`generatePlanWithLLM()` 新增 `sysPromptPrefix` 参数，接受 MemoryManager 产出的 System Prompt 前缀（注入位置在 SYSTEM_PROMPT 之后，遵循位置偏差效应）
- Gateway 集成：
  - 新增 `setMemory(MemoryManager)` 注入方法（与 `setLLMClient` 并列）
  - 步骤 4（生成计划）：从 `this.memory.buildSystemPromptPrefix()` 提取记忆前缀传入 Planner-LLM
  - 步骤 5d（记忆维护）：执行完成后异步调用 `this.memory.maintain(response.steps)`，裁剪超阈值上下文、生成摘要持久化、提取错误教训 upsert，失败不阻塞响应
- 重构 `orchestration/memory.ts` 为 barrel 导出（Persistence + MemoryManager + LLMSummarizer）
- 新增 `orchestration/persistence.ts`：SQLite 三表 schema（`user_profile` / `session_summaries` / `error_lessons`），better-sqlite3 同步 CRUD，WAL 模式，upsert 防重复
- 新增 `orchestration/memory-manager.ts`：记忆管理器，组合 ContextTrimmer + SummaryEngine
  - ContextTrimmer：步骤级滑动窗口（32K token 阈值），超阈值裁出最老的 5 个 StepRecord，最少保留 3 步
  - SummaryEngine：三级递归摘要 — L1 5 步 → 100 字 StepSummary → SQLite；L2 5 条 StepSummary → 200 字 MetaSummary → SQLite；L3 注入 System Prompt 末尾
  - 错误教训提取：从失败步骤自动 upsert 到 `error_lessons` 表，支持按频率/类别查询
  - `buildSystemPromptPrefix()`：组装最近 3 条 MetaSummary + 3 条 StepSummary
- 重构 `orchestration/memory.ts` 为 barrel 导出（Persistence + MemoryManager），旧 `MemorySystem` 移除
- 新增依赖：`better-sqlite3` + `@types/better-sqlite3`

### Phase 9 (v4.2) — v4.1 整改路线图全 Phase 落地

**Phase 0 止血**：tsc 零报错 / vitest 全部通过 / 测试文件重命名 / 导入路径修复

**Phase 1a 观测层**：
- 新增 `orchestration/logger.ts`：双模式彩色日志（终端 ANSI + 文件 JSON 序列化），24 tests

**Phase 1b MCP Server**：
- 新增 `mcp/server.ts`：基于 `@modelcontextprotocol/sdk` 实现，7 Tools（mgai_plan / mgai_health / mgai_status / mgai_execute / mgai_skill_list / mgai_skill_info / mgai_version），stdio transport，14 tests
- 新增 `mcp/index.ts`：MCP Server 启动入口
- 新增依赖：`@modelcontextprotocol/sdk`

**Phase 1c 防御补齐**：
- 新增 `orchestration/guard.ts`：工具执行安全护栏（路径边界/危险命令确认/审计日志），44 tests
- 新增 `orchestration/binary-guard.ts`：大文件/二进制绕过守卫（>1MB 或非文本类型过滤），9 tests
- 新增 `public/data/engine-matrix.json`：技术选型矩阵 JSON 配置（3 引擎 × 10 维度评分）
- `tech-selector.ts` 改为从 engine-matrix.json 加载矩阵，TS 只保留计算逻辑

**Phase 2a Skill 插件**：
- 新增 `orchestration/skill-loader.ts`：Skill 扫描器，自动发现注册 skills/ 目录下 SKILL.md，33 tests
- 新增 `skills/README.md`：SKILL.md 规范文档

**Phase 2b Agent 协同**：
- 新增 `orchestration/agent-orchestrator.ts`：多 Agent 协同编排器（Facade 包裹 Gateway + 任务委派协议），26 tests
- `protocol/agent-protocol.ts` 扩展 `AgentToAgentMessage` 类型

**Phase 2c MCP 适配器**：
- 新增 `adapters/mcp-client-adapter.ts`：mgai 可作为 MCP Client 调用其他 MCP Server

**Phase 2d 品类模板深化**：
- 新增 `src/game/IdleEngine.ts`：放置类引擎（点击/自动生产/多货币/升级树/成就/离线/存档/IAA/IAP），40 tests
- 新增 `src/game/CardEngine.ts`：卡牌引擎（抽卡概率/卡组构建/PVP 匹配/排位/赛季/商店），41 tests

**Phase 3a Godot Skill**：
- 新增 `skills/godot/SKILL.md`：Godot 4.x 实操 Skill 规范
- `code-generator.ts` 扩展 godot-2d / godot-3d 代码生成器，44 tests

**Phase 3b 关卡生成**：
- 新增 `src/level-gen/algorithms.ts`：BSP / 细胞自动机 / 随机游走 / WFC 四算法
- 新增 `src/level-gen/types.ts`：关卡生成类型定义

**Phase 3c 数值系统**：
- 新增 `src/numerics/curves.ts`：数值曲线系统（线性/指数/对数/多项式/Sigmoid/分段），67 tests
- 新增 `src/numerics/export.ts`：数值表导出（CSV/JSON/Markdown）

**Phase 3d Unity 适配**：
- 新增 `skills/unity/SKILL.md`：Unity 实操 Skill 规范
- `code-generator.ts` 扩展 unity-2d / unity-3d 代码生成器，65 tests

**Phase 3e 联网对战**：
- 新增 `src/networking/sync.ts`：状态同步引擎（客户端预测/服务器和解/插值）
- 新增 `src/networking/matchmaking.ts`：匹配系统（ELO/MMR + 等待队列）
- 新增 `src/networking/protocol.ts`：对战协议定义（消息序列化/帧同步），57 tests（networking 全量）

**Phase 3f 商业化**：
- 新增 `src/monetization/store.ts`：游戏内商店系统（虚拟货币/道具/礼包）
- 新增 `src/monetization/battle-pass.ts`：战令系统（免费+付费双轨/等级/奖励）
- 新增 `src/monetization/bundles.ts`：捆绑包/限时礼包系统
- 新增 `src/monetization/ads.ts`：广告系统（激励视频/插屏/Banner），86 tests（monetization 全量）

*文档版本: v0.8.0  |  2026-06-13  |  项目路径: D:\Marvis\手游AI开发Agent*
