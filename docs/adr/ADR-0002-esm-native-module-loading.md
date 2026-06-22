---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 0b418d7b66220b449a0c82e3d4c34758_c1eb83fc6e8211f18805525400d9a7a1
    ReservedCode1: XDXwGLw/fun21J0x2dQpjG3XsSDArGfwQ5cPbLbvXoVl+MJ52d1v4Q9ru9+CYWP+qvZWsf/EDjzTdacWU/mzubjEWC1gE2Z3sq650FYnDV3iyee5tDhxl3k23p/vnbAMe+bwO+9slipKo3efEM7Yl/zXSypGugQafvzm8rk1GGX5liNdnXsG7P1P6KY=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 0b418d7b66220b449a0c82e3d4c34758_c1eb83fc6e8211f18805525400d9a7a1
    ReservedCode2: XDXwGLw/fun21J0x2dQpjG3XsSDArGfwQ5cPbLbvXoVl+MJ52d1v4Q9ru9+CYWP+qvZWsf/EDjzTdacWU/mzubjEWC1gE2Z3sq650FYnDV3iyee5tDhxl3k23p/vnbAMe+bwO+9slipKo3efEM7Yl/zXSypGugQafvzm8rk1GGX5liNdnXsG7P1P6KY=
---

# ADR-0002：ESM 项目中加载 CJS 原生模块的策略

**状态**：已采纳
**日期**：2026-06-23
**决策者**：AI Agent + 用户确认
**影响范围**：所有需要加载 CJS/native 模块的 ESM 源文件

## 上下文

项目 `package.json` 设置 `"type": "module"`，运行时使用 tsx（ESM 模式）。better-sqlite3 是 CJS 原生模块，通过预编译 `.node` 二进制提供 native addon。

早期代码在 `persistence.ts`、`binary-guard.ts`、`mcp/server.ts` 中直接使用裸 `require()` 加载 better-sqlite3。在 ESM 作用域内，`require` 不可用，抛出 `ReferenceError: require is not defined`，被 catch 后误判为 better-sqlite3 原生模块加载失败，导致 `mgai_get_status` 返回 degraded。

## 决策

### 1. ESM 文件不能直接使用 require / require.resolve

- 在 ESM 模块中，`require` 不是全局可用
- 在 `package.json` 声明 `"type": "module"` 的项目中，所有 `.ts`（经 tsx 编译后以 ESM 运行）都受此限制
- 任何需要加载 CJS 模块的代码必须使用 `createRequire`

### 2. 加载 CJS/native 模块必须使用 createRequire

```typescript
import { createRequire } from 'module';
const projectRequire = createRequire(import.meta.url);
const betterSqlite3 = projectRequire('better-sqlite3');
```

- `createRequire` 是 Node.js 标准库 `module` 提供的 API
- 以 `import.meta.url` 为基点创建 require，保证解析路径与项目一致
- 零外部依赖

### 3. 推荐基于 projectRoot / package.json 创建 projectRequire

- 统一封装在 `orchestration/native-loader.ts`
- 导出 `createProjectRequire`、`loadBetterSqlite3` 等工具函数
- 各模块通过顶层 `import` 引入 native-loader，避免在每个文件中重复 `createRequire` 调用
- 静态 import 在 ESM 加载阶段执行，位于同步执行路径上，比动态 `import()` 更可靠

### 4. 加载失败时的处理策略

- try/catch 区分 `ReferenceError`（ESM require 误判）和真正的 native module 错误
- 真正的加载失败进入 degraded 模式，核心功能不受影响
- 通过 `mgai_get_status` 暴露 `sqliteAvailable` 字段供诊断

## 后果

- **正向**：彻底消除 ESM require 误判，SQLite 加载路径与项目模块系统一致
- **正向**：`native-loader.ts` 作为唯一入口，未来新增 CJS 依赖时无需重复踩坑
- **负向**：所有 CJS 模块加载需经过 native-loader，增加一层间接调用
- **后续观察**：如有多个 CJS 原生模块需要加载，考虑将 native-loader 泛化为 generic CJS bridge

## 参考

- [排错指南](../troubleshooting/codex-mcp-sqlite.md)
- [ADR-0001](ADR-0001-mcp-stdio-lifecycle.md)
*（内容由AI生成，仅供参考）*
