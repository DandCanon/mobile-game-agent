/**
 * MCP CLI 启动入口 — 供 npx tsx 或 mgai mcp 直接调用
 *
 * 以 stdio transport 启动 MCP Server。
 * 严禁向 stdout 输出任何非 MCP 协议内容，日志走 stderr + 文件。
 *
 * 用法：
 *   npx.cmd tsx mcp/run.ts
 *   或通过 Codex / Claude Code / Hermes 等 MCP 客户端配置启动。
 */

import { start } from "./index.js";

async function main(): Promise<void> {
  try {
    await start();
  } catch (err) {
    // 异常仅写入 stderr，绝不污染 stdout（MCP 协议通道）
    console.error("[mgai-mcp] Fatal error:", err instanceof Error ? err.message : String(err));
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

main();
