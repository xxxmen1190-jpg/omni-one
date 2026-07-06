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
 * OpenAI Provider Implementation
 * Supports GPT-4, GPT-3.5-turbo, and other OpenAI models
 */

export class OpenAIProvider implements IProvider {
  readonly type: AIProviderType = "openai";

  private apiKey: string;
  private apiUrl: string = "https://api.openai.com/v1";
  private timeout: number = 30000;
  private retries: number = 3;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 60000; // 1 minute
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
      "gpt-4-turbo",
      {
        contextWindow: 128000,
        costPer1kInputTokens: 0.01,
        costPer1kOutputTokens: 0.03,
      },
    ],
    [
      "gpt-4",
      {
        contextWindow: 8192,
        costPer1kInputTokens: 0.03,
        costPer1kOutputTokens: 0.06,
      },
    ],
    [
      "gpt-3.5-turbo",
      {
        contextWindow: 4096,
        costPer1kInputTokens: 0.0005,
        costPer1kOutputTokens: 0.0015,
      },
    ],
  ]);

  constructor(apiKey: string, apiUrl?: string) {
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    this.apiKey = apiKey;
    if (apiUrl) {
      this.apiUrl = apiUrl;
    }

    Logger.info("OpenAIProvider initialized", { type: this.type });
  }

  async initialize(): Promise<void> {
    Logger.info("Initializing OpenAI provider");

    // Validate API key
    const isValid = await this.validateApiKey();
    if (!isValid) {
      throw new Error("Invalid OpenAI API key");
    }

    Logger.info("OpenAI provider initialized successfully");
  }

  async healthCheck(): Promise<ProviderHealth> {
    const now = Date.now();

    // Return cached health check if recent
    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.buildHealthStatus();
    }

    try {
      const startTime = Date.now();

      // Make a simple API call to check health
      const response = await fetch(`${this.apiUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
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
      Logger.error("OpenAI health check failed", { error: error.message });

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
    const requestId = `openai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const model = request.model || "gpt-3.5-turbo";
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

      if (request.tools) {
        payload.tools = request.tools;
      }

      if (request.responseFormat === "json_object") {
        payload.response_format = { type: "json_object" };
      }

      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
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
      Logger.error("OpenAI chat request failed", {
        error: error.message,
        requestId,
      });

      throw error;
    }
  }

  async stream(request: ChatRequest): Promise<StreamResponse> {
    const requestId = `openai-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let cancelled = false;

    const streamGenerator = async function* (this: OpenAIProvider) {
      try {
        const model = request.model || "gpt-3.5-turbo";
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
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeout),
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.statusText}`);
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
        Logger.error("OpenAI stream failed", {
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
      model: request.model || "gpt-3.5-turbo",
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
    try {
      const model = request.model || "text-embedding-3-small";
      const input = Array.isArray(request.text) ? request.text : [request.text];

      const response = await fetch(`${this.apiUrl}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        embeddings: data.data.map((item: any) => item.embedding),
        model,
        provider: this.type,
        usage: {
          tokens: data.usage?.total_tokens || 0,
        },
        cost: (data.usage?.total_tokens || 0) * 0.00002, // Approximate cost
      };
    } catch (error: any) {
      Logger.error("OpenAI embeddings request failed", { error: error.message });
      throw error;
    }
  }

  async vision(request: VisionRequest): Promise<VisionResponse> {
    try {
      const model = request.model || "gpt-4-vision";

      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
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
          max_tokens: request.maxTokens || 1024,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        description: data.choices[0]?.message?.content || "",
        model,
        provider: this.type,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        cost: this.estimateCost(
          data.usage?.prompt_tokens || 0,
          data.usage?.completion_tokens || 0,
          model
        ),
      };
    } catch (error: any) {
      Logger.error("OpenAI vision request failed", { error: error.message });
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
    const m = model || "gpt-3.5-turbo";
    const config = this.models.get(m);

    if (!config) {
      return 0;
    }

    const inputCost = (inputTokens / 1000) * config.costPer1kInputTokens;
    const outputCost = (outputTokens / 1000) * config.costPer1kOutputTokens;

    return inputCost + outputCost;
  }

  estimateLatency(model?: string): number {
    // Average latency based on model
    const m = model || "gpt-3.5-turbo";

    if (m.includes("gpt-4")) {
      return 2000; // 2 seconds
    }

    return 1000; // 1 second
  }

  getCapabilities(): AICapability[] {
    return [
      "chat",
      "vision",
      "embeddings",
      "function_calling",
      "json_mode",
      "long_context",
    ];
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  async getUsage(): Promise<{ used: number; limit: number; resetAt?: number }> {
    // OpenAI doesn't provide real-time usage via API
    // This would need to be tracked separately
    return {
      used: 0,
      limit: 0,
    };
  }

  async shutdown(): Promise<void> {
    Logger.info("Shutting down OpenAI provider");
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

export const createOpenAIProvider = (apiKey: string, apiUrl?: string): OpenAIProvider => {
  return new OpenAIProvider(apiKey, apiUrl);
};
