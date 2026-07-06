import { Intent, TaskClassification } from "../../types";
import { DisplayMode } from "../../types/ux";
import { Logger } from "../system/Logger";

export class SmartModeSelector {
  /**
   * Automatically select the best display mode based on query characteristics
   * This ensures users get Simple Mode by default but automatically upgrade when needed
   */
  static selectOptimalMode(
    query: string,
    intent: Intent,
    taskClassification: TaskClassification,
    previousMode?: DisplayMode
  ): DisplayMode {
    // Start with Simple mode as default
    let selectedMode: DisplayMode = "simple";

    // Analyze query characteristics
    const queryLength = query.length;
    const isComplex = this.isComplexQuery(query);
    const requiresResearch = this.requiresWebResearch(intent, taskClassification);
    const requiresAgents = this.requiresAgents(taskClassification);
    const hasMultipleParts = this.hasMultipleParts(query);

    // Decision tree for mode selection
    if (requiresAgents) {
      selectedMode = "agent";
      Logger.info("SmartModeSelector: Selected AGENT mode (multi-step task detected)");
    } else if (requiresResearch) {
      selectedMode = "research";
      Logger.info("SmartModeSelector: Selected RESEARCH mode (web search required)");
    } else if (isComplex || hasMultipleParts || queryLength > 200) {
      selectedMode = "pro";
      Logger.info("SmartModeSelector: Selected PRO mode (complex query detected)");
    } else {
      selectedMode = "simple";
      Logger.info("SmartModeSelector: Selected SIMPLE mode (straightforward query)");
    }

    // Respect user's previous mode preference if they explicitly set it
    // (This would be tracked in a separate user preference system)
    
    return selectedMode;
  }

  /**
   * Detect if a query is complex and requires deeper reasoning
   */
  private static isComplexQuery(query: string): boolean {
    const complexIndicators = [
      /why/i,
      /how/i,
      /explain/i,
      /analyze/i,
      /compare/i,
      /contrast/i,
      /evaluate/i,
      /discuss/i,
      /pros and cons/i,
      /advantages and disadvantages/i,
      /implications/i,
      /consequences/i,
      /relationship/i,
      /correlation/i
    ];

    return complexIndicators.some(indicator => indicator.test(query));
  }

  /**
   * Detect if a query requires web research
   */
  private static requiresWebResearch(intent: Intent, taskClassification: TaskClassification): boolean {
    const researchIntents = ["search", "research", "current", "recent", "latest", "news"];
    const queryNeedsResearch = researchIntents.some(keyword => 
      taskClassification.taskType.toLowerCase().includes(keyword)
    );

    // Also check for time-sensitive queries
    const timeSensitivePatterns = [
      /latest/i,
      /recent/i,
      /current/i,
      /today/i,
      /this year/i,
      /2024/i,
      /2025/i,
      /breaking/i,
      /news/i
    ];

    const isTimeSensitive = timeSensitivePatterns.some(pattern => 
      pattern.test(JSON.stringify(taskClassification))
    );

    return queryNeedsResearch || isTimeSensitive;
  }

  /**
   * Detect if a query requires agent-based execution
   */
  private static requiresAgents(taskClassification: TaskClassification): boolean {
    const agentTasks = [
      "code",
      "programming",
      "development",
      "automation",
      "workflow",
      "multi-step",
      "complex task",
      "research project"
    ];

    return agentTasks.some(task => 
      taskClassification.taskType.toLowerCase().includes(task)
    );
  }

  /**
   * Detect if query has multiple parts that need separate handling
   */
  private static hasMultipleParts(query: string): boolean {
    // Look for conjunctions and multiple questions
    const multiPartIndicators = [
      /and\s+/i,
      /also\s+/i,
      /additionally\s+/i,
      /furthermore\s+/i,
      /\?\s*[A-Z]/,  // Multiple questions
      /;\s*[A-Z]/,   // Multiple statements
      /\d+\.\s+/     // Numbered list
    ];

    return multiPartIndicators.some(indicator => indicator.test(query));
  }

  /**
   * Get mode description for UI display
   */
  static getModeDescription(mode: DisplayMode): string {
    const descriptions: Record<DisplayMode, string> = {
      simple: "Clean, direct answers",
      pro: "Full reasoning & transparency",
      research: "Web + Deep Research",
      agent: "Complex multi-step tasks",
      debug: "Developer debug mode"
    };

    return descriptions[mode] || "Unknown mode";
  }

  /**
   * Get mode recommendation reason
   */
  static getModeReason(mode: DisplayMode, query: string): string {
    switch (mode) {
      case "agent":
        return "This query requires multi-step execution and agent coordination";
      case "research":
        return "This query benefits from web research and external sources";
      case "pro":
        return "This complex query shows detailed reasoning for transparency";
      case "simple":
        return "This straightforward query gets a direct answer";
      default:
        return "Mode selected based on query analysis";
    }
  }
}
