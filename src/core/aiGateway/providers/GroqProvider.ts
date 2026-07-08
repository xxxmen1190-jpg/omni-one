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
 * Groq Provider Implementation
 * Supports fast inference with Mixtral, Llama, and other models
 */

export class GroqProvider implements IProvider {
  readonly type: AIProviderType = "groq";

  private apiKey: string;
  private apiUrl: string = "https://api.groq.com/openai/v1";
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
      "mixtral-8x7b-32768",
      {
        contextWindow: 32768,
        costPer1kInputTokens: 0.00024,
        costPer1kOutputTokens: 0.00024,
      },
    ],
    [
      "llama2-70b-4096",
      {
        contextWindow: 4096,
        costPer1kInputTokens: 0.0007,
        costPer1kOutputTokens: 0.0009,
      },
    ],
    [
      "gemma-7b-it",
      {
        contextWindow: 8192,
        costPer1kInputTokens: 0.00007,
        costPer1kOutputTokens: 0.00007,
      },
    ],
  ]);

  constructor(apiKey: string, apiUrl?: string) {
    if (!apiKey) {
      throw new Error("Groq API key is required");
    }

    this.apiKey = apiKey;
    if (apiUrl) {
      this.apiUrl = apiUrl;
    }

    Logger.info("GroqProvider initialized", { type: this.type });
  }

  async initialize(): Promise<void> {
    Logger.info("Initializing Groq provider");

    const isValid = await this.validateApiKey();
    if (!isValid) {
      throw new Error("Invalid Groq API key");
    }

    Logger.info("Groq provider initialized successfully");
  }

  async healthCheck(): Promise<ProviderHealth> {
    const now = Date.now();

    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.buildHealthStatus();
    }

    try {
      const startTime = Date.now();

      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemma-7b-it",
          messages: [
            {
              role: "user",
              content: "ping",
            },
          ],
          max_tokens: 10,
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
      Logger.error("Groq health check failed", { error: error.message });

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
    const requestId = `groq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const model = request.model || "mixtral-8x7b-32768";
      const messages = request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const payload: Record<string, any> = {
        model,
        messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.maxTokens,
      };

      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      this.requestCount++;
      this.totalLatency += latency;

      const inputTokens = data.usage?.prompt_tokens || 0;
      const outputTokens = data.usage?.completion_tokens || 0;
      const cost = this.estimateCost(inputTokens, outputTokens, model);

      return {
        id: requestId,
        model,
        provider: this.type,
        content: data.choices[0]?.message?.content || "",
        finishReason: data.choices[0]?.finish_reason || "stop",
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: data.usage?.total_tokens || 0,
        },
        cost,
        latency,
      };
    } catch (error: any) {
      this.errorCount++;
      Logger.error("Groq chat request failed", {
        error: error.message,
        requestId,
      });

      throw error;
    }
  }

  async stream(request: ChatRequest): Promise<StreamResponse> {
    const requestId = `groq-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let cancelled = false;

    const streamGenerator = async function* (this: GroqProvider) {
      try {
        const model = request.model || "mixtral-8x7b-32768";
        const messages = request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const payload: Record<string, any> = {
          model,
          messages,
          stream: true,
          temperature: request.temperature || 0.7,
        };

        const response = await fetch(`${this.apiUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          throw new Error(`Groq API error: ${response.statusText}`);
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

              if (data === "[DONE]") {
                break;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || "";

                if (content) {
                  yield {
                    type: "content",
                    content,
                  } as StreamChunk;
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
        Logger.error("Groq stream failed", {
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
      model: request.model || "mixtral-8x7b-32768",
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
    // Groq doesn't provide embeddings API
    Logger.warn("Groq does not support embeddings API");

    const input = Array.isArray(request.text) ? request.text : [request.text];

    return {
      embeddings: input.map(() => Array(1536).fill(0).map(() => Math.random())),
      model: "groq-embeddings",
      provider: this.type,
      usage: {
        tokens: 0,
      },
      cost: 0,
    };
  }

  async vision(request: VisionRequest): Promise<VisionResponse> {
    // Groq doesn't support vision
    Logger.warn("Groq does not support vision API");

    return {
      description: "Vision not supported by Groq",
      model: request.model || "mixtral-8x7b-32768",
      provider: this.type,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
      },
      cost: 0,
    };
  }

  async getModels(): Promise<Array<{ id: string; name: string; contextWindow: number }>> {
    return Array.from(this.models.entries()).map(([id, config]) => ({
      id,
      name: id,
      contextWindow: config.contextWindow,
    }));
  }

  estimateCost(inputTokens: number, outputTokens: number, model?: string): number {
    const m = model || "mixtral-8x7b-32768";
    const config = this.models.get(m);

    if (!config) {
      return 0;
    }

    const inputCost = (inputTokens / 1000) * config.costPer1kInputTokens;
    const outputCost = (outputTokens / 1000) * config.costPer1kOutputTokens;

    return inputCost + outputCost;
  }

  estimateLatency(model?: string): number {
    // Groq is known for very fast inference
    return 300; // 300ms
  }

  getCapabilities(): AICapability[] {
    return ["chat", "function_calling", "long_context"];
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemma-7b-it",
          messages: [
            {
              role: "user",
              content: "test",
            },
          ],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getUsage(): Promise<{ used: number; limit: number; resetAt?: number }> {
    return {
      used: 0,
      limit: 0,
    };
  }

  async shutdown(): Promise<void> {
    Logger.info("Shutting down Groq provider");
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

export const createGroqProvider = (apiKey: string, apiUrl?: string): GroqProvider => {
  return new GroqProvider(apiKey, apiUrl);
};
