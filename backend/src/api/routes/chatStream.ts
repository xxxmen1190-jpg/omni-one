/**
 * Chat Streaming Route — Backend
 *
 * Phase 20.6 — Final System Wiring
 *
 * Server-Sent Events (SSE) endpoint for real-time streaming chat.
 * Supports all providers: OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek.
 *
 * Endpoint:
 *   POST /api/chat/stream   — Stream chat completion with real-time tokens
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { StreamingService, StreamChunk } from "../../services/streamingService.js";
import { OmniBrainV2 } from "../../services/omniBrainV2.js";
import { smartProviderSelector } from "../../services/smartProviderSelector.js";

interface ChatStreamRequest {
  message: string;
  conversationId?: string;
  proBrainMode?: boolean;
  provider?: "auto" | "openai" | "anthropic" | "gemini" | "groq" | "mistral" | "deepseek";
  manusApiKey?: string;
}

export async function chatStreamRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ChatStreamRequest }>(
    "/chat/stream",
    async (request: FastifyRequest<{ Body: ChatStreamRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const { message, conversationId, proBrainMode, provider = "auto", manusApiKey } = request.body;

      logger.info({ provider, proBrainMode }, "[ChatStreamRoute] Stream request");

      // Set SSE headers
      void reply.header("Content-Type", "text/event-stream");
      void reply.header("Cache-Control", "no-cache");
      void reply.header("Connection", "keep-alive");
      void reply.header("X-Accel-Buffering", "no");

      try {
        // Analyze task with OmniBrain
        const taskAnalysis = OmniBrainV2.analyzeTask(message);

        // Select provider
        let selectedProvider = provider;
        if (provider === "auto") {
          const selection = smartProviderSelector.selectProvider(
            taskAnalysis,
            { manusApiKey }
          );
          selectedProvider = selection.provider;
        }

        // Validate provider has streaming support
        const streamableProviders = ["openai", "anthropic", "gemini", "groq"];
        if (!streamableProviders.includes(selectedProvider.toLowerCase())) {
          throw new AppError(
            `Provider ${selectedProvider} does not support streaming. Use non-stream endpoint.`,
            400,
            "BAD_REQUEST"
          );
        }

        // Get API key for provider
        const apiKey = getProviderApiKey(selectedProvider);
        if (!apiKey) {
          throw new AppError(`No API key configured for provider: ${selectedProvider}`, 503, "SERVICE_UNAVAILABLE");
        }

        // Build messages array
        const messages = [{ role: "user" as const, content: message }];

        // Get model for provider
        const model = getModelForProvider(selectedProvider);

        // Create streaming generator
        const generator = StreamingService.getStreamGenerator(selectedProvider, messages, {
          provider: selectedProvider,
          model,
          apiKey,
          signal: request.raw.aborted ? AbortSignal.abort() : undefined,
          timeout: 300_000, // 5 minutes
        });

        // Send metadata if Pro Brain Mode
        if (proBrainMode) {
          const metadata = {
            type: "metadata",
            provider: selectedProvider,
            model,
            taskAnalysis,
            timestamp: Date.now(),
          };
          void reply.raw.write(`data: ${JSON.stringify(metadata)}\n\n`);
        }

        // Stream tokens
        for await (const chunk of generator) {
          if (request.raw.aborted) break;

          const eventData = JSON.stringify(chunk);
          void reply.raw.write(`data: ${eventData}\n\n`);
        }

        // Send end marker
        void reply.raw.write(`data: ${JSON.stringify({ type: "done", timestamp: Date.now() })}\n\n`);
        void reply.raw.end();
      } catch (error) {
        logger.error({ error }, "[ChatStreamRoute] Streaming failed");

        const errorChunk: StreamChunk = {
          type: "error",
          error: {
            code: error instanceof AppError ? error.code : "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          timestamp: Date.now(),
        };

        void reply.raw.write(`data: ${JSON.stringify(errorChunk)}\n\n`);
        void reply.raw.end();
      }
    }
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProviderApiKey(provider: string): string | null {
  switch (provider.toLowerCase()) {
    case "openai":
      return process.env.OPENAI_API_KEY || null;
    case "anthropic":
    case "claude":
      return process.env.ANTHROPIC_API_KEY || null;
    case "gemini":
      return process.env.GEMINI_API_KEY || null;
    case "groq":
      return process.env.GROQ_API_KEY || null;
    case "mistral":
      return process.env.MISTRAL_API_KEY || null;
    case "deepseek":
      return process.env.DEEPSEEK_API_KEY || null;
    default:
      return null;
  }
}

function getModelForProvider(provider: string): string {
  switch (provider.toLowerCase()) {
    case "openai":
      return "gpt-4o";
    case "anthropic":
    case "claude":
      return "claude-3-5-sonnet-20241022";
    case "gemini":
      return "gemini-2.0-flash";
    case "groq":
      return "mixtral-8x7b-32768";
    case "mistral":
      return "mistral-large-latest";
    case "deepseek":
      return "deepseek-chat";
    default:
      return "gpt-4o";
  }
}
