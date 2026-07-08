import { ToolTask } from "./SmartToolSelector";
import { WebSearchTool } from "../webIntelligence/WebSearchTool";
import { WikipediaTool } from "../webIntelligence/WikipediaTool";
import { NewsTool } from "../webIntelligence/NewsTool";
import { KnowledgeEngine } from "../knowledge/KnowledgeEngine";
import { AgentManager } from "../ai/AgentManager";
import { MultiModelRouter } from "../router/MultiModelRouter";
import { Logger } from "../system/Logger";
import { StreamCallbacks } from "../../types";

export interface ExecutionResult {
  source: string;
  data: any;
  success: boolean;
  error?: string;
}

export class ParallelExecutionBrain {
  static async execute(
    tasks: ToolTask[],
    apiKeys: Record<string, string>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<ExecutionResult[]> {
    Logger.info("Executing tasks in parallel where possible", { taskCount: tasks.length });

    const parallelTasks = tasks.filter(t => t.parallel);
    const sequentialTasks = tasks.filter(t => !t.parallel);

    const results: ExecutionResult[] = [];

    // Execute parallel tasks
    if (parallelTasks.length > 0) {
      const parallelPromises = parallelTasks.map(task => this.runTask(task, apiKeys, callbacks, signal));
      const parallelResults = await Promise.all(parallelPromises);
      results.push(...parallelResults);
    }

    // Execute sequential tasks
    for (const task of sequentialTasks) {
      const result = await this.runTask(task, apiKeys, callbacks, signal);
      results.push(result);
    }

    return results;
  }

  private static async runTask(
    task: ToolTask,
    apiKeys: Record<string, string>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<ExecutionResult> {
    try {
      Logger.debug(`Running task: ${task.toolName}`);
      let data: any;

      switch (task.toolName) {
        case "WebSearchTool": {
          const webSearch = new WebSearchTool();
          data = await webSearch.search({ query: typeof task.input === "string" ? task.input : task.input.query || "" });
          break;
        }
        case "WikipediaTool": {
          const wiki = new WikipediaTool();
          data = await wiki.search(typeof task.input === "string" ? task.input : task.input.query || "");
          break;
        }
        case "NewsTool": {
          const news = new NewsTool();
          data = await news.searchNews(typeof task.input === "string" ? task.input : task.input.query || "");
          break;
        }
        case "RAGCore": {
          const ke = new KnowledgeEngine();
          data = await ke.retrieveContext(
            typeof task.input === "string" ? task.input : task.input.query || "",
            "default-user",
            "default-session"
          );
          break;
        }
        case "AgentManager":
          data = await AgentManager.runAgent("coding-agent", task.input, { apiKeys });
          break;
        case "MultiModelRouter":
          data = await MultiModelRouter.routeAndExecute(
            "chat",
            [{ id: "1", role: "user", content: typeof task.input === "string" ? task.input : JSON.stringify(task.input), timestamp: Date.now() }],
            apiKeys,
            callbacks,
            signal
          );
          break;
        default:
          throw new Error(`Unknown tool: ${task.toolName}`);
      }

      return { source: task.toolName, data, success: true };
    } catch (error: any) {
      Logger.error(`Task ${task.toolName} failed`, { error: error.message });
      return { source: task.toolName, data: null, success: false, error: error.message };
    }
  }
}
