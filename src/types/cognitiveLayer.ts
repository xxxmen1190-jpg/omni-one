import { Intent } from "./index";

/**
 * Task Graph - Represents a directed acyclic graph of tasks
 * with dependencies, conditions, and parallelism support
 */

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "skipped" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type DependencyType = "sequential" | "parallel" | "conditional";

export interface TaskNode {
  id: string;
  name: string;
  description: string;
  intent: Intent;
  priority: TaskPriority;
  status: TaskStatus;
  estimatedDuration: number;
  maxRetries: number;
  timeout: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface TaskDependency {
  sourceTaskId: string;
  targetTaskId: string;
  type: DependencyType;
  condition?: (sourceOutput: any) => boolean;
  dataMapping?: Record<string, string>; // Maps output fields to input fields
}

export interface TaskGraph {
  id: string;
  name: string;
  description: string;
  nodes: Map<string, TaskNode>;
  dependencies: TaskDependency[];
  rootTasks: string[]; // Tasks with no dependencies
  leafTasks: string[]; // Tasks with no dependents
  metadata: Record<string, any>;
}

export interface TaskExecutionContext {
  taskId: string;
  graphId: string;
  startTime: number;
  endTime?: number;
  status: TaskStatus;
  result?: any;
  error?: Error;
  retryCount: number;
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  logs: string[];
}

export interface ExecutionPlanV2 {
  id: string;
  goal: string;
  taskGraph: TaskGraph;
  executionOrder: string[][]; // Phases of parallel execution
  estimatedTime: number;
  estimatedCost: number;
  confidence: number;
  reasoning: string;
  optimizations: string[];
}

export interface PlanDecomposition {
  originalGoal: string;
  subgoals: string[];
  taskMapping: Map<string, string>; // Maps subgoal to task ID
  decompositionStrategy: "hierarchical" | "sequential" | "parallel" | "hybrid";
  complexity: number;
}

/**
 * Execution Supervisor - Manages execution, monitoring, and re-planning
 */

export interface ExecutionMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  totalDuration: number;
  totalCost: number;
  averageTaskDuration: number;
  successRate: number;
}

export interface ExecutionSnapshot {
  timestamp: number;
  graphId: string;
  completedTasks: Set<string>;
  runningTasks: Set<string>;
  failedTasks: Set<string>;
  metrics: ExecutionMetrics;
  contextState: Record<string, any>;
}

export interface RePlanningTrigger {
  reason: "task_failure" | "timeout" | "resource_constraint" | "cost_exceeded" | "performance_degradation";
  failedTaskId?: string;
  suggestedAlternatives: string[];
  severity: "low" | "medium" | "high" | "critical";
}

export interface ExecutionSupervisorConfig {
  maxConcurrentTasks: number;
  maxRetries: number;
  timeoutMs: number;
  costBudget: number;
  enableDynamicReplanning: boolean;
  monitoringInterval: number;
  rePlanningThreshold: number; // Percentage of tasks that can fail before re-planning
}

/**
 * Context Layer - Manages execution context and state
 */

export interface ContextLayer {
  graphId: string;
  globalState: Record<string, any>;
  taskContexts: Map<string, TaskExecutionContext>;
  sharedMemory: Map<string, any>;
  conversationHistory: Array<{ role: string; content: string }>;
  environmentVariables: Record<string, string>;
  timestamp: number;
}

export interface ContextSnapshot {
  timestamp: number;
  globalState: Record<string, any>;
  taskStates: Record<string, TaskStatus>;
  sharedMemory: Record<string, any>;
  metrics: ExecutionMetrics;
}

/**
 * Cost and Performance Optimizer
 */

export interface CostMetrics {
  totalCost: number;
  costPerTask: Map<string, number>;
  estimatedRemainingCost: number;
  costPerProvider: Record<string, number>;
}

export interface PerformanceMetrics {
  totalTime: number;
  timePerTask: Map<string, number>;
  parallelizationFactor: number;
  criticalPath: string[];
  bottlenecks: string[];
}

export interface OptimizationStrategy {
  name: string;
  description: string;
  potentialSavings: {
    cost: number;
    time: number;
  };
  riskLevel: "low" | "medium" | "high";
  applicability: number; // 0-1, how applicable to current plan
}

export interface OptimizerConfig {
  optimizeFor: "cost" | "speed" | "balanced";
  costBudget?: number;
  timeBudget?: number;
  maxParallelTasks: number;
  enableCaching: boolean;
  enableBatching: boolean;
}

/**
 * Cognitive Layer Configuration
 */

export interface CognitiveLayerConfig {
  taskGraphConfig: {
    maxNodes: number;
    maxDependencies: number;
    enableCycleDetection: boolean;
  };
  plannerConfig: {
    decompositionDepth: number;
    maxSubgoals: number;
    enableMemoization: boolean;
  };
  supervisorConfig: ExecutionSupervisorConfig;
  optimizerConfig: OptimizerConfig;
  contextConfig: {
    maxContextSize: number;
    enableContextPersistence: boolean;
    contextRetentionTime: number;
  };
}

/**
 * Cognitive Layer Events
 */

export type CognitiveLayerEventType =
  | "plan_created"
  | "plan_optimized"
  | "execution_started"
  | "task_started"
  | "task_completed"
  | "task_failed"
  | "execution_completed"
  | "execution_failed"
  | "replanning_triggered"
  | "context_updated";

export interface CognitiveLayerEvent {
  type: CognitiveLayerEventType;
  timestamp: number;
  graphId: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface CognitiveLayerEventListener {
  (event: CognitiveLayerEvent): void | Promise<void>;
}
