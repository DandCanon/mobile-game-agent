/**
 * MCP Server 入口
 *
 * 导出 startMCPServer()，供 CLI 入口 / bin 入口调用。
 * 当通过 `mgai-mcp` 命令或 `mgai mcp` 子命令启动时，
 * 以 stdio transport 模式运行 MCP Server。
 */

import { startMCPServer } from "./server.js";

/**
 * 启动 MCP Server。
 * 自动探测项目根目录（从当前工作目录或环境变量 MGAI_PROJECT_ROOT）。
 */
export async function start(): Promise<void> {
  const projectRoot =
    process.env.MGAI_PROJECT_ROOT || process.cwd();
  await startMCPServer(projectRoot);
}

export { startMCPServer, createMCPServer } from "./server.js";
