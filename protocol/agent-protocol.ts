/**
 * Agent 接口协议 v1.0
 *
 * 本文件定义了手游 AI 开发 Agent 的统一接口契约。
 * 所有框架适配器（Marvis / Claude Code / Codex / Hermes / Coze）
 * 必须实现此协议，从而做到「一套核心逻辑，多框架运行」。
 *
 * 目标受众：适配器开发者、核心循环开发者。
 */

/* ===================== 基础类型 ===================== */

/** 管线阶段 */
export type PipelinePhase =
  | '立项'
  | '原型'
  | '生产'
  | '测试'
  | '发行'
  | '运营';

/** 工具 Schema */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/** Skill 清单（来自 skill-loader） */
export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  engines: string[];
  triggers: string[];
  capabilities: string[];
}

/** 上下文对象 */
export interface Context {
  /** 工作目录绝对路径 */
  workspacePath: string;
  /** 当前阶段 */
  currentPhase: PipelinePhase;
  /** 已选择的技术栈 */
  techStack?: TechStack;
  /** 历史执行步骤 */
  history: StepRecord[];
  /** 已生成的产物文件路径列表 */
  artifacts: Artifact[];
  /** 用户偏好（语言、引擎、风格等） */
  preferences: UserPreferences;
  /** 项目记忆 ID 列表（框架特定） */
  memoryIds: string[];
  /** 错误列表 */
  errors: AgentError[];
  /** 可用 Skill 清单（由 Gateway 启动时注入） */
  skillManifests?: SkillManifest[];
}

/** 技术栈选择结果 */
export interface TechStack {
  engine: 'react-vite-tailwind' | 'godot' | 'unity';
  reason: string;
  alternatives: string[];
  pros: string[];
  cons: string[];
}

/** 用户偏好 */
export interface UserPreferences {
  language: 'zh-CN' | 'en';
  codeStyle: 'compact' | 'verbose';
  testFramework: 'vitest' | 'jest' | 'pytest';
  preferredEngine?: TechStack['engine'];
  teamSize?: number;
  developerExperience?: string;
}

/** 产出物 */
export interface Artifact {
  path: string;
  type: 'file' | 'directory' | 'image' | 'doc' | 'code' | 'config';
  description: string;
  createdAt: number;
}

/** 步骤记录 */
export interface StepRecord {
  stepId: string;
  phase: PipelinePhase;
  status: 'planned' | 'executing' | 'completed' | 'failed' | 'skipped';
  plan: PlanStep;
  result?: StepResult;
  startedAt: number;
  completedAt?: number;
  retryCount: number;
}

/* ===================== Planner 相关 ===================== */

/** 执行计划：Planner 输出的结构化任务 */
export interface ExecutionPlan {
  /** 计划 ID */
  planId: string;
  /** 总体目标 */
  overallGoal: string;
  /** 技术选型建议 */
  techRecommendation: TechStack;
  /** 有序步骤列表 */
  steps: PlanStep[];
  /** 预计总耗时（秒） */
  estimatedDuration: number;
  /** 风险提示 */
  risks: string[];
  /** [Memory v2] System Prompt 前缀（由 InjectionStrategy 构建） */
  memoryV2SystemPrompt?: string;
  /** UI 风格指南文件路径（由 Style Director 生成） */
  styleGuidePath?: string;
  /** 动效指南文件路径（由 Style Director 生成） */
  motionGuidePath?: string;
  /** 美术方向指南文件路径（由 Art Direction Generator 生成） */
  artDirectionPath?: string;
  /** 知识卡召回结果（压缩 prompt，由 Knowledge Recall 注入） */
  knowledgeCards?: string;
}

/** 单个步骤定义 */
export interface PlanStep {
  /** 步骤唯一 ID */
  id: string;
  /** 步骤序号 */
  stepNumber?: number;
  /** 所属阶段 */
  phase: PipelinePhase;
  /** 步骤标题 */
  title: string;
  /** 步骤描述 */
  description: string;

  /** 本步骤将创建的目录结构 */
  directoryStructure: string[];

  /** 本步骤将定义的接口契约 */
  interfaceContracts: InterfaceContract[];

  /** 本步骤将定义的数据模型 */
  dataModels: DataModel[];

  /** 验收标准（可通过自动化测试验证） */
  acceptanceCriteria: AcceptanceCriterion[];

  /** 预计使用的工具 */
  estimatedTools: string[];

  /** 依赖的前置步骤 ID（空数组表示可立即执行） */
  dependencies: string[];

  /** 预计代码行数上限 */
  maxCodeLines: number;
}

/** 接口契约 */
export interface InterfaceContract {
  /** 函数/方法名 */
  name: string;
  /** 签名 */
  signature: string;
  /** 参数说明 */
  params: ParamSpec[];
  /** 返回值说明 */
  returns: string;
  /** 用途说明 */
  purpose: string;
}

/** 参数规格 */
export interface ParamSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/** 数据模型 */
export interface DataModel {
  name: string;
  fields: DataField[];
  description: string;
}

/** 数据字段 */
export interface DataField {
  name: string;
  type: string;
  nullable: boolean;
  description: string;
}

/** 验收标准 */
export interface AcceptanceCriterion {
  id: string;
  description: string;
  /** 验证方式 */
  verifyBy: 'file-exists' | 'type-check' | 'unit-test' | 'manual' | 'shell';
  /** 验证参数（如文件路径、测试命令） */
  verifyParam: string;
}

/* ===================== Executor 相关 ===================== */

/** 步骤执行结果 */
export interface StepResult {
  stepId: string;
  success: boolean;
  /** 产出物清单 */
  artifacts: Artifact[];
  /** 工具调用记录 */
  toolCalls: ToolCallRecord[];
  /** 错误信息 */
  errors: AgentError[];
  /** 执行耗时（毫秒） */
  durationMs: number;
}

/** 工具调用记录 */
export interface ToolCallRecord {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  success: boolean;
  error?: string;
  durationMs: number;
}

/** Agent 错误 */
export interface AgentError {
  code: string;
  message: string;
  stepId: string;
  toolName?: string;
  recoverable: boolean;
  suggestion?: string;
}

/* ===================== Reflector 相关 ===================== */

/** 反思结果 */
export interface ReflectionResult {
  /** 原步骤 ID */
  stepId: string;
  /** 是否通过所有检查 */
  passed: boolean;
  /** 各项检查结果 */
  checks: ReflectionCheck[];
  /** 需要修正的问题 */
  corrections: Correction[];
  /** 是否需要回到 Executor 重试 */
  needsRetry: boolean;
}

/** 单项检查结果 */
export interface ReflectionCheck {
  type: 'file-exists' | 'interface-match' | 'data-model' | 'code-quality' | 'test-pass';
  criterionId: string;
  passed: boolean;
  detail: string;
}

/** 修正建议 */
export interface Correction {
  description: string;
  /** 修正方式 */
  action: 'create-file' | 'edit-file' | 'run-command' | 'manual';
  /** 修正参数 */
  params: Record<string, string>;
}

/* ===================== Agent 主协议 ===================== */

export interface AgentRequest {
  /** 当前步骤任务描述 */
  task: string;
  /** 计划 ID（执行时提供） */
  planId?: string;
  /** 总体目标（多步骤时提供） */
  overallGoal?: string;
  /** 上下文 */
  context: Context;
  /** 约束条件 */
  constraints?: Record<string, unknown>;
  /** 可用工具列表 */
  tools?: ToolSchema[];
  /** 执行选项 */
  options?: {
    maxSteps?: number;
    temperature?: number;
    maxRetriesPerStep?: number;
    planOnly?: boolean;
    /** 人工网关：Planner 产出计划后暂停，回调返回 true 才继续执行。
     *  开发模式下可设为 true 跳过确认。 */
    planGate?: boolean | ((plan: ExecutionPlan) => Promise<boolean>);
  };
}

export interface AgentResponse {
  status: 'success' | 'partial' | 'failed' | 'error';
  /** 执行计划（如果是 Planner 调用） */
  plan?: ExecutionPlan;
  /** 技术推荐结果 */
  techRecommendation?: TechStack;
  /** 执行结果 */
  result?: StepResult;
  /** 反思结果 */
  reflection?: ReflectionResult;
  /** 完整步骤记录 */
  steps: StepRecord[];
  /** 产出物清单 */
  artifacts: Artifact[];
  /** 错误列表 */
  errors: AgentError[];
  /** 计划网关状态（planGate 回调结果） */
  gateStatus?: GateStatus;
}

/** 计划网关状态 */
export interface GateStatus {
  /** 是否调用了网关 */
  invoked: boolean;
  /** 是否通过（true=继续执行，false=暂停） */
  approved: boolean;
  /** 拒绝原因（如有） */
  reason?: string;
}

/** Agent 接口（所有框架适配器必须实现） */
export interface AgentProtocol {
  execute(request: AgentRequest): Promise<AgentResponse>;
  health(): Promise<{ ok: boolean; framework: string; version: string }>;
  listTools(): ToolSchema[];
}

/* ===================== 技术选型矩阵 ===================== */

export interface TechMatrixEntry {
  engine: TechStack['engine'];
  displayName: string;
  dimensions: Record<string, string | number>;
  tags: string[];
}

/** 技术选型决策引擎输入 */
export interface TechSelectionInput {
  gameType: string;           // 放置 / 卡牌 / 动作 / ...
  teamSize: number;           // 团队人数
  needHotUpdate: boolean;     // 是否需要热更新
  performanceLevel: 'low' | 'medium' | 'high';
  targetPlatforms: string[];  // Android / iOS / Web
  budget: 'zero' | 'low' | 'medium' | 'high';
  developerExperience: string; // 开发者技术背景
}

/** 技术选型决策引擎输出 */
export interface TechSelectionOutput {
  recommendation: TechStack;
  matrix: Record<string, string | number>[];
  ranking: { engine: TechStack['engine']; score: number }[];
  caveats: string[];
}
