/**
 * Phase 3 — 端到端 CLI 脚本
 *
 * 在 Marvis 真实环境中执行完整 P→E→R 管线，
 * 输出结构化 JSON 结果并打印人类可读摘要。
 *
 * 使用方式:
 *   npx tsx scripts/e2e-marvis.ts                # 默认：放置修仙手游
 *   npx tsx scripts/e2e-marvis.ts "开发肉鸽手游"  # 自定义任务
 */

import { Gateway } from '../orchestration/gateway.js';
import { MarvisAdapter } from '../adapters/marvis-adapter.js';

const WORKSPACE = process.argv[3]
  ?? 'D:\\Marvis\\手游AI开发Agent\\e2e-output';

const TASK = process.argv[2]
  ?? '开发一款修仙放置手游，点击修炼突破境界，离线自动挂机，10级成就系统';

async function main() {
  const adapter = new MarvisAdapter(WORKSPACE);
  const gateway = new Gateway();
  gateway.setAdapter(adapter);

  const ctx = adapter.getContext();

  console.log('═'.repeat(60));
  console.log('  MGAI 端到端测试 — Phase 3');
  console.log('═'.repeat(60));
  console.log(`  任务: ${TASK}`);
  console.log(`  工作区: ${WORKSPACE}`);
  console.log('─'.repeat(60));

  const start = Date.now();
  const response = await gateway.handleRequest(
    {
      task: TASK,
      overallGoal: TASK,
      context: ctx,
      tools: adapter.listTools(),
    },
    'marvis',
  );

  const elapsed = Date.now() - start;

  // --- 摘要 ---
  console.log('');
  console.log('  状态:', response.status.toUpperCase());
  console.log('  耗时:', `${elapsed}ms`);
  console.log('');

  if (response.plan) {
    console.log('  引擎:', response.plan.techRecommendation.engine);
    console.log('  理由:', response.plan.techRecommendation.reason);
    console.log('  步骤数:', response.plan.steps.length);
    console.log('  风险:', response.plan.risks.join('; ') || '无');
    console.log('');
  }

  console.log('  步骤执行:');
  for (const step of response.steps) {
    const icon = step.status === 'completed' ? '✓' : step.status === 'skipped' ? '○' : '✗';
    console.log(`    ${icon} [${step.phase}] ${step.plan.title}`);
  }

  if (response.errors.length > 0) {
    console.log('');
    console.log('  错误:');
    for (const e of response.errors) {
      console.log(`    ✗ [${e.code}] ${e.message}`);
    }
  }

  console.log('');
  console.log('─'.repeat(60));
  console.log(`  通过: ${response.steps.filter((s) => s.status === 'completed').length}/${response.steps.length}`);
  console.log('═'.repeat(60));

  // 输出完整 JSON 到 stdout（可管道至 jq）
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(response, null, 2));
  }

  process.exit(response.status === 'success' ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(2);
});
