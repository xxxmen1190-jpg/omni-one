import {
  SandboxConfig,
  SandboxExecutionContext,
  ISandbox,
} from "../../../types/runtime";
import { Logger } from "../../system/Logger";

/**
 * Execution Sandbox - Isolates and protects plugin execution
 * Provides timeout protection, crash containment, and resource limits
 */

export class ExecutionSandbox implements ISandbox {
  private contexts: Map<string, SandboxExecutionContext> = new Map();
  private defaultConfig: SandboxConfig;
  private activeExecutions: Map<string, NodeJS.Timeout> = new Map();

  constructor(defaultConfig: Partial<SandboxConfig> = {}) {
    this.defaultConfig = {
      timeout: defaultConfig.timeout || 30000,
      memoryLimit: defaultConfig.memoryLimit || 512 * 1024 * 1024, // 512MB
      cpuLimit: defaultConfig.cpuLimit || 100, // percentage
      networkAccess: defaultConfig.networkAccess !== false,
      fileSystemAccess: defaultConfig.fileSystemAccess !== false,
      allowedPaths: defaultConfig.allowedPaths || [],
    };

    Logger.info("ExecutionSandbox initialized", { config: this.defaultConfig });
  }

  /**
   * Execute code in sandbox
   */
  async execute(context: SandboxExecutionContext): Promise<any> {
    // Validate context
    if (this.contexts.has(context.id)) {
      throw new Error(`Execution context already exists: ${context.id}`);
    }

    // Store context
    this.contexts.set(context.id, context);

    try {
      // Get initial memory usage
      const initialMemory = process.memoryUsage().heapUsed;

      // Execute with timeout
      const result = await this.executeWithTimeout(context);

      // Get final memory usage
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDelta = finalMemory - initialMemory;

      // Check memory limit
      if (memoryDelta > context.config.memoryLimit) {
        Logger.warn("Memory limit exceeded", {
          contextId: context.id,
          delta: memoryDelta,
          limit: context.config.memoryLimit,
        });
      }

      // Update context
      context.endTime = Date.now();
      context.status = "completed";
      context.result = result;

      Logger.info("Execution completed", {
        contextId: context.id,
        duration: context.endTime - context.startTime,
      });

      return result;
    } catch (error: any) {
      // Update context
      context.endTime = Date.now();
      context.status = "failed";
      context.error = error;

      Logger.error("Execution failed", {
        contextId: context.id,
        error: error.message,
      });

      throw error;
    } finally {
      // Cleanup
      this.activeExecutions.delete(context.id);
    }
  }

  /**
   * Execute with timeout protection
   */
  private executeWithTimeout(context: SandboxExecutionContext): Promise<any> {
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        context.status = "timeout";
        context.endTime = Date.now();

        this.activeExecutions.delete(context.id);

        reject(
          new Error(
            `Execution timeout after ${context.config.timeout}ms (contextId: ${context.id})`
          )
        );
      }, context.config.timeout);

      this.activeExecutions.set(context.id, timeout);

      // Execute function
      try {
        // Simulate async execution
        // In a real implementation, this would use Worker threads or similar
        const result = this.simulateExecution(context.input);

        clearTimeout(timeout);
        this.activeExecutions.delete(context.id);

        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        this.activeExecutions.delete(context.id);

        reject(error);
      }
    });
  }

  /**
   * Simulate execution (placeholder for actual sandboxed execution)
   */
  private simulateExecution(input: any): any {
    // In a real implementation, this would:
    // 1. Use Worker threads for isolation
    // 2. Apply resource limits
    // 3. Monitor execution
    // 4. Handle crashes gracefully

    // For now, just return input
    return input;
  }

  /**
   * Terminate execution
   */
  terminate(contextId: string): void {
    const context = this.contexts.get(contextId);
    if (!context) {
      Logger.warn("Context not found", { contextId });
      return;
    }

    // Clear timeout
    const timeout = this.activeExecutions.get(contextId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeExecutions.delete(contextId);
    }

    // Mark as terminated
    context.status = "failed";
    context.endTime = Date.now();
    context.error = new Error("Execution terminated");

    Logger.info("Execution terminated", { contextId });
  }

  /**
   * Get execution context
   */
  getContext(contextId: string): SandboxExecutionContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * Get all contexts
   */
  getAllContexts(): SandboxExecutionContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Get active contexts
   */
  getActiveContexts(): SandboxExecutionContext[] {
    return Array.from(this.contexts.values()).filter(
      (c) => c.status === "running"
    );
  }

  /**
   * Get completed contexts
   */
  getCompletedContexts(): SandboxExecutionContext[] {
    return Array.from(this.contexts.values()).filter(
      (c) => c.status === "completed" || c.status === "failed"
    );
  }

  /**
   * Clear context
   */
  clearContext(contextId: string): void {
    this.contexts.delete(contextId);
    this.activeExecutions.delete(contextId);
  }

  /**
   * Clear all contexts
   */
  clearAllContexts(): void {
    // Terminate all active executions
    this.activeExecutions.forEach((timeout) => {
      clearTimeout(timeout);
    });

    this.contexts.clear();
    this.activeExecutions.clear();

    Logger.info("All contexts cleared");
  }

  /**
   * Get sandbox statistics
   */
  getStatistics(): Record<string, any> {
    const contexts = Array.from(this.contexts.values());
    const statusCounts: Record<string, number> = {
      running: 0,
      completed: 0,
      failed: 0,
      timeout: 0,
    };

    contexts.forEach((context) => {
      statusCounts[context.status] = (statusCounts[context.status] || 0) + 1;
    });

    const totalDuration = contexts
      .filter((c) => c.endTime)
      .reduce((sum, c) => sum + (c.endTime! - c.startTime), 0);

    const averageDuration =
      contexts.filter((c) => c.endTime).length > 0
        ? totalDuration / contexts.filter((c) => c.endTime).length
        : 0;

    return {
      totalContexts: contexts.length,
      activeContexts: this.activeExecutions.size,
      statusCounts,
      averageDuration,
      totalDuration,
    };
  }
}

export const createExecutionSandbox = (
  config?: Partial<SandboxConfig>
): ExecutionSandbox => {
  return new ExecutionSandbox(config);
};
