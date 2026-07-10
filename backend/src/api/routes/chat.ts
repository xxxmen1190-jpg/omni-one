/**
 * Chat Routes — Omni One Backend
 */
import type { FastifyInstance,   } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { authenticate } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
}

interface ChatRequestBody {
  conversationId?: string;
  model?: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

const chatBodySchema = {
  type: "object",
  required: ["messages"],
  properties: {
    conversationId: { type: "string" },
    model: { type: "string" },
    messages: {
      type: "array",
      items: {
        type: "object",
        required: ["role", "content"],
        properties: {
          role: { type: "string", enum: ["user", "assistant", "system", "tool"] },
          content: { type: "string" },
        },
      },
    },
    systemPrompt: { type: "string" },
    temperature: { type: "number", minimum: 0, maximum: 2 },
    maxTokens: { type: "integer", minimum: 1 },
    stream: { type: "boolean" },
  },
};

function selectProvider(preferredModel?: string): ProviderConfig {
  const ai = {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    groqApiKey: process.env.GROQ_API_KEY,
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
  };

  if (ai.openaiApiKey?.length && ai.openaiApiKey.length > 10)
    return { name: "openai", apiKey: ai.openaiApiKey, baseUrl: process.env.OPENAI_API_BASE || "https://api.openai.com/v1", defaultModel: preferredModel ?? "gpt-4o" };
  if (ai.anthropicApiKey?.length && ai.anthropicApiKey.length > 10)
    return { name: "anthropic", apiKey: ai.anthropicApiKey, baseUrl: "https://api.anthropic.com/v1", defaultModel: preferredModel ?? "claude-3-haiku-20240307" };
  
  throw new AppError("No AI provider configured.", 503, "SERVICE_UNAVAILABLE");
}

function buildMessages(body: ChatRequestBody): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  if (body.systemPrompt) msgs.push({ role: "system", content: body.systemPrompt });
  msgs.push(...body.messages);
  return msgs;
}

async function callCompletion(provider: ProviderConfig, messages: ChatMessage[], body: ChatRequestBody) {
  const model = body.model ?? provider.defaultModel;
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: body.maxTokens ?? 4096, temperature: body.temperature ?? 0.7, stream: false }),
  });
  if (!res.ok) { const err = await res.text(); logger.error({ err, status: res.status }, "Provider error"); throw new AppError(`Provider error: ${err}`, res.status, "PROVIDER_ERROR"); }
  const data = await res.json() as any;
  return { content: data.choices[0]?.message?.content ?? "", model: data.model ?? model, tokens: data.usage?.total_tokens ?? 0 };
}

export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ChatRequestBody }>("/chat", { preHandler: [authenticate], schema: { body: chatBodySchema } },
    async (request, reply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const provider = selectProvider(request.body.model);
      const messages = buildMessages(request.body);
      logger.info({ provider: provider.name, model: request.body.model ?? provider.defaultModel, baseUrl: provider.baseUrl, apiKeySet: !!provider.apiKey }, "Chat completion");
      const result = await callCompletion(provider, messages, request.body);
      void reply.send(successResponse(result, requestId));
    }
  );
}
