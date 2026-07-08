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
 * Google Gemini Provider Implementation
 * Supports Gemini Pro, Gemini Pro Vision, and other Google models
 */

export class GeminiProvider implements IProvider {
  readonly type: AIProviderType = "google";

  private apiKey: string;
  private apiUrl: string = "https://generativelanguage.googleapis.com/v1beta/models";
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
      "gemini-1.5-pro",
      {
        contextWindow: 1000000,
        costPer1kInputTokens: 0.0035,
        costPer1kOutputTokens: 0.0105,
      },
    ],
    [
      "gemini-1.5-flash",
      {
        contextWindow: 1000000,
        costPer1kInputTokens: 0.000075,
        costPer1kOutputTokens: 0.0003,
      },
    ],
    [
      "gemini-pro",
      {
        contextWindow: 32768,
        costPer1kInputTokens: 0.0005,
        costPer1kOutputTokens: 0.0015,
      },
    ],
  ]);

  constructor(apiKey: string, apiUrl?: string) {
    if (!apiKey) {
      throw new Error("Google API key is required");
    }

    this.apiKey = apiKey;
    if (apiUrl) {
      this.apiUrl = apiUrl;
    }

    Logger.info("GeminiProvider initialized", { type: this.type });
  }

  async initialize(): Promise<void> {
    Logger.info("Initializing Google Gemini provider");

    const isValid = await this.validateApiKey();
    if (!isValid) {
      throw new Error("Invalid Google API key");
    }

    Logger.info("Google Gemini provider initialized successfully");
  }

  async healthCheck(): Promise<ProviderHealth> {
    const now = Date.now();

    if (now - this.lastHealthCheck < this.healthCheckInterval) {
      return this.buildHealthStatus();
    }

    try {
      const startTime = Date.now();

      const response = await fetch(
        `${this.apiUrl}/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "ping",
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(5000),
        }
      );

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
      Logger.error("Gemini health check failed", { error: error.message });

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
    const requestId = `gemini-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const model = request.model || "gemini-1.5-flash";

      const contents = request.messages.map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [
          {
            text: m.content,
          },
        ],
      }));

      const payload: Record<string, any> = {
        contents,
        generationConfig: {
          temperature: request.temperature || 0.7,
          maxOutputTokens: request.maxTokens,
        },
      };

      const response = await fetch(
        `${this.apiUrl}/${model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.timeout),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      this.requestCount++;
      this.totalLatency += latency;

      const inputTokens = data.usageMetadata?.promptTokenCount || 0;
      const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
      const cost = this.estimateCost(inputTokens, outputTokens, model);

      return {
        id: requestId,
        model,
        provider: this.type,
        content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        finishReason: data.candidates?.[0]?.finishReason || "STOP",
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
      Logger.error("Gemini chat request failed", {
        error: error.message,
        requestId,
      });

      throw error;
    }
  }

  async stream(request: ChatRequest): Promise<StreamResponse> {
    const requestId = `gemini-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let cancelled = false;

    const streamGenerator = async function* (this: GeminiProvider) {
      try {
        const model = request.model || "gemini-1.5-flash";

        const contents = request.messages.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [
            {
              text: m.content,
            },
          ],
        }));

        const payload: Record<string, any> = {
          contents,
          generationConfig: {
            temperature: request.temperature || 0.7,
          },
        };

        const response = await fetch(
          `${this.apiUrl}/${model}:streamGenerateContent?key=${this.apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.timeout),
          }
        );

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.statusText}`);
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

            if (line) {
              try {
                const parsed = JSON.parse(line);
                const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
        Logger.error("Gemini stream failed", {
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
      model: request.model || "gemini-1.5-flash",
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
      const input = Array.isArray(request.text) ? request.text : [request.text];

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:batchEmbedContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: input.map((text) => ({
              model: "models/embedding-001",
              content: {
                parts: [
                  {
                    text,
                  },
                ],
              },
            })),
          }),
          signal: AbortSignal.timeout(this.timeout),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        embeddings: data.embeddings?.map((e: any) => e.values) || [],
        model: "embedding-001",
        provider: this.type,
        usage: {
          tokens: 0,
        },
        cost: 0,
      };
    } catch (error: any) {
      Logger.error("Gemini embeddings request failed", { error: error.message });
      throw error;
    }
  }

  async vision(request: VisionRequest): Promise<VisionResponse> {
    try {
      const model = request.model || "gemini-1.5-pro";

      const response = await fetch(
        `${this.apiUrl}/${model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType: "image/jpeg",
                      data: request.imageUrl,
                    },
                  },
                  {
                    text: request.prompt,
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(this.timeout),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        description: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
        model,
        provider: this.type,
        usage: {
          inputTokens: data.usageMetadata?.promptTokenCount || 0,
          outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        },
        cost: this.estimateCost(
          data.usageMetadata?.promptTokenCount || 0,
          data.usageMetadata?.candidatesTokenCount || 0,
          model
        ),
      };
    } catch (error: any) {
      Logger.error("Gemini vision request failed", { error: error.message });
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
    const m = model || "gemini-1.5-flash";
    const config = this.models.get(m);

    if (!config) {
      return 0;
    }

    const inputCost = (inputTokens / 1000) * config.costPer1kInputTokens;
    const outputCost = (outputTokens / 1000) * config.costPer1kOutputTokens;

    return inputCost + outputCost;
  }

  estimateLatency(model?: string): number {
    return 1200; // 1.2 seconds
  }

  getCapabilities(): AICapability[] {
    return ["chat", "vision", "embeddings", "long_context"];
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.apiUrl}/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: "test",
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(5000),
        }
      );

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
    Logger.info("Shutting down Gemini provider");
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

export const createGeminiProvider = (apiKey: string, apiUrl?: string): GeminiProvider => {
  return new GeminiProvider(apiKey, apiUrl);
};
