import { Message, ProviderName, StreamCallbacks, OmniBrainDecision, FusionResult, LogEntry, CacheEntry, RequestQueueItem, SkillName } from "../../types";
import { IntentAnalyzer } from "../classifier/IntentAnalyzer";
import { TaskClassifier } from "../classifier/TaskClassifier";
import { SkillRegistry } from "../skills/skillRegistry";
import { MultiModelRouter } from "../router/MultiModelRouter";
import { ResponseFusion } from "../fusion/ResponseFusion";
import { memoryStore } from "../memory/memoryStore";
import { IAIProvider } from "../providers/baseProvider";

// Placeholder for a simple logging mechanism
class Logger {
  static log(entry: LogEntry) {
    // In a real application, this would write to a file, a logging service, etc.
    console.log(`[${new Date(entry.timestamp).toISOString()}] [${entry.level.toUpperCase()}] ${entry.message}`, entry.context || {});
  }
}

// Placeholder for a simple caching mechanism
class CacheManager {
  private static cache = new Map<string, CacheEntry>();

  static get(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      return entry.value;
    }
    this.cache.delete(key); // Remove expired entry
    return undefined;
  }

  static set(key: string, value: any, ttl: number = 3600000) { // TTL in milliseconds, default 1 hour
    const expiry = Date.now() + ttl;
    this.cache.set(key, { key, value, expiry });
  }
}

// Placeholder for a simple request queue (for future priority/rate limiting)
class RequestQueue {
  private static queue: RequestQueueItem[] = [];
  private static isProcessing = false;

  static enqueue(item: RequestQueueItem) {
    this.queue.push(item);
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first
    this.processQueue();
  }

  private static async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        // Execute the request (this is a simplified placeholder)
        // In a real scenario, this would involve calling the actual provider execution logic
        // For now, we just resolve/reject the promise.
        // This queue is more for managing *incoming* requests to OmniBrain, not for provider calls.
        // Provider calls are handled by MultiModelRouter with Promise.all
        item.resolve(null); // Or call a method that executes the request
      } catch (error) {
        item.reject(error);
      }
    }
    this.isProcessing = false;
  }
}

export class OmniBrain {
  private apiKeys: Record<string, string>;

  constructor(apiKeys: Record<string, string>) {
    this.apiKeys = apiKeys;
    SkillRegistry.initialize(apiKeys);
  }

  async processRequest(
    messages: Message[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<FusionResult | void> {
    const lastMessage = messages[messages.length - 1].content;
    Logger.log({ timestamp: Date.now(), level: "info", message: "Processing new request", context: { lastMessage } });

    // 1. Memory Integration (Read from Memory)
    const context = memoryStore.getConversationContext(messages);
    const fullPrompt = context ? `${context}\n\n${lastMessage}` : lastMessage;

    // 2. Intent Analysis
    const intent = IntentAnalyzer.analyze(fullPrompt);
    Logger.log({ timestamp: Date.now(), level: "info", message: "Intent analyzed", context: { intent } });

    // 3. Task Classification
    const taskClassification = TaskClassifier.classify(intent);
    Logger.log({ timestamp: Date.now(), level: "info", message: "Task classified", context: { taskClassification } });

    // 4. Skill Selection (based on Task Classification)
    const selectedSkill = SkillRegistry.getSkill(taskClassification.taskType);
    if (!selectedSkill) {
      const error = new Error(`No skill found for task type: ${taskClassification.taskType}`);
      Logger.log({ timestamp: Date.now(), level: "error", message: error.message, context: { taskClassification } });
      callbacks.onError(error);
      return;
    }
    Logger.log({ timestamp: Date.now(), level: "info", message: "Skill selected", context: { skill: selectedSkill.name } });

    // 5. Provider Selection & Multi-Model Routing (Agent Decision)
    // For now, MultiModelRouter handles this based on skill.supportedProviders
    const decision: OmniBrainDecision = {
      skill: selectedSkill.name,
      providers: SkillRegistry.getSupportedProvidersForSkill(selectedSkill.name),
      routingStrategy: "parallel", // Default to parallel for now
      fallbackProviders: ["anthropic", "openai"], // Ordered fallback
    };
    Logger.log({ timestamp: Date.now(), level: "info", message: "OmniBrain Decision", context: { decision } });

    let providerResponses = [];
    try {
      // 6. Parallel Execution
      providerResponses = await MultiModelRouter.routeAndExecute(
        decision.skill,
        messages, // Use original messages for providers
        this.apiKeys,
        callbacks, // Pass original callbacks for real-time streaming
        signal
      );
    } catch (err: any) {
      Logger.log({ timestamp: Date.now(), level: "error", message: "Multi-model routing failed", context: { error: err.message } });
      // Smart Fallback (if initial routing fails completely)
      for (const fallbackProviderName of decision.fallbackProviders) {
        const fallbackProvider = SkillRegistry.getProviders().get(fallbackProviderName);
        if (fallbackProvider) {
          Logger.log({ timestamp: Date.now(), level: "warn", message: `Attempting fallback with ${fallbackProviderName}` });
          try {
            const fallbackResponse: ProviderResponse = { provider: fallbackProviderName, content: '', confidence: 0.5, latency: 0 };
            await fallbackProvider.generateStream({ messages, signal }, {
              onChunk: (chunk) => { fallbackResponse.content += chunk; callbacks.onChunk(chunk); },
              onComplete: (fullText) => { fallbackResponse.content = fullText; callbacks.onComplete(fullText); },
              onError: (e) => { fallbackResponse.error = e.message; callbacks.onError(e); },
            });
            providerResponses.push(fallbackResponse);
            break; // Stop after first successful fallback
          } catch (fallbackErr: any) {
            Logger.log({ timestamp: Date.now(), level: "error", message: `Fallback to ${fallbackProviderName} failed`, context: { error: fallbackErr.message } });
          }
        }
      }
      if (providerResponses.length === 0) {
        callbacks.onError(err); // If all fallbacks fail, report original error
        return;
      }
    }

    // 7. Response Fusion & Confidence Scoring
    const fusionResult = ResponseFusion.fuseResponses(providerResponses);
    Logger.log({ timestamp: Date.now(), level: "info", message: "Response fused", context: { fusionResult } });

    // 8. Memory Integration (Write to Memory - e.g., store conversation history)
    memoryStore.addMessage({ id: "omni-brain-response", role: "assistant", content: fusionResult.finalResponse, timestamp: Date.now() });

    // For streaming, the callbacks already handled the output. For non-streaming, return the final result.
    // The current implementation of generateStream in providers and MultiModelRouter is streaming-focused.
    // If a non-streaming final result is needed, the onComplete callback should be used to capture it.
    // For now, we assume streaming is the primary output method, and the fusion result is for internal use/logging.
    return fusionResult;
  }
}
