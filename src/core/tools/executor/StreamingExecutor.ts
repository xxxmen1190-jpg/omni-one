import { UniversalToolExecutor } from "./UniversalToolExecutor";
import { EventBus } from "../../system/EventBus";
import { Logger } from "../../system/Logger";

export class StreamingExecutor {
  static async *executeWithStreaming(
    toolId: string,
    params: Record<string, any>,
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    Logger.info(`Starting streaming execution for tool ${toolId}`);
    
    EventBus.emit("tool:start", { toolId, params });
    yield `🔧 Executing tool: ${toolId}...\n`;

    try {
      const result = await UniversalToolExecutor.execute(toolId, params, signal);
      
      if (result.success) {
        EventBus.emit("tool:complete", { toolId, result });
        yield `✅ Tool execution completed successfully.\n`;
        yield JSON.stringify(result.output, null, 2);
      } else {
        EventBus.emit("tool:error", { toolId, error: result.error });
        yield `❌ Tool execution failed: ${result.error}\n`;
      }
    } catch (error: any) {
      EventBus.emit("tool:error", { toolId, error: error.message });
      Logger.error(`Streaming execution failed for tool ${toolId}`, { error: error.message });
      yield `❌ Error: ${error.message}\n`;
    }
  }
}
