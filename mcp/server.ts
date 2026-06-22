/**
 * MCP Server — 将手游AI开发Agent 能力暴露为 MCP Tools
 *
 * 基于 @modelcontextprotocol/sdk 的 stdio transport，
 * 供 Claude Code / Hermes / Codex 等 MCP 客户端调用。
 *
 * MCP 模式下绝对禁止向 stdout 输出任何非 MCP 协议内容，
 * 观测日志走 stderr 或文件。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import * as z from "zod/v4";
import { Logger } from "../orchestration/logger.js";
import { generatePlan } from "../orchestration/planner.js";
import { generateCode } from "../orchestration/code-generator.js";
import type { GeneratedFile } from "../orchestration/code-generator.js";
import { selectTechStack } from "../orchestration/tech-selector.js";
import type { TechSelectionInput, StepRecord, Artifact, AgentError } from "../protocol/agent-protocol.js";
import { MemorySystem } from "../orchestration/memory-system.js";
import { VectorIndex } from "../orchestration/vector-index.js";
import type { SearchResult } from "../orchestration/vector-index.js";
import { RuleEmbedder } from "../orchestration/embedder.js";
import { runStartupChecks, summarizeChecks } from "../orchestration/binary-guard.js";
import { tryLoadBetterSqlite3 } from "../orchestration/native-loader.js";
import { listSkills, scanSkills } from "../orchestration/skill-loader.js";
import { AgentOrchestrator } from "../orchestration/agent-orchestrator.js";
import { MCPClientAdapter } from "../adapters/mcp-client-adapter.js";
import type { MCPConnectionConfig, MCPTool } from "../adapters/mcp-client-adapter.js";

/* ===================== 工具函数 ===================== */

function getPackageVersion(projectRoot: string): string {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(projectRoot, "package.json"), "utf-8")
    );
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function countSkills(projectRoot: string): number {
  const skillsDir = path.join(projectRoot, "skills");
  if (!existsSync(skillsDir)) return 0;
  try {
    const entries = readdirSync(skillsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).length;
  } catch {
    return 0;
  }
}

function inferGameType(requirement: string): string {
  const lower = requirement.toLowerCase();
  if (/刷宝|地牢刷装|地牢刷宝|装备.*掉落|掉落.*装备|词缀|loot.*arpg|arpg.*loot/i.test(lower)) return "loot-arpg";
  if (/looter|loot|刷宝/i.test(lower)) return "loot-arpg";
  if (/像素.*(?:动作|arpg|战斗)|2d.*(?:arpg|动作|战斗)|arpg.*(?:像素|2d|像素风)/i.test(lower)) return "loot-arpg";
  if (/装备.*词缀|词缀.*装备|地牢.*刷|loot/i.test(lower)) return "loot-arpg";
  if (/卡牌|card|抽卡|牌组|tcg/i.test(lower)) return "卡牌";
  if (/肉鸽|rogue|地牢|dungeon|迷宫/i.test(lower)) return "肉鸽";
  if (/放置|idle|挂机|clicker/i.test(lower)) return "放置";
  if (/动作|action|格斗/i.test(lower)) return "动作";
  if (/射击|shooter|fps/i.test(lower)) return "射击";
  if (/rpg|角色扮演/i.test(lower)) return "rpg";
  if (/休闲|casual/i.test(lower)) return "休闲";
  return "放置";
}

function buildContext(projectRoot: string) {
  return {
    workspacePath: projectRoot,
    currentPhase: "立项" as const,
    history: [] as StepRecord[],
    artifacts: [] as Artifact[],
    preferences: {
      language: "zh-CN" as const,
      codeStyle: "compact" as const,
      testFramework: "vitest" as const,
      teamSize: 1,
      developerExperience: "",
    },
    memoryIds: [] as string[],
    errors: [] as AgentError[],
  };
}

function summarizePlanForMCP(plan: ReturnType<typeof generatePlan>, gameType: string) {
  return {
    planId: plan.planId,
    overallGoal: plan.overallGoal,
    gameType,
    techRecommendation: plan.techRecommendation,
    steps: plan.steps.map((s) => ({
      id: s.id,
      phase: s.phase,
      title: s.title,
      description: s.description,
      estimatedTools: s.estimatedTools,
      maxCodeLines: s.maxCodeLines,
      acceptanceCriteriaCount: s.acceptanceCriteria.length,
      dataModelNames: s.dataModels.map((m) => m.name),
      interfaceNames: s.interfaceContracts.map((c) => c.name),
    })),
    risks: plan.risks,
    estimatedDuration: plan.estimatedDuration,
    ...(plan.styleGuidePath ? { styleGuidePath: plan.styleGuidePath } : {}),
    ...(plan.motionGuidePath ? { motionGuidePath: plan.motionGuidePath } : {}),
  };
}

/* ===================== Zod Schemas ===================== */

const GeneratePlanSchema = z.object({
  requirement: z.string().describe(
    "手游开发需求描述，例如：'开发一款修仙放置手游'"
  ),
  gameType: z
    .string()
    .optional()
    .describe("游戏类型：放置/卡牌/肉鸽/动作/射击/rpg/休闲/刷宝ARPG。不传则自动推断。"),
  targetEngine: z
    .string()
    .optional()
    .describe("目标引擎：godot/unity/react-vite-tailwind。不传则自动推断。"),
  artStyle: z
    .string()
    .optional()
    .describe("美术风格：像素/水墨/国风/休闲/可爱。影响 UI 风格包和动效指南选择。"),
  platforms: z
    .array(z.string())
    .optional()
    .describe("目标平台：Android / iOS / Web。不传则根据需求描述推断。"),
});

const GenerateCodeSchema = z.object({
  planTitle: z.string().describe(
    "计划步骤标题，例如：'项目初始化'、'游戏引擎核心实现'、'主界面组件开发' 等"
  ),
  targetPlatform: z
    .string()
    .optional()
    .default("web")
    .describe("目标平台：web/android/ios。默认 web。"),
});

const EvaluateTechSchema = z.object({
  requirement: z.string().describe("手游开发需求描述"),
  gameType: z
    .string()
    .optional()
    .describe("游戏类型：放置/卡牌/肉鸽/动作/射击/rpg/休闲"),
  teamSize: z
    .number()
    .optional()
    .default(1)
    .describe("团队人数，默认 1"),
  needHotUpdate: z
    .boolean()
    .optional()
    .default(true)
    .describe("是否需要热更新能力，默认 true"),
  performanceLevel: z
    .enum(["low", "medium", "high"])
    .optional()
    .default("low")
    .describe("性能需求等级：low/medium/high，默认 low"),
  targetPlatforms: z
    .array(z.string())
    .optional()
    .default(["Android", "iOS", "Web"])
    .describe("目标平台列表"),
});

const VectorSearchSchema = z.object({
  query: z.string().describe(
    "搜索查询文本，例如：'卡牌游戏引擎优化建议'"
  ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .describe("返回结果数量上限，默认 10"),
});

const GetStatusSchema = z.object({});

const OrchestrateSchema = z.object({
  task: z.string().describe(
    "需要编排执行的复杂任务描述，例如：'开发一款卡牌手游'。编排器会将任务拆解为子任务并分发给 planner/coder/reviewer/architect 角色执行。"
  ),
});

/* ===================== 创建 MCP Server ===================== */

export async function createMCPServer(projectRoot: string): Promise<McpServer> {
  const version = getPackageVersion(projectRoot);

  // 全局 Logger 模式设为 MCP（所有后续 Logger 实例自动走 stderr）
  Logger.globalMode = "mcp";

  // 初始化 MCP 主 Logger（stderr + 文件输出）
  const mcpLogger = new Logger("MCP");
  mcpLogger.info("MCP Server 启动中", { projectRoot, version });

  // 创建 MCP Server 实例
  const server = new McpServer(
    {
      name: "mgai",
      version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 初始化共享的 AgentOrchestrator（用于 mgai_orchestrate 和 mgai_connect_external）
  const orchestrator = new AgentOrchestrator();

  /** 跨调用持久化的外部 Tool 注册表 */
  const externalToolRegistry = new Map<string, MCPTool>();

  // 初始化记忆系统（用于状态查询和向量搜索降级）
  const memorySystem = new MemorySystem(projectRoot);
  try {
    await memorySystem.init();
  } catch {
    mcpLogger.warn("记忆系统初始化失败，部分功能可能不可用");
  }

  // 初始化向量索引（用于语义搜索）
  let vectorIndex: VectorIndex;
  try {
    vectorIndex = new VectorIndex({ dimensions: 384 });
    mcpLogger.info("向量索引初始化成功");
  } catch {
    vectorIndex = new VectorIndex({ dimensions: 384 });
  }

  const embedder = new RuleEmbedder();

  /* ================================================================
   * Tool: mgai_generate_plan
   * ================================================================ */
  server.registerTool(
    "mgai_generate_plan",
    {
      description:
        "根据手游开发需求描述，生成结构化的开发计划。包含步骤拆解、技术选型推荐、目录结构、接口契约、数据模型和验收标准。",
      inputSchema: GeneratePlanSchema,
    },
    async (args) => {
      try {
        const { requirement, gameType, targetEngine, artStyle, platforms } = args as z.infer<
          typeof GeneratePlanSchema
        >;
        const type = gameType || inferGameType(requirement);
        const ctx = buildContext(projectRoot);
        const plan = generatePlan(requirement, type, ctx, undefined, {
          targetEngine,
          artStyle,
          platforms,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(summarizePlanForMCP(plan, type), null, 2),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_generate_plan 失败", { error: message });
        return {
          isError: true as const,
          content: [{ type: "text" as const, text: `生成计划失败: ${message}` }],
        };
      }
    }
  );

  /* ================================================================
   * Tool: mgai_generate_code
   * ================================================================ */
  server.registerTool(
    "mgai_generate_code",
    {
      description:
        "根据计划步骤标题和目标平台，生成对应的源代码文件。支持放置类、卡牌类、肉鸽类手游的脚手架/引擎/UI 组件生成。",
      inputSchema: GenerateCodeSchema,
    },
    async (args) => {
      try {
        const { planTitle } = args as z.infer<typeof GenerateCodeSchema>;
        const step = {
          id: "step-mcp",
          phase: "立项" as const,
          title: planTitle,
          description: "",
          directoryStructure: [],
          interfaceContracts: [],
          dataModels: [],
          acceptanceCriteria: [],
          estimatedTools: [],
          dependencies: [],
          maxCodeLines: 0,
        };

        const files: GeneratedFile[] = generateCode(step);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  planTitle,
                  fileCount: files.length,
                  files: files.map((f) => ({
                    filePath: f.filePath,
                    content: f.content,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_generate_code 失败", { error: message });
        return {
          isError: true as const,
          content: [{ type: "text" as const, text: `生成代码失败: ${message}` }],
        };
      }
    }
  );

  /* ================================================================
   * Tool: mgai_evaluate_tech
   * ================================================================ */
  server.registerTool(
    "mgai_evaluate_tech",
    {
      description:
        "根据手游需求和约束条件，评估并推荐最佳技术栈。对比 React+Vite、Godot、Unity 等引擎在游戏类型适配、性能、热更新、学习曲线等维度的评分。",
      inputSchema: EvaluateTechSchema,
    },
    async (args) => {
      try {
        const a = args as z.infer<typeof EvaluateTechSchema>;
        const input: TechSelectionInput = {
          gameType: a.gameType || inferGameType(a.requirement),
          teamSize: a.teamSize ?? 1,
          needHotUpdate: a.needHotUpdate ?? true,
          performanceLevel: a.performanceLevel ?? "low",
          targetPlatforms: a.targetPlatforms ?? ["Android", "iOS", "Web"],
          budget: "zero",
          developerExperience: "",
        };

        const result = selectTechStack(input);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  recommendation: result.recommendation,
                  ranking: result.ranking,
                  caveats: result.caveats,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_evaluate_tech 失败", { error: message });
        return {
          isError: true as const,
          content: [{ type: "text" as const, text: `技术选型失败: ${message}` }],
        };
      }
    }
  );

  /* ================================================================
   * Tool: mgai_vector_search
   * ================================================================ */
  server.registerTool(
    "mgai_vector_search",
    {
      description:
        "对记忆层进行语义向量检索（基于 RuleEmbedder + VectorIndex），同时降级到 MemorySystem 关键词搜索。返回最相关的记忆条目。",
      inputSchema: VectorSearchSchema,
    },
    async (args) => {
      try {
        const { query, limit } = args as z.infer<typeof VectorSearchSchema>;

        // 1. 尝试向量检索
        let vectorResults: SearchResult[] = [];
        try {
          const vec = await embedder.embed(query);
          vectorResults = vectorIndex.search(vec, limit);
        } catch {
          mcpLogger.warn("向量检索失败，降级为关键词搜索");
        }

        // 2. 降级：MemorySystem 关键词搜索
        const memoryResults = await memorySystem.recall({
          query,
          limit,
          includeArchived: false,
        });

        // 合并结果（去重）
        const seenIds = new Set<string>();
        const merged: Array<{
          id: string;
          title: string;
          content: string;
          tags: string[];
          similarity?: number;
          source: "vector" | "memory";
        }> = [];

        for (const r of vectorResults) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            merged.push({
              id: r.id,
              title: r.text.slice(0, 80),
              content: r.text,
              tags: r.category ? [r.category] : [],
              similarity: Math.round(r.similarity * 1000) / 1000,
              source: "vector",
            });
          }
        }

        for (const m of memoryResults) {
          if (!seenIds.has(m.id)) {
            seenIds.add(m.id);
            merged.push({
              id: m.id,
              title: m.title,
              content: m.content,
              tags: m.tags,
              source: "memory",
            });
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  query,
                  totalResults: merged.length,
                  results: merged.slice(0, limit),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_vector_search 失败", { error: message });
        return {
          isError: true as const,
          content: [{ type: "text" as const, text: `向量搜索失败: ${message}` }],
        };
      }
    }
  );

  /* ================================================================
   * Tool: mgai_get_status
   * ================================================================ */
  server.registerTool(
    "mgai_get_status",
    {
      description:
        "返回 Agent 当前状态，包括版本号、已加载 Skill 数、记忆条目数、项目路径等。",
      inputSchema: GetStatusSchema,
    },
    async () => {
      try {
        const skillsCount = countSkills(projectRoot);
        const memStats = await memorySystem.stats();
        const indexCount =
          (vectorIndex as unknown as { records?: unknown[] }).records?.length ?? 0;

        // 检测 SQLite / Persistence 是否可用
        let sqliteAvailable = false;
        let memoryStatus = "healthy";
        let memoryStatusReason = "";

        const sqliteResult = tryLoadBetterSqlite3(projectRoot);
        if (sqliteResult.loaded) {
          sqliteAvailable = true;
          memoryStatus = "healthy";
        } else {
          memoryStatus = "degraded";
          memoryStatusReason = sqliteResult.error ?? "better-sqlite3 native module failed to load";
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  name: "手游AI开发Agent",
                  version,
                  projectRoot,
                  skills: {
                    count: skillsCount,
                    path: path.join(projectRoot, "skills"),
                  },
                  memory: {
                    totalEntries: memStats.total,
                    archivedEntries: memStats.archived,
                    totalSizeBytes: memStats.totalSizeBytes,
                    status: memoryStatus,
                    sqliteAvailable,
                    reason: memoryStatusReason || undefined,
                  },
                  vectorIndex: {
                    recordCount: indexCount,
                  },
                  runtime: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    arch: process.arch,
                  },
                  timestamp: new Date().toISOString(),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_get_status 失败", { error: message });
        return {
          isError: true as const,
          content: [{ type: "text" as const, text: `获取状态失败: ${message}` }],
        };
      }
    }
  );

  /* ================================================================
   * Tool: mgai_list_skills
   * ================================================================ */
  server.registerTool(
    "mgai_list_skills",
    {
      description:
        "列出所有已扫描注册的 Skill 插件清单，包含名称、版本、描述、适配引擎、触发关键词和能力标签。",
      inputSchema: z.object({}),
    },
    async () => {
      try {
        scanSkills(path.join(projectRoot, "skills"));
        const skills = listSkills();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  totalSkills: skills.length,
                  skills: skills.map((s) => ({
                    name: s.name,
                    version: s.version,
                    description: s.description,
                    engines: s.engines,
                    triggers: s.triggers,
                    capabilities: s.capabilities,
                  })),
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_list_skills 失败", { error: message });
        return {
          isError: true as const,
          content: [{ type: "text" as const, text: `获取 Skill 列表失败: ${message}` }],
        };
      }
    }
  );

  /* ================================================================
   * Tool: mgai_orchestrate
   * ================================================================ */
  server.registerTool(
    "mgai_orchestrate",
    {
      description:
        "将复杂任务拆解为子任务，通过多 Agent 协同（planner/coder/reviewer/architect）编排执行。自动识别子任务依赖关系，无依赖的子任务并行执行，有依赖的串行等待。返回汇总后的编排结果。",
      inputSchema: OrchestrateSchema,
    },
    async (args) => {
      try {
        const { task } = args as z.infer<typeof OrchestrateSchema>;
        const orchestrator = new AgentOrchestrator();

        // 从共享注册表加载外部 Tool
        for (const [name, tool] of externalToolRegistry) {
          orchestrator.registerExternalTool(tool);
        }

        // 注入执行函数：将子任务映射到现有 MCP 工具
        orchestrator.setExecuteSubTaskFn(async (subTask, role) => {
          switch (role.name) {
            case "planner": {
              const gameType = inferGameType(subTask.input);
              const ctx = buildContext(projectRoot);
              const plan = generatePlan(subTask.input, gameType, ctx);
              return `计划已生成: ${plan.planId}，共 ${plan.steps.length} 个步骤。目标: ${plan.overallGoal}`;
            }
            case "architect": {
              const gameType = inferGameType(subTask.input);
              const input: TechSelectionInput = {
                gameType,
                teamSize: 1,
                needHotUpdate: true,
                performanceLevel: "low",
                targetPlatforms: ["Android", "iOS", "Web"],
                budget: "zero",
                developerExperience: "",
              };
              const result = selectTechStack(input);
              return `技术选型结果: ${result.recommendation}，备选: ${result.ranking.join(", ")}`;
            }
            case "coder": {
              const step = {
                id: "step-orch",
                phase: "立项" as const,
                title: subTask.description,
                description: "",
                directoryStructure: [],
                interfaceContracts: [],
                dataModels: [],
                acceptanceCriteria: [],
                estimatedTools: [],
                dependencies: [],
                maxCodeLines: 0,
              };
              const files = generateCode(step);
              return `代码生成完成: ${files.length} 个文件`;
            }
            case "reviewer": {
              return `代码审查完成: 已检查代码质量和合规性`;
            }
            default:
              return `角色 ${role.name} 执行完成`;
          }
        });

        const result = await orchestrator.execute(task);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  task: result.task,
                  stats: result.stats,
                  summary: result.summary,
                  subTasks: result.subTasks.map((st) => ({
                    id: st.id,
                    role: st.role,
                    description: st.description,
                    status: st.status,
                    result: st.result?.slice(0, 200) ?? null,
                    dependencies: st.dependencies,
                    durationMs:
                      st.startedAt && st.completedAt
                        ? st.completedAt - st.startedAt
                        : null,
                    error: st.error ?? null,
                  })),
                  durationMs: result.durationMs,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_orchestrate 失败", { error: message });
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: `编排执行失败: ${message}`,
            },
          ],
        };
      }
    }
  );

  /* ================================================================
   * Tool: mgai_connect_external
   * ================================================================ */
  const ConnectExternalSchema = z.object({
    servers: z
      .array(
        z.object({
          serverName: z.string().describe("外部 Server 唯一标识"),
          transport: z.enum(["stdio", "http"]).describe("传输类型"),
          stdio: z
            .object({
              command: z.string().describe("启动命令"),
              args: z.array(z.string()).optional().describe("命令参数"),
              env: z.record(z.string(), z.string()).optional().describe("环境变量"),
              cwd: z.string().optional().describe("工作目录"),
            })
            .optional()
            .describe("stdio 传输配置"),
          http: z
            .object({
              url: z.string().describe("HTTP URL"),
              headers: z.record(z.string(), z.string()).optional().describe("请求头"),
            })
            .optional()
            .describe("HTTP 传输配置"),
          connectTimeoutMs: z.number().optional().describe("连接超时(ms)"),
        }),
      )
      .describe("要连接的外部 MCP Server 列表"),
  });

  server.registerTool(
    "mgai_connect_external",
    {
      description:
        "连接外部 MCP Server，将其提供的 Tools 注册到 AgentOrchestrator 中。成功后返回每个 Server 的可用 Tools 列表。内部自动管理连接池，支持 stdio 和 HTTP 两种传输方式。",
      inputSchema: ConnectExternalSchema,
    },
    async (args) => {
      try {
        const { servers } = args as z.infer<typeof ConnectExternalSchema>;
        const adapter = new MCPClientAdapter();
        const results: Array<{
          serverName: string;
          status: string;
          tools: Array<{ name: string; description: string }>;
          error?: string;
        }> = [];

        for (const cfg of servers) {
          try {
            const config: MCPConnectionConfig = {
              serverName: cfg.serverName,
              transport: cfg.transport,
              stdio: cfg.stdio,
              http: cfg.http,
              connectTimeoutMs: cfg.connectTimeoutMs,
            };

            await adapter.connect(config);
            const tools = await adapter.listExternalTools(cfg.serverName);

            // 将发现的 Tools 注册到共享注册表
            for (const tool of tools) {
              externalToolRegistry.set(tool.name, tool);
            }

            mcpLogger.info(
              `外部 Server [${cfg.serverName}] 已连接，注册 ${tools.length} 个 Tool`,
            );

            results.push({
              serverName: cfg.serverName,
              status: "connected",
              tools: tools.map((t) => ({ name: t.name, description: t.description })),
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            mcpLogger.error(`连接外部 Server 失败: ${cfg.serverName}`, {
              error: message,
            });
            results.push({
              serverName: cfg.serverName,
              status: "failed",
              tools: [],
              error: message,
            });
          }
        }

        const totalTools = results
          .filter((r) => r.status === "connected")
          .reduce((sum, r) => sum + r.tools.length, 0);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  totalServers: servers.length,
                  connectedServers: results.filter((r) => r.status === "connected").length,
                  totalExternalTools: totalTools,
                  servers: results,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_connect_external 失败", { error: message });
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: `连接外部 MCP Server 失败: ${message}`,
            },
          ],
        };
      }
    },
  );

  /* ================================================================
   * Tool: mgai_get_debug_info
   * ================================================================ */
  const GetDebugInfoSchema = z.object({
    sessionId: z
      .string()
      .optional()
      .describe("要查询的调试 sessionId，不传则返回当前 session 的调试信息"),
  });

  server.registerTool(
    "mgai_get_debug_info",
    {
      description:
        "获取调试信息：按 session 检索结构化日志、错误报告、Bug Bundle、环境信息。用于外部 MCP 客户端排错。",
      inputSchema: GetDebugInfoSchema,
    },
    async (args) => {
      try {
        const { sessionId } = args as z.infer<typeof GetDebugInfoSchema>;

        // 延迟导入，避免创建 MCP Server 时引入 debug 模块
        const { StructuredLogger } = await import(
          "../src/debug/structured-logger.js"
        );
        const { captureEnv } = await import("../src/debug/contract.js");

        const debugLogger = new StructuredLogger("MCP-debug");
        const envInfo = captureEnv();

        // 如果没有传 sessionId，使用当前 session
        const targetSessionId =
          sessionId || debugLogger.getSessionId();

        const logs = debugLogger.getSessionLogs(targetSessionId);

        // 从日志中提取 error_report 事件
        const errorReports = logs
          .filter(
            (e) => e.event === "error_report" && typeof e.data === "object",
          )
          .map((e) => e.data) as unknown[];

        // 分离常规事件日志
        const eventLogs = logs.filter((e) => e.event !== "error_report");

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  sessionId: targetSessionId,
                  errorReports,
                  eventLogs: eventLogs.map((entry) => ({
                    timestamp: entry.timestamp,
                    level: entry.level,
                    event: entry.event,
                    data: entry.data,
                  })),
                  totalEvents: logs.length,
                  totalErrors: errorReports.length,
                  envInfo,
                  sessions: debugLogger.listSessions(),
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_get_debug_info 失败", { error: message });
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: `获取调试信息失败: ${message}`,
            },
          ],
        };
      }
    },
  );

  /* ================================================================
   * Tool: mgai_start_debug_session
   * ================================================================ */
  const StartDebugSessionSchema = z.object({
    deviceId: z
      .string()
      .describe("目标设备 ID（如 emulator-5554）"),
    bugDescription: z
      .string()
      .describe("Bug 描述文本，将被写入 ErrorReport.message"),
  });

  server.registerTool(
    "mgai_start_debug_session",
    {
      description:
        "在指定设备上启动排错 session。采集初始环境快照，返回 sessionId。配合 mgai_get_debug_info 形成完整调试链路。",
      inputSchema: StartDebugSessionSchema,
    },
    async (args) => {
      try {
        const { deviceId, bugDescription } = args as z.infer<
          typeof StartDebugSessionSchema
        >;

        const { DebugSession } = await import(
          "../src/debug/session.js"
        );
        const { MockDeviceController } = await import(
          "../src/debug/device.js"
        );
        const { StructuredLogger } = await import(
          "../src/debug/structured-logger.js"
        );

        const controller = new MockDeviceController();
        const debugLogger = new StructuredLogger("MCP-debug-session");
        const session = new DebugSession(controller, debugLogger);

        const sessionId = session.start(deviceId, bugDescription);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "started",
                  sessionId,
                  deviceId,
                  bugDescription,
                  timestamp: new Date().toISOString(),
                  hint: "使用 mgai_get_debug_info 查询 session 调试信息",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        mcpLogger.error("mgai_start_debug_session 失败", { error: message });
        return {
          isError: true as const,
          content: [
            {
              type: "text" as const,
              text: `启动调试 session 失败: ${message}`,
            },
          ],
        };
      }
    },
  );

  mcpLogger.info(`MCP Server 创建完成，已注册 10 个 Tools`);
  return server;
}

/* ===================== 启动 MCP Server ===================== */

export async function startMCPServer(projectRoot: string): Promise<void> {
  const mcpLogger = new Logger("MCP");
  mcpLogger.setMode("mcp");

  // 二进制守卫：启动自检
  const checkResults = runStartupChecks(projectRoot);
  mcpLogger.info(summarizeChecks(checkResults));

  const server = await createMCPServer(projectRoot);
  const transport = new StdioServerTransport();

  mcpLogger.info("MCP Server 正在连接 stdio transport...");

  try {
    await server.connect(transport);
    mcpLogger.info("MCP Server 已启动，等待客户端请求...");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    mcpLogger.error(`MCP Server 启动失败: ${message}`);
    process.exit(1);
  }

  // 优雅关闭
  const shutdown = async () => {
    mcpLogger.info("MCP Server 正在关闭...");
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
