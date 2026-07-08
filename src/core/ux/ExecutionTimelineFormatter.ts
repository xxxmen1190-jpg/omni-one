import {
  ExecutionTimeline,
  TimelineStage,
  ExecutionContext,
} from "../../types/integration";
import { ExecutionTimeline as UITimeline, TimelineStage as UIStage } from "../../types/ux";
import { Logger } from "../system/Logger";

/**
 * Execution Timeline Formatter - Converts execution context to UI timeline
 */

export class ExecutionTimelineFormatter {
  private stageIcons: Record<string, string> = {
    input_processing: "📥",
    query_understanding: "🔍",
    planning: "📋",
    knowledge_retrieval: "📚",
    memory_injection: "🧠",
    execution: "⚙️",
    response_generation: "✨",
    complete: "✅",
  };

  private stageDisplayNames: Record<string, string> = {
    input_processing: "Processing Input",
    query_understanding: "Understanding Query",
    planning: "Creating Plan",
    knowledge_retrieval: "Searching Knowledge",
    memory_injection: "Loading Memory",
    execution: "Executing",
    response_generation: "Generating Response",
    complete: "Complete",
  };

  constructor() {
    Logger.info("ExecutionTimelineFormatter initialized");
  }

  /**
   * Format execution context to UI timeline
   */
  formatTimeline(executionContext: ExecutionContext): UITimeline {
    const stages: UIStage[] = [];
    let totalDuration = 0;

    for (const step of executionContext.steps) {
      const stage: UIStage = {
        id: step.stage,
        name: step.stage,
        displayName: this.stageDisplayNames[step.stage] || step.stage,
        icon: this.stageIcons[step.stage] || "⚡",
        startTime: step.startTime,
        endTime: step.endTime,
        duration: step.duration,
        status: this.mapStatus(step.status),
        details: this.formatDetails(step),
        error: step.error,
      };

      if (step.duration) {
        totalDuration += step.duration;
      }

      stages.push(stage);
    }

    return {
      id: executionContext.id,
      stages,
      totalDuration,
      startTime: executionContext.startTime,
      endTime: executionContext.endTime,
      overallStatus: executionContext.success ? "completed" : "failed",
    };
  }

  /**
   * Map execution status to UI status
   */
  private mapStatus(
    status: "pending" | "running" | "completed" | "failed"
  ): "pending" | "running" | "completed" | "failed" | "skipped" {
    return status;
  }

  /**
   * Format stage details
   */
  private formatDetails(step: any): string {
    const details: string[] = [];

    if (step.duration) {
      details.push(`${step.duration}ms`);
    }

    if (step.data) {
      if (step.data.itemsRetrieved) {
        details.push(`${step.data.itemsRetrieved} items`);
      }
      if (step.data.toolsUsed) {
        details.push(`${step.data.toolsUsed.length} tools`);
      }
      if (step.data.agentsUsed) {
        details.push(`${step.data.agentsUsed.length} agents`);
      }
    }

    return details.join(" • ");
  }

  /**
   * Calculate stage progress
   */
  calculateProgress(timeline: UITimeline): number {
    const completedStages = timeline.stages.filter(
      (s) => s.status === "completed"
    ).length;
    return Math.round((completedStages / timeline.stages.length) * 100);
  }

  /**
   * Get stage by name
   */
  getStage(timeline: UITimeline, stageName: string): UIStage | undefined {
    return timeline.stages.find((s) => s.name === stageName);
  }

  /**
   * Format duration
   */
  formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Get timeline summary
   */
  getTimelineSummary(timeline: UITimeline): string {
    const completedCount = timeline.stages.filter((s) => s.status === "completed").length;
    const failedCount = timeline.stages.filter((s) => s.status === "failed").length;
    const skippedCount = timeline.stages.filter((s) => s.status === "skipped").length;

    const parts: string[] = [];

    if (completedCount > 0) {
      parts.push(`${completedCount} completed`);
    }

    if (failedCount > 0) {
      parts.push(`${failedCount} failed`);
    }

    if (skippedCount > 0) {
      parts.push(`${skippedCount} skipped`);
    }

    parts.push(`${this.formatDuration(timeline.totalDuration)}`);

    return parts.join(" • ");
  }

  /**
   * Export timeline as JSON
   */
  exportAsJSON(timeline: UITimeline): string {
    return JSON.stringify(timeline, null, 2);
  }

  /**
   * Export timeline as CSV
   */
  exportAsCSV(timeline: UITimeline): string {
    const headers = ["Stage", "Status", "Start Time", "Duration", "Details"];
    const rows: string[] = [headers.join(",")];

    for (const stage of timeline.stages) {
      const row = [
        stage.displayName,
        stage.status,
        new Date(stage.startTime).toISOString(),
        stage.duration ? `${stage.duration}ms` : "",
        stage.details || "",
      ];

      rows.push(row.map((cell) => `"${cell}"`).join(","));
    }

    return rows.join("\n");
  }

  /**
   * Get critical path
   */
  getCriticalPath(timeline: UITimeline): UIStage[] {
    // For sequential execution, critical path is all stages
    return timeline.stages.filter((s) => s.status !== "skipped");
  }

  /**
   * Get bottleneck stage
   */
  getBottleneckStage(timeline: UITimeline): UIStage | null {
    let maxDuration = 0;
    let bottleneck: UIStage | null = null;

    for (const stage of timeline.stages) {
      if (stage.duration && stage.duration > maxDuration) {
        maxDuration = stage.duration;
        bottleneck = stage;
      }
    }

    return bottleneck;
  }

  /**
   * Get statistics
   */
  getStatistics(timeline: UITimeline): Record<string, any> {
    const durations = timeline.stages
      .filter((s) => s.duration)
      .map((s) => s.duration!);

    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b) / durations.length : 0;
    const maxDuration = Math.max(...durations, 0);
    const minDuration = Math.min(...durations, 0);

    return {
      totalStages: timeline.stages.length,
      completedStages: timeline.stages.filter((s) => s.status === "completed").length,
      failedStages: timeline.stages.filter((s) => s.status === "failed").length,
      skippedStages: timeline.stages.filter((s) => s.status === "skipped").length,
      totalDuration: timeline.totalDuration,
      averageStageDuration: avgDuration,
      maxStageDuration: maxDuration,
      minStageDuration: minDuration,
      bottleneck: this.getBottleneckStage(timeline)?.displayName,
    };
  }
}

export const createExecutionTimelineFormatter = (): ExecutionTimelineFormatter => {
  return new ExecutionTimelineFormatter();
};
