import {
  AIProviderType,
  ChatRequest,
  ChatResponse,
  StreamResponse,
  StreamChunk,
  EmbeddingRequest,
  EmbeddingResponse,
  VisionRequest,
  VisionResponse,
  ProviderHealth,
  AICapability,
} from "../../../types/aiIntegration";
import { IProvider } from "../IProvider";
import { Logger } from "../../system/Logger";

/**
 * Anthropic Claude Provider Implementation
 * Supports Claude 3 family (Opus, Sonnet, Haiku)
 */

export class AnthropicProvider implements IProvider {
  readonly type: AIProviderType = "anthropic";

  private apiKey: string;
  private apiUrl: string = "https://api.anthropic.com/v1";
  private timeout: number = 30000;
  private retries: number = 3;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 60000;
  private requestCount: number = 0;
  private errorCount: number = 0;
  private totalLatency: number = 0;

  private models: Map<
    string,
    {
      contextWindow: number;
      costPer1kInputTokens: number;
      costPer1kOutputTokens: number;
    }
  > = new Map([
    [
      "claude-3-opus-20240229",
      {
        contextWindow: 200000,
        costPer1kInputTokens: 0.015,
        costPer1kOutputTokens: 0.075,
      },
    ],
    [
      "claude-3-sonnet-20240229",
      {
        contextWindow: 200000,
        costPer1kInputTokens: 0.003,
        costPer1kOutputTokens: 0.015,
      },
    ],
    [
      "claude-3-haiku-20240307",
      {
        contextWindow: 200000,
        costPer1kInputTokens: 0.00025,
        costPer1kOutputTokens: 0.00125,
      },
    ],
  ]);

  constructor(apiKey: string, apiUrl?: string) {
    if (!apiKey) {
      throw new Error("Anthropic API key is required");
    }

    this.apiKey = apiKey;
    if (apiUrl) {
      this.apiUrl = apiUrl;
    }

    Logger.info("AnthropicProvider initialized", { type: this.type });
  }

  async initialize(): Promise<void> {
    Logger.info("Initializing Anthropic provider");

    const isValid = await this.validateApiKey();
    if (!isValid) {
      throw new Error("Invalid Anthropic API key");
    }

    Logger.info("Anthropic provider initialized successfully");
  }

  async healthCheck(): Promise<ProviderHealth> {
    const now = Date.now();

    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.buildHealthStatus();
    }

    try {
      const startTime = Date.now();

      // Make a simple API call to check health
      const response = await fetch(`${this.apiUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: "ping",
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });

      const latency = Date.now() - startTime;

      if (response.ok) {
        this.errorCount = 0;
        this.totalLatency += latency;
        this.lastHealthCheck = now;

        return this.buildHealthStatus();
      } else {
        this.errorCount++;
        throw new Error(`Health check failed: ${response.statusText}`);
      }
    } catch (error: any) {
      this.errorCount++;
      Logger.error("Anthropic health check failed", { error: error.message });

      return {
        provider: this.type,
        status: this.errorCount > 3 ? "unhealthy" : "degraded",
        latency: 0,
        availability: Math.max(0, 1 - this.errorCount * 0.1),
        errorRate: this.errorCount / Math.max(this.requestCount, 1),
        lastChecked: now,
        consecutiveErrors: this.errorCount,
        averageResponseTime: this.requestCount > 0 ? this.totalLatency / this.requestCount : 0,
        successRate: Math.max(0, 1 - this.errorCount * 0.1),
        costToday: 0,
        costThisMonth: 0,
      };
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const requestId = `anthropic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const model = request.model || "claude-3-sonnet-20240229";

      const payload: Record<string, any> = {
        model,
        max_tokens: request.maxTokens || 1024,
        messages: request.messages.map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
      };

      if (request.temperature !== undefined) {
        payload.temperature = request.temperature;
      }

      const response = await fetch(`${this.apiUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      this.requestCount++;
      this.totalLatency += latency;

      const inputTokens = data.usage?.input_tokens || 0;
      const outputTokens = data.usage?.output_tokens || 0;
      const cost = this.estimateCost(inputTokens, outputTokens, model);

      return {
        id: requestId,
        model,
        provider: this.type,
        content: data.content[0]?.text || "",
        finishReason: data.stop_reason || "end_turn",
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
        cost,
        latency,
      };
    } catch (error: any) {
      this.errorCount++;
      Logger.error("Anthropic chat request failed", {
        error: error.message,
        requestId,
      });

      throw error;
    }
  }

  async stream(request: ChatRequest): Promise<StreamResponse> {
    const requestId = `anthropic-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let cancelled = false;

    const streamGenerator = async function* (this: AnthropicProvider) {
      try {
        const model = request.model || "claude-3-sonnet-20240229";

        const payload: Record<string, any> = {
          model,
          max_tokens: request.maxTokens || 1024,
          messages: request.messages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
          stream: true,
        };

        const response = await fetch(`${this.apiUrl}/messages`, {
          method: "POST",
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          throw new Error(`Anthropic API error: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();

            if (line.startsWith("data: ")) {
              const data = line.slice(6);

              try {
                const parsed = JSON.parse(data);

                if (parsed.type === "content_block_delta") {
                  const content = parsed.delta?.text || "";

                  if (content) {
                    yield {
                      type: "content",
                      content,
                    } as StreamChunk;
                  }
                }
              } catch (e) {
                // Ignore JSON parse errors
              }
            }
          }

          buffer = lines[lines.length - 1];
        }
      } catch (error: any) {
        this.errorCount++;
        Logger.error("Anthropic stream failed", {
          error: error.message,
          requestId,
        });

        yield {
          type: "error",
          error: {
            code: "STREAM_ERROR",
            message: error.message,
          },
        } as StreamChunk;
      }
    };

    return {
      id: requestId,
      model: request.model || "claude-3-sonnet-20240229",
      provider: this.type,
      stream: streamGenerator.call(this),
      cancel: () => {
        cancelled = true;
      },
      onComplete: () => {
        // Placeholder
      },
    };
  }

  async embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    // Anthropic doesn't provide embeddings API
    // Return mock embeddings for now
    Logger.warn("Anthropic does not support embeddings API");

    const input = Array.isArray(request.text) ? request.text : [request.text];

    return {
      embeddings: input.map(() => Array(1536).fill(0).map(() => Math.random())),
      model: "claude-embeddings",
      provider: this.type,
      usage: {
        tokens: 0,
      },
      cost: 0,
    };
  }

  async vision(request: VisionRequest): Promise<VisionResponse> {
    try {
      const model = request.model || "claude-3-opus-20240229";

      const response = await fetch(`${this.apiUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens || 1024,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "url",
                    url: request.imageUrl,
                  },
                },
                {
                  type: "text",
                  text: request.prompt,
                },
              ],
            },
          ],
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        description: data.content[0]?.text || "",
        model,
        provider: this.type,
        usage: {
          inputTokens: data.usage?.input_tokens || 0,
          outputTokens: data.usage?.output_tokens || 0,
        },
        cost: this.estimateCost(
          data.usage?.input_tokens || 0,
          data.usage?.output_tokens || 0,
          model
        ),
      };
    } catch (error: any) {
      Logger.error("Anthropic vision request failed", { error: error.message });
      throw error;
    }
  }

  async getModels(): Promise<Array<{ id: string; name: string; contextWindow: number }>> {
    return Array.from(this.models.entries()).map(([id, config]) => ({
      id,
      name: id,
      contextWindow: config.contextWindow,
    }));
  }

  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const m = model || "claude-3-sonnet-20240229";
    const config = this.models.get(m);

    if (!config) {
      return 0;
    }

    const inputCost = (inputTokens / 1000) * config.costPer1kInputTokens;
    const outputCost = (outputTokens / 1000) * config.costPer1kOutputTokens;

    return inputCost + outputCost;
  }

  estimateLatency(model?: string): number {
    // Claude models are generally faster
    return 1500; // 1.5 seconds
  }

  getCapabilities(): AICapability[] {
    return ["chat", "vision", "function_calling", "long_context"];
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 10,
          messages: [
            {
              role: "user",
              content: "test",
            },
          ],
        }),
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getUsage(): Promise<{ used: number; limit: number; resetAt?: number }> {
    // Anthropic doesn't provide real-time usage via API
    return {
      used: 0,
      limit: 0,
    };
  }

  async shutdown(): Promise<void> {
    Logger.info("Shutting down Anthropic provider");
  }

  private buildHealthStatus(): ProviderHealth {
    return {
      provider: this.type,
      status: this.errorCount === 0 ? "healthy" : this.errorCount > 3 ? "unhealthy" : "degraded",
      latency: this.requestCount > 0 ? this.totalLatency / this.requestCount : 0,
      availability: Math.max(0, 1 - this.errorCount * 0.1),
      errorRate: this.errorCount / Math.max(this.requestCount, 1),
      lastChecked: Date.now(),
      consecutiveErrors: this.errorCount,
      averageResponseTime: this.requestCount > 0 ? this.totalLatency / this.requestCount : 0,
      successRate: Math.max(0, 1 - this.errorCount * 0.1),
      costToday: 0,
      costThisMonth: 0,
    };
  }
}

export const createAnthropicProvider = (apiKey: string, apiUrl?: string): AnthropicProvider => {
  return new AnthropicProvider(apiKey, apiUrl);
};
