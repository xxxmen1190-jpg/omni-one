import { Message, FusionResult, StreamCallbacks } from "../../types";
import { OrchestrationPipeline } from "./OrchestrationPipeline";
import { SkillRegistry } from "../skills/skillRegistry";
import { Logger } from "../system/Logger";
import { memoryStore } from "../memory/memoryStore";
import { CognitiveLayerOrchestrator } from "../cognitive/CognitiveLayerOrchestrator";
import { ToolManager } from "../tools/ToolManager";
import { ToolRegistry } from "../tools/ToolRegistry";
import { ResponseQualityFilter } from "../quality/ResponseQualityFilter";
import { FinalDecisionValidator } from "../validation/FinalDecisionValidator";
import { ErrorRecoveryLayer } from "../error/ErrorRecoveryLayer";
import { SmartModeSelector } from "../routing/SmartModeSelector";
import { IntentAnalyzer } from "../classifier/IntentAnalyzer";
import { TaskClassifier } from "../classifier/TaskClassifier";
import { FailureRecoverySystem } from "../integration/FailureRecoverySystem";
import { RuntimeManager } from "../runtime/RuntimeManager";
import { initializeToolRegistry } from "../tools/ToolInitializer";

export class OmniBrain {
  private apiKeys: Record<string, string>;
  private cognitiveLayer?: CognitiveLayerOrchestrator;
  private pipeline: OrchestrationPipeline;

  private runtimeManager: RuntimeManager;

  constructor(apiKeys: Record<string, string>) {
    this.apiKeys = apiKeys;
    this.runtimeManager = new RuntimeManager();
    this.pipeline = new OrchestrationPipeline(apiKeys, this.runtimeManager);
    
    // Phase 11.6: Initialize all subsystems
    this.initializeSystems(apiKeys);
    Logger.info("OmniBrain initialized with all subsystems wired");
  }

  /**
   * Initialize all core subsystems
   */
  private async initializeSystems(apiKeys: Record<string, string>): Promise<void> {
    // 1. Initialize Skill Registry (bootstrap providers, skills, agents)
    SkillRegistry.initialize(apiKeys);

    // 2. Initialize Runtime Manager
    await this.runtimeManager.initialize();

    // 3. Initialize Cognitive Layer
    this.initializeCognitiveLayer();

    Logger.info("All core subsystems initialized");
  }

  /**
   * Initialize Cognitive Layer
   */
  initializeCognitiveLayer(): void {
    // Phase 12.2: Initialize tool registry with all native tools
    const toolRegistry = initializeToolRegistry();
    const toolManager = new ToolManager(toolRegistry);
    
    Logger.info(`Tool Registry initialized with ${toolRegistry.size()} tools`);
    
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

    Logger.info(`Cognitive Layer initialized with ${toolRegistry.size()} tools`);
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
      const lastMessage = messages[messages.length - 1].content;

      // Phase 10: Smart Mode Selection
      const intent = IntentAnalyzer.analyze(lastMessage);
      const taskClassification = TaskClassifier.classify(intent);
      const selectedMode = SmartModeSelector.selectOptimalMode(
        lastMessage,
        intent,
        taskClassification
      );
      Logger.info("Smart mode selected", { mode: selectedMode });

      // Execute the orchestration pipeline with FailureRecoverySystem integration
      const result = await FailureRecoverySystem.executeRecovery(
        async () => {
          return await ErrorRecoveryLayer.executeWithRecovery(
            () => this.pipeline.process(messages, callbacks, signal),
            "OrchestrationPipeline"
          );
        },
        "execution"
      );

      // Phase 10: Response Quality Filtering
      const qualityMetrics = ResponseQualityFilter.analyzeQuality(result);
      Logger.info("Response quality analyzed", qualityMetrics);

      // If quality is poor, attempt reprocessing
      let finalResult = result;
      if (ResponseQualityFilter.shouldReprocess(qualityMetrics)) {
        Logger.info("Quality threshold not met, attempting reprocessing");
        finalResult = await ErrorRecoveryLayer.executeWithRecovery(
          () => this.pipeline.process(messages, callbacks, signal),
          "OrchestrationPipeline (Reprocess)",
          result // Use original result as fallback
        );
      }

      // Phase 10: Final Decision Validation
      const validation = FinalDecisionValidator.validate(finalResult, lastMessage);
      Logger.info("Final validation passed", validation);

      // If validation fails, generate fallback
      let responseToSend = finalResult.finalResponse;
      if (!validation.isValid && validation.score < 0.4) {
        Logger.warn("Validation failed, using fallback response");
        responseToSend = ResponseQualityFilter.generateFallbackResponse(
          lastMessage,
          qualityMetrics
        );
      }

      // Update memory with the final response
      memoryStore.addMessage({ 
        id: `resp-${Date.now()}`, 
        role: "assistant", 
        content: responseToSend, 
        timestamp: Date.now() 
      });

      // Enhance metadata with Phase 10 information
      const enhancedMetadata = {
        ...finalResult.metadata,
        selectedMode,
        qualityMetrics,
        validation
      };

      // Notify completion with metadata for Phase 9.5 transparency
      callbacks.onComplete(responseToSend, enhancedMetadata);
      
      Logger.info("Request processing completed successfully");
      return { ...finalResult, finalResponse: responseToSend, metadata: enhancedMetadata };

    } catch (error: any) {
      Logger.error("OmniBrain processing failed", { error: error.message });
      ErrorRecoveryLayer.logError(error, { operation: "OmniBrain.processRequest" });
      
      // Phase 10: Error-Free UX - Generate graceful fallback
      const errorClassification = ErrorRecoveryLayer.classifyError(error);
      const fallbackResponse = ErrorRecoveryLayer.generateFallbackResponse(
        messages[messages.length - 1].content,
        errorClassification.type
      );

      // Send fallback response instead of error
      callbacks.onComplete(fallbackResponse, {
        error: true,
        errorType: errorClassification.type,
        recoverable: errorClassification.recoverable
      });
    }
  }
}
