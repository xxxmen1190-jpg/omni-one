import { SkillName, Message, StreamCallbacks, ProviderResponse, ProviderName } from "../../types";
import { SkillRegistry } from "../skills/skillRegistry";
import { SmartCache } from "../system/SmartCache";
import { RequestQueue } from "../system/RequestQueue";
import { Metrics } from "../system/Metrics";
import { ProviderHealth } from "../system/ProviderHealth";
import { Logger } from "../system/Logger";

export class MultiModelRouter {
  static async routeAndExecute(
    skillName: SkillName,
    messages: Message[],
    apiKeys: Record<string, string>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<ProviderResponse[]> {
    const skill = SkillRegistry.getSkill(skillName);
    if (!skill) throw new Error(`Skill '${skillName}' not found.`);

    const supportedProviders = SkillRegistry.getSupportedProvidersForSkill(skillName);
    const availableProviders = supportedProviders.filter(p => ProviderHealth.isAvailable(p));

    if (availableProviders.length === 0) {
      throw new Error(`No healthy providers available for skill '${skillName}'.`);
    }

    // 1. Smart Cache Check
    const cacheKey = await SmartCache.generateHash({ skillName, messages });
    const cachedResponse = SmartCache.get<ProviderResponse[]>(cacheKey);
    if (cachedResponse) {
      Logger.info("Returning cached response", { skillName });
      cachedResponse.forEach(res => {
        if (!res.error) callbacks.onChunk(res.content);
      });
      callbacks.onComplete(cachedResponse[0].content); // Simple completion
      return cachedResponse;
    }

    // 2. Parallel Execution with Queue and Retry
    const executionPromises = availableProviders.map(async (providerName) => {
      return new Promise<ProviderResponse>((resolve) => {
        const queueItem = {
          id: `${providerName}-${Date.now()}`,
          priority: 1, // Can be dynamic
          request: { messages, signal },
          resolve: async () => {
            try {
              const response = await this.executeWithRetry(providerName, messages, signal);
              resolve(response);
            } catch (err: any) {
              resolve({
                provider: providerName,
                content: "",
                confidence: 0,
                latency: 0,
                error: err.message
              });
            } finally {
              RequestQueue.release();
            }
          },
          reject: (err: any) => {
            resolve({
              provider: providerName,
              content: "",
              confidence: 0,
              latency: 0,
              error: err.message
            });
          },
          signal: signal || new AbortController().signal
        };
        RequestQueue.enqueue(queueItem);
      });
    });

    const results = await Promise.all(executionPromises);
    
    // 3. Cache the result if successful
    if (results.some(r => !r.error)) {
      SmartCache.set(cacheKey, results);
    }

    return results;
  }

  private static async executeWithRetry(
    providerName: ProviderName,
    messages: Message[],
    signal?: AbortSignal,
    attempt: number = 1
  ): Promise<ProviderResponse> {
    const provider = SkillRegistry.getProviders().get(providerName);
    if (!provider) throw new Error(`Provider ${providerName} not found`);

    const maxRetries = provider.retryConfig?.maxRetries || 3;
    const initialDelay = provider.retryConfig?.initialDelay || 1000;
    const timeout = provider.timeoutMs || 30000;

    const startTime = Date.now();
    let content = "";

    try {
      await provider.generateStream(
        { messages, signal, options: { timeout } },
        {
          onChunk: (chunk) => { content += chunk; },
          onComplete: (full) => { content = full; },
          onError: (err) => { throw err; }
        }
      );

      const latency = Date.now() - startTime;
      Metrics.recordRequest(providerName, latency, true);
      ProviderHealth.recordSuccess(providerName);

      return {
        provider: providerName,
        content,
        confidence: 0.8, // Should be dynamic based on model
        latency
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      // Retry logic: Exponential Backoff
      if (attempt < maxRetries && this.isRetryable(error)) {
        const delay = initialDelay * Math.pow(2, attempt - 1);
        Logger.warn(`Retrying ${providerName} (Attempt ${attempt + 1}/${maxRetries}) in ${delay}ms`, { error: error.message });
        await new Promise(r => setTimeout(r, delay));
        return this.executeWithRetry(providerName, messages, signal, attempt + 1);
      }

      Metrics.recordRequest(providerName, latency, false);
      ProviderHealth.recordFailure(providerName);
      Logger.error(`Provider ${providerName} failed after ${attempt} attempts`, { error: error.message });
      throw error;
    }
  }

  private static isRetryable(error: any): boolean {
    const msg = error.message.toLowerCase();
    return msg.includes("timeout") || msg.includes("rate limit") || msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504");
  }
}
