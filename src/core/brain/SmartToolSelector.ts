import { OmniBrainDecision, StrategyType } from "../../types";
import { Logger } from "../system/Logger";

export interface ToolTask {
  toolName: string;
  input: any;
  priority: number;
  parallel: boolean;
}

export class SmartToolSelector {
  static planTools(decision: OmniBrainDecision, query: string): ToolTask[] {
    Logger.info("Planning tools", { strategy: decision.selectedStrategy });
    const tasks: ToolTask[] = [];

    switch (decision.selectedStrategy) {
      case "WEB_SEARCH":
        tasks.push({
          toolName: "WebSearchTool",
          input: query,
          priority: 1,
          parallel: false
        });
        break;
      case "DEEP_RESEARCH":
        tasks.push({
          toolName: "WebSearchTool",
          input: query,
          priority: 1,
          parallel: true
        });
        tasks.push({
          toolName: "WikipediaTool",
          input: query,
          priority: 1,
          parallel: true
        });
        tasks.push({
          toolName: "NewsTool",
          input: query,
          priority: 1,
          parallel: true
        });
        break;
      case "RAG_MEMORY":
        tasks.push({
          toolName: "RAGCore",
          input: query,
          priority: 1,
          parallel: false
        });
        break;
      case "AGENT_MODE":
        tasks.push({
          toolName: "AgentManager",
          input: query,
          priority: 1,
          parallel: false
        });
        break;
      case "DIRECT":
      default:
        tasks.push({
          toolName: "MultiModelRouter",
          input: query,
          priority: 1,
          parallel: false
        });
        break;
    }

    return tasks;
  }
}
