import {
  ExecutionPlanV2,
  TaskExecutionContext,
  ExecutionSnapshot,
  ExecutionMetrics,
  ExecutionSupervisorConfig,
  TaskStatus,
  RePlanningTrigger,
} from "../../types/cognitiveLayer";
import { TaskGraphEngine } from "./TaskGraphEngine";
import { AdvancedOmniPlanner } from "./AdvancedOmniPlanner";
import { ToolManager } from "../tools/ToolManager";
import { Logger } from "../system/Logger";

/**
 * Execution Supervisor - Manages plan execution, monitoring, and dynamic re-planning
 */

export class ExecutionSupervisor {
  private taskGraphEngine: TaskGraphEngine;
  private planner: AdvancedOmniPlanner;
  private toolManager: ToolManager;
  private config: ExecutionSupervisorConfig;

  private executingPlans: Map<string, ExecutionPlanV2> = new Map();
  private taskContexts: Map<string, TaskExecutionContext> = new Map();
  private executionSnapshots: Map<string, ExecutionSnapshot[]> = new Map();
  private metrics: Map<string, ExecutionMetrics> = new Map();

  constructor(
    taskGraphEngine: TaskGraphEngine,
    planner: AdvancedOmniPlanner,
    toolManager: ToolManager,
    config: Partial<ExecutionSupervisorConfig> = {}
  ) {
    this.taskGraphEngine = taskGraphEngine;
    this.planner = planner;
    this.toolManager = toolManager;

    this.config = {
      maxConcurrentTasks: config.maxConcurrentTasks || 5,
      maxRetries: config.maxRetries || 3,
      timeoutMs: config.timeoutMs || 30000,
      costBudget: config.costBudget || 100,
      enableDynamicReplanning: config.enableDynamicReplanning !== false,
      monitoringInterval: config.monitoringInterval || 1000,
      rePlanningThreshold: config.rePlanningThreshold || 0.3, // 30% failure rate
    };
  }

  /**
   * Execute a plan
   */
  async executePlan(plan: ExecutionPlanV2): Promise<ExecutionMetrics> {
    Logger.info("Starting plan execution", { planId: plan.id });

    this.executingPlans.set(plan.id, plan);
    this.executionSnapshots.set(plan.id, []);

    const metrics: ExecutionMetrics = {
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksSkipped: 0,
      totalDuration: 0,
      totalCost: 0,
      averageTaskDuration: 0,
      successRate: 0,
    };

    this.metrics.set(plan.id, metrics);

    const startTime = Date.now();

    try {
      // Execute phases sequentially
      for (let phaseIndex = 0; phaseIndex < plan.executionOrder.length; phaseIndex++) {
        const phase = plan.executionOrder[phaseIndex];
        Logger.info("Executing phase", { planId: plan.id, phase: phaseIndex + 1 });

        // Execute tasks in phase concurrently (up to maxConcurrentTasks)
        const results = await this.executePhase(plan.id, phase);

        // Check for failures and decide whether to re-plan
        const failedCount = results.filter((r) => !r.success).length;
        const failureRate = failedCount / phase.length;

        if (
          this.config.enableDynamicReplanning &&
          failureRate > this.config.rePlanningThreshold
        ) {
          Logger.warn("High failure rate detected, triggering re-planning", {
            planId: plan.id,
            failureRate,
          });

          const shouldReplan = await this.evaluateReplanning(plan, results);
          if (shouldReplan) {
            return await this.handleReplanning(plan, metrics, startTime);
          }
        }

        // Update metrics
        results.forEach((result) => {
          if (result.success) {
            metrics.tasksCompleted++;
          } else {
            metrics.tasksFailed++;
          }
        });

        // Take snapshot
        this.takeSnapshot(plan.id, metrics);
      }

      // Finalize execution
      metrics.totalDuration = Date.now() - startTime;
      metrics.averageTaskDuration =
        metrics.totalDuration / (metrics.tasksCompleted + metrics.tasksFailed);
      metrics.successRate =
        metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed);

      Logger.info("Plan execution completed", {
        planId: plan.id,
        metrics,
      });

      return metrics;
    } catch (error: any) {
      Logger.error("Plan execution failed", { planId: plan.id, error: error.message });
      throw error;
    } finally {
      this.executingPlans.delete(plan.id);
    }
  }

  /**
   * Execute a phase (multiple tasks in parallel)
   */
  private async executePhase(
    planId: string,
    taskIds: string[]
  ): Promise<Array<{ taskId: string; success: boolean; result?: any; error?: Error }>> {
    const plan = this.executingPlans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    const results: Array<{ taskId: string; success: boolean; result?: any; error?: Error }> = [];

    // Execute tasks concurrently (up to maxConcurrentTasks)
    const chunks = this.chunkArray(taskIds, this.config.maxConcurrentTasks);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map((taskId) =>
        this.executeTask(planId, taskId).catch((error) => ({
          taskId,
          success: false,
          error,
        }))
      );

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    planId: string,
    taskId: string
  ): Promise<{ taskId: string; success: boolean; result?: any; error?: Error }> {
    const plan = this.executingPlans.get(planId);
    if (!plan) {
      throw new Error(`Plan ${planId} not found`);
    }

    const task = plan.taskGraph.nodes.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const contextKey = `${planId}-${taskId}`;
    const context: TaskExecutionContext = {
      taskId,
      graphId: plan.taskGraph.id,
      startTime: Date.now(),
      status: "running",
      retryCount: 0,
      inputData: {},
      outputData: {},
      logs: [],
    };

    this.taskContexts.set(contextKey, context);

    try {
      // Update task status
      task.status = "running";

      // Execute with retries
      let lastError: Error | undefined;

      for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
        try {
          context.logs.push(`Attempt ${attempt + 1}/${this.config.maxRetries}`);

          // Execute the task using ToolManager
          const result = await this.toolManager.execute({
            toolId: this.mapIntentToTool(task.intent.type),
            input: {
              goal: task.description,
              ...task.intent.payload,
            },
            timeout: this.config.timeoutMs,
          });

          if (result.success) {
            context.outputData = result.result;
            context.status = "completed";
            task.status = "completed";
            context.endTime = Date.now();

            Logger.info("Task executed successfully", { taskId, planId });

            return { taskId, success: true, result: result.result };
          } else {
            lastError = new Error(result.error);
            context.logs.push(`Error: ${result.error}`);
          }
        } catch (error: any) {
          lastError = error;
          context.logs.push(`Exception: ${error.message}`);

          if (attempt < this.config.maxRetries - 1) {
            const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
            context.logs.push(`Retrying in ${delay}ms`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }

        context.retryCount = attempt + 1;
      }

      // All retries failed
      context.status = "failed";
      context.error = lastError;
      task.status = "failed";
      context.endTime = Date.now();

      Logger.error("Task execution failed after retries", {
        taskId,
        planId,
        error: lastError?.message,
      });

      return { taskId, success: false, error: lastError };
    } finally {
      this.taskContexts.set(contextKey, context);
    }
  }

  /**
   * Evaluate whether re-planning is necessary
   */
  private async evaluateReplanning(
    plan: ExecutionPlanV2,
    results: Array<{ taskId: string; success: boolean; result?: any; error?: Error }>
  ): Promise<boolean> {
    const failedTasks = results.filter((r) => !r.success);

    if (failedTasks.length === 0) {
      return false;
    }

    // Check if failures are recoverable
    const recoverableFailures = failedTasks.filter((f) => {
      const error = f.error?.message || "";
      return (
        error.includes("timeout") ||
        error.includes("rate limit") ||
        error.includes("temporary")
      );
    });

    // Re-plan if more than 50% of failures are non-recoverable
    const nonRecoverableRate = (failedTasks.length - recoverableFailures.length) / failedTasks.length;
    return nonRecoverableRate > 0.5;
  }

  /**
   * Handle re-planning
   */
  private async handleReplanning(
    originalPlan: ExecutionPlanV2,
    metrics: ExecutionMetrics,
    startTime: number
  ): Promise<ExecutionMetrics> {
    Logger.info("Initiating re-planning", { planId: originalPlan.id });

    try {
      // Create a new plan with adjusted strategy
      const newPlan = await this.planner.createPlan(
        originalPlan.goal,
        originalPlan.taskGraph.nodes.values().next().value?.intent ?? { type: "chat" as const, confidence: 0.5 }
      );

      // Optimize for speed since we're already behind
      const optimizedPlan = await this.planner.optimizePlan(newPlan, {
        optimizeFor: "speed",
        maxParallelTasks: this.config.maxConcurrentTasks,
        enableCaching: true,
        enableBatching: true,
      });

      // Execute the new plan
      const newMetrics = await this.executePlan(optimizedPlan);

      // Combine metrics
      metrics.tasksCompleted += newMetrics.tasksCompleted;
      metrics.tasksFailed += newMetrics.tasksFailed;
      metrics.totalDuration = Date.now() - startTime;
      metrics.averageTaskDuration =
        metrics.totalDuration / (metrics.tasksCompleted + metrics.tasksFailed);
      metrics.successRate =
        metrics.tasksCompleted / (metrics.tasksCompleted + metrics.tasksFailed);

      return metrics;
    } catch (error: any) {
      Logger.error("Re-planning failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Take execution snapshot
   */
  private takeSnapshot(planId: string, metrics: ExecutionMetrics): void {
    const snapshot: ExecutionSnapshot = {
      timestamp: Date.now(),
      graphId: "",
      completedTasks: new Set(),
      runningTasks: new Set(),
      failedTasks: new Set(),
      metrics,
      contextState: {},
    };

    const snapshots = this.executionSnapshots.get(planId) || [];
    snapshots.push(snapshot);
    this.executionSnapshots.set(planId, snapshots);
  }

  /**
   * Get execution snapshots
   */
  getExecutionSnapshots(planId: string): ExecutionSnapshot[] {
    return this.executionSnapshots.get(planId) || [];
  }

  /**
   * Get task context
   */
  getTaskContext(planId: string, taskId: string): TaskExecutionContext | undefined {
    return this.taskContexts.get(`${planId}-${taskId}`);
  }

  /**
   * Map intent type to tool ID
   */
  private mapIntentToTool(intentType: string): string {
    const mapping: Record<string, string> = {
      code: "code-generation",
      search: "http-request",
      image: "image-generation",
      vision: "image-recognition",
      documents: "document-processing",
      summarize: "text-processing",
      translate: "text-processing",
      browser: "browser-navigation",
      chat: "http-request",
      reasoning: "http-request",
    };

    return mapping[intentType] || "http-request";
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Get execution metrics
   */
  getMetrics(planId: string): ExecutionMetrics | undefined {
    return this.metrics.get(planId);
  }

  /**
   * Cancel execution
   */
  cancelExecution(planId: string): void {
    this.executingPlans.delete(planId);
    Logger.info("Plan execution cancelled", { planId });
  }
}
