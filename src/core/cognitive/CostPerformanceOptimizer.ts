import {
  ExecutionPlanV2,
  CostMetrics,
  PerformanceMetrics,
  OptimizationStrategy,
  OptimizerConfig,
} from "../../types/cognitiveLayer";
import { Logger } from "../system/Logger";

/**
 * Cost and Performance Optimizer - Analyzes and optimizes plans
 * for cost efficiency and performance
 */

export class CostPerformanceOptimizer {
  private costMetrics: Map<string, CostMetrics> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();

  /**
   * Calculate cost metrics for a plan
   */
  calculateCostMetrics(plan: ExecutionPlanV2): CostMetrics {
    const costPerTask = new Map<string, number>();
    let totalCost = 0;
    const costPerProvider: Record<string, number> = {};

    // Simple cost model: $0.001 per task
    const costPerTaskDefault = 0.001;

    plan.taskGraph.nodes.forEach((task) => {
      const taskCost = costPerTaskDefault;
      costPerTask.set(task.id, taskCost);
      totalCost += taskCost;

      // Track cost by provider (simplified)
      const provider = task.intent.type;
      costPerProvider[provider] = (costPerProvider[provider] || 0) + taskCost;
    });

    const metrics: CostMetrics = {
      totalCost,
      costPerTask,
      estimatedRemainingCost: totalCost,
      costPerProvider,
    };

    this.costMetrics.set(plan.id, metrics);
    return metrics;
  }

  /**
   * Calculate performance metrics for a plan
   */
  calculatePerformanceMetrics(plan: ExecutionPlanV2): PerformanceMetrics {
    const timePerTask = new Map<string, number>();
    let totalTime = 0;

    plan.taskGraph.nodes.forEach((task) => {
      timePerTask.set(task.id, task.estimatedDuration);
      totalTime += task.estimatedDuration;
    });

    // Calculate parallelization factor
    const totalTasksIfSequential = plan.taskGraph.nodes.size;
    const executionPhases = plan.executionOrder.length;
    const parallelizationFactor = totalTasksIfSequential / executionPhases;

    // Calculate critical path
    const criticalPath = this.calculateCriticalPath(plan);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(plan);

    const metrics: PerformanceMetrics = {
      totalTime,
      timePerTask,
      parallelizationFactor,
      criticalPath,
      bottlenecks,
    };

    this.performanceMetrics.set(plan.id, metrics);
    return metrics;
  }

  /**
   * Optimize plan for cost
   */
  optimizeForCost(plan: ExecutionPlanV2, budget: number): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];
    const costMetrics = this.calculateCostMetrics(plan);

    if (costMetrics.totalCost > budget) {
      // Strategy 1: Reduce task count
      strategies.push({
        name: "Reduce Task Count",
        description: "Combine similar tasks to reduce total cost",
        potentialSavings: {
          cost: costMetrics.totalCost * 0.2,
          time: 0,
        },
        riskLevel: "medium",
        applicability: 0.6,
      });

      // Strategy 2: Use cheaper providers
      strategies.push({
        name: "Use Cheaper Providers",
        description: "Switch to more cost-effective providers where possible",
        potentialSavings: {
          cost: costMetrics.totalCost * 0.15,
          time: 0,
        },
        riskLevel: "low",
        applicability: 0.7,
      });

      // Strategy 3: Enable caching
      strategies.push({
        name: "Enable Result Caching",
        description: "Cache results to avoid redundant computations",
        potentialSavings: {
          cost: costMetrics.totalCost * 0.1,
          time: 0,
        },
        riskLevel: "low",
        applicability: 0.8,
      });
    }

    return strategies;
  }

  /**
   * Optimize plan for speed
   */
  optimizeForSpeed(plan: ExecutionPlanV2, timeBudget: number): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];
    const perfMetrics = this.calculatePerformanceMetrics(plan);

    if (perfMetrics.totalTime > timeBudget) {
      // Strategy 1: Increase parallelism
      strategies.push({
        name: "Increase Parallelism",
        description: "Execute more tasks concurrently",
        potentialSavings: {
          cost: 0,
          time: perfMetrics.totalTime * 0.3,
        },
        riskLevel: "medium",
        applicability: 0.7,
      });

      // Strategy 2: Optimize critical path
      strategies.push({
        name: "Optimize Critical Path",
        description: "Focus on reducing critical path duration",
        potentialSavings: {
          cost: 0,
          time: perfMetrics.totalTime * 0.2,
        },
        riskLevel: "low",
        applicability: 0.8,
      });

      // Strategy 3: Use faster providers
      strategies.push({
        name: "Use Faster Providers",
        description: "Switch to providers with lower latency",
        potentialSavings: {
          cost: 0,
          time: perfMetrics.totalTime * 0.15,
        },
        riskLevel: "low",
        applicability: 0.6,
      });
    }

    return strategies;
  }

  /**
   * Optimize plan for balanced cost and performance
   */
  optimizeBalanced(
    plan: ExecutionPlanV2,
    costBudget: number,
    timeBudget: number
  ): OptimizationStrategy[] {
    const strategies: OptimizationStrategy[] = [];

    const costMetrics = this.calculateCostMetrics(plan);
    const perfMetrics = this.calculatePerformanceMetrics(plan);

    // Combine cost and performance optimizations
    if (costMetrics.totalCost > costBudget) {
      strategies.push(...this.optimizeForCost(plan, costBudget));
    }

    if (perfMetrics.totalTime > timeBudget) {
      strategies.push(...this.optimizeForSpeed(plan, timeBudget));
    }

    // Add general optimization
    strategies.push({
      name: "Batch Operations",
      description: "Combine multiple operations to improve efficiency",
      potentialSavings: {
        cost: costMetrics.totalCost * 0.1,
        time: perfMetrics.totalTime * 0.1,
      },
      riskLevel: "low",
      applicability: 0.7,
    });

    return strategies;
  }

  /**
   * Calculate critical path
   */
  private calculateCriticalPath(plan: ExecutionPlanV2): string[] {
    const distances = new Map<string, number>();
    const paths = new Map<string, string[]>();

    // Initialize
    plan.taskGraph.nodes.forEach((task) => {
      distances.set(task.id, task.estimatedDuration);
      paths.set(task.id, [task.id]);
    });

    // Process execution phases
    for (const phase of plan.executionOrder) {
      for (const taskId of phase) {
        const task = plan.taskGraph.nodes.get(taskId)!;

        // Find dependencies
        const dependencies = plan.taskGraph.dependencies.filter(
          (dep) => dep.targetTaskId === taskId
        );

        for (const dep of dependencies) {
          const depDist = distances.get(dep.sourceTaskId) || 0;
          const newDist = depDist + task.estimatedDuration;

          if (newDist > (distances.get(taskId) || 0)) {
            distances.set(taskId, newDist);
            const depPath = paths.get(dep.sourceTaskId) || [];
            paths.set(taskId, [...depPath, taskId]);
          }
        }
      }
    }

    // Find the path with maximum distance
    let maxDistance = 0;
    let criticalPath: string[] = [];

    distances.forEach((distance, taskId) => {
      if (distance > maxDistance) {
        maxDistance = distance;
        criticalPath = paths.get(taskId) || [];
      }
    });

    return criticalPath;
  }

  /**
   * Identify bottlenecks in the plan
   */
  private identifyBottlenecks(plan: ExecutionPlanV2): string[] {
    const bottlenecks: string[] = [];
    const taskDependencyCount = new Map<string, number>();

    // Count dependencies for each task
    plan.taskGraph.dependencies.forEach((dep) => {
      taskDependencyCount.set(
        dep.targetTaskId,
        (taskDependencyCount.get(dep.targetTaskId) || 0) + 1
      );
    });

    // Find tasks with many dependencies (bottlenecks)
    const avgDependencies =
      plan.taskGraph.dependencies.length / plan.taskGraph.nodes.size;

    taskDependencyCount.forEach((count, taskId) => {
      if (count > avgDependencies * 1.5) {
        bottlenecks.push(taskId);
      }
    });

    return bottlenecks;
  }

  /**
   * Get cost metrics
   */
  getCostMetrics(planId: string): CostMetrics | undefined {
    return this.costMetrics.get(planId);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(planId: string): PerformanceMetrics | undefined {
    return this.performanceMetrics.get(planId);
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport(
    plan: ExecutionPlanV2,
    config: OptimizerConfig
  ): Record<string, any> {
    const costMetrics = this.calculateCostMetrics(plan);
    const perfMetrics = this.calculatePerformanceMetrics(plan);

    let strategies: OptimizationStrategy[] = [];

    switch (config.optimizeFor) {
      case "cost":
        strategies = this.optimizeForCost(plan, config.costBudget || 100);
        break;
      case "speed":
        strategies = this.optimizeForSpeed(plan, config.timeBudget || 60000);
        break;
      case "balanced":
        strategies = this.optimizeBalanced(
          plan,
          config.costBudget || 100,
          config.timeBudget || 60000
        );
        break;
    }

    return {
      planId: plan.id,
      optimizeFor: config.optimizeFor,
      costMetrics,
      performanceMetrics: perfMetrics,
      strategies,
      recommendations: this.generateRecommendations(costMetrics, perfMetrics, config),
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    costMetrics: CostMetrics,
    perfMetrics: PerformanceMetrics,
    config: OptimizerConfig
  ): string[] {
    const recommendations: string[] = [];

    // Cost recommendations
    if (costMetrics.totalCost > (config.costBudget || 100)) {
      recommendations.push(
        `Total cost (${costMetrics.totalCost.toFixed(2)}) exceeds budget (${config.costBudget})`
      );
    }

    // Performance recommendations
    if (perfMetrics.totalTime > (config.timeBudget || 60000)) {
      recommendations.push(
        `Total time (${perfMetrics.totalTime}ms) exceeds budget (${config.timeBudget}ms)`
      );
    }

    // Parallelism recommendations
    if (perfMetrics.parallelizationFactor < 2) {
      recommendations.push("Plan has low parallelization factor - consider increasing concurrency");
    }

    // Bottleneck recommendations
    if (perfMetrics.bottlenecks.length > 0) {
      recommendations.push(
        `${perfMetrics.bottlenecks.length} bottleneck(s) identified - consider optimizing these tasks`
      );
    }

    return recommendations;
  }
}

export const costPerformanceOptimizer = new CostPerformanceOptimizer();
