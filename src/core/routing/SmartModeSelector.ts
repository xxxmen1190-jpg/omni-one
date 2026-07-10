import { Intent, TaskClassification, DisplayMode } from "../../types";
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
    let selectedMode: DisplayMode = "simple";

    // Trivial queries (greetings, one-word answers) must never escalate
    if (this.isTrivialQuery(query)) {
      Logger.info("SmartModeSelector: Selected SIMPLE mode (trivial/greeting query)");
      return selectedMode;
    }

    const isComplex = this.isComplexQuery(query);
    const requiresResearch = this.requiresWebResearch(intent, taskClassification, query);
    const requiresAgents = this.requiresAgents(taskClassification, query);
    const hasMultipleParts = this.hasMultipleParts(query);

    if (requiresAgents) {
      selectedMode = "agent";
      Logger.info("SmartModeSelector: Selected AGENT mode (multi-step task detected)");
    } else if (requiresResearch) {
      selectedMode = "research";
      Logger.info("SmartModeSelector: Selected RESEARCH mode (web search required)");
    } else if (isComplex || hasMultipleParts || query.length > 300) {
      selectedMode = "pro";
      Logger.info("SmartModeSelector: Selected PRO mode (complex query detected)");
    } else {
      selectedMode = "simple";
      Logger.info("SmartModeSelector: Selected SIMPLE mode (straightforward query)");
    }

    return selectedMode;
  }

  /**
   * Trivial queries that should never trigger research or agent mode.
   */
  private static isTrivialQuery(query: string): boolean {
    const trivialPatterns = [
      /^(hi|hello|hey|yo|sup|howdy)[!?.]*$/i,
      /^how are you[?!.]*$/i,
      /^what('s| is) your name[?!.]*$/i,
      /^thanks?[!.]*$/i,
      /^ok[!.]*$/i,
      /^(yes|no|sure|okay)[!.]*$/i,
    ];
    return trivialPatterns.some((p) => p.test(query.trim()));
  }

  /**
   * Detect if a query is genuinely complex.
   * Requires at least 2 signals to avoid false positives on simple "how" questions.
   */
  private static isComplexQuery(query: string): boolean {
    const complexIndicators = [
      /\bwhy\b/i,
      /\bexplain\b/i,
      /\banalyze\b/i,
      /\bcompare\b/i,
      /\bcontrast\b/i,
      /\bevaluate\b/i,
      /\bdiscuss\b/i,
      /\bpros and cons\b/i,
      /\badvantages and disadvantages\b/i,
      /\bimplications\b/i,
      /\bconsequences\b/i,
      /\bcorrelation\b/i,
    ];
    const matches = complexIndicators.filter((p) => p.test(query)).length;
    // Require at least 2 signals, or query must be long AND have 1 signal
    return matches >= 2 || (matches >= 1 && query.length > 150);
  }

  /**
   * Detect if a query requires web research.
   * Checks the raw query string — not JSON.stringify of classification.
   */
  private static requiresWebResearch(
    intent: Intent,
    taskClassification: TaskClassification,
    query: string
  ): boolean {
    const researchIntents = ["search", "research", "current", "recent", "latest", "news"];
    const queryNeedsResearch = researchIntents.some((keyword) =>
      taskClassification.taskType.toLowerCase().includes(keyword)
    );

    // Time-sensitive patterns — use dynamic year, never hardcoded
    const currentYear = new Date().getFullYear();
    const timeSensitivePatterns: RegExp[] = [
      /\blatest\b/i,
      /\brecent\b/i,
      /\bcurrent\b/i,
      /\btoday\b/i,
      /\bthis (year|month|week)\b/i,
      /\bbreaking\b/i,
      /\bnews\b/i,
      new RegExp(`\\b${currentYear}\\b`),
      new RegExp(`\\b${currentYear + 1}\\b`),
    ];
    const isTimeSensitive = timeSensitivePatterns.some((p) => p.test(query));

    return queryNeedsResearch || isTimeSensitive;
  }

  /**
   * Detect if a query requires agent-based execution.
   * Only triggers for explicit multi-step / automation requests.
   * Removed "code" and "programming" — those are handled by simple/pro mode.
   */
  private static requiresAgents(
    taskClassification: TaskClassification,
    query: string
  ): boolean {
    const agentTaskTypes = ["automation", "workflow", "multi-step", "research project"];
    const typeMatch = agentTaskTypes.some((task) =>
      taskClassification.taskType.toLowerCase().includes(task)
    );

    // Explicit agent-trigger phrases in the raw query
    const agentPhrases = [
      /\bstep by step\b/i,
      /\bautomate\b/i,
      /\bworkflow\b/i,
      /\bmulti.?step\b/i,
      /\brun a (series|sequence|pipeline)\b/i,
    ];
    const phraseMatch = agentPhrases.some((p) => p.test(query));

    return typeMatch || phraseMatch;
  }

  /**
   * Detect if query has multiple genuinely separate parts.
   * Tightened to avoid triggering on normal sentences with "and" or "also".
   */
  private static hasMultipleParts(query: string): boolean {
    const multiPartIndicators = [
      /\?\s+[A-Z]/,          // Multiple questions
      /;\s*[A-Z]/,           // Multiple statements separated by semicolons
      /^\d+\.\s+/m,          // Numbered list
      /\balso\b.*\balso\b/i, // "also ... also" pattern
    ];
    return multiPartIndicators.some((p) => p.test(query));
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
