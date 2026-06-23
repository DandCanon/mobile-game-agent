---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 0b418d7b66220b449a0c82e3d4c34758_be624dae6e8211f18805525400d9a7a1
    ReservedCode1: 3ROXmFe3VOSbnhLXnuR6of0QF/SA+ND3KrQgQCY6go/Z2oiN/uddFZAMuypZNvq8vXNofU8VdttGOCN/0rHfUi5zuqZvUoZbeyb9eO6uKoOqvEXd7JimXDr+5CYKb9680TB9czprwQPIMG5KcNUyAPY6UV4uzqxzLuqk0zynPEJp73i4OLuxjcHBG+0=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 0b418d7b66220b449a0c82e3d4c34758_be624dae6e8211f18805525400d9a7a1
    ReservedCode2: 3ROXmFe3VOSbnhLXnuR6of0QF/SA+ND3KrQgQCY6go/Z2oiN/uddFZAMuypZNvq8vXNofU8VdttGOCN/0rHfUi5zuqZvUoZbeyb9eO6uKoOqvEXd7JimXDr+5CYKb9680TB9czprwQPIMG5KcNUyAPY6UV4uzqxzLuqk0zynPEJp73i4OLuxjcHBG+0=
---

# Codex MCP + better-sqlite3 排错指南

> 最后更新：2026-06-23 | 相关 ADR：[ADR-0001](docs/adr/ADR-0001-mcp-stdio-lifecycle.md) [ADR-0002](docs/adr/ADR-0002-esm-native-module-loading.md)

## 问题速查表

| 现象 | 可能原因 | 优先检查 |
|------|---------|---------|
| `mgai_get_status` 返回 `degraded` | SQLite 加载失败 | ESM require 误判（见下文） |
| `sqliteAvailable: false` | better-sqlite3 原生模块问题 | smoke test + Node 版本 |
| `Transport closed` | MCP 子进程被杀 | 新聊天/重启 Codex |
| `codex mcp list` 显示正常但聊天内 MCP 不可用 | stdio transport 断连 | 同上，list/get 不检查运行态 |

## 快速排错决策树

```
mgai MCP 异常
  ├─ 是 "Transport closed"？
  │   └─ 开新聊天或重启 Codex。codex mcp list/get 只看配置，无法重连。
  ├─ 是 memoryStatus: degraded / sqliteAvailable: false？
  │   ├─ 先跑：npx tsx scripts/smoke-sqlite-runtime.ts
  │   ├─ 成功但 mgai 仍 degraded → ESM require 误判（见 §ESM require 误判）
  │   ├─ 失败 → npm rebuild better-sqlite3
  │   └─ 仍失败 → 检查 Node 版本是否在 20~26 之间
  └─ 其他异常
      └─ 查看 mgai_get_status 完整返回，定位具体模块
```

## ESM require 误判（高频坑）

**场景**：`node -e "require('better-sqlite3')"` 成功，但 `mgai_get_status` 仍返回 `sqliteAvailable: false`。

**根因**：项目 `package.json` 设置了 `"type": "module"`，使用 tsx 以 ESM 模式运行。ESM 作用域内直接使用 `require()` 会抛出 `ReferenceError`，被 catch 后误判为原生模块加载失败。

**判断方法**：

```powershell
# 在项目根目录下，node 默认以 ESM 模式运行 — 必须指定 CJS
node --input-type=commonjs -e "require('better-sqlite3'); console.log('OK')"

# 或在项目外执行（无 package.json type 影响）
cd C:\ && node -e "require('D:\\path\\to\\mobile-game-agent\\node_modules\\better-sqlite3'); console.log('OK')"
```

如果上述命令成功但 mgai 仍 degraded，基本可确定是 ESM require 问题。

**修复方式**：使用 `createRequire` 封装，见 `orchestration/native-loader.ts`。

## 验证命令

```powershell
# ESM 运行时 smoke test（与 mgai 运行时一致）
npx tsx scripts/smoke-sqlite-runtime.ts

# tsc 类型检查
npx tsc --noEmit

# 完整测试
npx vitest run
```

## Codex MCP stdio transport 限制

- Codex 的 MCP stdio transport 以子进程方式运行 mgai MCP Server
- 子进程被杀后，**当前聊天的 transport 无法原地重连**（Codex 宿主限制）
- `codex mcp list` / `codex mcp get` 只读取配置文件，**不检查运行态 transport**
- 开发调试时**不要杀当前 Codex 正在使用的 MCP 进程**
- 需要重启时：新开 Codex 聊天，或重启 Codex 应用

> 详细决策记录见 [ADR-0001](docs/adr/ADR-0001-mcp-stdio-lifecycle.md)
*（内容由AI生成，仅供参考）*
