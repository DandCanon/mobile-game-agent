---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 0b418d7b66220b449a0c82e3d4c34758_c09c04aa6e8211f18805525400d9a7a1
    ReservedCode1: 6nbIENe7g3l3P8YIZV2qnoAvHI119PFwrHmBrAjdFE5DjpoVXltoaqsXXo4gV00eoQ7ztqL/D6yOvt0DGsXng7p2a8WSVzdD65CrIYTVRoK8GWbWoQ0DP6Hehayw+4DF3tW37V0mbn7lUuThNrv91aQTFtmKTnWpxWgsdCQHIEGaVdIL4gyHfUC06nE=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 0b418d7b66220b449a0c82e3d4c34758_c09c04aa6e8211f18805525400d9a7a1
    ReservedCode2: 6nbIENe7g3l3P8YIZV2qnoAvHI119PFwrHmBrAjdFE5DjpoVXltoaqsXXo4gV00eoQ7ztqL/D6yOvt0DGsXng7p2a8WSVzdD65CrIYTVRoK8GWbWoQ0DP6Hehayw+4DF3tW37V0mbn7lUuThNrv91aQTFtmKTnWpxWgsdCQHIEGaVdIL4gyHfUC06nE=
---

# ADR-0001：MCP stdio transport 生命周期管理

**状态**：已采纳
**日期**：2026-06-23
**决策者**：AI Agent + 用户确认
**影响范围**：mgai MCP Server 部署与调试流程

## 上下文

mgai 作为 Codex 的 MCP Server，通过 stdio transport 与 Codex 通信。开发过程中发现：

1. 杀 MCP Server 进程后，当前 Codex 聊天内 MCP 功能不可用
2. `codex mcp list` / `codex mcp get` 显示配置正常，但无法恢复 MCP 功能
3. 用户需开新聊天或重启 Codex 才能恢复

## 决策

### 1. mgai MCP 使用 stdio transport

- Codex 以子进程方式启动 mgai MCP Server
- stdio transport 是 MCP 协议的标准 transport 之一，Codex 原生支持
- 无需额外网络配置，进程生命周期由 Codex 管理

### 2. 当前 Codex 无运行态 reload 命令

- `codex mcp list` 和 `codex mcp get` 仅读取配置文件，不检查运行态 transport 状态
- 不存在 `codex mcp reload` 或等效命令来重新启动已断连的 MCP Server
- 这是 Codex 宿主层面的限制，mgai 项目无法绕过

### 3. MCP Server 进程不能因内部模块失败而退出

- MCP Server 内部模块（如 persistence、binary-guard）失败时，应降级而非退出
- 降级模式保证核心规划/选型功能不受影响
- degraded 状态通过 `mgai_get_status` 对外暴露，方便排查

### 4. 调试时不要杀当前 Codex 正在使用的 MCP 进程

- 杀进程 = 需新开聊天或重启 Codex 才能恢复
- 如需重启 MCP Server，先关闭当前 Codex 聊天
- 如需清理残留进程，使用 `scripts/kill-mgai-mcp.ps1`，但仅在确认聊天已关闭后执行

## 后果

- **正向**：降级模式保证 MCP Server 韧性，核心功能不受子模块故障影响
- **负向**：stdio transport 断连后无法热修复，调试迭代成本较高
- **后续观察**：如 Codex 未来支持运行态 MCP reload，可考虑接入

## 参考

- [排错指南](../troubleshooting/codex-mcp-sqlite.md)
- [ADR-0002](ADR-0002-esm-native-module-loading.md)
*（内容由AI生成，仅供参考）*
