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

    let selectedStrategy: StrategyType = "DIRECT";
    let skill: SkillName = intent.type as SkillName;
    let providers: ProviderName[] = ["openai", "anthropic"];
    let routingStrategy: "single" | "parallel" | "sequential" = "single";
    let fallbackProviders: ProviderName[] = ["openai"];
    const parameters: Record<string, any> = {};

    // Phase 14: Route by intent type first
    switch (intent.type) {
      case "vision":
      case "ocr":
        selectedStrategy = "VISION";
        skill = "vision";
        providers = ["openai", "anthropic", "gemini"];
        break;
      case "image":
        selectedStrategy = "IMAGE_GEN";
        skill = "image";
        providers = ["openai", "gemini"];
        break;
      case "voice":
        selectedStrategy = "VOICE";
        skill = "voice";
        providers = ["openai"];
        break;
      case "documents":
        selectedStrategy = "FILE_INTEL";
        skill = "documents";
        providers = ["openai", "anthropic"];
        break;
      case "search":
        selectedStrategy = context ? "RAG_MEMORY" : "WEB_SEARCH";
        skill = "search";
        providers = ["openai"];
        break;
      case "code":
        selectedStrategy = "AGENT_MODE";
        skill = "code";
        providers = ["openai", "anthropic"];
        break;
      default:
        if (context) {
          selectedStrategy = "RAG_MEMORY";
          skill = "chat";
        } else if (intent.confidence > 0.8 && intent.type === "chat") {
          selectedStrategy = "DIRECT";
          skill = "chat";
        } else {
          selectedStrategy = "DIRECT";
          skill = "chat";
        }
    }

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
