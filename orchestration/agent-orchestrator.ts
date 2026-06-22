/**
 * AgentOrchestrator — 多 Agent 协同编排器
 *
 * 职责：
 * 1. 注册不同专业的 Agent 角色（planner / coder / reviewer / architect）
 * 2. 将复杂任务拆解为子任务并分发给对应角色
 * 3. 识别子任务依赖关系，并行执行无依赖子任务，串行执行有依赖子任务
 * 4. 汇总所有子任务结果为最终输出
 */

import type { LLMClient, LLMMessage } from '../orchestration/llm-client';
import { Logger } from '../orchestration/logger';
import type { MCPTool } from '../adapters/mcp-client-adapter';

/* ===================== 类型定义 ===================== */

/** Agent 角色定义 */
export interface AgentRole {
  /** 角色唯一标识 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 能力标签：该角色能处理的子任务类型 */
  capabilities: string[];
  /** 可用工具列表 */
  tools: string[];
  /** 优先级（数字越小优先级越高） */
  priority: number;
}

/** 子任务状态 */
export type SubTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** 子任务定义 */
export interface SubTask {
  /** 子任务唯一标识 */
  id: string;
  /** 指派给的角色名称 */
  role: string;
  /** 子任务描述 */
  description: string;
  /** 子任务输入 */
  input: string;
  /** 当前状态 */
  status: SubTaskStatus;
  /** 执行结果 */
  result?: string;
  /** 依赖的子任务 ID 列表 */
  dependencies: string[];
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 错误信息 */
  error?: string;
}

/** 编排执行结果 */
export interface OrchestrationResult {
  /** 原始任务 */
  task: string;
  /** 所有子任务 */
  subTasks: SubTask[];
  /** 汇总结果 */
  summary: string;
  /** 总耗时（ms） */
  durationMs: number;
  /** 成功/失败统计 */
  stats: {
    total: number;
    completed: number;
    failed: number;
    skipped: number;
  };
}

/** 编排状态 */
export interface OrchestrationStatus {
  /** 当前活跃（运行中）子任务数 */
  activeTasks: number;
  /** 等待执行的子任务队列长度 */
  queueLength: number;
  /** 已完成子任务数 */
  completedTasks: number;
  /** 失败子任务数 */
  failedTasks: number;
  /** 已注册的角色数 */
  registeredRoles: number;
  /** 是否有正在执行的编排 */
  isExecuting: boolean;
  /** 已注册的外部 MCP Tool 数量 */
  externalToolsCount: number;
}

/* ===================== 预置角色 ===================== */

const PRESET_ROLES: AgentRole[] = [
  {
    name: 'planner',
    description: '负责任务拆解和开发计划生成',
    capabilities: ['planning', 'decomposition', 'scheduling', 'task-breakdown'],
    tools: ['mgai_generate_plan'],
    priority: 1,
  },
  {
    name: 'coder',
    description: '负责代码生成和实现',
    capabilities: ['code-generation', 'implementation', 'scaffolding', 'component-creation'],
    tools: ['mgai_generate_code'],
    priority: 2,
  },
  {
    name: 'reviewer',
    description: '负责代码审查，调用 Reflector 检查生成代码的质量',
    capabilities: ['code-review', 'quality-check', 'reflection', 'validation'],
    tools: ['reflect', 'reflectAll'],
    priority: 3,
  },
  {
    name: 'architect',
    description: '负责技术选型和架构决策',
    capabilities: ['tech-selection', 'architecture', 'evaluation', 'recommendation'],
    tools: ['mgai_evaluate_tech', 'selectTech'],
    priority: 2,
  },
];

/* ===================== 角色-子任务模板映射（规则降级用） ===================== */

interface SubTaskTemplate {
  role: string;
  descriptionTemplate: string;
  dependencies: string[];
}

/** 关键词 → 子任务模板列表 */
const KEYWORD_TEMPLATES: Record<string, SubTaskTemplate[]> = {
  // 审查类（必须在代码类之前，避免"审查代码"误匹配代码模式）
  '审查|review|reviewer|校验': [
    { role: 'reviewer', descriptionTemplate: '审查代码质量和合规性', dependencies: [] },
  ],
  // 计划类
  '计划|方案|规划|拆解|plan': [
    { role: 'planner', descriptionTemplate: '分析需求并生成开发计划', dependencies: [] },
  ],
  // 技术选型类
  '技术选型|技术栈|选型|评估|evaluate|tech select': [
    { role: 'architect', descriptionTemplate: '分析需求并推荐技术栈', dependencies: [] },
  ],
  // 代码实现类（含开发/游戏/模块等实现语义，最宽泛，放最后）
  '代码|手游|游戏|开发一款|模块|生成|实现|开发|写|component': [
    { role: 'planner', descriptionTemplate: '分析需求并生成开发计划', dependencies: [] },
    { role: 'architect', descriptionTemplate: '评估并推荐最佳技术栈', dependencies: ['plan-1'] },
    { role: 'coder', descriptionTemplate: '根据计划生成核心代码', dependencies: ['plan-1', 'arch-2'] },
    { role: 'reviewer', descriptionTemplate: '审查生成的代码质量', dependencies: ['code-3'] },
  ],
};

/* ===================== LLM 拆解 Prompt ===================== */

function buildDecompositionPrompt(task: string, roles: AgentRole[]): LLMMessage[] {
  const roleDescriptions = roles
    .map((r) => `- ${r.name}: ${r.description}（能力：${r.capabilities.join(', ')}）`)
    .join('\n');

  return [
    {
      role: 'system',
      content: `你是一个任务拆解专家。根据用户的任务描述，将其拆解为多个可独立执行的子任务。

可用角色：
${roleDescriptions}

输出格式要求：
返回一个严格的 JSON 对象，包含 subTasks 数组。每个子任务格式如下：
{
  "subTasks": [
    {
      "id": "plan-1",
      "role": "planner",
      "description": "子任务描述",
      "input": "原始任务文本",
      "dependencies": []
    }
  ]
}

规则：
1. id 格式：{角色缩写}-{序号}，如 plan-1、code-2、arch-1、review-1
2. dependencies 填入该子任务依赖的其他子任务 id 列表
3. 如果多个子任务无依赖关系，则不填 dependencies（它们可以并行执行）
4. 每个子任务指派给最匹配的角色
5. 只返回 JSON，不要任何额外文本`,
    },
    {
      role: 'user',
      content: `请拆解以下任务：${task}`,
    },
  ];
}

/* ===================== AgentOrchestrator 实现 ===================== */

export class AgentOrchestrator {
  private roles: Map<string, AgentRole> = new Map();
  private activeSubTasks: Map<string, SubTask> = new Map();
  private isExecuting = false;
  private llmClient: LLMClient | null = null;
  private logger: Logger;
  private subTaskCounter = 0;

  /** 已注册的外部 MCP Tool（来自外部 MCP Server） */
  private externalTools: Map<string, MCPTool> = new Map();

  /** 子任务执行回调：外部注入实际 Agent 调用逻辑 */
  private executeSubTaskFn:
    | ((subTask: SubTask, role: AgentRole) => Promise<string>)
    | null = null;

  /** 外部 Tool 调用回调：当子任务 role 匹配到外部 Tool 时使用 */
  private externalToolCallFn:
    | ((toolName: string, args: Record<string, unknown>) => Promise<unknown>)
    | null = null;

  constructor(llmClient?: LLMClient) {
    this.logger = new Logger('AgentOrchestrator');
    if (llmClient) {
      this.llmClient = llmClient;
    }
    // 注册预置角色
    for (const role of PRESET_ROLES) {
      this.registerRole(role);
    }
  }

  /** 注册 Agent 角色 */
  registerRole(role: AgentRole): void {
    this.roles.set(role.name, role);
    this.logger.info(`角色已注册: ${role.name}`, {
      capabilities: role.capabilities,
      tools: role.tools,
    });
  }

  /** 注销 Agent 角色 */
  unregisterRole(name: string): boolean {
    const deleted = this.roles.delete(name);
    if (deleted) {
      this.logger.info(`角色已注销: ${name}`);
    }
    return deleted;
  }

  /** 注册外部 MCP Tool（来自外部 MCP Server） */
  registerExternalTool(tool: MCPTool): void {
    this.externalTools.set(tool.name, tool);
    this.logger.info(`外部 Tool 已注册: ${tool.name} (${tool.serverName})`);
  }

  /** 撤销外部 MCP Tool */
  unregisterExternalTool(name: string): boolean {
    const deleted = this.externalTools.delete(name);
    if (deleted) {
      this.logger.info(`外部 Tool 已撤销: ${name}`);
    }
    return deleted;
  }

  /** 获取已注册的外部 Tool 列表 */
  getExternalTools(): MCPTool[] {
    return Array.from(this.externalTools.values());
  }

  /** 设置外部 Tool 调用回调 */
  setExternalToolCallFn(
    fn: (toolName: string, args: Record<string, unknown>) => Promise<unknown>,
  ): void {
    this.externalToolCallFn = fn;
  }

  /** 获取所有已注册的角色 */
  getRoles(): AgentRole[] {
    return Array.from(this.roles.values()).sort((a, b) => a.priority - b.priority);
  }

  /** 设置 LLM 客户端（用于 LLM 辅助拆解） */
  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
  }

  /** 注入子任务执行函数 */
  setExecuteSubTaskFn(fn: (subTask: SubTask, role: AgentRole) => Promise<string>): void {
    this.executeSubTaskFn = fn;
  }

  /** 核心方法：将复杂任务拆解为子任务列表 */
  async decompose(task: string): Promise<SubTask[]> {
    // 尝试 LLM 辅助拆解
    if (this.llmClient) {
      try {
        return await this.decomposeWithLLM(task);
      } catch (err) {
        this.logger.warn(
          `LLM 拆解失败，降级为规则拆解: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    // 降级：规则拆解
    return this.decomposeByRules(task);
  }

  /** LLM 辅助拆解 */
  private async decomposeWithLLM(task: string): Promise<SubTask[]> {
    if (!this.llmClient) {
      throw new Error('LLMClient 未注入');
    }

    const messages = buildDecompositionPrompt(task, this.getRoles());
    const result = await this.llmClient.complete(messages, {
      temperature: 0.3,
      maxTokens: 2048,
      jsonMode: true,
    });

    const content = result.content.trim();
    // 尝试提取 JSON（处理可能的 markdown 代码块包裹）
    let jsonStr = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as { subTasks: Array<Record<string, unknown>> };

    if (!parsed.subTasks || !Array.isArray(parsed.subTasks)) {
      throw new Error('LLM 返回的 JSON 缺少 subTasks 数组');
    }

    const roles = this.getRoles();
    const roleNames = new Set(roles.map((r) => r.name));

    const subTasks: SubTask[] = parsed.subTasks.map((st) => ({
      id: String(st.id ?? `sub-${++this.subTaskCounter}`),
      role: String(st.role ?? 'planner'),
      description: String(st.description ?? ''),
      input: String(st.input ?? task),
      status: 'pending' as SubTaskStatus,
      dependencies: Array.isArray(st.dependencies)
        ? st.dependencies.map((d: unknown) => String(d))
        : [],
    }));

    // 验证角色存在，无效角色降级为 planner
    for (const st of subTasks) {
      if (!roleNames.has(st.role)) {
        this.logger.warn(`未知角色 "${st.role}"，降级为 "planner"`);
        st.role = 'planner';
      }
    }

    this.logger.info(`LLM 拆解完成: ${subTasks.length} 个子任务`);
    return subTasks;
  }

  /** 规则降级：基于关键词匹配拆解 */
  decomposeByRules(task: string): SubTask[] {
    const roles = this.getRoles();
    const roleNames = new Set(roles.map((r) => r.name));

    // 生成角色名缩写映射
    const roleAbbrMap = new Map<string, string>();
    for (const [name] of this.roles) {
      roleAbbrMap.set(name, name.slice(0, 4));
    }

    // 按模板匹配
    for (const [pattern, templates] of Object.entries(KEYWORD_TEMPLATES)) {
      if (new RegExp(pattern, 'i').test(task)) {
        // 第一遍：生成子任务列表（依赖为临时 ID）
        const tempSubTasks: Array<{
          id: string;
          role: string;
          desc: string;
          input: string;
          tempDeps: string[];
          depIdx: number;
        }> = [];

        for (let i = 0; i < templates.length; i++) {
          const tpl = templates[i];
          const id = `${roleAbbrMap.get(tpl.role) ?? tpl.role.slice(0, 4)}-${i + 1}`;
          tempSubTasks.push({
            id,
            role: roleNames.has(tpl.role) ? tpl.role : 'planner',
            desc: tpl.descriptionTemplate,
            input: task,
            tempDeps: tpl.dependencies,
            depIdx: i,
          });
        }

        // 第二遍：映射依赖（模板索引 → 实际 ID）
        const idByIndex = new Map<number, string>();
        for (const ts of tempSubTasks) {
          idByIndex.set(ts.depIdx, ts.id);
        }

        const subTasks: SubTask[] = tempSubTasks.map((ts) => ({
          id: ts.id,
          role: ts.role,
          description: ts.desc,
          input: ts.input,
          status: 'pending' as SubTaskStatus,
          dependencies: ts.tempDeps
            .map((dep) => {
              // 模板依赖格式 "role-n"，提取序号 n
              const match = dep.match(/(\d+)$/);
              if (match) {
                const depIdx = parseInt(match[1], 10) - 1;
                return idByIndex.get(depIdx) ?? '';
              }
              return '';
            })
            .filter((d) => d !== ''),
        }));

        this.logger.info(`规则拆解完成: ${subTasks.length} 个子任务`);
        return subTasks;
      }
    }

    // 无匹配：默认生成单个 planner 子任务
    this.logger.info('无匹配模板，生成默认 planner 子任务');
    return [
      {
        id: 'plan-1',
        role: 'planner',
        description: '分析并规划任务',
        input: task,
        status: 'pending',
        dependencies: [],
      },
    ];
  }

  /** 核心方法：执行完整编排流程 */
  async execute(task: string): Promise<OrchestrationResult> {
    const startTime = Date.now();
    this.isExecuting = true;

    try {
      // 1. 拆解任务
      const subTasks = await this.decompose(task);

      // 2. 拓扑排序（依赖关系决定执行顺序）
      const executionOrder = this.topologicalSort(subTasks);

      // 3. 按依赖并行/串行执行
      await this.executeInOrder(subTasks, executionOrder);

      // 4. 汇总结果
      const completed = subTasks.filter((s) => s.status === 'completed').length;
      const failed = subTasks.filter((s) => s.status === 'failed').length;
      const skipped = subTasks.filter((s) => s.status === 'skipped').length;
      const durationMs = Date.now() - startTime;

      const summary = this.buildSummary(subTasks, durationMs);

      this.logger.info(
        `编排执行完成: ${completed}/${subTasks.length} 成功, ${failed} 失败, ${durationMs}ms`,
      );

      return {
        task,
        subTasks,
        summary,
        durationMs,
        stats: {
          total: subTasks.length,
          completed,
          failed,
          skipped,
        },
      };
    } finally {
      this.isExecuting = false;
    }
  }

  /** 拓扑排序：返回依赖层级的分组列表 */
  private topologicalSort(subTasks: SubTask[]): SubTask[][] {
    const layers: SubTask[][] = [];
    const remaining = new Map(subTasks.map((s) => [s.id, s]));
    const completed = new Set<string>();

    // 安全上限防止环依赖死循环
    const maxIterations = subTasks.length * 2;
    let iterations = 0;

    while (remaining.size > 0 && iterations < maxIterations) {
      iterations++;
      const currentLayer: SubTask[] = [];

      for (const [id, st] of remaining) {
        const depsAllCompleted = st.dependencies.every((dep) => completed.has(dep));
        if (depsAllCompleted) {
          currentLayer.push(st);
        }
      }

      if (currentLayer.length === 0) {
        // 存在环依赖：将剩余任务全部加入当前层
        this.logger.warn('检测到环依赖，将剩余任务全部加入当前层');
        for (const [, st] of remaining) {
          currentLayer.push(st);
        }
      }

      for (const st of currentLayer) {
        remaining.delete(st.id);
        completed.add(st.id);
      }

      layers.push(currentLayer);
    }

    return layers;
  }

  /** 按拓扑排序的层级执行：同一层内并行，逐层串行 */
  private async executeInOrder(
    subTasks: SubTask[],
    executionOrder: SubTask[][],
  ): Promise<void> {
    for (const layer of executionOrder) {
      // 检查是否有子任务的前驱失败，失败则跳过
      for (const st of layer) {
        const hasFailedDep = st.dependencies.some((depId) => {
          const dep = subTasks.find((s) => s.id === depId);
          return dep?.status === 'failed';
        });
        if (hasFailedDep) {
          st.status = 'skipped';
          st.error = '前置依赖失败，跳过执行';
          this.logger.warn(`子任务 ${st.id} 跳过：前置依赖失败`);
        }
      }

      // 并行执行当前层中未被跳过的子任务
      const active = layer.filter((st) => st.status === 'pending');
      if (active.length > 0) {
        await Promise.all(
          active.map((st) => this.executeSubTask(st)),
        );
      }
    }
  }

  /** 执行单个子任务 */
  private async executeSubTask(subTask: SubTask): Promise<void> {
    subTask.status = 'running';
    subTask.startedAt = Date.now();

    // 路径 1：检查是否匹配外部 Tool
    const externalTool = this.externalTools.get(subTask.role);
    if (externalTool) {
      await this.executeViaExternalTool(subTask, externalTool);
      return;
    }

    // 路径 2：内置角色执行
    const role = this.roles.get(subTask.role);
    if (!role) {
      subTask.status = 'failed';
      subTask.error = `未注册的角色: ${subTask.role}`;
      subTask.completedAt = Date.now();
      this.logger.error(`子任务 ${subTask.id} 失败: 角色 ${subTask.role} 未注册`);
      return;
    }

    try {
      if (this.executeSubTaskFn) {
        subTask.result = await this.executeSubTaskFn(subTask, role);
      } else {
        // 无外部执行函数时，返回模拟结果
        subTask.result = `[模拟] 角色 ${role.name} 已完成: ${subTask.description}`;
      }
      subTask.status = 'completed';
      this.logger.info(`子任务 ${subTask.id} 完成 (${role.name})`);
    } catch (err) {
      subTask.status = 'failed';
      subTask.error = err instanceof Error ? err.message : String(err);
      this.logger.error(`子任务 ${subTask.id} 失败: ${subTask.error}`);
    } finally {
      subTask.completedAt = Date.now();
    }
  }

  /** 通过外部 MCP Tool 执行子任务 */
  private async executeViaExternalTool(
    subTask: SubTask,
    tool: MCPTool,
  ): Promise<void> {
    if (!this.externalToolCallFn) {
      subTask.status = 'failed';
      subTask.error = `外部 Tool "${tool.name}" 已注册但未注入 externalToolCallFn`;
      subTask.completedAt = Date.now();
      this.logger.error(`子任务 ${subTask.id} 失败: externalToolCallFn 未注入`);
      return;
    }

    try {
      const args = { input: subTask.input, description: subTask.description };
      const result = await this.externalToolCallFn(tool.name, args);
      subTask.result =
        typeof result === 'string' ? result : JSON.stringify(result);
      subTask.status = 'completed';
      this.logger.info(
        `子任务 ${subTask.id} 完成 (外部 Tool: ${tool.name}@${tool.serverName})`,
      );
    } catch (err) {
      subTask.status = 'failed';
      subTask.error = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `子任务 ${subTask.id} 失败 (外部 Tool: ${tool.name}): ${subTask.error}`,
      );
    } finally {
      subTask.completedAt = Date.now();
    }
  }

  /** 汇总所有子任务结果 */
  private buildSummary(subTasks: SubTask[], durationMs: number): string {
    const lines: string[] = [];
    lines.push(`## 编排执行报告`);
    lines.push(`- 总耗时: ${durationMs}ms`);
    lines.push(`- 子任务总数: ${subTasks.length}`);
    lines.push('');

    for (const st of subTasks) {
      const duration =
        st.startedAt && st.completedAt ? `${st.completedAt - st.startedAt}ms` : 'N/A';
      const statusIcon =
        st.status === 'completed'
          ? '✅'
          : st.status === 'failed'
            ? '❌'
            : st.status === 'skipped'
              ? '⏭️'
              : '⏳';
      lines.push(`### ${statusIcon} ${st.id} [${st.role}]`);
      lines.push(`- 描述: ${st.description}`);
      lines.push(`- 状态: ${st.status}`);
      lines.push(`- 耗时: ${duration}`);
      if (st.result) {
        lines.push(`- 结果: ${st.result.slice(0, 200)}${st.result.length > 200 ? '...' : ''}`);
      }
      if (st.error) {
        lines.push(`- 错误: ${st.error}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /** 返回当前编排状态 */
  getStatus(): OrchestrationStatus {
    let activeTasks = 0;
    let queueLength = 0;
    let completedTasks = 0;
    let failedTasks = 0;

    for (const st of this.activeSubTasks.values()) {
      switch (st.status) {
        case 'running':
          activeTasks++;
          break;
        case 'pending':
          queueLength++;
          break;
        case 'completed':
          completedTasks++;
          break;
        case 'failed':
          failedTasks++;
          break;
      }
    }

    return {
      activeTasks,
      queueLength,
      completedTasks,
      failedTasks,
      registeredRoles: this.roles.size,
      isExecuting: this.isExecuting,
      externalToolsCount: this.externalTools.size,
    };
  }
}
