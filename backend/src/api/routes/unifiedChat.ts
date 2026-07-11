/**
 * Unified Chat Route — Omni One Backend
 *
 * POST /api/unified-chat
 *
 * Central gateway that:
 *   1. Receives user message
 *   2. Routes through OmniBrain (decision engine)
 *   3. Selects best provider (Manus, Claude, GPT-4o, etc.)
 *   4. Executes task
 *   5. Returns result with metadata (Pro Mode)
 *
 * Response includes:
 *   - content: The actual response
 *   - provider: Which provider was used
 *   - reason: Why that provider was selected
 *   - confidence: Confidence score (0-1)
 *   - durationMs: Execution time
 *   - endpointsCalled: (Manus only) which endpoints were hit
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { authenticate } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { smartProviderSelector, type ProviderDecision, type TaskAnalysis } from "../../services/smartProviderSelector.js";
import { manusAgent } from "../../services/manusAgent.js";

interface UnifiedChatRequest {
  message: string;
  conversationId?: string;
  proBrainMode?: boolean; // Show provider selection metadata
  manusApiKey?: string; // Optional override
}

interface UnifiedChatResponse {
  content: string;
  conversationId: string;
  provider: string;
  model: string;
  reason: string;
  confidence: number;
  durationMs: number;
  // Pro Mode only:
  taskAnalysis?: TaskAnalysis;
  fallbackProviders?: string[];
  endpointsCalled?: string[]; // Manus only
}

const unifiedChatBodySchema = {
  type: "object",
  required: ["message"],
  properties: {
    message: { type: "string", minLength: 1, maxLength: 8000 },
    conversationId: { type: "string" },
    proBrainMode: { type: "boolean" },
    manusApiKey: { type: "string" },
  },
} as const;

export async function unifiedChatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: UnifiedChatRequest }>(
    "/unified-chat",
    { preHandler: [authenticate], schema: { body: unifiedChatBodySchema } },
    async (request: FastifyRequest<{ Body: UnifiedChatRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const startMs = Date.now();

      const { message, conversationId = `conv-${Date.now()}`, proBrainMode = false, manusApiKey } = request.body;

      logger.info(
        { message: message.slice(0, 80), proBrainMode, conversationId },
        "[UnifiedChat] Processing request"
      );

      try {
        // ── Step 1: Analyze task ────────────────────────────────────────────
        const taskAnalysis = smartProviderSelector.analyzeTask(message);
        logger.info({ taskAnalysis }, "[UnifiedChat] Task analyzed");

        // ── Step 2: Get available providers ──────────────────────────────────
        const availableProviders = smartProviderSelector.getAvailableProviders();
        // Override Manus availability if apiKey is provided
        if (manusApiKey) {
          availableProviders.manus = true;
        }
        logger.info({ availableProviders }, "[UnifiedChat] Available providers");

        // ── Step 3: Select provider ─────────────────────────────────────────
        const providerDecision = smartProviderSelector.selectProvider(taskAnalysis, availableProviders);
        logger.info({ providerDecision }, "[UnifiedChat] Provider selected");

        // ── Step 4: Execute via selected provider ────────────────────────────
        let response: UnifiedChatResponse;

        if (providerDecision.provider === "manus") {
          // Use Manus Agent
          const key = manusApiKey || process.env.MANUS_API_KEY;
          if (!key) {
            throw new AppError("Manus API key not configured", 400, "BAD_REQUEST");
          }

          const manusResult = await manusAgent.runAutonomousTask("api-user", message, { apiKey: key });
          response = {
            content: manusResult.output,
            conversationId,
            provider: "manus",
            model: "manus-1.6",
            reason: providerDecision.reason,
            confidence: providerDecision.confidence,
            durationMs: manusResult.durationMs,
            endpointsCalled: manusResult.endpointsCalled,
          };
        } else {
          // Use standard LLM provider (Claude, GPT-4o, Gemini, Groq, OpenRouter)
          const providerResponse = await callStandardProvider(providerDecision, message);
          response = {
            ...providerResponse,
            conversationId,
            reason: providerDecision.reason,
            confidence: providerDecision.confidence,
            durationMs: Date.now() - startMs,
          };
        }

        // ── Step 5: Add Pro Mode metadata if requested ───────────────────────
        if (proBrainMode) {
          response.taskAnalysis = taskAnalysis;
          response.fallbackProviders = providerDecision.fallbackProviders;
        }

        logger.info(
          { provider: response.provider, durationMs: response.durationMs },
          "[UnifiedChat] Request completed"
        );

        void reply.status(200).send(successResponse(response, requestId));
      } catch (error) {
        logger.error({ error }, "[UnifiedChat] Request failed");
        if (error instanceof AppError) {
          void reply.status(error.statusCode).send({
            success: false,
            requestId,
            timestamp: new Date().toISOString(),
            error: { code: error.code, message: error.message },
          });
        } else {
          void reply.status(500).send({
            success: false,
            requestId,
            timestamp: new Date().toISOString(),
            error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unknown error" },
          });
        }
      }
    }
  );
}

/**
 * Call a standard LLM provider (Claude, GPT-4o, Gemini, Groq, OpenRouter)
 */
async function callStandardProvider(
  decision: ProviderDecision,
  userMessage: string
): Promise<Omit<UnifiedChatResponse, "conversationId" | "reason" | "confidence" | "durationMs">> {
  const startMs = Date.now();

  switch (decision.provider) {
    case "claude":
      return callClaude(decision.model, userMessage, startMs);
    case "openai":
      return callOpenAI(decision.model, userMessage, startMs);
    case "gemini":
      return callGemini(decision.model, userMessage, startMs);
    case "groq":
      return callGroq(decision.model, userMessage, startMs);
    case "openrouter":
      return callOpenRouter(decision.model, userMessage, startMs);
    default:
      throw new AppError(`Unknown provider: ${decision.provider}`, 500, "INTERNAL_ERROR");
  }
}

async function callClaude(model: string, message: string, startMs: number) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AppError("Claude API key not configured", 503, "SERVICE_UNAVAILABLE");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) throw new AppError(`Claude API error: ${res.statusText}`, res.status, "PROVIDER_ERROR");
  const data = (await res.json()) as any;
  return {
    content: data.content[0]?.text ?? "",
    provider: "claude" as const,
    model,
    durationMs: Date.now() - startMs,
  };
}

async function callOpenAI(model: string, message: string, startMs: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_API_BASE || "https://api.openai.com/v1";
  if (!apiKey) throw new AppError("OpenAI API key not configured", 503, "SERVICE_UNAVAILABLE");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) throw new AppError(`OpenAI API error: ${res.statusText}`, res.status, "PROVIDER_ERROR");
  const data = (await res.json()) as any;
  return {
    content: data.choices[0]?.message?.content ?? "",
    provider: "openai" as const,
    model,
    durationMs: Date.now() - startMs,
  };
}

async function callGemini(model: string, message: string, startMs: number) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError("Gemini API key not configured", 503, "SERVICE_UNAVAILABLE");

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: message }] }],
    }),
  });

  if (!res.ok) throw new AppError(`Gemini API error: ${res.statusText}`, res.status, "PROVIDER_ERROR");
  const data = (await res.json()) as any;
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text ?? "",
    provider: "gemini" as const,
    model,
    durationMs: Date.now() - startMs,
  };
}

async function callGroq(model: string, message: string, startMs: number) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new AppError("Groq API key not configured", 503, "SERVICE_UNAVAILABLE");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) throw new AppError(`Groq API error: ${res.statusText}`, res.status, "PROVIDER_ERROR");
  const data = (await res.json()) as any;
  return {
    content: data.choices[0]?.message?.content ?? "",
    provider: "groq" as const,
    model,
    durationMs: Date.now() - startMs,
  };
}

async function callOpenRouter(model: string, message: string, startMs: number) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AppError("OpenRouter API key not configured", 503, "SERVICE_UNAVAILABLE");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) throw new AppError(`OpenRouter API error: ${res.statusText}`, res.status, "PROVIDER_ERROR");
  const data = (await res.json()) as any;
  return {
    content: data.choices[0]?.message?.content ?? "",
    provider: "openrouter" as const,
    model,
    durationMs: Date.now() - startMs,
  };
}
