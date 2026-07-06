import { Message, OmniBrainDecision, FusionResult, StreamCallbacks } from "../../types";
import { AgentManager, AgentRegistry } from "../ai/AgentManager";
import { IntentAnalyzer } from "../classifier/IntentAnalyzer";
import { TaskClassifier } from "../classifier/TaskClassifier";
import { SkillRegistry } from "../skills/skillRegistry";
import { MultiModelRouter } from "../router/MultiModelRouter";
import { ResponseFusion } from "../fusion/ResponseFusion";
import { memoryStore } from "../memory/memoryStore";
import { Logger } from "../system/Logger";

export class OmniBrain {
  private apiKeys: Record<string, string>;

  constructor(apiKeys: Record<string, string>) {
    this.apiKeys = apiKeys;
    SkillRegistry.initialize(apiKeys);
    Logger.info("OmniBrain initialized");
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

      // 3. Agent/Skill Selection
      // Check if there's a specific agent for this task
      const agents = AgentRegistry.getAllAgents();
      const matchingAgent = agents.find(a => a.id.includes(taskClassification.taskType));

      if (matchingAgent) {
        Logger.info(`Delegating task to agent: ${matchingAgent.name}`);
        await AgentManager.runAgent(matchingAgent.id, lastMessage, { apiKeys: this.apiKeys });
        // After agent execution, we might want to continue or return
      }

      const selectedSkill = SkillRegistry.getSkill(taskClassification.taskType);
      if (!selectedSkill) {
        throw new Error(`No skill found for task type: ${taskClassification.taskType}`);
      }

      // 4. Routing Decision
      const decision: OmniBrainDecision = {
        skill: selectedSkill.name,
        providers: SkillRegistry.getSupportedProvidersForSkill(selectedSkill.name),
        routingStrategy: "parallel",
        fallbackProviders: ["anthropic", "openai"],
      };

      // 5. Execution via MultiModelRouter
      const providerResponses = await MultiModelRouter.routeAndExecute(
        decision.skill,
        messages,
        this.apiKeys,
        callbacks,
        signal
      );

      // 6. Response Fusion
      const fusionResult = ResponseFusion.fuseResponses(providerResponses);
      
      // 7. Finalize
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
}
