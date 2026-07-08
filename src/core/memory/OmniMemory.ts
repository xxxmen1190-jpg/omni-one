import { Message } from "../../types";

export interface MemoryEntry {
  id: string;
  timestamp: number;
  type: "interaction" | "learning" | "context" | "result";
  content: any;
  importance: number; // 0-1
  tags: string[];
}

export interface MemoryStats {
  totalEntries: number;
  byType: Record<string, number>;
  averageImportance: number;
  oldestEntry: number;
  newestEntry: number;
}

export class OmniMemory {
  private workingMemory: Map<string, any> = new Map();
  private shortTermMemory: MemoryEntry[] = [];
  private longTermMemory: MemoryEntry[] = [];
  private maxShortTermSize: number = 100;
  private maxLongTermSize: number = 1000;
  private importanceThreshold: number = 0.5;

  addToWorkingMemory(key: string, value: any): void {
    this.workingMemory.set(key, value);
  }

  getFromWorkingMemory(key: string): any {
    return this.workingMemory.get(key);
  }

  clearWorkingMemory(): void {
    this.workingMemory.clear();
  }

  addToShortTermMemory(entry: MemoryEntry): void {
    this.shortTermMemory.push(entry);

    // Move high-importance entries to long-term memory
    if (entry.importance > this.importanceThreshold) {
      this.addToLongTermMemory(entry);
    }

    // Maintain size limit
    if (this.shortTermMemory.length > this.maxShortTermSize) {
      this.shortTermMemory.shift();
    }
  }

  addToLongTermMemory(entry: MemoryEntry): void {
    this.longTermMemory.push(entry);

    // Maintain size limit
    if (this.longTermMemory.length > this.maxLongTermSize) {
      this.longTermMemory.shift();
    }
  }

  getShortTermMemory(): MemoryEntry[] {
    return [...this.shortTermMemory];
  }

  getLongTermMemory(): MemoryEntry[] {
    return [...this.longTermMemory];
  }

  searchMemory(query: string, limit: number = 10): MemoryEntry[] {
    const allMemory = [...this.shortTermMemory, ...this.longTermMemory];
    const queryLower = query.toLowerCase();

    return allMemory
      .filter(
        (entry) =>
          JSON.stringify(entry.content).toLowerCase().includes(queryLower) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(queryLower))
      )
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  getRecentMemory(count: number = 10): MemoryEntry[] {
    const allMemory = [...this.shortTermMemory, ...this.longTermMemory];
    return allMemory
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  getMemoryByType(type: string): MemoryEntry[] {
    const allMemory = [...this.shortTermMemory, ...this.longTermMemory];
    return allMemory.filter((entry) => entry.type === type);
  }

  getMemoryByTag(tag: string): MemoryEntry[] {
    const allMemory = [...this.shortTermMemory, ...this.longTermMemory];
    return allMemory.filter((entry) => entry.tags.includes(tag));
  }

  clearShortTermMemory(): void {
    this.shortTermMemory = [];
  }

  clearLongTermMemory(): void {
    this.longTermMemory = [];
  }

  clearAllMemory(): void {
    this.workingMemory.clear();
    this.shortTermMemory = [];
    this.longTermMemory = [];
  }

  getMemoryStats(): MemoryStats {
    const allMemory = [...this.shortTermMemory, ...this.longTermMemory];
    const byType: Record<string, number> = {};

    allMemory.forEach((entry) => {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    });

    const timestamps = allMemory.map((e) => e.timestamp);
    const importances = allMemory.map((e) => e.importance);

    return {
      totalEntries: allMemory.length,
      byType,
      averageImportance:
        importances.length > 0
          ? importances.reduce((a, b) => a + b, 0) / importances.length
          : 0,
      oldestEntry: Math.min(...timestamps, Infinity),
      newestEntry: Math.max(...timestamps, 0),
    };
  }

  private generateEntryId(): string {
    return `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  addMemoryEntry(
    type: "interaction" | "learning" | "context" | "result",
    content: any,
    importance: number = 0.5,
    tags: string[] = []
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: this.generateEntryId(),
      timestamp: Date.now(),
      type,
      content,
      importance,
      tags,
    };

    this.addToShortTermMemory(entry);
    return entry;
  }
}
