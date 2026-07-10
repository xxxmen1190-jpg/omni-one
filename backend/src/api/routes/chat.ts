/**
 * Chat Routes — Omni One Backend
 * POST /chat        — Non-streaming AI chat completion
 * POST /chat/stream — Real SSE streaming chat completion
 * Auto-selects provider: OpenAI → Anthropic → Groq → OpenRouter
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";
import { config } from "../../config/index.js";

interface ChatMessage { role: "user" | "assistant" | "system"; content: string; }
interface ChatRequestBody {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  conversationId?: string;
}
interface ProviderConfig { name: string; apiKey: string; baseUrl: string; defaultModel: string; }

const chatBodySchema = {
  type: "object", required: ["messages"], additionalProperties: true,
  properties: {
    messages: { type: "array", minItems: 1, maxItems: 100, items: { type: "object", required: ["role", "content"], properties: { role: { type: "string", enum: ["user", "assistant", "system"] }, content: { type: "string", minLength: 1, maxLength: 32000 } } } },
    model: { type: "string", maxLength: 100 },
    stream: { type: "boolean" },
    maxTokens: { type: "integer", minimum: 1, maximum: 32000 },
    temperature: { type: "number", minimum: 0, maximum: 2 },
    systemPrompt: { type: "string", maxLength: 8000 },
    conversationId: { type: "string" },
  },
} as const;

function selectProvider(preferredModel?: string): ProviderConfig {
  const { ai } = config;
  if (preferredModel?.startsWith("claude") && ai.anthropicApiKey?.length > 10)
    return { name: "anthropic", apiKey: ai.anthropicApiKey, baseUrl: "https://api.anthropic.com/v1", defaultModel: preferredModel };
  if (ai.openaiApiKey?.length > 10)
    return { name: "openai", apiKey: ai.openaiApiKey, baseUrl: "https://api.openai.com/v1", defaultModel: preferredModel ?? "gpt-4o-mini" };
  if (ai.anthropicApiKey?.length > 10)
    return { name: "anthropic", apiKey: ai.anthropicApiKey, baseUrl: "https://api.anthropic.com/v1", defaultModel: preferredModel ?? "claude-3-haiku-20240307" };
  if (ai.groqApiKey?.length > 10)
    return { name: "groq", apiKey: ai.groqApiKey, baseUrl: "https://api.groq.com/openai/v1", defaultModel: preferredModel ?? "llama3-8b-8192" };
  if (ai.openrouterApiKey?.length > 10)
    return { name: "openrouter", apiKey: ai.openrouterApiKey, baseUrl: "https://openrouter.ai/api/v1", defaultModel: preferredModel ?? "openai/gpt-4o-mini" };
  throw new AppError("No AI provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.", 503, "SERVICE_UNAVAILABLE");
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
  if (!res.ok) throw new AppError(`Provider error: ${await res.text()}`, res.status, "PROVIDER_ERROR");
  const data = await res.json() as { choices: Array<{ message: { content: string } }>; model: string; usage?: { total_tokens?: number } };
  return { content: data.choices[0]?.message?.content ?? "", model: data.model ?? model, tokens: data.usage?.total_tokens ?? 0 };
}

async function streamCompletion(provider: ProviderConfig, messages: ChatMessage[], body: ChatRequestBody, reply: FastifyReply) {
  const model = body.model ?? provider.defaultModel;
  const upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({ model, messages, max_tokens: body.maxTokens ?? 4096, temperature: body.temperature ?? 0.7, stream: true }),
  });
  if (!upstream.ok || !upstream.body) {
    reply.raw.write(`data: ${JSON.stringify({ type: "error", error: await upstream.text() })}\n\n`);
    reply.raw.write("data: [DONE]\n\n");
    reply.raw.end();
    return;
  }
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        reply.raw.write("data: [DONE]\n\n");
        reply.raw.end();
        return;
      }
      try {
        const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) reply.raw.write(`data: ${JSON.stringify({ type: "delta", content: delta, model })}\n\n`);
      } catch { /* skip malformed */ }
    }
  }
  reply.raw.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  reply.raw.write("data: [DONE]\n\n");
  reply.raw.end();
}

export async function chatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ChatRequestBody }>("/chat", { schema: { body: chatBodySchema } },
    async (request, reply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const provider = selectProvider(request.body.model);
      const messages = buildMessages(request.body);
      logger.info({ provider: provider.name, model: request.body.model ?? provider.defaultModel }, "Chat completion");
      const result = await callCompletion(provider, messages, request.body);
      void reply.send(successResponse(result, requestId));
    }
  );

  fastify.post<{ Body: ChatRequestBody }>("/chat/stream", { schema: { body: chatBodySchema } },
    async (request, reply) => {
      const provider = selectProvider(request.body.model);
      const messages = buildMessages(request.body);
      logger.info({ provider: provider.name, model: request.body.model ?? provider.defaultModel }, "Chat stream");
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      if (typeof reply.raw.flushHeaders === "function") reply.raw.flushHeaders();
      await streamCompletion(provider, messages, request.body, reply);
    }
  );
}
