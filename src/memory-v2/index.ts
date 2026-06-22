/**
 * Memory v2 — 五层记忆体系 (Barrel Export)
 *
 * 导出：
 * - types.ts    → 五层类型定义 + MemorySnapshot + MemoryAccessor
 * - injection.ts → InjectionStrategy 注入策略
 */

export {
  MemoryLayer,
  LAYER_TOKEN_BUDGET,
  type OutputFragment,
  type WorkingMemory,
  type TurnEntry,
  type ConversationMemory,
  type Convention,
  type Decision,
  type FileHash,
  type ProjectMemory,
  type KnowledgeCard,
  type KnowledgeMemory,
  type Preference,
  type BehaviorPattern,
  type ProfileMemory,
  type MemorySnapshot,
  type TokenEstimate,
  type MemoryAccessor,
} from './types';

export { InjectionStrategy } from './injection';
