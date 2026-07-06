import {
  ExecutionTrace,
  TraceEvent,
  RuntimeMetrics,
  DebugContext,
} from "../../../types/runtime";
import { EventBus } from "../events/EventBus";
import { Logger } from "../../system/Logger";

/**
 * Runtime Observability - Provides visibility into system execution
 * Tracks traces, metrics, and debug information
 */

export class RuntimeObservability {
  private eventBus: EventBus;
  private traces: Map<string, ExecutionTrace> = new Map();
  private metrics: RuntimeMetrics;
  private debugContext: DebugContext;
  private traceIdCounter: number = 0;
  private startTime: number = Date.now();

  constructor(eventBus: EventBus, debugContext: Partial<DebugContext> = {}) {
    this.eventBus = eventBus;
    this.debugContext = {
      enabled: debugContext.enabled !== false,
      traceLevel: debugContext.traceLevel || "normal",
      captureEvents: debugContext.captureEvents !== false,
      captureMetrics: debugContext.captureMetrics !== false,
      captureTraces: debugContext.captureTraces !== false,
      filters: debugContext.filters || {},
    };

    this.metrics = {
      uptime: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTime: 0,
      activePlugins: 0,
      totalPlugins: 0,
      systemHealth: 100,
      memoryUsage: 0,
      cpuUsage: 0,
    };

    Logger.info("RuntimeObservability initialized", { debugContext: this.debugContext });
  }

  /**
   * Start a trace
   */
  startTrace(source: string, metadata?: Record<string, any>): ExecutionTrace {
    const trace: ExecutionTrace = {
      id: this.generateTraceId(),
      startTime: Date.now(),
      events: [],
      metadata: metadata || {},
    };

    this.traces.set(trace.id, trace);

    if (this.debugContext.captureTraces) {
      Logger.debug("Trace started", { traceId: trace.id, source });
    }

    return trace;
  }

  /**
   * Add event to trace
   */
  addTraceEvent(
    traceId: string,
    type: "enter" | "exit" | "event" | "error" | "log",
    source: string,
    data: any,
    duration?: number
  ): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      Logger.warn("Trace not found", { traceId });
      return;
    }

    const event: TraceEvent = {
      timestamp: Date.now(),
      type,
      source,
      data,
      duration,
    };

    trace.events.push(event);

    if (this.debugContext.captureTraces && this.shouldLogTraceEvent(type)) {
      Logger.debug("Trace event", {
        traceId,
        type,
        source,
        duration,
      });
    }
  }

  /**
   * End trace
   */
  endTrace(traceId: string): ExecutionTrace | undefined {
    const trace = this.traces.get(traceId);
    if (!trace) {
      Logger.warn("Trace not found", { traceId });
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;

    if (this.debugContext.captureTraces) {
      Logger.debug("Trace ended", {
        traceId,
        duration: trace.duration,
        eventCount: trace.events.length,
      });
    }

    return trace;
  }

  /**
   * Get trace
   */
  getTrace(traceId: string): ExecutionTrace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces
   */
  getAllTraces(limit: number = 100): ExecutionTrace[] {
    const traces = Array.from(this.traces.values());
    return traces.slice(-limit);
  }

  /**
   * Get active traces
   */
  getActiveTraces(): ExecutionTrace[] {
    return Array.from(this.traces.values()).filter((t) => !t.endTime);
  }

  /**
   * Clear old traces
   */
  clearOldTraces(maxAge: number = 3600000): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.traces.forEach((trace, id) => {
      if (trace.endTime && now - trace.endTime > maxAge) {
        toDelete.push(id);
      }
    });

    toDelete.forEach((id) => {
      this.traces.delete(id);
    });

    if (toDelete.length > 0) {
      Logger.info("Old traces cleared", { count: toDelete.length });
    }
  }

  /**
   * Update metrics
   */
  updateMetrics(updates: Partial<RuntimeMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...updates,
      uptime: Date.now() - this.startTime,
    };

    if (this.debugContext.captureMetrics) {
      Logger.debug("Metrics updated", { metrics: this.metrics });
    }
  }

  /**
   * Record execution
   */
  recordExecution(success: boolean, duration: number): void {
    this.metrics.totalExecutions++;

    if (success) {
      this.metrics.successfulExecutions++;
    } else {
      this.metrics.failedExecutions++;
    }

    // Update average execution time
    const totalTime =
      this.metrics.averageExecutionTime * (this.metrics.totalExecutions - 1) +
      duration;
    this.metrics.averageExecutionTime = totalTime / this.metrics.totalExecutions;
  }

  /**
   * Get metrics
   */
  getMetrics(): RuntimeMetrics {
    // Update current memory and CPU usage
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = memUsage.heapUsed;
    this.metrics.cpuUsage = process.cpuUsage().user / 1000; // Convert to ms

    return this.metrics;
  }

  /**
   * Get debug context
   */
  getDebugContext(): DebugContext {
    return this.debugContext;
  }

  /**
   * Set debug context
   */
  setDebugContext(context: Partial<DebugContext>): void {
    this.debugContext = {
      ...this.debugContext,
      ...context,
    };

    Logger.info("Debug context updated", { debugContext: this.debugContext });
  }

  /**
   * Enable debug mode
   */
  enableDebugMode(): void {
    this.debugContext.enabled = true;
    this.debugContext.traceLevel = "debug";
    this.debugContext.captureEvents = true;
    this.debugContext.captureMetrics = true;
    this.debugContext.captureTraces = true;

    Logger.info("Debug mode enabled");
  }

  /**
   * Disable debug mode
   */
  disableDebugMode(): void {
    this.debugContext.enabled = false;
    this.debugContext.traceLevel = "normal";

    Logger.info("Debug mode disabled");
  }

  /**
   * Get system snapshot
   */
  getSystemSnapshot(): Record<string, any> {
    return {
      timestamp: Date.now(),
      uptime: this.metrics.uptime,
      metrics: this.getMetrics(),
      traces: {
        total: this.traces.size,
        active: this.getActiveTraces().length,
      },
      debugContext: this.debugContext,
    };
  }

  /**
   * Get execution timeline
   */
  getExecutionTimeline(traceId: string): Array<{
    timestamp: number;
    type: string;
    source: string;
    duration?: number;
  }> {
    const trace = this.traces.get(traceId);
    if (!trace) {
      return [];
    }

    return trace.events.map((event) => ({
      timestamp: event.timestamp,
      type: event.type,
      source: event.source,
      duration: event.duration,
    }));
  }

  /**
   * Get performance report
   */
  getPerformanceReport(): Record<string, any> {
    const traces = Array.from(this.traces.values());
    const completedTraces = traces.filter((t) => t.duration);

    const durations = completedTraces.map((t) => t.duration || 0);
    const avgDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

    return {
      totalTraces: traces.length,
      completedTraces: completedTraces.length,
      activeTraces: this.getActiveTraces().length,
      averageDuration: avgDuration,
      maxDuration,
      minDuration,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Export observability data
   */
  export(): Record<string, any> {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      traces: Array.from(this.traces.values()),
      debugContext: this.debugContext,
      systemSnapshot: this.getSystemSnapshot(),
    };
  }

  /**
   * Should log trace event
   */
  private shouldLogTraceEvent(type: string): boolean {
    const level = this.debugContext.traceLevel;

    if (level === "none") return false;
    if (level === "minimal") return type === "error";
    if (level === "normal") return type === "error" || type === "exit";
    if (level === "verbose") return true;
    if (level === "debug") return true;

    return false;
  }

  /**
   * Generate trace ID
   */
  private generateTraceId(): string {
    return `trace-${Date.now()}-${++this.traceIdCounter}`;
  }
}

export const createRuntimeObservability = (
  eventBus: EventBus,
  debugContext?: Partial<DebugContext>
): RuntimeObservability => {
  return new RuntimeObservability(eventBus, debugContext);
};
