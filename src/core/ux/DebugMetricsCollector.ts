import {
  DebugMetrics,
  DebugPanel,
} from "../../types/ux";
import { ExecutionContext } from "../../types/integration";
import { Logger } from "../system/Logger";

/**
 * Debug Metrics Collector - Collects and formats debug information
 */

export class DebugMetricsCollector {
  private logs: Array<{
    timestamp: number;
    level: "info" | "warn" | "error" | "debug";
    message: string;
    data?: Record<string, any>;
  }> = [];

  private maxLogs: number = 1000;

  constructor() {
    Logger.info("DebugMetricsCollector initialized");
  }

  /**
   * Collect metrics from execution context
   */
  collectMetrics(
    executionContext: ExecutionContext,
    latencyOptimizer?: any,
    failureRecovery?: any
  ): DebugMetrics {
    const metrics: DebugMetrics = {
      latencyPerStage: this.collectLatencyPerStage(executionContext),
      cacheHits: latencyOptimizer?.cacheHits || 0,
      cacheMisses: latencyOptimizer?.cacheMisses || 0,
      toolUsage: this.collectToolUsage(executionContext),
      agentUsage: this.collectAgentUsage(executionContext),
      failureRecoveryEvents: failureRecovery?.getRecoveryHistory() || [],
      tokenUsage: this.estimateTokenUsage(executionContext),
      memoryUsage: this.collectMemoryUsage(),
    };

    return metrics;
  }

  /**
   * Collect latency per stage
   */
  private collectLatencyPerStage(executionContext: ExecutionContext): Record<string, number> {
    const latency: Record<string, number> = {};

    for (const step of executionContext.steps) {
      latency[step.stage] = step.duration || 0;
    }

    return latency;
  }

  /**
   * Collect tool usage
   */
  private collectToolUsage(executionContext: ExecutionContext): DebugMetrics["toolUsage"] {
    const toolUsage: DebugMetrics["toolUsage"] = [];

    if (executionContext.metadata.toolsUsed && Array.isArray(executionContext.metadata.toolsUsed)) {
      for (const toolId of executionContext.metadata.toolsUsed) {
        toolUsage.push({
          toolId,
          toolName: toolId,
          callCount: 1,
          totalTime: 100, // Placeholder
          successRate: 1.0,
        });
      }
    }

    return toolUsage;
  }

  /**
   * Collect agent usage
   */
  private collectAgentUsage(executionContext: ExecutionContext): DebugMetrics["agentUsage"] {
    const agentUsage: DebugMetrics["agentUsage"] = [];

    if (executionContext.metadata.agentsUsed && Array.isArray(executionContext.metadata.agentsUsed)) {
      for (const agentId of executionContext.metadata.agentsUsed) {
        agentUsage.push({
          agentId,
          agentName: agentId,
          actionCount: 1,
          totalTime: 150, // Placeholder
          successRate: 1.0,
        });
      }
    }

    return agentUsage;
  }

  /**
   * Estimate token usage
   */
  private estimateTokenUsage(executionContext: ExecutionContext): DebugMetrics["tokenUsage"] {
    // Rough estimation: 1 token ≈ 4 characters
    const inputTokens = Math.ceil(executionContext.userMessage.length / 4);
    const outputTokens = Math.ceil(
      (executionContext.finalResponse || "").length / 4
    );

    return {
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      estimatedCost: (inputTokens + outputTokens) * 0.0001, // Placeholder pricing
    };
  }

  /**
   * Collect memory usage
   */
  private collectMemoryUsage(): DebugMetrics["memoryUsage"] {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external,
      };
    }

    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
    };
  }

  /**
   * Add log
   */
  addLog(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    data?: Record<string, any>
  ): void {
    this.logs.push({
      timestamp: Date.now(),
      level,
      message,
      data,
    });

    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-Math.floor(this.maxLogs / 2));
    }
  }

  /**
   * Get logs
   */
  getLogs(limit?: number): typeof this.logs {
    if (limit) {
      return this.logs.slice(-limit);
    }
    return this.logs;
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: "info" | "warn" | "error" | "debug"): typeof this.logs {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Build debug panel
   */
  buildDebugPanel(metrics: DebugMetrics, enabled: boolean = true): DebugPanel {
    return {
      enabled,
      metrics,
      logs: this.logs,
    };
  }

  /**
   * Export metrics as JSON
   */
  exportMetricsAsJSON(metrics: DebugMetrics): string {
    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Export metrics as CSV
   */
  exportMetricsAsCSV(metrics: DebugMetrics): string {
    const rows: string[] = [];

    // Latency per stage
    rows.push("Stage,Latency (ms)");
    for (const [stage, latency] of Object.entries(metrics.latencyPerStage)) {
      rows.push(`${stage},${latency}`);
    }

    rows.push("");

    // Tool usage
    rows.push("Tool,Calls,Total Time,Success Rate");
    for (const tool of metrics.toolUsage) {
      rows.push(
        `${tool.toolName},${tool.callCount},${tool.totalTime},${(tool.successRate * 100).toFixed(0)}%`
      );
    }

    rows.push("");

    // Agent usage
    rows.push("Agent,Actions,Total Time,Success Rate");
    for (const agent of metrics.agentUsage) {
      rows.push(
        `${agent.agentName},${agent.actionCount},${agent.totalTime},${(agent.successRate * 100).toFixed(0)}%`
      );
    }

    rows.push("");

    // Token usage
    rows.push("Metric,Value");
    rows.push(`Input Tokens,${metrics.tokenUsage.inputTokens}`);
    rows.push(`Output Tokens,${metrics.tokenUsage.outputTokens}`);
    rows.push(`Total Tokens,${metrics.tokenUsage.totalTokens}`);
    if (metrics.tokenUsage.estimatedCost) {
      rows.push(`Estimated Cost,$${metrics.tokenUsage.estimatedCost.toFixed(4)}`);
    }

    return rows.join("\n");
  }

  /**
   * Get statistics
   */
  getStatistics(metrics: DebugMetrics): Record<string, any> {
    const latencies = Object.values(metrics.latencyPerStage);
    const totalLatency = latencies.reduce((a, b) => a + b, 0);
    const avgLatency = latencies.length > 0 ? totalLatency / latencies.length : 0;

    const cacheHitRate =
      metrics.cacheHits + metrics.cacheMisses > 0
        ? metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)
        : 0;

    const totalToolTime = metrics.toolUsage.reduce((sum, t) => sum + t.totalTime, 0);
    const totalAgentTime = metrics.agentUsage.reduce((sum, a) => sum + a.totalTime, 0);

    return {
      totalLatency,
      averageLatency: avgLatency,
      slowestStage: Object.entries(metrics.latencyPerStage).sort(
        ([, a], [, b]) => b - a
      )[0]?.[0],
      cacheHitRate: (cacheHitRate * 100).toFixed(0) + "%",
      toolCount: metrics.toolUsage.length,
      totalToolTime,
      agentCount: metrics.agentUsage.length,
      totalAgentTime,
      recoveryEvents: metrics.failureRecoveryEvents.length,
      totalTokens: metrics.tokenUsage.totalTokens,
      estimatedCost: metrics.tokenUsage.estimatedCost?.toFixed(4),
    };
  }

  /**
   * Format metrics for display
   */
  formatMetricsForDisplay(metrics: DebugMetrics): Record<string, string> {
    return {
      "Cache Hit Rate": `${((metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses)) * 100).toFixed(0)}%`,
      "Tools Used": metrics.toolUsage.length.toString(),
      "Agents Used": metrics.agentUsage.length.toString(),
      "Token Usage": metrics.tokenUsage.totalTokens.toString(),
      "Recovery Events": metrics.failureRecoveryEvents.length.toString(),
      "Heap Used": `${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
    };
  }
}

export const createDebugMetricsCollector = (): DebugMetricsCollector => {
  return new DebugMetricsCollector();
};
