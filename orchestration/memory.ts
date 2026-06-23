/**
 * Memory system barrel export.
 *
 * Exports:
 * - MemorySystem: file-based JSON memory store for compatibility
 * - Persistence: SQLite persistence layer
 * - MemoryManager: unified memory manager
 * - Embedder: text embedding interface and implementations
 * - VectorIndex: dependency-free vector search index
 * - LRUCache: in-memory LRU cache
 */

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
