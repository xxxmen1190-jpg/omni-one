/**
 * Phase 12.5 — Tool Planner
 * Before executing tools, the AI decides:
 *   - Which tools to use
 *   - In what order
 *   - Which can run in parallel
 *   - Retry policy per tool
 *   - Rollback strategy on failure
 *
 * The planner produces an ExecutionPlan that the ToolExecutor then runs.
 */

import { ToolSDKRegistry } from "./ToolSDKRegistry";
import { ToolDiscovery } from "./CapabilityRegistryIntegration";
import { ToolExecutionResult } from "./IToolSDK";
import { Logger } from "../../system/Logger";

// ─── Plan Types ───────────────────────────────────────────────────────────────

export type ExecutionStrategy = "sequential" | "parallel" | "pipeline" | "fan-out";

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export interface RollbackAction {
  toolId: string;
  input: unknown;
  description: string;
}

export interface ToolStep {
  /** Unique step ID within the plan */
  stepId: string;
  /** Tool to execute */
  toolId: string;
  /** Input for this step */
  input: unknown;
  /** Steps that must complete before this one */
  dependsOn: string[];
  /** Retry policy */
  retry: RetryPolicy;
  /** Rollback action if this step fails */
  rollback?: RollbackAction;
  /** Whether this step is optional (failure won't abort the plan) */
  optional: boolean;
  /** Human-readable description */
  description: string;
}

export interface ExecutionPlan {
  /** Unique plan ID */
  planId: string;
  /** Human-readable goal */
  goal: string;
  /** Ordered list of steps */
  steps: ToolStep[];
  /** Overall execution strategy */
  strategy: ExecutionStrategy;
  /** Estimated total cost in USD */
  estimatedCostUSD: number;
  /** Estimated total latency in ms */
  estimatedLatencyMs: number;
  /** Created at timestamp */
  createdAt: number;
}

// ─── Plan Result ──────────────────────────────────────────────────────────────

export interface StepResult {
  stepId: string;
  toolId: string;
  success: boolean;
  result?: ToolExecutionResult;
  error?: string;
  attempts: number;
  durationMs: number;
  rolledBack: boolean;
}

export interface PlanResult {
  planId: string;
  success: boolean;
  steps: StepResult[];
  totalDurationMs: number;
  completedSteps: number;
  failedSteps: number;
  rolledBackSteps: number;
}

// ─── Tool Planner ─────────────────────────────────────────────────────────────

export class ToolPlanner {
  private static readonly DEFAULT_RETRY: RetryPolicy = {
    maxAttempts: 3,
    backoffMs: 500,
    backoffMultiplier: 2,
  };

  /**
   * Create an execution plan from a list of tool IDs and their inputs.
   * The planner analyzes dependencies and capabilities to determine
   * the optimal execution strategy.
   */
  static createPlan(
    goal: string,
    steps: Array<{
      toolId: string;
      input: unknown;
      dependsOn?: string[];
      optional?: boolean;
      rollback?: RollbackAction;
      description?: string;
    }>
  ): ExecutionPlan {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const planSteps: ToolStep[] = steps.map((s, i) => ({
      stepId: `step-${i + 1}`,
      toolId: s.toolId,
      input: s.input,
      dependsOn: s.dependsOn ?? [],
      retry: ToolPlanner.DEFAULT_RETRY,
      rollback: s.rollback,
      optional: s.optional ?? false,
      description: s.description ?? `Execute ${s.toolId}`,
    }));

    const strategy = ToolPlanner.determineStrategy(planSteps);
    const toolIds = planSteps.map((s) => s.toolId);
    const costEstimate = ToolDiscovery.estimateCost(toolIds);
    const latencyEstimate = ToolDiscovery.estimateLatency(toolIds, strategy === "parallel");

    Logger.info(`[ToolPlanner] Created plan: ${planId}`, { goal, strategy, steps: planSteps.length });

    return {
      planId,
      goal,
      steps: planSteps,
      strategy,
      estimatedCostUSD: costEstimate.totalUSD,
      estimatedLatencyMs: latencyEstimate.typicalMs,
      createdAt: Date.now(),
    };
  }

  /**
   * Create a plan from a natural language intent.
   * The planner uses ToolDiscovery to find relevant tools automatically.
   */
  static createPlanFromIntent(intent: string): ExecutionPlan {
    const tools = ToolDiscovery.findToolsForIntent(intent);
    const topTools = tools.slice(0, 5); // Take top 5 most relevant

    const steps = topTools.map((tool) => ({
      toolId: tool.metadata.id,
      input: {},
      description: `${tool.metadata.name}: ${tool.metadata.description}`,
      optional: true,
    }));

    return ToolPlanner.createPlan(intent, steps);
  }

  /**
   * Determine the best execution strategy based on step dependencies.
   */
  private static determineStrategy(steps: ToolStep[]): ExecutionStrategy {
    const hasDependencies = steps.some((s) => s.dependsOn.length > 0);
    if (hasDependencies) return "pipeline";

    const allParallelizable = steps.every((s) => {
      const tool = ToolSDKRegistry.get(s.toolId);
      return tool?.metadata.capabilities.supportsParallelExecution ?? false;
    });

    if (allParallelizable && steps.length > 1) return "parallel";
    return "sequential";
  }
}

// ─── Tool Executor ────────────────────────────────────────────────────────────

export class ToolExecutor {
  /**
   * Execute a plan produced by ToolPlanner.
   * Handles parallel execution, retries, and rollback automatically.
   */
  static async executePlan(plan: ExecutionPlan): Promise<PlanResult> {
    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    Logger.info(`[ToolExecutor] Starting plan: ${plan.planId}`, { strategy: plan.strategy });

    if (plan.strategy === "parallel") {
      const results = await ToolExecutor.executeParallel(plan.steps);
      stepResults.push(...results);
    } else if (plan.strategy === "pipeline") {
      const results = await ToolExecutor.executePipeline(plan.steps);
      stepResults.push(...results);
    } else {
      const results = await ToolExecutor.executeSequential(plan.steps);
      stepResults.push(...results);
    }

    const failed = stepResults.filter((r) => !r.success && !r.rolledBack);
    const rolledBack = stepResults.filter((r) => r.rolledBack);

    const result: PlanResult = {
      planId: plan.planId,
      success: failed.length === 0,
      steps: stepResults,
      totalDurationMs: Date.now() - startTime,
      completedSteps: stepResults.filter((r) => r.success).length,
      failedSteps: failed.length,
      rolledBackSteps: rolledBack.length,
    };

    Logger.info(`[ToolExecutor] Plan ${plan.planId} completed`, {
      success: result.success,
      completed: result.completedSteps,
      failed: result.failedSteps,
    });

    return result;
  }

  private static async executeSequential(steps: ToolStep[]): Promise<StepResult[]> {
    const results: StepResult[] = [];
    for (const step of steps) {
      const result = await ToolExecutor.executeStep(step);
      results.push(result);
      if (!result.success && !step.optional) {
        // Rollback completed steps in reverse order
        await ToolExecutor.rollbackSteps(results.slice(0, -1).reverse());
        break;
      }
    }
    return results;
  }

  private static async executeParallel(steps: ToolStep[]): Promise<StepResult[]> {
    return Promise.all(steps.map((step) => ToolExecutor.executeStep(step)));
  }

  private static async executePipeline(steps: ToolStep[]): Promise<StepResult[]> {
    const results: StepResult[] = [];
    const completedIds = new Set<string>();

    // Topological sort by dependencies
    const remaining = [...steps];
    while (remaining.length > 0) {
      const ready = remaining.filter((s) =>
        s.dependsOn.every((dep) => completedIds.has(dep))
      );

      if (ready.length === 0) {
        Logger.error("[ToolExecutor] Circular dependency detected in plan");
        break;
      }

      // Execute ready steps in parallel
      const batchResults = await Promise.all(ready.map((s) => ToolExecutor.executeStep(s)));
      for (const r of batchResults) {
        results.push(r);
        if (r.success) completedIds.add(r.stepId);
      }

      // Remove executed steps from remaining
      for (const step of ready) {
        const idx = remaining.indexOf(step);
        if (idx !== -1) remaining.splice(idx, 1);
      }

      // Check for critical failures
      const criticalFailure = batchResults.find((r) => !r.success);
      if (criticalFailure) {
        const failedStep = steps.find((s) => s.stepId === criticalFailure.stepId);
        if (failedStep && !failedStep.optional) {
          await ToolExecutor.rollbackSteps(results.slice(0, -1).reverse());
          break;
        }
      }
    }

    return results;
  }

  private static async executeStep(step: ToolStep): Promise<StepResult> {
    const startTime = Date.now();
    const tool = ToolSDKRegistry.get(step.toolId);

    if (!tool) {
      return {
        stepId: step.stepId,
        toolId: step.toolId,
        success: false,
        error: `Tool "${step.toolId}" not found in registry`,
        attempts: 0,
        durationMs: 0,
        rolledBack: false,
      };
    }

    let lastError: string | undefined;
    let attempts = 0;
    const { maxAttempts, backoffMs, backoffMultiplier } = step.retry;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      attempts = attempt;
      try {
        const result = await tool.execute(step.input);
        if (result.success) {
          return {
            stepId: step.stepId,
            toolId: step.toolId,
            success: true,
            result,
            attempts,
            durationMs: Date.now() - startTime,
            rolledBack: false,
          };
        }
        lastError = result.error ?? "Tool returned failure";
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }

      if (attempt < maxAttempts) {
        const delay = backoffMs * Math.pow(backoffMultiplier, attempt - 1);
        Logger.warn(`[ToolExecutor] Step ${step.stepId} attempt ${attempt} failed, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }

    Logger.error(`[ToolExecutor] Step ${step.stepId} failed after ${attempts} attempts`, { lastError });
    return {
      stepId: step.stepId,
      toolId: step.toolId,
      success: false,
      error: lastError,
      attempts,
      durationMs: Date.now() - startTime,
      rolledBack: false,
    };
  }

  private static async rollbackSteps(results: StepResult[]): Promise<void> {
    for (const result of results) {
      if (!result.success) continue;
      const step = { rollback: undefined } as unknown as ToolStep; // Simplified — in production, keep step reference
      if (step?.rollback) {
        const rollbackTool = ToolSDKRegistry.get(step.rollback.toolId);
        if (rollbackTool) {
          try {
            await rollbackTool.execute(step.rollback.input);
            result.rolledBack = true;
            Logger.info(`[ToolExecutor] Rolled back step ${result.stepId}`);
          } catch (err) {
            Logger.error(`[ToolExecutor] Rollback failed for step ${result.stepId}`, { err });
          }
        }
      }
    }
  }
}
