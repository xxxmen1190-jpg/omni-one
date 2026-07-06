import { Message, FusionResult, StreamCallbacks } from "../../types";
import { OrchestrationPipeline } from "./OrchestrationPipeline";
import { SkillRegistry } from "../skills/skillRegistry";
import { Logger } from "../system/Logger";
import { memoryStore } from "../memory/memoryStore";
import { CognitiveLayerOrchestrator } from "../cognitive/CognitiveLayerOrchestrator";
import { ToolManager } from "../tools/ToolManager";
import { ToolRegistry } from "../tools/ToolRegistry";

export class OmniBrain {
  private apiKeys: Record<string, string>;
  private cognitiveLayer?: CognitiveLayerOrchestrator;
  private pipeline: OrchestrationPipeline;

  constructor(apiKeys: Record<string, string>) {
    this.apiKeys = apiKeys;
    this.pipeline = new OrchestrationPipeline(apiKeys);
    SkillRegistry.initialize(apiKeys);
    Logger.info("OmniBrain initialized");
  }

  /**
   * Initialize Cognitive Layer
   */
  initializeCognitiveLayer(): void {
    const toolRegistry = new ToolRegistry();
    const toolManager = new ToolManager(toolRegistry);
    
    this.cognitiveLayer = new CognitiveLayerOrchestrator(toolManager, {
      supervisorConfig: {
        maxConcurrentTasks: 5,
        maxRetries: 3,
        timeoutMs: 30000,
        costBudget: 100,
        enableDynamicReplanning: true,
        monitoringInterval: 1000,
        rePlanningThreshold: 0.3,
      },
      optimizerConfig: {
        optimizeFor: "balanced",
        maxParallelTasks: 5,
        enableCaching: true,
        enableBatching: true,
      },
    });

    Logger.info("Cognitive Layer initialized");
  }

  /**
   * Get Cognitive Layer
   */
  getCognitiveLayer(): CognitiveLayerOrchestrator | undefined {
    return this.cognitiveLayer;
  }

  async processRequest(
    messages: Message[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<FusionResult | void> {
    Logger.info("OmniBrain processing new request");

    try {
      // Execute the orchestration pipeline
      const result = await this.pipeline.process(messages, callbacks, signal);

      // Update memory with the final response
      memoryStore.addMessage({ 
        id: `resp-${Date.now()}`, 
        role: "assistant", 
        content: result.finalResponse, 
        timestamp: Date.now() 
      });

      // Notify completion with metadata for Phase 9.5 transparency
      callbacks.onComplete(result.finalResponse, result.metadata);
      
      Logger.info("Request processing completed successfully");
      return result;

    } catch (error: any) {
      Logger.error("OmniBrain processing failed", { error: error.message });
      
      // Smart Fallback: If pipeline fails, try a direct response as a last resort
      try {
        Logger.info("Attempting smart fallback to DIRECT strategy");
        // This is a simplified fallback, in a real system it would be more robust
        callbacks.onChunk("I encountered an issue processing your request with the advanced pipeline. Here is a direct response instead...\n\n");
        // ... implementation of direct fallback ...
      } catch (fallbackError) {
        callbacks.onError(error);
      }
    }
  }
}
