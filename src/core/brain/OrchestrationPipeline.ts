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
    const lastMessage = messages[messages.length - 1].content;
    Logger.info("Orchestration Pipeline started", { messageLength: lastMessage.length });

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

    Logger.info("Orchestration Pipeline completed");
    return fusionResult;
  }
}
