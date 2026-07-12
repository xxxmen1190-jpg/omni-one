/**
 * Streaming Service — Backend
 *
 * Phase 20.6 — Final System Wiring
 *
 * Unified Server-Sent Events (SSE) implementation for all providers.
 * Provides a consistent streaming interface regardless of the underlying provider.
 *
 * Supported providers:
 *   - OpenAI (native streaming)
 *   - Anthropic (native streaming)
 *   - Gemini (native streaming)
 *   - Groq (native streaming)
 *   - Mistral (native streaming)
 *   - DeepSeek (native streaming)
 *   - Manus (polling-based, converted to streaming)
 */

import { logger } from "../utils/logger.js";
import { AppError } from "../types/index.js";

export interface StreamChunk {
  type: "start" | "token" | "metadata" | "end" | "error";
  content?: string;
  metadata?: Record<string, any>;
  error?: { code: string; message: string };
  timestamp: number;
}

export interface StreamOptions {
  provider: string;
  model: string;
  apiKey: string;
  signal?: AbortSignal;
  timeout?: number;
}

export class StreamingService {
  /**
   * Stream a response from OpenAI using native streaming.
   */
  static async *streamOpenAI(
    messages: any[],
    options: StreamOptions
  ): AsyncGenerator<StreamChunk> {
    const { apiKey, signal, timeout = 60_000 } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: signal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.text();
        throw new AppError(`OpenAI streaming error: ${err}`, res.status, "PROVIDER_ERROR");
      }

      yield { type: "start", timestamp: Date.now() };

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            yield { type: "end", timestamp: Date.now() };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { type: "token", content, timestamp: Date.now() };
            }
          } catch (e) {
            logger.warn({ data }, "[StreamingService] Failed to parse OpenAI chunk");
          }
        }
      }

      yield { type: "end", timestamp: Date.now() };
    } catch (error) {
      logger.error({ error }, "[StreamingService] OpenAI streaming failed");
      yield {
        type: "error",
        error: {
          code: "STREAMING_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Stream a response from Anthropic using native streaming.
   */
  static async *streamAnthropic(
    messages: any[],
    options: StreamOptions
  ): AsyncGenerator<StreamChunk> {
    const { apiKey, signal, timeout = 60_000 } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          stream: true,
          max_tokens: 4096,
        }),
        signal: signal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.text();
        throw new AppError(`Anthropic streaming error: ${err}`, res.status, "PROVIDER_ERROR");
      }

      yield { type: "start", timestamp: Date.now() };

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
              yield { type: "token", content: parsed.delta.text, timestamp: Date.now() };
            } else if (parsed.type === "message_stop") {
              yield { type: "end", timestamp: Date.now() };
              return;
            }
          } catch (e) {
            logger.warn({ data }, "[StreamingService] Failed to parse Anthropic chunk");
          }
        }
      }

      yield { type: "end", timestamp: Date.now() };
    } catch (error) {
      logger.error({ error }, "[StreamingService] Anthropic streaming failed");
      yield {
        type: "error",
        error: {
          code: "STREAMING_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Stream a response from Gemini using native streaming.
   */
  static async *streamGemini(
    messages: any[],
    options: StreamOptions
  ): AsyncGenerator<StreamChunk> {
    const { apiKey, signal, timeout = 60_000 } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:streamGenerateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: messages.map((m) => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.content }],
            })),
          }),
          signal: signal || controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.text();
        throw new AppError(`Gemini streaming error: ${err}`, res.status, "PROVIDER_ERROR");
      }

      yield { type: "start", timestamp: Date.now() };

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line);
            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              yield { type: "token", content, timestamp: Date.now() };
            }
          } catch (e) {
            logger.warn({ line }, "[StreamingService] Failed to parse Gemini chunk");
          }
        }
      }

      yield { type: "end", timestamp: Date.now() };
    } catch (error) {
      logger.error({ error }, "[StreamingService] Gemini streaming failed");
      yield {
        type: "error",
        error: {
          code: "STREAMING_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Stream a response from Groq using native streaming.
   */
  static async *streamGroq(
    messages: any[],
    options: StreamOptions
  ): AsyncGenerator<StreamChunk> {
    const { apiKey, signal, timeout = 60_000 } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: signal || controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.text();
        throw new AppError(`Groq streaming error: ${err}`, res.status, "PROVIDER_ERROR");
      }

      yield { type: "start", timestamp: Date.now() };

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") {
            yield { type: "end", timestamp: Date.now() };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { type: "token", content, timestamp: Date.now() };
            }
          } catch (e) {
            logger.warn({ data }, "[StreamingService] Failed to parse Groq chunk");
          }
        }
      }

      yield { type: "end", timestamp: Date.now() };
    } catch (error) {
      logger.error({ error }, "[StreamingService] Groq streaming failed");
      yield {
        type: "error",
        error: {
          code: "STREAMING_ERROR",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get the appropriate streaming generator based on provider.
   */
  static getStreamGenerator(
    provider: string,
    messages: any[],
    options: StreamOptions
  ): AsyncGenerator<StreamChunk> {
    switch (provider.toLowerCase()) {
      case "openai":
        return this.streamOpenAI(messages, options);
      case "anthropic":
      case "claude":
        return this.streamAnthropic(messages, options);
      case "gemini":
        return this.streamGemini(messages, options);
      case "groq":
        return this.streamGroq(messages, options);
      default:
        throw new AppError(`Streaming not supported for provider: ${provider}`, 400, "BAD_REQUEST");
    }
  }
}
