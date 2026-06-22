/**
 * MCP Server 单元测试
 *
 * 测试各 MCP Tool 的输入验证和输出格式。
 * 通过 McpServer 内部 _registeredTools 直接调用 handler，
 * 避免依赖 stdio transport 和完整 MCP 握手流程。
 */

import { describe, it, expect, beforeAll } from "vitest";
import { createMCPServer } from "../mcp/server.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, TextContent } from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ToolEntry {
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

type RegisteredTools = Record<string, ToolEntry>;

function getTools(server: McpServer): RegisteredTools {
  return (server as unknown as { _registeredTools: RegisteredTools })
    ._registeredTools;
}

async function invokeTool(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const tools = getTools(server);
  const tool = tools[toolName];
  if (!tool) {
    throw new Error(`Tool not registered: ${toolName}`);
  }
  return tool.handler(args);
}

/** 从 CallToolResult 提取 text content 的纯文本 */
function getText(result: CallToolResult): string {
  const ct = result.content[0];
  if (ct.type !== "text") {
    throw new Error(`Expected text content, got ${ct.type}`);
  }
  return (ct as TextContent).text;
}

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------

describe("MCP Server", () => {
  let server: McpServer;

  beforeAll(async () => {
    server = await createMCPServer(process.cwd());
  });

  describe("mgai_get_status", () => {
    it("should return valid status JSON with required fields", async () => {
      const result = await invokeTool(server, "mgai_get_status", {});

      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");

      const status = JSON.parse(getText(result));
      expect(status.name).toBe("手游AI开发Agent");
      expect(typeof status.version).toBe("string");
      expect(status.version).toBeTruthy();
      expect(typeof status.projectRoot).toBe("string");
      expect(typeof status.skills.count).toBe("number");
      expect(typeof status.skills.path).toBe("string");
      expect(typeof status.memory.totalEntries).toBe("number");
      expect(typeof status.memory.archivedEntries).toBe("number");
      expect(typeof status.memory.totalSizeBytes).toBe("number");
      expect(typeof status.vectorIndex.recordCount).toBe("number");
      expect(typeof status.runtime.nodeVersion).toBe("string");
      expect(typeof status.runtime.platform).toBe("string");
      expect(status.runtime.platform).toBe("win32");
      expect(typeof status.timestamp).toBe("string");
      // timestamp should parse as ISO 8601
      expect(() => new Date(status.timestamp)).not.toThrow();
    });
  });

  describe("mgai_generate_plan", () => {
    it("should generate a plan with required fields", async () => {
      const result = await invokeTool(server, "mgai_generate_plan", {
        requirement: "开发一款修仙放置手游",
      });

      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");

      const plan = JSON.parse(getText(result));
      expect(typeof plan.planId).toBe("string");
      expect(typeof plan.overallGoal).toBe("string");
      expect(typeof plan.gameType).toBe("string");
      expect(plan.gameType).toBe("放置");
      expect(Array.isArray(plan.steps)).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(0);

      for (const step of plan.steps) {
        expect(typeof step.id).toBe("string");
        expect(typeof step.phase).toBe("string");
        expect(typeof step.title).toBe("string");
        expect(typeof step.description).toBe("string");
        expect(Array.isArray(step.estimatedTools)).toBe(true);
        expect(typeof step.maxCodeLines).toBe("number");
      }

      expect(Array.isArray(plan.risks)).toBe(true);
    });

    it("should infer game type from requirement keywords", async () => {
      const result = await invokeTool(server, "mgai_generate_plan", {
        requirement: "开发一款卡牌对战手游，有抽卡系统",
      });

      expect(result.isError).toBeFalsy();
      const plan = JSON.parse(getText(result));
      expect(plan.gameType).toBe("卡牌");
    });

    it("should allow explicit gameType override", async () => {
      const result = await invokeTool(server, "mgai_generate_plan", {
        requirement: "开发一款游戏",
        gameType: "肉鸽",
      });

      expect(result.isError).toBeFalsy();
      const plan = JSON.parse(getText(result));
      expect(plan.gameType).toBe("肉鸽");
    });
  });

  describe("mgai_generate_code", () => {
    it("should generate code files for a valid planTitle", async () => {
      const result = await invokeTool(server, "mgai_generate_code", {
        planTitle: "项目初始化",
      });

      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");

      const output = JSON.parse(getText(result));
      expect(typeof output.planTitle).toBe("string");
      expect(typeof output.fileCount).toBe("number");
      expect(output.fileCount).toBeGreaterThan(0);
      expect(Array.isArray(output.files)).toBe(true);

      for (const file of output.files) {
        expect(typeof file.filePath).toBe("string");
        expect(typeof file.content).toBe("string");
      }
    });

    it("should generate code for game engine core", async () => {
      const result = await invokeTool(server, "mgai_generate_code", {
        planTitle: "游戏引擎核心实现",
      });

      expect(result.isError).toBeFalsy();
      const output = JSON.parse(getText(result));
      expect(output.fileCount).toBeGreaterThan(0);
    });
  });

  describe("mgai_evaluate_tech", () => {
    it("should return tech recommendation with ranking and caveats", async () => {
      const result = await invokeTool(server, "mgai_evaluate_tech", {
        requirement: "开发一款休闲手游",
      });

      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");

      const tech = JSON.parse(getText(result));
      expect(typeof tech.recommendation).toBe("object");
      expect(tech.recommendation.engine).toBeTruthy();
      expect(typeof tech.recommendation.engine).toBe("string");
      expect(typeof tech.recommendation.reason).toBe("string");

      expect(Array.isArray(tech.ranking)).toBe(true);
      expect(tech.ranking.length).toBeGreaterThan(0);
      for (const item of tech.ranking) {
        expect(typeof item.engine).toBe("string");
        expect(typeof item.score).toBe("number");
        expect(item.score).toBeGreaterThanOrEqual(0);
        expect(item.score).toBeLessThanOrEqual(100);
      }

      expect(Array.isArray(tech.caveats)).toBe(true);
    });

    it("should respect teamSize and platform constraints", async () => {
      const result = await invokeTool(server, "mgai_evaluate_tech", {
        requirement: "开发RPG手游",
        gameType: "rpg",
        teamSize: 5,
        performanceLevel: "high",
        targetPlatforms: ["Android", "iOS"],
      });

      expect(result.isError).toBeFalsy();
      const tech = JSON.parse(getText(result));
      expect(typeof tech.recommendation.engine).toBe("string");
    });
  });

  describe("mgai_vector_search", () => {
    it("should return search results with valid structure", async () => {
      const result = await invokeTool(server, "mgai_vector_search", {
        query: "卡牌游戏",
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(result.isError).toBeFalsy();
      expect(result.content.length).toBeGreaterThan(0);
      expect(result.content[0].type).toBe("text");

      const searchResult = JSON.parse(getText(result));
      expect(searchResult.query).toBe("卡牌游戏");
      expect(typeof searchResult.totalResults).toBe("number");
      expect(Array.isArray(searchResult.results)).toBe(true);

      for (const item of searchResult.results) {
        expect(typeof item.id).toBe("string");
        expect(typeof item.title).toBe("string");
        expect(typeof item.content).toBe("string");
        expect(Array.isArray(item.tags)).toBe(true);
        expect(["vector", "memory"]).toContain(item.source);
      }
    });

    it("should handle default limit", async () => {
      const result = await invokeTool(server, "mgai_vector_search", {
        query: "优化",
      });

      expect(result.isError).toBeFalsy();
      const searchResult = JSON.parse(getText(result));
      expect(searchResult.results.length).toBeLessThanOrEqual(10);
    });
  });

  describe("Error handling", () => {
    it("should handle empty query gracefully", async () => {
      const result = await invokeTool(server, "mgai_vector_search", {
        query: "",
      });

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
    });
  });

  describe("Tool registration completeness", () => {
    it("should register all 5 required tools", () => {
      const tools = getTools(server);
      const toolNames = Object.keys(tools);

      expect(toolNames).toContain("mgai_generate_plan");
      expect(toolNames).toContain("mgai_generate_code");
      expect(toolNames).toContain("mgai_evaluate_tech");
      expect(toolNames).toContain("mgai_vector_search");
      expect(toolNames).toContain("mgai_get_status");
      expect(toolNames.length).toBe(5);
    });

    it("each tool should have a description", () => {
      const tools = getTools(server);
      for (const [name, tool] of Object.entries(tools)) {
        expect(typeof tool.description, `Tool ${name} missing description`).toBe("string");
        expect(tool.description.length, `Tool ${name} description too short`).toBeGreaterThan(10);
      }
    });

    it("each tool should have an inputSchema", () => {
      const tools = getTools(server);
      for (const [name, tool] of Object.entries(tools)) {
        expect(tool.inputSchema, `Tool ${name} missing inputSchema`).toBeDefined();
      }
    });
  });
});
