import {
  ExecutionPlanV2,
  PlanDecomposition,
  OptimizationStrategy,
  OptimizerConfig,
} from "../../types/cognitiveLayer";
import { Intent } from "../../types";
import { TaskGraphEngine } from "./TaskGraphEngine";
import { Logger } from "../system/Logger";

/**
 * Advanced Omni Planner - Intelligent planning with decomposition,
 * optimization, and strategy selection
 */

export class AdvancedOmniPlanner {
  private taskGraphEngine: TaskGraphEngine;
  private planCache: Map<string, ExecutionPlanV2> = new Map();
  private decompositionStrategies = [
    "hierarchical",
    "sequential",
    "parallel",
    "hybrid",
  ];

  constructor(taskGraphEngine: TaskGraphEngine) {
    this.taskGraphEngine = taskGraphEngine;
  }

  /**
   * Create an execution plan from a goal
   */
  async createPlan(goal: string, intent: Intent): Promise<ExecutionPlanV2> {
    const planId = this.generatePlanId();
    Logger.info("Creating execution plan", { planId, goal });

    try {
      // 1. Decompose goal into subgoals
      const decomposition = await this.decomposeGoal(goal, intent);

      // 2. Create task graph
      const graphId = `graph-${planId}`;
      const graph = this.taskGraphEngine.createGraph(graphId, `Plan ${planId}`, goal);

      // 3. Add tasks from decomposition
      const taskMapping = new Map<string, string>();
      for (let i = 0; i < decomposition.subgoals.length; i++) {
        const subgoal = decomposition.subgoals[i];
        const taskId = `task-${i}`;

        this.taskGraphEngine.addTask(graphId, taskId, `Task ${i}`, subgoal, intent, {
          priority: this.calculateTaskPriority(i, decomposition.subgoals.length),
          estimatedDuration: this.estimateTaskDuration(subgoal),
          tags: [decomposition.decompositionStrategy],
        });

        taskMapping.set(subgoal, taskId);
      }

      // 4. Add dependencies based on strategy
      this.addDependenciesForStrategy(
        graphId,
        decomposition.decompositionStrategy,
        decomposition.subgoals
      );

      // 5. Resolve execution order
      const executionOrder = this.taskGraphEngine.resolveExecutionOrder(graphId);

      // 6. Calculate metrics
      const estimatedTime = this.calculateEstimatedTime(graphId, executionOrder);
      const estimatedCost = this.calculateEstimatedCost(graphId);

      const plan: ExecutionPlanV2 = {
        id: planId,
        goal,
        taskGraph: graph,
        executionOrder,
        estimatedTime,
        estimatedCost,
        confidence: intent.confidence,
        reasoning: `Plan created using ${decomposition.decompositionStrategy} decomposition with ${decomposition.subgoals.length} subgoals`,
        optimizations: [],
      };

      // 7. Cache the plan
      this.planCache.set(planId, plan);

      Logger.info("Execution plan created", {
        planId,
        subgoals: decomposition.subgoals.length,
        phases: executionOrder.length,
        estimatedTime,
        estimatedCost,
      });

      return plan;
    } catch (error: any) {
      Logger.error("Failed to create execution plan", { error: error.message });
      throw error;
    }
  }

  /**
   * Optimize an execution plan
   */
  async optimizePlan(
    plan: ExecutionPlanV2,
    config: OptimizerConfig
  ): Promise<ExecutionPlanV2> {
    Logger.info("Optimizing execution plan", { planId: plan.id });

    const optimizedPlan = { ...plan };
    const optimizations: string[] = [];

    try {
      // 1. Analyze current plan
      const stats = this.taskGraphEngine.getGraphStats(plan.taskGraph.id);

      // 2. Generate optimization strategies
      const strategies = this.generateOptimizationStrategies(plan, config, stats);

      // 3. Apply optimizations
      for (const strategy of strategies) {
        if (strategy.applicability > 0.5) {
          // Only apply if applicable
          await this.applyOptimization(optimizedPlan, strategy);
          optimizations.push(strategy.name);
        }
      }

      // 4. Re-resolve execution order
      optimizedPlan.executionOrder = this.taskGraphEngine.resolveExecutionOrder(
        plan.taskGraph.id
      );

      // 5. Recalculate metrics
      optimizedPlan.estimatedTime = this.calculateEstimatedTime(
        plan.taskGraph.id,
        optimizedPlan.executionOrder
      );
      optimizedPlan.estimatedCost = this.calculateEstimatedCost(plan.taskGraph.id);
      optimizedPlan.optimizations = optimizations;

      Logger.info("Execution plan optimized", {
        planId: plan.id,
        optimizations: optimizations.length,
        newEstimatedTime: optimizedPlan.estimatedTime,
        newEstimatedCost: optimizedPlan.estimatedCost,
      });

      return optimizedPlan;
    } catch (error: any) {
      Logger.error("Failed to optimize plan", { error: error.message });
      return plan; // Return original plan if optimization fails
    }
  }

  /**
   * Decompose a goal into subgoals
   */
  private async decomposeGoal(
    goal: string,
    intent: Intent
  ): Promise<PlanDecomposition> {
    const strategy = this.selectDecompositionStrategy(intent);
    const subgoals = this.generateSubgoals(goal, intent, strategy);

    return {
      originalGoal: goal,
      subgoals,
      taskMapping: new Map(),
      decompositionStrategy: strategy as any,
      complexity: subgoals.length,
    };
  }

  /**
   * Select decomposition strategy based on intent
   */
  private selectDecompositionStrategy(intent: Intent): string {
    switch (intent.type) {
      case "code":
      case "reasoning":
        return "hierarchical"; // Complex tasks need hierarchical breakdown
      case "search":
      case "image":
        return "parallel"; // Can be parallelized
      case "documents":
      case "summarize":
        return "sequential"; // Must be done in order
      default:
        return "hybrid"; // Mix of strategies
    }
  }

  /**
   * Generate subgoals from a goal
   */
  private generateSubgoals(
    goal: string,
    intent: Intent,
    strategy: string
  ): string[] {
    const subgoals: string[] = [];

    switch (intent.type) {
      case "code":
        subgoals.push(
          `Analyze requirements: ${goal}`,
          `Design architecture`,
          `Generate code`,
          `Analyze generated code`,
          `Provide explanation`
        );
        break;

      case "search":
        subgoals.push(
          `Formulate search query: ${goal}`,
          `Execute search`,
          `Aggregate results`,
          `Summarize findings`
        );
        break;

      case "image":
        subgoals.push(`Generate image: ${goal}`, `Validate image quality`);
        break;

      case "documents":
        subgoals.push(
          `Fetch document: ${goal}`,
          `Extract content`,
          `Process data`,
          `Format output`
        );
        break;

      case "summarize":
        subgoals.push(
          `Extract key points: ${goal}`,
          `Organize summary`,
          `Generate final summary`
        );
        break;

      case "translate":
        subgoals.push(
          `Analyze source text: ${goal}`,
          `Translate content`,
          `Validate translation`
        );
        break;

      case "reasoning":
        subgoals.push(
          `Understand problem: ${goal}`,
          `Analyze components`,
          `Synthesize solution`,
          `Validate reasoning`
        );
        break;

      default:
        subgoals.push(goal);
    }

    return subgoals;
  }

  /**
   * Add dependencies based on strategy
   */
  private addDependenciesForStrategy(
    graphId: string,
    strategy: string,
    subgoals: string[]
  ): void {
    const graph = this.taskGraphEngine.getGraph(graphId);
    if (!graph) return;

    const tasks = Array.from(graph.nodes.keys());

    switch (strategy) {
      case "sequential":
        // Chain all tasks
        for (let i = 0; i < tasks.length - 1; i++) {
          this.taskGraphEngine.addDependency(graphId, tasks[i], tasks[i + 1], "sequential");
        }
        break;

      case "parallel":
        // No dependencies (all can run in parallel)
        break;

      case "hierarchical":
        // Create a tree structure
        for (let i = 1; i < tasks.length; i++) {
          const parentIndex = Math.floor((i - 1) / 2);
          this.taskGraphEngine.addDependency(
            graphId,
            tasks[parentIndex],
            tasks[i],
            "sequential"
          );
        }
        break;

      case "hybrid":
        // Mix of sequential and parallel
        // First task is a prerequisite for all others
        for (let i = 1; i < tasks.length; i++) {
          this.taskGraphEngine.addDependency(graphId, tasks[0], tasks[i], "sequential");
        }
        // Chain the rest
        for (let i = 1; i < tasks.length - 1; i++) {
          this.taskGraphEngine.addDependency(graphId, tasks[i], tasks[i + 1], "sequential");
        }
        break;
    }
  }

  /**
   * Calculate task priority
   */
  private calculateTaskPriority(
    index: number,
    totalTasks: number
  ): "low" | "medium" | "high" | "critical" {
    if (index === 0) return "critical"; // First task is critical
    if (index === totalTasks - 1) return "high"; // Last task is high priority
    return "medium";
  }

  /**
   * Estimate task duration
   */
  private estimateTaskDuration(subgoal: string): number {
    // Simple heuristic: longer goals take longer
    const baseTime = 2000; // 2 seconds
    const complexity = subgoal.length / 10; // Rough complexity estimate
    return baseTime + complexity * 500;
  }

  /**
   * Calculate total estimated time
   */
  private calculateEstimatedTime(graphId: string, executionOrder: string[][]): number {
    const graph = this.taskGraphEngine.getGraph(graphId);
    if (!graph) return 0;

    let totalTime = 0;

    for (const phase of executionOrder) {
      let maxPhaseTime = 0;

      for (const taskId of phase) {
        const task = graph.nodes.get(taskId);
        if (task) {
          maxPhaseTime = Math.max(maxPhaseTime, task.estimatedDuration);
        }
      }

      totalTime += maxPhaseTime;
    }

    return totalTime;
  }

  /**
   * Calculate estimated cost
   */
  private calculateEstimatedCost(graphId: string): number {
    const graph = this.taskGraphEngine.getGraph(graphId);
    if (!graph) return 0;

    // Simple cost model: $0.001 per task
    return graph.nodes.size * 0.001;
  }

  /**
   * Generate optimization strategies
   */
  private generateOptimizationStrategies(
    plan: ExecutionPlanV2,
    config: OptimizerConfig,
    stats: Record<string, any>
  ): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];

    // Strategy 1: Increase parallelism
    if (stats.executionPhases > 1) {
      strategies.push({
        name: "Increase Parallelism",
        description: "Reduce sequential dependencies to enable more parallel execution",
        potentialSavings: {
          time: plan.estimatedTime * 0.2,
          cost: 0,
        },
        riskLevel: "low",
        applicability: 0.7,
      });
    }

    // Strategy 2: Cache results
    if (config.enableCaching) {
      strategies.push({
        name: "Enable Result Caching",
        description: "Cache intermediate results to avoid redundant computations",
        potentialSavings: {
          time: plan.estimatedTime * 0.1,
          cost: plan.estimatedCost * 0.15,
        },
        riskLevel: "low",
        applicability: 0.6,
      });
    }

    // Strategy 3: Batch operations
    if (config.enableBatching && stats.nodeCount > 5) {
      strategies.push({
        name: "Batch Operations",
        description: "Combine multiple small tasks into batch operations",
        potentialSavings: {
          time: plan.estimatedTime * 0.15,
          cost: plan.estimatedCost * 0.2,
        },
        riskLevel: "medium",
        applicability: 0.5,
      });
    }

    // Strategy 4: Prioritize critical path
    if (stats.criticalPathLength > 0) {
      strategies.push({
        name: "Prioritize Critical Path",
        description: "Allocate more resources to critical path tasks",
        potentialSavings: {
          time: plan.estimatedTime * 0.1,
          cost: plan.estimatedCost * 0.05,
        },
        riskLevel: "low",
        applicability: 0.8,
      });
    }

    return strategies;
  }

  /**
   * Apply an optimization
   */
  private async applyOptimization(
    plan: ExecutionPlanV2,
    strategy: OptimizationStrategy
  ): Promise<void> {
    // Implementation depends on the specific optimization
    Logger.debug("Applying optimization", { strategy: strategy.name });

    // This would involve modifying the task graph based on the strategy
    // For now, we just log it
  }

  /**
   * Validate a plan
   */
  validatePlan(plan: ExecutionPlanV2): boolean {
    try {
      // Check that all tasks in execution order exist in the graph
      const allTasks = new Set(plan.taskGraph.nodes.keys());

      for (const phase of plan.executionOrder) {
        for (const taskId of phase) {
          if (!allTasks.has(taskId)) {
            Logger.warn("Task not found in graph", { taskId });
            return false;
          }
        }
      }

      // Check that all tasks are covered in execution order
      const coveredTasks = new Set<string>();
      for (const phase of plan.executionOrder) {
        phase.forEach((taskId) => coveredTasks.add(taskId));
      }

      if (coveredTasks.size !== allTasks.size) {
        Logger.warn("Not all tasks are in execution order");
        return false;
      }

      return true;
    } catch (error: any) {
      Logger.error("Plan validation failed", { error: error.message });
      return false;
    }
  }

  /**
   * Get a cached plan
   */
  getCachedPlan(planId: string): ExecutionPlanV2 | undefined {
    return this.planCache.get(planId);
  }

  /**
   * Clear plan cache
   */
  clearCache(): void {
    this.planCache.clear();
  }

  /**
   * Generate unique plan ID
   */
  private generatePlanId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
