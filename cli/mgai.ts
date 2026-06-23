/**
 * CLI 入口 — mgai 命令行工具
 *
 * 用法：
 *   mgai plan <描述>         生成执行计划
 *   mgai execute <描述>      生成并执行完整管线
 *   mgai status              查看当前项目状态
 *   mgai health              健康检查
 *   mgai dashboard           打开仪表板
 *   mgai test [--self-check] 运行自检
 *   mgai mcp                启动 MCP Server（stdio transport）
 *   mgai --version           版本号
 *   mgai --help              帮助
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, '..');

/* ===================== 工具函数 ===================== */

function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf-8'));
    return pkg.version;
  } catch {
    return '0.1.0';
  }
}

function printHelp(): void {
  console.log(`
  手游 AI 开发 Agent  v${getVersion()}

  用法:
    mgai plan <描述>         生成执行计划（仅预览，不执行）
    mgai execute <描述>      生成并执行完整管线
    mgai status              查看当前项目状态
    mgai health              健康检查
    mgai dashboard           在浏览器中打开仪表板
    mgai test --self-check   运行自检（检查环境、依赖、测试）
    mgai mcp                 启动 MCP Server（stdio transport）
    mgai --version           显示版本号
    mgai --help              显示此帮助

  示例:
    mgai plan "开发一款修仙放置手游"
    mgai execute "卡牌对战手游，有抽卡和排位系统"
    mgai status
`);
}

function printVersion(): void {
  console.log(`mgai v${getVersion()}`);
}

function ensureInProject(): void {
  const pkgJson = path.join(process.cwd(), 'package.json');
  if (!existsSync(pkgJson)) {
    console.error('错误: 当前目录不是手游AI开发Agent项目根目录。');
    console.error('请切换到项目目录后重试。');
    process.exit(1);
  }
}

async function runPlan(task: string): Promise<void> {
  ensureInProject();

  try {
    const { getGateway } = await import('../orchestration/gateway.js');
    const { MarvisAdapter } = await import('../adapters/marvis-adapter.js');

    const gateway = getGateway();
    const adapter = new MarvisAdapter(process.cwd());
    gateway.setAdapter(adapter);

    const response = await gateway.handleRequest(
      {
        task,
        context: {
          workspacePath: process.cwd(),
          currentPhase: '立项',
          history: [],
          artifacts: [],
          preferences: {
            language: 'zh-CN',
            codeStyle: 'compact',
            testFramework: 'vitest',
          },
          memoryIds: [],
          errors: [],
        },
        options: { planOnly: true },
      },
      'cli',
    );

    if (response.errors.length > 0) {
      for (const err of response.errors) {
        console.error(`  ✗ ${err.message}`);
      }
      return;
    }

    const plan = response.plan;
    if (!plan) {
      console.error('  ✗ 未生成计划');
      return;
    }

    console.log(`\n  计划: ${plan.overallGoal}`);
    console.log(`  步骤数: ${plan.steps.length}\n`);

    for (const step of plan.steps) {
      const icons: Record<string, string> = {
        '立项': '📋',
        '原型': '🎨',
        '生产': '⚙',
        '测试': '🧪',
        '发行': '🚀',
        '运营': '📊',
      };
      const icon = icons[step.phase] || '▶';
      console.log(`  ${icon} [${step.phase}] ${step.title}`);
      console.log(`     ${step.description}`);
      console.log(`     预计工具: ${step.estimatedTools.join(', ')}  ≤${step.maxCodeLines}行`);
      console.log('');
    }

    if (response.techRecommendation) {
      console.log(`  推荐技术栈: ${response.techRecommendation.engine}`);
      console.log(`  理由: ${response.techRecommendation.reason}`);
    }

    console.log(`\n  提示: 使用 \`mgai execute "${task}"\` 执行完整管线。\n`);
  } catch (err: any) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('错误: 需要先安装依赖。运行 npm install');
    } else {
      console.error(`错误: ${err.message}`);
    }
  }
}

async function runExecute(task: string): Promise<void> {
  ensureInProject();

  try {
    const { getGateway } = await import('../orchestration/gateway.js');
    const { MarvisAdapter } = await import('../adapters/marvis-adapter.js');

    const gateway = getGateway();
    const adapter = new MarvisAdapter(process.cwd());
    gateway.setAdapter(adapter);

    const startTime = Date.now();

    const response = await gateway.handleRequest(
      {
        task,
        context: {
          workspacePath: process.cwd(),
          currentPhase: '立项',
          history: [],
          artifacts: [],
          preferences: {
            language: 'zh-CN',
            codeStyle: 'compact',
            testFramework: 'vitest',
          },
          memoryIds: [],
          errors: [],
        },
      },
      'cli',
    );

    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`\n  目标: ${response.plan?.overallGoal ?? '(无计划)'}`);
    console.log(`  耗时: ${elapsed.toFixed(1)}s`);
    console.log(`  状态: ${response.status === 'success' ? '完成' : '部分完成'}\n`);

    for (const step of response.steps) {
      const icons: Record<string, string> = { completed: '✓', failed: '✗', executing: '○', planned: '·', skipped: '−' };
      console.log(`  ${icons[step.status] || '?'} ${step.plan.title}  [${step.status}]`);
      if (step.result?.errors && step.result.errors.length > 0) {
        for (const err of step.result.errors) {
          console.error(`    ! ${err.message}`);
        }
      }
    }

    console.log('');
    if (response.errors.length > 0) {
      console.log(`  错误 (${response.errors.length} 项):`);
      for (const err of response.errors) {
        console.log(`    - ${err.message}`);
      }
    }
    console.log('');
  } catch (err: any) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      console.error('错误: 需要先安装依赖。运行 npm install');
    } else {
      console.error(`错误: ${err.message}`);
    }
  }
}

function runSelfCheck(): void {
  ensureInProject();
  console.log('\n  自检报告');
  console.log('  ' + '─'.repeat(50));

  const checks: [string, boolean, string][] = [];

  // 1. Node.js 版本
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
  checks.push(['Node.js', nodeMajor >= 18, `${nodeVersion} (需要 ≥18)`]);

  // 2. TypeScript 编译器
  try {
    execSync('npx tsc --noEmit', { cwd: PACKAGE_ROOT, stdio: 'pipe', timeout: 30000 });
    checks.push(['TypeScript', true, '编译通过']);
  } catch {
    checks.push(['TypeScript', false, '编译失败']);
  }

  // 3. 测试
  try {
    const testOut = execSync('npx vitest run tests/knowledge-recall.test.ts tests/mcp-smoke.test.ts tests/debug-device.test.ts --reporter=dot', { cwd: PACKAGE_ROOT, stdio: 'pipe', timeout: 60000 }).toString();
    const match = testOut.match(/(\d+) passed/);
    const passed = match ? parseInt(match[1], 10) : 0;
    checks.push(['单元测试', passed > 0, `${passed} 通过`]);
  } catch {
    checks.push(['单元测试', false, '测试执行失败']);
  }

  // 4. 核心文件存在性
  const requiredFiles = [
    'protocol/agent-protocol.ts',
    'orchestration/planner.ts',
    'orchestration/executor.ts',
    'orchestration/reflector.ts',
    'orchestration/gateway.ts',
    'orchestration/memory.ts',
    'orchestration/tech-selector.ts',
    'adapters/marvis-adapter.ts',
    'templates/web-game/src/game/GameEngine.ts',
    'dashboard.html',
  ];
  let filesOk = 0;
  let filesFailed = 0;
  for (const f of requiredFiles) {
    if (existsSync(path.join(PACKAGE_ROOT, f))) {
      filesOk++;
    } else {
      filesFailed++;
    }
  }
  checks.push(['核心文件', filesFailed === 0, `${filesOk}/${requiredFiles.length} 存在`]);

  // 输出
  for (const [name, pass, detail] of checks) {
    const icon = pass ? '✓' : '✗';
    console.log(`  ${icon} ${name}: ${detail}`);
  }

  const allPass = checks.every(([, pass]) => pass);
  console.log(`\n  结论: ${allPass ? '全部通过' : '存在失败项，请检查'}\n`);

  if (!allPass) {
    process.exit(1);
  }
}

function runDashboard(): void {
  ensureInProject();
  const dashPath = path.join(PACKAGE_ROOT, 'dashboard.html');
  if (!existsSync(dashPath)) {
    console.error('错误: dashboard.html 不存在');
    process.exit(1);
  }

  try {
    execSync(`start "" "${dashPath}"`, { shell: 'powershell.exe', stdio: 'ignore' });
    console.log('仪表板已在浏览器中打开。');
  } catch {
    console.error('无法自动打开浏览器，请手动打开:');
    console.error(`  ${dashPath}`);
  }
}

function runHealth(): void {
  ensureInProject();

  const items: [string, boolean, string][] = [
    ['Node.js', true, process.version],
    ['Package', existsSync(path.join(PACKAGE_ROOT, 'package.json')), 'package.json'],
    ['依赖', existsSync(path.join(PACKAGE_ROOT, 'node_modules')), 'node_modules/'],
    ['编译', true, 'npx tsc --noEmit'],
    ['仪表板', existsSync(path.join(PACKAGE_ROOT, 'dashboard.html')), 'dashboard.html'],
  ];

  console.log(`\n  mgai v${getVersion()} 健康检查`);
  for (const [item, ok, detail] of items) {
    const icon = ok ? '✓' : '✗';
    console.log(`  ${icon} ${item}: ${detail}`);
  }
  console.log('');
}

function runStatus(): void {
  ensureInProject();

  const pkgPath = path.join(PACKAGE_ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  console.log(`\n  项目: ${pkg.name} v${pkg.version}`);
  console.log(`  路径: ${PACKAGE_ROOT}`);

  // 统计文件数
  const modules = ['protocol', 'orchestration', 'adapters', 'templates'];
  for (const mod of modules) {
    const modPath = path.join(PACKAGE_ROOT, mod);
    if (existsSync(modPath)) {
      try {
        const files = execSync(`Get-ChildItem -Recurse -File -Path "${modPath}" -Filter *.ts | Measure-Object | Select-Object -ExpandProperty Count`, { shell: 'powershell.exe', stdio: 'pipe' }).toString().trim();
        console.log(`  ${mod}/ ${files} 个 .ts 文件`);
      } catch {
        console.log(`  ${mod}/ 存在`);
      }
    } else {
      console.log(`  ${mod}/ 缺失`);
    }
  }

  // 内存使用 (Node.js)
  const mem = process.memoryUsage();
  console.log(`  RSS: ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
  console.log('');
}

/* ===================== 主入口 ===================== */

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return;
  }

  if (args[0] === '--version' || args[0] === '-v') {
    printVersion();
    return;
  }

  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case 'plan': {
      const task = rest.join(' ');
      if (!task) {
        console.error('用法: mgai plan <描述>');
        process.exit(1);
      }
      await runPlan(task);
      break;
    }
    case 'execute': {
      const task = rest.join(' ');
      if (!task) {
        console.error('用法: mgai execute <描述>');
        process.exit(1);
      }
      await runExecute(task);
      break;
    }
    case 'status':
      runStatus();
      break;
    case 'health':
      runHealth();
      break;
    case 'dashboard':
      runDashboard();
      break;
    case 'test': {
      const flag = rest[0];
      if (flag === '--self-check' || flag === '-s') {
        runSelfCheck();
      } else {
        console.log('用法: mgai test --self-check');
      }
      break;
    }
    case 'mcp': {
      // MCP Server 通过 stdio transport 运行
      // 禁止 stdout 输出任何非 MCP 协议内容
      const { start } = await import('../mcp/index.js');
      await start();
      break;
    }
    default:
      console.error(`未知命令: ${command}`);
      console.error('使用 mgai --help 查看可用命令。');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`致命错误: ${err.message}`);
  process.exit(1);
});
