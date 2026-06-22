/**
 * 璁板繂绯荤粺 鈥?璺ㄤ細璇濅笂涓嬫枃瀛樺偍 (Barrel Export)
 *
 * 瀵煎嚭锛? * - MemorySystem       鈫?鏃х増鏂囦欢绾?JSON 瀛樺偍锛堝吋瀹癸級
 * - Persistence        鈫?P0 SQLite 鎸佷箙鍖栧眰
 * - MemoryManager      鈫?P0+P1+P2+P3 鍏ㄨ仈鍔ㄨ蹇嗙鐞嗗櫒
 * - Embedder           鈫?P3 鏂囨湰宓屽叆鎺ュ彛 + 瀹炵幇
 * - VectorIndex        鈫?P3 闆朵緷璧栧悜閲忕储寮? * - LRUCache           鈫?P2 LRU 缂撳瓨锛坮e-export锛? */

export { MemorySystem } from './memory-system';
export type { MemoryEntry, MemoryQuery, MemoryStats } from './memory-system';

export { Persistence } from './persistence';
export type {
  UserProfileRow,
  SessionSummaryRow,
  ErrorLessonRow,
  VectorRecordRow,
} from './persistence';

export { MemoryManager } from './memory-manager';
export type { SummaryGenerator } from './memory-manager';

export { LLMEmbedder, RuleEmbedder } from './embedder';
export type { Embedder, LLMEmbedderConfig } from './embedder';

export { VectorIndex } from './vector-index';
export type { VectorRecord, SearchResult } from './vector-index';

export { LRUCache } from './lru-cache';

import { promises as fs } from 'node:fs';
import path from 'node:path';
