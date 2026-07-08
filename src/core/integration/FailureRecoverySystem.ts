import {
  FailureRecoveryContext,
  RecoveryStrategy,
  ExecutionStage,
} from "../../types/integration";
import { Logger } from "../system/Logger";

/**
 * Failure Recovery System - Handles failures gracefully with fallback strategies
 * Ensures system always returns a response
 */

export class FailureRecoverySystem {
  private recoveryStrategies: Map<ExecutionStage, RecoveryStrategy[]> = new Map();
  private recoveryHistory: Array<{
    timestamp: number;
    stage: ExecutionStage;
    error: string;
    recovery: RecoveryStrategy;
    success: boolean;
  }> = [];

  constructor() {
    this.initializeStrategies();
    Logger.info("FailureRecoverySystem initialized");
  }

  /**
   * Initialize recovery strategies
   */
  private initializeStrategies(): void {
    // Input processing failures
    this.recoveryStrategies.set("input_processing", [
      {
        level: 1,
        attempts: 0,
        maxAttempts: 2,
        backoffMs: 100,
      },
      {
        level: 2,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 500,
      },
    ]);

    // Query understanding failures
    this.recoveryStrategies.set("query_understanding", [
      {
        level: 1,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 200,
      },
      {
        level: 2,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 500,
      },
    ]);

    // Planning failures
    this.recoveryStrategies.set("planning", [
      {
        level: 1,
        attempts: 0,
        maxAttempts: 2,
        backoffMs: 300,
      },
      {
        level: 2,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 500,
      },
      {
        level: 3,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 0,
      },
    ]);

    // Knowledge retrieval failures
    this.recoveryStrategies.set("knowledge_retrieval", [
      {
        level: 1,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 200,
      },
      {
        level: 2,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 500,
      },
    ]);

    // Memory injection failures
    this.recoveryStrategies.set("memory_injection", [
      {
        level: 1,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 100,
      },
      {
        level: 2,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 500,
      },
    ]);

    // Execution failures
    this.recoveryStrategies.set("execution", [
      {
        level: 1,
        attempts: 0,
        maxAttempts: 2,
        backoffMs: 500,
      },
      {
        level: 2,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 1000,
      },
      {
        level: 3,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 0,
      },
    ]);

    // Response generation failures
    this.recoveryStrategies.set("response_generation", [
      {
        level: 1,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 200,
      },
      {
        level: 2,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 500,
      },
      {
        level: 3,
        attempts: 0,
        maxAttempts: 1,
        backoffMs: 0,
      },
    ]);
  }

  /**
   * Create recovery context
   */
  createRecoveryContext(
    error: Error,
    stage: ExecutionStage
  ): FailureRecoveryContext {
    const strategies = this.recoveryStrategies.get(stage) || [];

    return {
      originalError: error,
      failedStage: stage,
      recoveryStrategies: strategies,
      attemptedRecoveries: [],
    };
  }

  /**
   * Get next recovery strategy
   */
  getNextRecoveryStrategy(context: FailureRecoveryContext): RecoveryStrategy | null {
    for (const strategy of context.recoveryStrategies) {
      if (strategy.attempts < strategy.maxAttempts) {
        return strategy;
      }
    }

    return null;
  }

  /**
   * Execute recovery (Static helper for easy integration)
   */
  static async executeRecovery<T>(
    operation: () => Promise<T>,
    stage: ExecutionStage = "execution"
  ): Promise<T> {
    const system = new FailureRecoverySystem();
    const context = system.createRecoveryContext(new Error("Initial attempt"), stage);
    
    try {
      return await operation();
    } catch (error: any) {
      context.originalError = error;
      let strategy = system.getNextRecoveryStrategy(context);
      
      while (strategy) {
        const recoveryResult = await system.executeRecovery(context, strategy, async () => {
          return await operation();
        });
        
        if (recoveryResult.success) {
          return recoveryResult.result;
        }
        
        strategy = system.getNextRecoveryStrategy(context);
      }
      
      throw error;
    }
  }

  /**
   * Execute recovery (Instance method)
   */
  async executeRecovery(
    context: FailureRecoveryContext,
    strategy: RecoveryStrategy,
    executor: (level: number) => Promise<any>
  ): Promise<{ success: boolean; result?: any; error?: Error }> {
    try {
      // Wait for backoff
      if (strategy.backoffMs > 0) {
        await this.sleep(strategy.backoffMs);
      }

      Logger.info("Attempting recovery", {
        stage: context.failedStage,
        level: strategy.level,
        attempt: strategy.attempts + 1,
      });

      // Execute recovery
      const result = await executor(strategy.level);

      strategy.attempts++;

      // Record success
      this.recordRecovery(context.failedStage, context.originalError, strategy, true);

      Logger.info("Recovery successful", {
        stage: context.failedStage,
        level: strategy.level,
      });

      return { success: true, result };
    } catch (error: any) {
      strategy.attempts++;

      // Record failure
      this.recordRecovery(context.failedStage, context.originalError, strategy, false);

      Logger.warn("Recovery failed", {
        stage: context.failedStage,
        level: strategy.level,
        error: error.message,
      });

      return { success: false, error };
    }
  }

  /**
   * Get fallback response
   */
  getFallbackResponse(stage: ExecutionStage, error: Error): string {
    const fallbackResponses: Record<ExecutionStage, string> = {
      input_processing: "I couldn't process your input. Please try again with a clearer message.",
      query_understanding: "I had trouble understanding your query. Could you rephrase it?",
      planning: "I couldn't plan a response. Let me try a simpler approach.",
      knowledge_retrieval: "I couldn't retrieve relevant information. Let me work with what I know.",
      memory_injection: "I had trouble accessing your preferences. I'll continue without them.",
      execution: "I encountered an issue executing the plan. Let me try a different approach.",
      response_generation: "I had trouble generating a response. Here's what I found instead.",
      complete: "I encountered an unexpected issue. Please try again.",
    };

    return fallbackResponses[stage] || "I encountered an error. Please try again.";
  }

  /**
   * Record recovery
   */
  private recordRecovery(
    stage: ExecutionStage,
    error: Error,
    strategy: RecoveryStrategy,
    success: boolean
  ): void {
    this.recoveryHistory.push({
      timestamp: Date.now(),
      stage,
      error: error.message,
      recovery: strategy,
      success,
    });

    // Keep only last 1000 entries
    if (this.recoveryHistory.length > 1000) {
      this.recoveryHistory = this.recoveryHistory.slice(-500);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics
   */
  getStatistics(): Record<string, any> {
    const successCount = this.recoveryHistory.filter((r) => r.success).length;
    const failureCount = this.recoveryHistory.filter((r) => !r.success).length;

    const stageStats: Record<string, any> = {};
    for (const entry of this.recoveryHistory) {
      if (!stageStats[entry.stage]) {
        stageStats[entry.stage] = { success: 0, failure: 0 };
      }

      if (entry.success) {
        stageStats[entry.stage].success++;
      } else {
        stageStats[entry.stage].failure++;
      }
    }

    return {
      totalAttempts: this.recoveryHistory.length,
      successCount,
      failureCount,
      successRate: this.recoveryHistory.length > 0 ? successCount / this.recoveryHistory.length : 0,
      stageStats,
    };
  }

  /**
   * Get recovery history
   */
  getRecoveryHistory(limit: number = 100): typeof this.recoveryHistory {
    return this.recoveryHistory.slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.recoveryHistory = [];
    Logger.info("Recovery history cleared");
  }
}

export const createFailureRecoverySystem = (): FailureRecoverySystem => {
  return new FailureRecoverySystem();
};
