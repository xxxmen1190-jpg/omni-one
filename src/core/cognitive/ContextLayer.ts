import {
  ContextLayer,
  ContextSnapshot,
  TaskExecutionContext,
  ExecutionMetrics,
  TaskStatus,
} from "../../types/cognitiveLayer";
import { Logger } from "../system/Logger";

/**
 * Context Layer - Manages execution context, state, and memory
 */

export class ContextLayerManager {
  private contexts: Map<string, ContextLayer> = new Map();
  private snapshots: Map<string, ContextSnapshot[]> = new Map();
  private maxContextSize: number = 1000;
  private contextRetentionTime: number = 3600000; // 1 hour

  /**
   * Create a new context
   */
  createContext(graphId: string): ContextLayer {
    const context: ContextLayer = {
      graphId,
      globalState: {},
      taskContexts: new Map(),
      sharedMemory: new Map(),
      conversationHistory: [],
      environmentVariables: process.env as Record<string, string>,
      timestamp: Date.now(),
    };

    this.contexts.set(graphId, context);
    this.snapshots.set(graphId, []);

    Logger.info("Context created", { graphId });
    return context;
  }

  /**
   * Get context
   */
  getContext(graphId: string): ContextLayer | undefined {
    return this.contexts.get(graphId);
  }

  /**
   * Update global state
   */
  updateGlobalState(graphId: string, updates: Record<string, any>): void {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    context.globalState = {
      ...context.globalState,
      ...updates,
    };

    Logger.debug("Global state updated", { graphId });
  }

  /**
   * Get global state
   */
  getGlobalState(graphId: string): Record<string, any> {
    const context = this.contexts.get(graphId);
    return context?.globalState || {};
  }

  /**
   * Add task context
   */
  addTaskContext(graphId: string, taskContext: TaskExecutionContext): void {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    context.taskContexts.set(taskContext.taskId, taskContext);

    // Enforce max context size
    if (context.taskContexts.size > this.maxContextSize) {
      const firstKey = context.taskContexts.keys().next().value;
      context.taskContexts.delete(firstKey!);
    }

    Logger.debug("Task context added", { graphId, taskId: taskContext.taskId });
  }

  /**
   * Get task context
   */
  getTaskContext(graphId: string, taskId: string): TaskExecutionContext | undefined {
    const context = this.contexts.get(graphId);
    return context?.taskContexts.get(taskId);
  }

  /**
   * Update task context
   */
  updateTaskContext(
    graphId: string,
    taskId: string,
    updates: Partial<TaskExecutionContext>
  ): void {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    const taskContext = context.taskContexts.get(taskId);
    if (!taskContext) {
      throw new Error(`Task context ${taskId} not found`);
    }

    Object.assign(taskContext, updates);
    Logger.debug("Task context updated", { graphId, taskId });
  }

  /**
   * Add to shared memory
   */
  setSharedMemory(graphId: string, key: string, value: any): void {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    context.sharedMemory.set(key, {
      value,
      timestamp: Date.now(),
    });

    Logger.debug("Shared memory updated", { graphId, key });
  }

  /**
   * Get from shared memory
   */
  getSharedMemory(graphId: string, key: string): any {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    const entry = context.sharedMemory.get(key);
    return entry?.value;
  }

  /**
   * Add conversation entry
   */
  addConversationEntry(graphId: string, role: string, content: string): void {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    context.conversationHistory.push({
      role,
      content,
    });

    Logger.debug("Conversation entry added", { graphId, role });
  }

  /**
   * Get conversation history
   */
  getConversationHistory(graphId: string, limit?: number): Array<{ role: string; content: string }> {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    if (limit) {
      return context.conversationHistory.slice(-limit);
    }

    return context.conversationHistory;
  }

  /**
   * Take context snapshot
   */
  takeSnapshot(graphId: string, metrics: ExecutionMetrics): ContextSnapshot {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    const taskStates: Record<string, TaskStatus> = {};
    context.taskContexts.forEach((taskContext, taskId) => {
      taskStates[taskId] = taskContext.status;
    });

    const sharedMemorySnapshot: Record<string, any> = {};
    context.sharedMemory.forEach((entry, key) => {
      sharedMemorySnapshot[key] = entry.value;
    });

    const snapshot: ContextSnapshot = {
      timestamp: Date.now(),
      globalState: { ...context.globalState },
      taskStates,
      sharedMemory: sharedMemorySnapshot,
      metrics,
    };

    const snapshots = this.snapshots.get(graphId) || [];
    snapshots.push(snapshot);
    this.snapshots.set(graphId, snapshots);

    Logger.debug("Context snapshot taken", { graphId });
    return snapshot;
  }

  /**
   * Get context snapshots
   */
  getSnapshots(graphId: string): ContextSnapshot[] {
    return this.snapshots.get(graphId) || [];
  }

  /**
   * Get latest snapshot
   */
  getLatestSnapshot(graphId: string): ContextSnapshot | undefined {
    const snapshots = this.snapshots.get(graphId) || [];
    return snapshots[snapshots.length - 1];
  }

  /**
   * Restore context from snapshot
   */
  restoreFromSnapshot(graphId: string, snapshot: ContextSnapshot): void {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    context.globalState = snapshot.globalState;
    context.timestamp = snapshot.timestamp;

    Logger.info("Context restored from snapshot", { graphId });
  }

  /**
   * Clear context
   */
  clearContext(graphId: string): void {
    this.contexts.delete(graphId);
    this.snapshots.delete(graphId);
    Logger.info("Context cleared", { graphId });
  }

  /**
   * Get context statistics
   */
  getContextStats(graphId: string): Record<string, any> {
    const context = this.contexts.get(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    const taskStatuses: Record<TaskStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
      cancelled: 0,
    };

    context.taskContexts.forEach((taskContext) => {
      taskStatuses[taskContext.status]++;
    });

    return {
      graphId,
      taskCount: context.taskContexts.size,
      taskStatuses,
      sharedMemorySize: context.sharedMemory.size,
      conversationLength: context.conversationHistory.length,
      snapshotCount: this.snapshots.get(graphId)?.length || 0,
      createdAt: context.timestamp,
      uptime: Date.now() - context.timestamp,
    };
  }

  /**
   * Cleanup old contexts
   */
  cleanup(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.contexts.forEach((context, graphId) => {
      if (now - context.timestamp > this.contextRetentionTime) {
        toDelete.push(graphId);
      }
    });

    toDelete.forEach((graphId) => {
      this.clearContext(graphId);
    });

    if (toDelete.length > 0) {
      Logger.info("Cleaned up old contexts", { count: toDelete.length });
    }
  }

  /**
   * Get all contexts
   */
  getAllContexts(): ContextLayer[] {
    return Array.from(this.contexts.values());
  }
}

export const contextLayerManager = new ContextLayerManager();
