/**
 * MCP Smoke Test — 验证 mgai MCP Server 在 stdio 模式下能正常启动和响应
 *
 * 测试内容：
 * 1. listTools — 验证至少包含 mgai_generate_plan / mgai_get_status / mgai_list_skills
 * 2. callTool mgai_generate_plan — 验证能生成计划
 * 3. callTool mgai_get_status — 验证即使 SQLite 不可用也能返回 degraded 状态
 *
 * 运行方式：
 *   npx vitest run tests/mcp-smoke.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';
import type { SpawnOptions } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

/* ===================== 辅助 ===================== */

let client: Client;
let transport: StdioClientTransport;
let toolNames: string[] = [];

const spawnEnv: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined) spawnEnv[k] = v;
}
spawnEnv.MGAI_PROJECT_ROOT = projectRoot;

const spawnOpts: SpawnOptions = {
  cwd: projectRoot,
  env: spawnEnv,
  stdio: ['pipe', 'pipe', 'pipe'] as const,
};

beforeAll(async () => {
  const params: Record<string, unknown> = {
    command: 'npx.cmd',
    args: ['tsx', path.join(projectRoot, 'mcp', 'run.ts')],
    cwd: projectRoot,
    env: spawnEnv,
    stderr: 'pipe',
  };

  transport = new StdioClientTransport(params as any);

  client = new Client(
    { name: 'smoke-test', version: '1.0.0' },
    { capabilities: {} },
  );

  await client.connect(transport);

  const tools = await client.listTools();
  toolNames = tools.tools.map((t) => t.name);
}, 30000);

afterAll(async () => {
  try {
    await client?.close();
  } catch {
    // 忽略关闭错误
  }
});

/* ===================== 测试 ===================== */

describe('MCP Smoke Test', () => {
  it('listTools 应包含核心工具', () => {
    const expected = [
      'mgai_generate_plan',
      'mgai_generate_code',
      'mgai_evaluate_tech',
      'mgai_get_status',
      'mgai_list_skills',
      'mgai_vector_search',
      'mgai_orchestrate',
      'mgai_connect_external',
    ];
    for (const name of expected) {
      expect(toolNames).toContain(name);
    }
  });

  it('mgai_generate_plan 应返回有效计划', async () => {
    const result = await client.callTool({
      name: 'mgai_generate_plan',
      arguments: { requirement: '开发一款修仙放置手游' },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text?: string }>;
    expect(content).toBeDefined();
    expect(content.length).toBeGreaterThan(0);

    const text = content.find((c) => c.type === 'text')?.text;
    expect(text).toBeDefined();
    expect(Buffer.byteLength(text!, 'utf8')).toBeLessThan(10_000);

    const plan = JSON.parse(text!);
    expect(plan.planId).toBeDefined();
    expect(plan.steps).toBeDefined();
    expect(Array.isArray(plan.steps)).toBe(true);
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.techRecommendation).toBeDefined();
    expect(plan.steps[0].acceptanceCriteriaCount).toBeTypeOf('number');
    expect(Array.isArray(plan.steps[0].dataModelNames)).toBe(true);
    expect(Array.isArray(plan.steps[0].interfaceNames)).toBe(true);
    expect(plan.steps[0].acceptanceCriteria).toBeUndefined();
    expect(plan.steps[0].dataModels).toBeUndefined();
    expect(plan.steps[0].interfaceContracts).toBeUndefined();
  }, 15000);

  it('mgai_get_status 应在本环境返回 healthy（SQLite 可用）', async () => {
    const result = await client.callTool({
      name: 'mgai_get_status',
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text?: string }>;
    const text = content.find((c) => c.type === 'text')?.text;
    expect(text).toBeDefined();

    const status = JSON.parse(text!);
    expect(status.name).toBe('手游AI开发Agent');
    expect(status.version).toBeDefined();
    expect(status.memory).toBeDefined();
    expect(status.memory.status).toBeDefined();
    expect(status.memory.sqliteAvailable).toBeDefined();

    // 本环境 better-sqlite3@12.11.1 + Node 24 应返回 healthy
    expect(status.memory.sqliteAvailable).toBe(true);
    expect(status.memory.status).toBe('healthy');
  }, 15000);

  it('mgai_list_skills 应返回技能列表', async () => {
    const result = await client.callTool({
      name: 'mgai_list_skills',
      arguments: {},
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text?: string }>;
    const text = content.find((c) => c.type === 'text')?.text;
    expect(text).toBeDefined();

    const skills = JSON.parse(text!);
    expect(skills.totalSkills).toBeDefined();
    expect(skills.totalSkills).toBeGreaterThan(0);
    expect(Array.isArray(skills.skills)).toBe(true);
  }, 15000);
});
