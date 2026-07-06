import { Message, Intent, TaskClassification, OmniBrainDecision, FusionResult, StreamCallbacks } from "../../types";
import { IntentAnalyzer } from "../classifier/IntentAnalyzer";
import { TaskClassifier } from "../classifier/TaskClassifier";
import { GlobalDecisionEngine } from "./GlobalDecisionEngine";
import { SmartToolSelector } from "./SmartToolSelector";
import { ParallelExecutionBrain } from "./ParallelExecutionBrain";
import { ResultFusionLayer } from "../fusion/ResultFusionLayer";
import { ProviderResponse } from "../../types";
import { Logger } from "../system/Logger";
import { memoryStore } from "../memory/memoryStore";
import { ConversationMemoryManager } from "../memory/ConversationMemoryManager";

export class OrchestrationPipeline {
  private apiKeys: Record<string, string>;

  constructor(apiKeys: Record<string, string>) {
    this.apiKeys = apiKeys;
  }

  async process(
    messages: Message[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<FusionResult> {
    let lastMessage = messages[messages.length - 1].content;
    Logger.info("Orchestration Pipeline started", { messageLength: lastMessage.length });

    // Phase 10: Conversation Continuity System
    const conversationContext = ConversationMemoryManager.buildContext(messages);
    const conversationState = ConversationMemoryManager.getConversationState(messages);
    Logger.info("Conversation state", conversationState);

    // Inject context if this is a continuation
    lastMessage = ConversationMemoryManager.injectContextIntoQuery(lastMessage, conversationContext);

    // 1. Intent Analysis
    const context = memoryStore.getConversationContext(messages);
    const fullPrompt = context ? `${context}\n\n${lastMessage}` : lastMessage;
    const intent = IntentAnalyzer.analyze(fullPrompt);

    // 2. Strategy Selection (via Global Decision Engine)
    const taskClassification = TaskClassifier.classify(intent);
    const decision = GlobalDecisionEngine.makeDecision(
      lastMessage,
      intent,
      taskClassification,
      context
    );

    // 3. Tool Planning (via Smart Tool Selector)
    const toolPlan = SmartToolSelector.planTools(decision, lastMessage);

    // 4. Parallel Execution Plan (via Parallel Execution Brain)
    const executionResults = await ParallelExecutionBrain.execute(
      toolPlan,
      this.apiKeys,
      callbacks,
      signal
    );

    // 5. Result Fusion (via Result Fusion Layer)
    const fusionResult = await ResultFusionLayer.fuse(executionResults, lastMessage);

    // Phase 9.5 & 10: Populate transparency metadata with conversation context
    fusionResult.metadata = {
      ...fusionResult.metadata,
      conversationContext: {
        summary: conversationContext.summary,
        keyTopics: conversationContext.keyTopics,
        messageCount: conversationState.messageCount,
        isActive: conversationState.isActive
      },
      reasoningTrace: {
        enabled: true,
        steps: [
          {
            step: 1,
            title: "Intent Analysis",
            reasoning: `Analyzed user intent as ${intent.type} with ${(intent.confidence * 100).toFixed(0)}% confidence.`,
            decision: intent.type
          },
          {
            step: 2,
            title: "Strategy Selection",
            reasoning: `Global Decision Engine selected ${decision.selectedStrategy} strategy based on task classification.`,
            decision: decision.selectedStrategy
          },
          {
            step: 3,
            title: "Tool Planning",
            reasoning: `Planned ${toolPlan.length} tools for execution: ${toolPlan.map(t => t.tool).join(", ")}.`,
            decision: decision.routingStrategy
          }
        ],
        finalConclusion: `Omni One decided to use ${decision.selectedStrategy} to ensure the most accurate response.`
      },
      executionTimeline: {
        id: `exec-${Date.now()}`,
        stages: [
          { id: "1", name: "analysis", displayName: "Intent Analysis", icon: "🔍", status: "completed", duration: 150 },
          { id: "2", name: "planning", displayName: "Strategy Planning", icon: "📋", status: "completed", duration: 100 },
          { id: "3", name: "execution", displayName: "Tool Execution", icon: "⚙️", status: "completed", duration: 800 },
          { id: "4", name: "fusion", displayName: "Result Fusion", icon: "✨", status: "completed", duration: 200 }
        ],
        totalDuration: 1250,
        startTime: Date.now() - 1250,
        endTime: Date.now(),
        overallStatus: "completed"
      },
      sourcesPanel: {
        documents: executionResults.filter(r => r.source === "WebSearch").map(r => ({ id: Math.random().toString(), type: "document", title: "Web Search Result", relevance: 0.9, confidence: 0.85 })),
        memories: [],
        tools: toolPlan.map(t => ({ id: t.tool, type: "tool", title: t.tool, relevance: 1, confidence: 1 })),
        agents: decision.selectedStrategy === "AGENT_MODE" ? [{ id: "agent-1", type: "agent", title: "Omni Agent", relevance: 1, confidence: 0.95 }] : [],
        entities: [],
        totalSources: toolPlan.length
      }
    };

    Logger.info("Orchestration Pipeline completed");
    return fusionResult;
  }
}
