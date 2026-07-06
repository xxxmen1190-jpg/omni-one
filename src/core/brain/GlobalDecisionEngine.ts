import { Intent, TaskClassification, OmniBrainDecision, StrategyType, SkillName, ProviderName } from "../../types";
import { Logger } from "../system/Logger";

export class GlobalDecisionEngine {

  static makeDecision(
    userQuery: string,
    intent: Intent,
    taskClassification: TaskClassification,
    context: string | null
  ): OmniBrainDecision {
    Logger.info("Making global decision", { intentType: intent.type, taskType: taskClassification.taskType });

    let selectedStrategy: StrategyType;
    let skill: SkillName = intent.type as SkillName; // Default to intent type as skill
    let providers: ProviderName[] = ["openai", "anthropic"]; // Default providers
    let routingStrategy: "single" | "parallel" | "sequential" = "single";
    let fallbackProviders: ProviderName[] = ["openai"];
    let parameters: Record<string, any> = {};

    // Implement Routing Rules (Core Logic)
    if (userQuery.startsWith("מה זה")) {
      selectedStrategy = "DIRECT"; // Or RAG_MEMORY if internal knowledge is available
      skill = "chat";
    } else if (userQuery.startsWith("מה קורה עכשיו")) {
      selectedStrategy = "WEB_SEARCH";
      skill = "search";
      providers = ["openai"]; // Assuming WebSearchTool uses a single provider for search
      routingStrategy = "single";
    } else if (userQuery.startsWith("תחקור לי")) {
      selectedStrategy = "DEEP_RESEARCH";
      skill = "search";
      providers = ["openai", "anthropic"]; // Potentially multiple for cross-validation
      routingStrategy = "parallel";
    } else if (userQuery.startsWith("תכתוב לי קוד")) {
      selectedStrategy = "AGENT_MODE";
      skill = "code";
      providers = ["openai"]; // Agents might use specific code-generating models
      routingStrategy = "single";
    } else if (userQuery.includes("מי יותר טוב בין")) {
      selectedStrategy = "WEB_SEARCH"; // Combined with comparison logic later
      skill = "search";
      providers = ["openai"];
      routingStrategy = "parallel"; // For comparing multiple sources
    } else if (context) {
      selectedStrategy = "RAG_MEMORY";
      skill = "chat";
    } else {
      // Default strategy based on intent and confidence
      if (intent.confidence > 0.8 && intent.type === "chat") {
        selectedStrategy = "DIRECT";
      } else if (intent.confidence > 0.6 && intent.type === "search") {
        selectedStrategy = "WEB_SEARCH";
      } else if (intent.confidence > 0.7 && intent.type === "code") {
        selectedStrategy = "AGENT_MODE";
      } else {
        selectedStrategy = "DIRECT"; // Fallback to direct if no clear intent or low confidence
      }
    }

    // Further refine skill and providers based on selected strategy
    switch (selectedStrategy) {
      case "DIRECT":
        skill = "chat";
        providers = ["openai", "anthropic"];
        routingStrategy = "single";
        break;
      case "WEB_SEARCH":
        skill = "search";
        providers = ["openai"]; // Assuming a tool-based search
        routingStrategy = "single";
        break;
      case "DEEP_RESEARCH":
        skill = "search";
        providers = ["openai", "anthropic"];
        routingStrategy = "parallel";
        break;
      case "RAG_MEMORY":
        skill = "chat";
        providers = ["openai", "anthropic"];
        routingStrategy = "single";
        break;
      case "AGENT_MODE":
        skill = "code"; // Agents can be for various skills, defaulting to code for now
        providers = ["openai"];
        routingStrategy = "single";
        break;
    }

    // Smart Fallback (if initial decision is too ambitious or fails)
    // This will be handled in the Orchestration Pipeline, but the decision can suggest a fallback path.
    // For now, we'll just ensure fallbackProviders are set.

    Logger.debug("Decision made", { selectedStrategy, skill, providers, routingStrategy });

    return {
      skill,
      providers,
      routingStrategy,
      fallbackProviders,
      selectedStrategy,
      parameters,
    };
  }
}
