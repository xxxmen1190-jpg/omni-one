import {
  TaskNode,
  TaskDependency,
  TaskGraph,
  TaskStatus,
  DependencyType,
  TaskPriority,
} from "../../types/cognitiveLayer";
import { Intent } from "../../types";
import { Logger } from "../system/Logger";

/**
 * Task Graph Engine - Manages task graphs with dependency resolution,
 * cycle detection, and execution planning
 */

export class TaskGraphEngine {
  private graphs: Map<string, TaskGraph> = new Map();
  private executionOrder: Map<string, string[][]> = new Map(); // graphId -> execution phases

  /**
   * Create a new task graph
   */
  createGraph(id: string, name: string, description: string): TaskGraph {
    const graph: TaskGraph = {
      id,
      name,
      description,
      nodes: new Map(),
      dependencies: [],
      rootTasks: [],
      leafTasks: [],
      metadata: {},
    };

    this.graphs.set(id, graph);
    Logger.info("Task graph created", { graphId: id });
    return graph;
  }

  /**
   * Add a task node to the graph
   */
  addTask(
    graphId: string,
    taskId: string,
    name: string,
    description: string,
    intent: Intent,
    options?: {
      priority?: TaskPriority;
      estimatedDuration?: number;
      maxRetries?: number;
      timeout?: number;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ): TaskNode {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const task: TaskNode = {
      id: taskId,
      name,
      description,
      intent,
      priority: options?.priority || "medium",
      status: "pending",
      estimatedDuration: options?.estimatedDuration || 5000,
      maxRetries: options?.maxRetries || 3,
      timeout: options?.timeout || 30000,
      tags: options?.tags || [],
      metadata: options?.metadata || {},
    };

    graph.nodes.set(taskId, task);
    Logger.debug("Task added to graph", { graphId, taskId });

    // Update root and leaf tasks
    this.updateRootAndLeafTasks(graphId);

    return task;
  }

  /**
   * Add a dependency between two tasks
   */
  addDependency(
    graphId: string,
    sourceTaskId: string,
    targetTaskId: string,
    type: DependencyType = "sequential",
    condition?: (output: any) => boolean,
    dataMapping?: Record<string, string>
  ): TaskDependency {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    if (!graph.nodes.has(sourceTaskId) || !graph.nodes.has(targetTaskId)) {
      throw new Error("One or both tasks not found in graph");
    }

    // Check for cycles
    if (this.wouldCreateCycle(graph, sourceTaskId, targetTaskId)) {
      throw new Error("Adding this dependency would create a cycle");
    }

    const dependency: TaskDependency = {
      sourceTaskId,
      targetTaskId,
      type,
      condition,
      dataMapping,
    };

    graph.dependencies.push(dependency);
    Logger.debug("Dependency added", { graphId, sourceTaskId, targetTaskId, type });

    // Update root and leaf tasks
    this.updateRootAndLeafTasks(graphId);

    return dependency;
  }

  /**
   * Resolve execution order - topological sort with phase grouping for parallelism
   */
  resolveExecutionOrder(graphId: string): string[][] {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    // Build adjacency list and in-degree map
    const inDegree = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    graph.nodes.forEach((task) => {
      inDegree.set(task.id, 0);
      adjacencyList.set(task.id, []);
    });

    graph.dependencies.forEach((dep) => {
      const currentInDegree = inDegree.get(dep.targetTaskId) || 0;
      inDegree.set(dep.targetTaskId, currentInDegree + 1);

      const adjacents = adjacencyList.get(dep.sourceTaskId) || [];
      adjacents.push(dep.targetTaskId);
      adjacencyList.set(dep.sourceTaskId, adjacents);
    });

    // Kahn's algorithm with phase grouping
    const phases: string[][] = [];
    const processed = new Set<string>();

    while (processed.size < graph.nodes.size) {
      const currentPhase: string[] = [];

      // Find all tasks with in-degree 0 (ready to execute)
      inDegree.forEach((degree, taskId) => {
        if (degree === 0 && !processed.has(taskId)) {
          currentPhase.push(taskId);
        }
      });

      if (currentPhase.length === 0) {
        throw new Error("Cycle detected in task graph");
      }

      phases.push(currentPhase);

      // Process current phase
      currentPhase.forEach((taskId) => {
        processed.add(taskId);

        // Reduce in-degree for dependent tasks
        adjacencyList.get(taskId)?.forEach((dependentId) => {
          const currentDegree = inDegree.get(dependentId) || 0;
          inDegree.set(dependentId, currentDegree - 1);
        });
      });
    }

    this.executionOrder.set(graphId, phases);
    Logger.info("Execution order resolved", {
      graphId,
      phases: phases.length,
      totalTasks: graph.nodes.size,
    });

    return phases;
  }

  /**
   * Get execution order for a graph
   */
  getExecutionOrder(graphId: string): string[][] {
    return this.executionOrder.get(graphId) || this.resolveExecutionOrder(graphId);
  }

  /**
   * Get task dependencies
   */
  getTaskDependencies(graphId: string, taskId: string): TaskDependency[] {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    return graph.dependencies.filter(
      (dep) => dep.sourceTaskId === taskId || dep.targetTaskId === taskId
    );
  }

  /**
   * Get all tasks that must complete before a given task
   */
  getPrerequisiteTasks(graphId: string, taskId: string): string[] {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const prerequisites = new Set<string>();
    const visited = new Set<string>();

    const traverse = (currentTaskId: string) => {
      if (visited.has(currentTaskId)) return;
      visited.add(currentTaskId);

      graph.dependencies.forEach((dep) => {
        if (dep.targetTaskId === currentTaskId) {
          prerequisites.add(dep.sourceTaskId);
          traverse(dep.sourceTaskId);
        }
      });
    };

    traverse(taskId);
    return Array.from(prerequisites);
  }

  /**
   * Get all tasks that depend on a given task
   */
  getDependentTasks(graphId: string, taskId: string): string[] {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const dependents = new Set<string>();
    const visited = new Set<string>();

    const traverse = (currentTaskId: string) => {
      if (visited.has(currentTaskId)) return;
      visited.add(currentTaskId);

      graph.dependencies.forEach((dep) => {
        if (dep.sourceTaskId === currentTaskId) {
          dependents.add(dep.targetTaskId);
          traverse(dep.targetTaskId);
        }
      });
    };

    traverse(taskId);
    return Array.from(dependents);
  }

  /**
   * Get graph statistics
   */
  getGraphStats(graphId: string): Record<string, any> {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const tasksByStatus = new Map<TaskStatus, number>();
    const tasksByPriority = new Map<TaskPriority, number>();

    graph.nodes.forEach((task) => {
      tasksByStatus.set(task.status, (tasksByStatus.get(task.status) || 0) + 1);
      tasksByPriority.set(task.priority, (tasksByPriority.get(task.priority) || 0) + 1);
    });

    const executionOrder = this.getExecutionOrder(graphId);
    const criticalPath = this.calculateCriticalPath(graphId);

    return {
      nodeCount: graph.nodes.size,
      dependencyCount: graph.dependencies.length,
      executionPhases: executionOrder.length,
      tasksByStatus: Object.fromEntries(tasksByStatus),
      tasksByPriority: Object.fromEntries(tasksByPriority),
      rootTasks: graph.rootTasks,
      leafTasks: graph.leafTasks,
      criticalPathLength: criticalPath.length,
      criticalPath,
    };
  }

  /**
   * Calculate critical path (longest path through the graph)
   */
  private calculateCriticalPath(graphId: string): string[] {
    const graph = this.graphs.get(graphId);
    if (!graph) {
      throw new Error(`Graph ${graphId} not found`);
    }

    const distances = new Map<string, number>();
    const paths = new Map<string, string[]>();

    // Initialize
    graph.nodes.forEach((task) => {
      distances.set(task.id, task.estimatedDuration);
      paths.set(task.id, [task.id]);
    });

    // Topological sort for dynamic programming
    const executionOrder = this.getExecutionOrder(graphId);

    for (const phase of executionOrder) {
      for (const taskId of phase) {
        const prerequisites = this.getPrerequisiteTasks(graphId, taskId);

        for (const prereqId of prerequisites) {
          const prereqDist = distances.get(prereqId) || 0;
          const currentTask = graph.nodes.get(taskId)!;
          const newDist = prereqDist + currentTask.estimatedDuration;

          if (newDist > (distances.get(taskId) || 0)) {
            distances.set(taskId, newDist);
            const prereqPath = paths.get(prereqId) || [];
            paths.set(taskId, [...prereqPath, taskId]);
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
   * Check if adding a dependency would create a cycle
   */
  private wouldCreateCycle(graph: TaskGraph, sourceId: string, targetId: string): boolean {
    const visited = new Set<string>();

    const hasCycle = (currentId: string): boolean => {
      if (visited.has(currentId)) {
        return currentId === sourceId;
      }

      visited.add(currentId);

      for (const dep of graph.dependencies) {
        if (dep.sourceTaskId === currentId) {
          if (hasCycle(dep.targetTaskId)) {
            return true;
          }
        }
      }

      return false;
    };

    return hasCycle(targetId);
  }

  /**
   * Update root and leaf task lists
   */
  private updateRootAndLeafTasks(graphId: string): void {
    const graph = this.graphs.get(graphId);
    if (!graph) return;

    const hasIncoming = new Set<string>();
    const hasOutgoing = new Set<string>();

    graph.dependencies.forEach((dep) => {
      hasIncoming.add(dep.targetTaskId);
      hasOutgoing.add(dep.sourceTaskId);
    });

    graph.rootTasks = Array.from(graph.nodes.keys()).filter((id) => !hasIncoming.has(id));
    graph.leafTasks = Array.from(graph.nodes.keys()).filter((id) => !hasOutgoing.has(id));
  }

  /**
   * Get a graph by ID
   */
  getGraph(graphId: string): TaskGraph | undefined {
    return this.graphs.get(graphId);
  }

  /**
   * Delete a graph
   */
  deleteGraph(graphId: string): boolean {
    return this.graphs.delete(graphId);
  }

  /**
   * Get all graphs
   */
  getAllGraphs(): TaskGraph[] {
    return Array.from(this.graphs.values());
  }
}

export const taskGraphEngine = new TaskGraphEngine();
