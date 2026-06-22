/**
 * MCP Client Adapter — 使 mgai 以 MCP Client 身份连接外部 MCP Server
 *
 * 职责：
 * 1. 管理到外部 MCP Server 的连接池（支持多 Server 并存）
 * 2. 列出外部 Server 提供的 Tools
 * 3. 调用外部 Tool（含超时 + 重试机制）
 * 4. 安全清理所有连接
 *
 * 传输层支持：
 * - stdio：通过 command + args 启动子进程
 * - http：通过 HTTP/SSE 连接远程 Server（保留接口，实际走 streamableHttp）
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type {
  CallToolResult,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "../orchestration/logger.js";

/* ===================== 类型定义 ===================== */

/** 外部 MCP 连接配置 */
export interface MCPConnectionConfig {
  /** 连接唯一名称（用于池管理） */
  serverName: string;
  /** 传输类型 */
  transport: "stdio" | "http";
  /** stdio 传输参数 */
  stdio?: {
    command: string;
    args?: string[];
    env?: Record<string, string>;
    cwd?: string;
  };
  /** http 传输参数 */
  http?: {
    url: string;
    headers?: Record<string, string>;
  };
  /** 连接超时（ms），默认 15000 */
  connectTimeoutMs?: number;
}

/** 外部 MCP Tool 描述 */
export interface MCPTool {
  /** Tool 名称 */
  name: string;
  /** Tool 描述 */
  description: string;
  /** 输入 JSON Schema */
  inputSchema: Record<string, unknown>;
  /** 所属的外部 Server 名称 */
  serverName: string;
}

/** 单个连接的内部状态 */
interface ConnectionState {
  config: MCPConnectionConfig;
  client: Client;
  transport: Transport;
  connected: boolean;
  tools: MCPTool[];
  connectPromise: Promise<void> | null;
}

/** callExternalTool 调用选项 */
export interface CallToolOptions {
  /** 超时时间（ms），默认 30000 */
  timeoutMs?: number;
  /** 最大重试次数，默认 2 */
  maxRetries?: number;
}

/* ===================== 常量 ===================== */

const DEFAULT_CONNECT_TIMEOUT = 15_000;
const DEFAULT_CALL_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;

/* ===================== MCPClientAdapter 实现 ===================== */

export class MCPClientAdapter {
  /** 连接池：serverName → ConnectionState */
  private connections: Map<string, ConnectionState> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger("MCPClientAdapter");
  }

  /* ===================== 连接管理 ===================== */

  /**
   * 建立到外部 MCP Server 的连接。
   * 支持 stdio（启动子进程）和 http（连接远程 URL）两种传输。
   */
  async connect(config: MCPConnectionConfig): Promise<void> {
    if (this.connections.has(config.serverName)) {
      throw new Error(`连接 "${config.serverName}" 已存在，请先断开或使用不同的 serverName`);
    }

    this.logger.info(`正在连接外部 MCP Server: ${config.serverName} (${config.transport})`);

    let transport: Transport;

    if (config.transport === "stdio") {
      if (!config.stdio) {
        throw new Error("stdio 传输需要提供 stdio 配置");
      }
      transport = new StdioClientTransport({
        command: config.stdio.command,
        args: config.stdio.args ?? [],
        env: config.stdio.env,
        cwd: config.stdio.cwd,
      });
    } else {
      if (!config.http) {
        throw new Error("http 传输需要提供 http 配置");
      }
      transport = new StreamableHTTPClientTransport(
        new URL(config.http.url),
        {
          requestInit: config.http.headers
            ? { headers: config.http.headers }
            : undefined,
        },
      );
    }

    const client = new Client(
      { name: "mgai", version: "0.8.0" },
      { capabilities: {} },
    );

    const state: ConnectionState = {
      config,
      client,
      transport,
      connected: false,
      tools: [],
      connectPromise: null,
    };

    // 先存入池以便超时处理时能找到
    this.connections.set(config.serverName, state);

    const timeoutMs = config.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT;
    const connectPromise = this.doConnect(state, timeoutMs);
    state.connectPromise = connectPromise;

    try {
      await connectPromise;
    } catch (err) {
      // 连接失败时从池中移除
      this.connections.delete(config.serverName);
      throw err;
    }

    state.connected = true;
    state.connectPromise = null;

    // 连接成功后立即拉取 Tools 列表
    await this.refreshTools(state);

    this.logger.info(
      `外部 MCP Server 已连接: ${config.serverName}，可用 Tools: ${state.tools.length}`,
    );
  }

  /** 内部：带超时的连接流程 */
  private async doConnect(state: ConnectionState, timeoutMs: number): Promise<void> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`连接 "${state.config.serverName}" 超时 (${timeoutMs}ms)`)),
        timeoutMs,
      ),
    );

    await Promise.race([state.client.connect(state.transport), timeout]);
  }

  /** 刷新指定连接的工具列表 */
  private async refreshTools(state: ConnectionState): Promise<void> {
    const result = (await state.client.listTools()) as ListToolsResult;
    state.tools = (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: (t.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
      serverName: state.config.serverName,
    }));
  }

  /* ===================== 工具发现 ===================== */

  /**
   * 列出外部 Server 提供的 Tools。
   * @param serverName 可选，不传则返回所有已连接 Server 的工具合集
   */
  async listExternalTools(serverName?: string): Promise<MCPTool[]> {
    if (serverName) {
      const state = this.connections.get(serverName);
      if (!state) {
        throw new Error(`未找到连接: ${serverName}`);
      }
      if (!state.connected) {
        throw new Error(`连接 "${serverName}" 尚未就绪`);
      }
      return [...state.tools];
    }

    // 返回全部
    const all: MCPTool[] = [];
    for (const [, state] of this.connections) {
      if (state.connected) {
        all.push(...state.tools);
      }
    }
    return all;
  }

  /* ===================== 工具调用 ===================== */

  /**
   * 调用外部 Tool。
   * 自动定位 Tool 所属的 Server 连接，支持超时和自动重试。
   *
   * @param name       Tool 名称
   * @param args       Tool 参数
   * @param serverName 可选，指定 Server 名称（多 Server 下有同名 Tool 时必传）
   * @param options    调用选项
   */
  async callExternalTool(
    name: string,
    args: Record<string, unknown>,
    serverName?: string,
    options: CallToolOptions = {},
  ): Promise<unknown> {
    const timeoutMs = options.timeoutMs ?? DEFAULT_CALL_TIMEOUT;
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    const state = this.resolveConnection(name, serverName);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.callWithTimeout(state, name, args, timeoutMs);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < maxRetries) {
          this.logger.warn(
            `Tool "${name}" 调用失败 (第 ${attempt + 1}/${maxRetries + 1} 次)，${lastError.message}，准备重试...`,
          );
          // 重试前稍等
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
      }
    }

    throw new Error(
      `Tool "${name}" 调用失败，已重试 ${maxRetries} 次: ${lastError?.message}`,
    );
  }

  /** 带超时的单次调用 */
  private async callWithTimeout(
    state: ConnectionState,
    name: string,
    args: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Tool "${name}" 调用超时 (${timeoutMs}ms)`)),
        timeoutMs,
      ),
    );

    const callPromise = state.client.callTool({
      name,
      arguments: args,
    }) as Promise<CallToolResult>;

    const result = await Promise.race([callPromise, timeout]);

    // 检查是否是错误返回
    if (result.isError) {
      const errorText =
        result.content
          ?.filter((c) => c.type === "text")
          .map((c) => (c as { type: "text"; text: string }).text)
          .join(" ") ?? "未知错误";
      throw new Error(`Tool "${name}" 返回错误: ${errorText}`);
    }

    // 提取文本内容作为返回值
    const texts =
      result.content
        ?.filter((c) => c.type === "text")
        .map((c) => (c as { type: "text"; text: string }).text) ?? [];

    // 如果只有一个 text 且是 JSON，直接解析返回
    if (texts.length === 1) {
      try {
        return JSON.parse(texts[0]);
      } catch {
        return texts[0];
      }
    }

    if (texts.length > 1) {
      return texts;
    }

    // 无文本内容时返回 raw result
    return result;
  }

  /** 根据 tool 名称定位连接 */
  private resolveConnection(name: string, serverName?: string): ConnectionState {
    if (serverName) {
      const state = this.connections.get(serverName);
      if (!state) throw new Error(`未找到连接: ${serverName}`);
      if (!state.connected) throw new Error(`连接 "${serverName}" 尚未就绪`);
      return state;
    }

    // 自动查找：找到第一个拥有该 Tool 的连接
    for (const [, state] of this.connections) {
      if (!state.connected) continue;
      if (state.tools.some((t) => t.name === name)) {
        return state;
      }
    }

    // 如果所有连接都没有此 tool，列出已知工具
    const knownTools = Array.from(this.connections.entries())
      .filter(([, s]) => s.connected)
      .flatMap(([sn, s]) => s.tools.map((t) => `${sn}:${t.name}`));

    throw new Error(
      `未找到 Tool "${name}"。已连接的 Tool 列表: ${knownTools.length > 0 ? knownTools.join(", ") : "(无)"}`,
    );
  }

  /* ===================== 断开连接 ===================== */

  /**
   * 断开连接。
   * @param serverName 可选，不传则断开所有连接
   */
  async disconnect(serverName?: string): Promise<void> {
    if (serverName) {
      const state = this.connections.get(serverName);
      if (state) {
        await this.closeState(state);
        this.connections.delete(serverName);
        this.logger.info(`已断开连接: ${serverName}`);
      }
      return;
    }

    // 断开全部
    const names = Array.from(this.connections.keys());
    await Promise.all(
      names.map(async (name) => {
        const state = this.connections.get(name);
        if (state) {
          await this.closeState(state);
          this.connections.delete(name);
        }
      }),
    );
    this.logger.info(`已断开所有外部 MCP 连接 (${names.length} 个)`);
  }

  private async closeState(state: ConnectionState): Promise<void> {
    // 如果正在连接中，先等待
    if (state.connectPromise) {
      try {
        await state.connectPromise;
      } catch {
        // 连接失败时仍尝试关闭 transport
      }
    }
    try {
      await state.client.close();
    } catch {
      // 关闭失败忽略
    }
    state.connected = false;
  }

  /* ===================== 状态查询 ===================== */

  /** 获取已连接 Server 名称列表 */
  getConnectedServers(): string[] {
    return Array.from(this.connections.entries())
      .filter(([, s]) => s.connected)
      .map(([name]) => name);
  }

  /** 获取外部工具总数（跨所有连接） */
  getExternalToolsCount(): number {
    let count = 0;
    for (const [, state] of this.connections) {
      if (state.connected) {
        count += state.tools.length;
      }
    }
    return count;
  }
}
