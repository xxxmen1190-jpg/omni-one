import { LatencyMetrics, LatencyOptimization } from "../../types/integration";
import { Logger } from "../system/Logger";

/**
 * Latency Optimizer - Optimizes system performance
 * Implements caching, parallel retrieval, lazy loading, and task cancellation
 */

export class LatencyOptimizer {
  private cache: Map<string, { result: any; timestamp: number; ttl: number }> = new Map();
  private maxCacheSize: number = 1000;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;
  private activeTasks: Map<string, AbortController> = new Map();
  private taskCancellations: number = 0;
  private metrics: LatencyMetrics = {
    inputProcessing: 0,
    queryUnderstanding: 0,
    planning: 0,
    knowledgeRetrieval: 0,
    memoryInjection: 0,
    execution: 0,
    responseGeneration: 0,
    total: 0,
  };

  constructor() {
    Logger.info("LatencyOptimizer initialized");
  }

  /**
   * Get or compute cached value
   */
  async getOrCompute<T>(
    key: string,
    ttl: number,
    compute: () => Promise<T>
  ): Promise<T> {
    // Check cache
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      this.cacheHits++;
      Logger.debug("Cache hit", { key });
      return cached.result;
    }

    this.cacheMisses++;

    // Compute value
    const result = await compute();

    // Store in cache
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      ttl,
    });

    // Cleanup old entries
    if (this.cache.size > this.maxCacheSize) {
      const oldest = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0];
      this.cache.delete(oldest[0]);
    }

    return result;
  }

  /**
   * Parallel execution
   */
  async executeParallel<T>(
    tasks: Array<{ id: string; execute: () => Promise<T> }>
  ): Promise<Array<{ id: string; result: T; error?: Error }>> {
    const results: Array<{ id: string; result: T; error?: Error }> = [];

    // Create abort controllers for each task
    const controllers = new Map<string, AbortController>();
    for (const task of tasks) {
      controllers.set(task.id, new AbortController());
      this.activeTasks.set(task.id, controllers.get(task.id)!);
    }

    try {
      // Execute all tasks in parallel
      const promises = tasks.map(async (task) => {
        try {
          const result = await task.execute();
          return { id: task.id, result };
        } catch (error: any) {
          return { id: task.id, result: null, error };
        }
      });

      const taskResults = await Promise.all(promises);
      results.push(...taskResults);

      Logger.debug("Parallel execution completed", {
        taskCount: tasks.length,
        successCount: results.filter((r) => !r.error).length,
      });

      return results;
    } finally {
      // Cleanup
      for (const task of tasks) {
        this.activeTasks.delete(task.id);
      }
    }
  }

  /**
   * Lazy load value
   */
  lazyLoad<T>(loader: () => Promise<T>): { get: () => Promise<T>; cached: boolean } {
    let value: T | null = null;
    let loaded = false;

    return {
      get: async () => {
        if (!loaded) {
          value = await loader();
          loaded = true;
        }
        return value as T;
      },
      cached: loaded,
    };
  }

  /**
   * Cancel task
   */
  cancelTask(taskId: string): void {
    const controller = this.activeTasks.get(taskId);
    if (controller) {
      controller.abort();
      this.activeTasks.delete(taskId);
      this.taskCancellations++;

      Logger.info("Task cancelled", { taskId });
    }
  }

  /**
   * Record metric
   */
  recordMetric(stage: keyof LatencyMetrics, duration: number): void {
    this.metrics[stage] = duration;
    this.metrics.total = Object.values(this.metrics).reduce((a, b) => a + b, 0) - this.metrics.total;

    Logger.debug("Metric recorded", { stage, duration });
  }

  /**
   * Get metrics
   */
  getMetrics(): LatencyMetrics {
    return { ...this.metrics };
  }

  /**
   * Get optimization status
   */
  getOptimizationStatus(): LatencyOptimization {
    const totalRequests = this.cacheHits + this.cacheMisses;

    return {
      parallelRetrieval: true,
      lazyLoadingRAG: true,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      taskCancellations: this.taskCancellations,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    const totalRequests = this.cacheHits + this.cacheMisses;

    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
      activeTasks: this.activeTasks.size,
      taskCancellations: this.taskCancellations,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    Logger.info("Cache cleared");
  }

  /**
   * Reset statistics
   */
  resetStatistics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.taskCancellations = 0;
    this.metrics = {
      inputProcessing: 0,
      queryUnderstanding: 0,
      planning: 0,
      knowledgeRetrieval: 0,
      memoryInjection: 0,
      execution: 0,
      responseGeneration: 0,
      total: 0,
    };

    Logger.info("Statistics reset");
  }
}

export const createLatencyOptimizer = (): LatencyOptimizer => {
  return new LatencyOptimizer();
};
