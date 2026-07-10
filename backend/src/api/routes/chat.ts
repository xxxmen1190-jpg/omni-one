/**
 * Chat Route — POST /chat
 *
 * Accepts a conversation history and returns an AI completion.
 * Validates all input via JSON Schema before processing.
 * Routes to the appropriate AI provider based on configuration.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { getProviderStatus } from "../../services/providerStatus.js";
import { logger } from "../../utils/logger.js";
import type { ChatRequest, ChatResponse } from "../../types/index.js";

// ─── JSON Schema for request validation ──────────────────────────────────────

const chatBodySchema = {
  type: "object",
  required: ["messages"],
  additionalProperties: false,
  properties: {
    messages: {
      type: "array",
      minItems: 1,
      maxItems: 100,
      items: {
        type: "object",
        required: ["role", "content"],
        additionalProperties: false,
        properties: {
          role: { type: "string", enum: ["user", "assistant", "system"] },
          content: { type: "string", minLength: 1, maxLength: 32000 },
        },
      },
    },
    model: { type: "string", maxLength: 100 },
    stream: { type: "boolean" },
    maxTokens: { type: "integer", minimum: 1, maximum: 32000 },
    temperature: { type: "number", minimum: 0, maximum: 2 },
    systemPrompt: { type: "string", maxLength: 8000 },
  },
} as const;

// ─── Chat Service ─────────────────────────────────────────────────────────────

async function processChat(body: ChatRequest): Promise<ChatResponse> {
  const providers = getProviderStatus();
  const availableProvider = (
    Object.entries(providers) as [string, string][]
  ).find(([, status]) => status === "available")?.[0];

  if (!availableProvider) {
    throw new AppError(
      "No AI provider is configured. Please set at least one API key in the environment.",
      503,
      "SERVICE_UNAVAILABLE"
    );
  }

  // The actual provider call is handled by the OmniBrain orchestration layer.
  // In Phase 16.2, this will be wired to the full provider routing system.
  // For now, we validate, select a provider, and return a structured response.
  logger.info(
    {
      provider: availableProvider,
      messageCount: body.messages.length,
      model: body.model ?? "default",
    },
    "Processing chat request"
  );

  // Placeholder: real provider call will be injected here in Phase 16.2
  // when the database and session layers are available.
  throw new AppError(
    "Chat completion requires a configured AI provider. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or another provider key.",
    503,
    "SERVICE_UNAVAILABLE"
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ChatRequest }>(
    "/chat",
    {
      schema: {
        tags: ["Chat"],
        summary: "AI chat completion",
        description:
          "Send a conversation history and receive an AI-generated response. " +
          "Automatically routes to the best available AI provider.",
        security: [{ ApiKeyAuth: [] }],
        body: chatBodySchema,
        response: {
          200: {
            description: "Successful chat completion",
            type: "object",
            properties: {
              success: { type: "boolean" },
              requestId: { type: "string" },
              timestamp: { type: "string" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  content: { type: "string" },
                  model: { type: "string" },
                  usage: {
                    type: "object",
                    properties: {
                      promptTokens: { type: "number" },
                      completionTokens: { type: "number" },
                      totalTokens: { type: "number" },
                    },
                  },
                  finishReason: { type: "string" },
                },
              },
            },
          },
          400: { description: "Validation error", type: "object" },
          503: { description: "No AI provider available", type: "object" },
        },
      },
    },
    async (request: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) => {
      const requestId =
        (request.headers["x-request-id"] as string | undefined) ?? "unknown";

      const result = await processChat(request.body);
      void reply.status(200).send(successResponse(result, requestId));
    }
  );
}
