import {
  Memory,
  MemoryType,
  UserMemory,
  MemoryContext,
} from "../../../types/knowledge";
import { Logger } from "../../system/Logger";

/**
 * Long-Term Memory System - Manages persistent memories
 * Supports memory consolidation, rewriting, and retrieval
 */

export class LongTermMemory {
  private memories: Map<string, Memory> = new Map();
  private userMemories: Map<string, UserMemory> = new Map();
  private memoryIdCounter: number = 0;
  private consolidationInterval: number = 3600000; // 1 hour
  private consolidationTimer: NodeJS.Timeout | null = null;

  constructor() {
    Logger.info("LongTermMemory initialized");
  }

  /**
   * Add memory
   */
  addMemory(
    type: MemoryType,
    content: string,
    importance: number = 50,
    metadata: Record<string, any> = {}
  ): Memory {
    const memory: Memory = {
      id: this.generateMemoryId(),
      type,
      content,
      importance,
      accessCount: 0,
      lastAccessed: Date.now(),
      createdAt: Date.now(),
      relatedMemories: [],
      metadata,
    };

    this.memories.set(memory.id, memory);

    Logger.info("Memory added", {
      memoryId: memory.id,
      type,
      importance,
    });

    return memory;
  }

  /**
   * Update memory (rewriting)
   */
  updateMemory(memoryId: string, updates: Partial<Memory>): Memory | null {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      return null;
    }

    const updated: Memory = {
      ...memory,
      ...updates,
      updatedAt: Date.now(),
    };

    this.memories.set(memoryId, updated);

    Logger.info("Memory updated", {
      memoryId,
      changes: Object.keys(updates),
    });

    return updated;
  }

  /**
   * Access memory (increment access count)
   */
  accessMemory(memoryId: string): Memory | null {
    const memory = this.memories.get(memoryId);
    if (!memory) {
      return null;
    }

    memory.accessCount++;
    memory.lastAccessed = Date.now();

    return memory;
  }

  /**
   * Retrieve memory by ID
   */
  getMemory(memoryId: string): Memory | undefined {
    return this.memories.get(memoryId);
  }

  /**
   * Retrieve memories by type
   */
  getMemoriesByType(type: MemoryType): Memory[] {
    return Array.from(this.memories.values()).filter((m) => m.type === type);
  }

  /**
   * Retrieve memories by importance
   */
  getMemoriesByImportance(minImportance: number = 50): Memory[] {
    return Array.from(this.memories.values())
      .filter((m) => m.importance >= minImportance)
      .sort((a, b) => b.importance - a.importance);
  }

  /**
   * Retrieve recent memories
   */
  getRecentMemories(limit: number = 10): Memory[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.lastAccessed - a.lastAccessed)
      .slice(0, limit);
  }

  /**
   * Retrieve frequently accessed memories
   */
  getFrequentMemories(limit: number = 10): Memory[] {
    return Array.from(this.memories.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }

  /**
   * Add user memory
   */
  addUserMemory(userId: string): UserMemory {
    let userMemory = this.userMemories.get(userId);

    if (!userMemory) {
      userMemory = {
        userId,
        preferences: {},
        history: [],
        facts: new Map(),
        goals: [],
        lastUpdated: Date.now(),
      };

      this.userMemories.set(userId, userMemory);

      Logger.info("User memory created", { userId });
    }

    return userMemory;
  }

  /**
   * Update user preferences
   */
  updateUserPreferences(userId: string, preferences: Record<string, any>): void {
    let userMemory = this.userMemories.get(userId);

    if (!userMemory) {
      userMemory = this.addUserMemory(userId);
    }

    userMemory.preferences = {
      ...userMemory.preferences,
      ...preferences,
    };

    userMemory.lastUpdated = Date.now();

    Logger.info("User preferences updated", {
      userId,
      preferences: Object.keys(preferences),
    });
  }

  /**
   * Add user fact
   */
  addUserFact(userId: string, key: string, value: string): void {
    let userMemory = this.userMemories.get(userId);

    if (!userMemory) {
      userMemory = this.addUserMemory(userId);
    }

    userMemory.facts.set(key, value);
    userMemory.lastUpdated = Date.now();

    Logger.info("User fact added", { userId, key });
  }

  /**
   * Get user fact
   */
  getUserFact(userId: string, key: string): string | undefined {
    const userMemory = this.userMemories.get(userId);
    return userMemory?.facts.get(key);
  }

  /**
   * Add user goal
   */
  addUserGoal(userId: string, goal: string): void {
    let userMemory = this.userMemories.get(userId);

    if (!userMemory) {
      userMemory = this.addUserMemory(userId);
    }

    if (!userMemory.goals.includes(goal)) {
      userMemory.goals.push(goal);
      userMemory.lastUpdated = Date.now();

      Logger.info("User goal added", { userId, goal });
    }
  }

  /**
   * Get user memory
   */
  getUserMemory(userId: string): UserMemory | undefined {
    return this.userMemories.get(userId);
  }

  /**
   * Consolidate memories (merge similar ones)
   */
  consolidateMemories(): void {
    const memories = Array.from(this.memories.values());

    // Group similar memories
    const groups: Map<string, Memory[]> = new Map();

    for (const memory of memories) {
      // Simple grouping by type and importance range
      const key = `${memory.type}-${Math.floor(memory.importance / 10)}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }

      groups.get(key)!.push(memory);
    }

    // Consolidate within groups
    let consolidatedCount = 0;

    for (const [key, group] of groups) {
      if (group.length > 3) {
        // Merge low-importance memories
        const sorted = group.sort((a, b) => a.importance - b.importance);
        const toMerge = sorted.slice(0, Math.floor(group.length / 2));

        if (toMerge.length > 1) {
          const merged = this.mergeMemories(toMerge);
          this.memories.set(merged.id, merged);

          // Remove original memories
          for (const memory of toMerge) {
            this.memories.delete(memory.id);
          }

          consolidatedCount++;
        }
      }
    }

    if (consolidatedCount > 0) {
      Logger.info("Memories consolidated", { count: consolidatedCount });
    }
  }

  /**
   * Merge memories
   */
  private mergeMemories(memories: Memory[]): Memory {
    const merged: Memory = {
      id: this.generateMemoryId(),
      type: memories[0].type,
      content: memories.map((m) => m.content).join(" | "),
      importance: Math.max(...memories.map((m) => m.importance)),
      accessCount: memories.reduce((sum, m) => sum + m.accessCount, 0),
      lastAccessed: Math.max(...memories.map((m) => m.lastAccessed)),
      createdAt: Math.min(...memories.map((m) => m.createdAt)),
      relatedMemories: Array.from(
        new Set(memories.flatMap((m) => m.relatedMemories))
      ),
      metadata: {
        mergedFrom: memories.map((m) => m.id),
        mergedAt: Date.now(),
      },
    };

    return merged;
  }

  /**
   * Start automatic consolidation
   */
  startConsolidation(): void {
    if (this.consolidationTimer) {
      return;
    }

    this.consolidationTimer = setInterval(() => {
      this.consolidateMemories();
    }, this.consolidationInterval);

    Logger.info("Memory consolidation started", {
      intervalMs: this.consolidationInterval,
    });
  }

  /**
   * Stop automatic consolidation
   */
  stopConsolidation(): void {
    if (this.consolidationTimer) {
      clearInterval(this.consolidationTimer);
      this.consolidationTimer = null;

      Logger.info("Memory consolidation stopped");
    }
  }

  /**
   * Prune old memories
   */
  pruneOldMemories(maxAgeDays: number = 30): void {
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, memory] of this.memories) {
      if (now - memory.lastAccessed > maxAge && memory.importance < 50) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.memories.delete(id);
    }

    if (toDelete.length > 0) {
      Logger.info("Old memories pruned", { count: toDelete.length });
    }
  }

  /**
   * Get all memories
   */
  getAllMemories(): Memory[] {
    return Array.from(this.memories.values());
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    const memories = Array.from(this.memories.values());
    const typeCount: Record<string, number> = {};

    memories.forEach((m) => {
      typeCount[m.type] = (typeCount[m.type] || 0) + 1;
    });

    const avgImportance =
      memories.length > 0
        ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length
        : 0;

    const avgAccessCount =
      memories.length > 0
        ? memories.reduce((sum, m) => sum + m.accessCount, 0) / memories.length
        : 0;

    return {
      totalMemories: memories.length,
      totalUsers: this.userMemories.size,
      typeCount,
      averageImportance: avgImportance.toFixed(2),
      averageAccessCount: avgAccessCount.toFixed(2),
      consolidationActive: this.consolidationTimer !== null,
    };
  }

  /**
   * Clear all memories
   */
  clear(): void {
    this.memories.clear();
    this.userMemories.clear();
    this.stopConsolidation();

    Logger.info("All memories cleared");
  }

  /**
   * Generate memory ID
   */
  private generateMemoryId(): string {
    return `mem-${Date.now()}-${++this.memoryIdCounter}`;
  }
}

export const createLongTermMemory = (): LongTermMemory => {
  return new LongTermMemory();
};
