import { Message, OmniBrainDecision, FusionResult, StreamCallbacks } from "../../types";
import { AgentManager, AgentRegistry } from "../ai/AgentManager";
import { IntentAnalyzer } from "../classifier/IntentAnalyzer";
import { TaskClassifier } from "../classifier/TaskClassifier";
import { SkillRegistry } from "../skills/skillRegistry";
import { MultiModelRouter } from "../router/MultiModelRouter";
import { ResponseFusion } from "../fusion/ResponseFusion";
import { memoryStore } from "../memory/memoryStore";
import { Logger } from "../system/Logger";
import { CognitiveLayerOrchestrator } from "../cognitive/CognitiveLayerOrchestrator";
import { ToolManager } from "../tools/ToolManager";
import { ToolRegistry } from "../tools/ToolRegistry";

export class OmniBrain {
  private apiKeys: Record<string, string>;
  private cognitiveLayer?: CognitiveLayerOrchestrator;

  constructor(apiKeys: Record<string, string>) {
    this.apiKeys = apiKeys;
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
    const lastMessage = messages[messages.length - 1].content;
    Logger.info("Processing new request", { messageLength: lastMessage.length });

    try {
      // 1. Memory Integration
      const context = memoryStore.getConversationContext(messages);
      const fullPrompt = context ? `${context}\n\n${lastMessage}` : lastMessage;

      // 2. Intent & Task Analysis
      const intent = IntentAnalyzer.analyze(fullPrompt);
      const taskClassification = TaskClassifier.classify(intent);
      Logger.debug("Task classified", { type: taskClassification.taskType });

      // 3. Try Cognitive Layer first (for complex tasks)
      if (this.cognitiveLayer && this.shouldUseCognitiveLayer(intent)) {
        try {
          Logger.info("Delegating to Cognitive Layer", { intentType: intent.type });
          const plan = await this.cognitiveLayer.executeGoal(fullPrompt, intent);
          
          // Extract final result from plan execution
          const executionStatus = this.cognitiveLayer.getExecutionStatus(plan.taskGraph.id);
          const finalResponse = JSON.stringify(executionStatus.latestSnapshot?.metrics || {}, null, 2);
          
          callbacks.onComplete(finalResponse);
          
          memoryStore.addMessage({ 
            id: `resp-${Date.now()}`, 
            role: "assistant", 
            content: finalResponse, 
            timestamp: Date.now() 
          });
          
          return {
            finalResponse,
            confidenceScore: intent.confidence,
            rawResponses: [],
          };
        } catch (cognitiveError: any) {
          Logger.warn("Cognitive Layer execution failed, falling back to traditional routing", 
            { error: cognitiveError.message });
        }
      }

      // 4. Fallback: Agent/Skill Selection
      const agents = AgentRegistry.getAllAgents();
      const matchingAgent = agents.find(a => a.id.includes(taskClassification.taskType));

      if (matchingAgent) {
        Logger.info(`Delegating task to agent: ${matchingAgent.name}`);
        await AgentManager.runAgent(matchingAgent.id, lastMessage, { apiKeys: this.apiKeys });
      }

      const selectedSkill = SkillRegistry.getSkill(taskClassification.taskType);
      if (!selectedSkill) {
        throw new Error(`No skill found for task type: ${taskClassification.taskType}`);
      }

      // 5. Routing Decision
      const decision: OmniBrainDecision = {
        skill: selectedSkill.name,
        providers: SkillRegistry.getSupportedProvidersForSkill(selectedSkill.name),
        routingStrategy: "parallel",
        fallbackProviders: ["anthropic", "openai"],
      };

      // 6. Execution via MultiModelRouter
      const providerResponses = await MultiModelRouter.routeAndExecute(
        decision.skill,
        messages,
        this.apiKeys,
        callbacks,
        signal
      );

      // 7. Response Fusion
      const fusionResult = ResponseFusion.fuseResponses(providerResponses);
      
      // 8. Finalize
      memoryStore.addMessage({ 
        id: `resp-${Date.now()}`, 
        role: "assistant", 
        content: fusionResult.finalResponse, 
        timestamp: Date.now() 
      });

      Logger.info("Request processing completed successfully");
      return fusionResult;

    } catch (error: any) {
      Logger.error("OmniBrain processing failed", { error: error.message });
      callbacks.onError(error);
    }
  }

  /**
   * Determine if Cognitive Layer should be used
   */
  private shouldUseCognitiveLayer(intent: Intent): boolean {
    // Use Cognitive Layer for complex tasks
    const complexIntents = ["reasoning", "code", "documents", "search"];
    return complexIntents.includes(intent.type) && intent.confidence > 0.7;
  }
}
