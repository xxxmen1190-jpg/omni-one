import {
  ExecutionPlanV2,
  CognitiveLayerConfig,
  CognitiveLayerEvent,
  CognitiveLayerEventListener,
  CognitiveLayerEventType,
} from "../../types/cognitiveLayer";
import { Intent } from "../../types";
import { TaskGraphEngine } from "./TaskGraphEngine";
import { AdvancedOmniPlanner } from "./AdvancedOmniPlanner";
import { ExecutionSupervisor } from "./ExecutionSupervisor";
import { ContextLayerManager } from "./ContextLayer";
import { CostPerformanceOptimizer } from "./CostPerformanceOptimizer";
import { ToolManager } from "../tools/ToolManager";
import { Logger } from "../system/Logger";

/**
 * Cognitive Layer Orchestrator - Unified interface for the entire cognitive layer
 * Coordinates task graph creation, planning, execution, and optimization
 */

export class CognitiveLayerOrchestrator {
  private taskGraphEngine: TaskGraphEngine;
  private planner: AdvancedOmniPlanner;
  private supervisor: ExecutionSupervisor;
  private contextManager: ContextLayerManager;
  private optimizer: CostPerformanceOptimizer;
  private config: CognitiveLayerConfig;

  private eventListeners: Map<CognitiveLayerEventType, CognitiveLayerEventListener[]> =
    new Map();

  constructor(
    toolManager: ToolManager,
    config: Partial<CognitiveLayerConfig> = {}
  ) {
    this.taskGraphEngine = new TaskGraphEngine();
    this.planner = new AdvancedOmniPlanner(this.taskGraphEngine);
    this.supervisor = new ExecutionSupervisor(
      this.taskGraphEngine,
      this.planner,
      toolManager,
      config.supervisorConfig
    );
    this.contextManager = new ContextLayerManager();
    this.optimizer = new CostPerformanceOptimizer();

    this.config = {
      taskGraphConfig: config.taskGraphConfig || {
        maxNodes: 1000,
        maxDependencies: 5000,
        enableCycleDetection: true,
      },
      plannerConfig: config.plannerConfig || {
        decompositionDepth: 5,
        maxSubgoals: 20,
        enableMemoization: true,
      },
      supervisorConfig: config.supervisorConfig || {
        maxConcurrentTasks: 5,
        maxRetries: 3,
        timeoutMs: 30000,
        costBudget: 100,
        enableDynamicReplanning: true,
        monitoringInterval: 1000,
        rePlanningThreshold: 0.3,
      },
      optimizerConfig: config.optimizerConfig || {
        optimizeFor: "balanced",
        maxParallelTasks: 5,
        enableCaching: true,
        enableBatching: true,
      },
      contextConfig: config.contextConfig || {
        maxContextSize: 1000,
        enableContextPersistence: true,
        contextRetentionTime: 3600000,
      },
    };

    Logger.info("Cognitive Layer Orchestrator initialized", { config: this.config });
  }

  /**
   * Execute a goal end-to-end
   */
  async executeGoal(goal: string, intent: Intent): Promise<ExecutionPlanV2> {
    const executionId = this.generateExecutionId();
    Logger.info("Starting goal execution", { executionId, goal });

    try {
      // 1. Emit event: plan_created
      this.emitEvent({
        type: "plan_created",
        timestamp: Date.now(),
        graphId: "",
        data: { goal, intent },
      });

      // 2. Create execution plan
      const plan = await this.planner.createPlan(goal, intent);
      Logger.info("Execution plan created", { executionId, planId: plan.id });

      // 3. Create context
      const context = this.contextManager.createContext(plan.taskGraph.id);
      this.contextManager.updateGlobalState(plan.taskGraph.id, {
        executionId,
        goal,
        intent,
        startTime: Date.now(),
      });

      // 4. Optimize plan
      const optimizedPlan = await this.planner.optimizePlan(
        plan,
        this.config.optimizerConfig
      );
      Logger.info("Execution plan optimized", { executionId, planId: optimizedPlan.id });

      this.emitEvent({
        type: "plan_optimized",
        timestamp: Date.now(),
        graphId: plan.taskGraph.id,
        data: { optimizations: optimizedPlan.optimizations },
      });

      // 5. Generate optimization report
      const optimizationReport = this.optimizer.generateOptimizationReport(
        optimizedPlan,
        this.config.optimizerConfig
      );
      Logger.info("Optimization report generated", { executionId, report: optimizationReport });

      // 6. Execute plan
      this.emitEvent({
        type: "execution_started",
        timestamp: Date.now(),
        graphId: plan.taskGraph.id,
        data: { planId: optimizedPlan.id },
      });

      const metrics = await this.supervisor.executePlan(optimizedPlan);

      // 7. Update context with final state
      this.contextManager.updateGlobalState(plan.taskGraph.id, {
        endTime: Date.now(),
        metrics,
        optimizationReport,
      });

      this.contextManager.takeSnapshot(plan.taskGraph.id, metrics);

      this.emitEvent({
        type: "execution_completed",
        timestamp: Date.now(),
        graphId: plan.taskGraph.id,
        data: { metrics },
      });

      Logger.info("Goal execution completed", { executionId, metrics });

      return optimizedPlan;
    } catch (error: any) {
      Logger.error("Goal execution failed", { executionId, error: error.message });

      this.emitEvent({
        type: "execution_failed",
        timestamp: Date.now(),
        graphId: "",
        data: { error: error.message },
      });

      throw error;
    }
  }

  /**
   * Create a custom task graph
   */
  createTaskGraph(name: string, description: string): string {
    const graphId = `graph-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.taskGraphEngine.createGraph(graphId, name, description);
    this.contextManager.createContext(graphId);

    Logger.info("Task graph created", { graphId, name });
    return graphId;
  }

  /**
   * Add task to graph
   */
  addTaskToGraph(
    graphId: string,
    taskId: string,
    name: string,
    description: string,
    intent: Intent,
    options?: any
  ): void {
    this.taskGraphEngine.addTask(graphId, taskId, name, description, intent, options);
    Logger.debug("Task added to graph", { graphId, taskId });
  }

  /**
   * Add dependency between tasks
   */
  addDependency(
    graphId: string,
    sourceTaskId: string,
    targetTaskId: string,
    type: "sequential" | "parallel" | "conditional" = "sequential"
  ): void {
    this.taskGraphEngine.addDependency(graphId, sourceTaskId, targetTaskId, type);
    Logger.debug("Dependency added", { graphId, sourceTaskId, targetTaskId });
  }

  /**
   * Execute custom task graph
   */
  async executeTaskGraph(graphId: string): Promise<ExecutionPlanV2> {
    const graph = this.taskGraphEngine.getGraph(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    // Create a plan from the graph
    const plan: ExecutionPlanV2 = {
      id: `plan-${Date.now()}`,
      goal: graph.description,
      taskGraph: graph,
      executionOrder: this.taskGraphEngine.resolveExecutionOrder(graphId),
      estimatedTime: 0,
      estimatedCost: 0,
      confidence: 1.0,
      reasoning: "Custom task graph execution",
      optimizations: [],
    };

    // Execute the plan
    const metrics = await this.supervisor.executePlan(plan);

    Logger.info("Task graph execution completed", { graphId, metrics });

    return plan;
  }

  /**
   * Get execution status
   */
  getExecutionStatus(graphId: string): Record<string, any> {
    const context = this.contextManager.getContext(graphId);
    if (!context) {
      throw new Error(`Context ${graphId} not found`);
    }

    const stats = this.contextManager.getContextStats(graphId);
    const snapshots = this.contextManager.getSnapshots(graphId);
    const latestSnapshot = this.contextManager.getLatestSnapshot(graphId);

    return {
      graphId,
      stats,
      latestSnapshot,
      snapshotCount: snapshots.length,
      globalState: context.globalState,
    };
  }

  /**
   * Get execution history
   */
  getExecutionHistory(graphId: string): any[] {
    const snapshots = this.contextManager.getSnapshots(graphId);
    return snapshots.map((snapshot) => ({
      timestamp: snapshot.timestamp,
      metrics: snapshot.metrics,
      taskStates: snapshot.taskStates,
    }));
  }

  /**
   * Cancel execution
   */
  cancelExecution(graphId: string): void {
    this.supervisor.cancelExecution(graphId);
    Logger.info("Execution cancelled", { graphId });
  }

  /**
   * Register event listener
   */
  addEventListener(
    eventType: CognitiveLayerEventType,
    listener: CognitiveLayerEventListener
  ): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }

    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(
    eventType: CognitiveLayerEventType,
    listener: CognitiveLayerEventListener
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private emitEvent(event: CognitiveLayerEvent): void {
    const listeners = this.eventListeners.get(event.type) || [];

    for (const listener of listeners) {
      try {
        const result = listener(event);
        if (result instanceof Promise) {
          result.catch((error) => {
            Logger.error("Event listener error", { error: error.message });
          });
        }
      } catch (error: any) {
        Logger.error("Event listener error", { error: error.message });
      }
    }
  }

  /**
   * Get cognitive layer stats
   */
  getStats(): Record<string, any> {
    return {
      contexts: this.contextManager.getAllContexts().length,
      graphs: this.taskGraphEngine.getAllGraphs().length,
      config: this.config,
    };
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    this.contextManager.cleanup();
    Logger.info("Cognitive layer cleanup completed");
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const createCognitiveLayerOrchestrator = (
  toolManager: ToolManager,
  config?: Partial<CognitiveLayerConfig>
): CognitiveLayerOrchestrator => {
  return new CognitiveLayerOrchestrator(toolManager, config);
};
