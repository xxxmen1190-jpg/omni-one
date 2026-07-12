/**
 * Unified Chat Route — Omni One Backend
 *
 * POST /api/unified-chat   (registered at prefix "/" so path is /unified-chat)
 *
 * Phase 20.6 — Unified AI Gateway
 *
 * Full flow:
 *   User Message
 *   → Frontend Chat
 *   → Backend API  (this file)
 *   → OmniBrainV2  (task analysis + routing decision)
 *   → SmartProviderSelector  (selects best available provider)
 *   → Provider: Manus | Claude | OpenAI | Gemini | Groq | Mistral | DeepSeek | OpenRouter
 *   → Execute
 *   → Return Response (with metadata for Pro Mode)
 *
 * Fallback behaviour:
 *   If the primary provider fails, the route automatically retries with each
 *   fallback provider in the decision's `fallbackProviders` list.
 *
 * Response includes:
 *   - content       : The actual AI response
 *   - provider      : Which provider was ultimately used
 *   - model         : Model identifier
 *   - reason        : Why that provider was selected
 *   - confidence    : Confidence score (0–1)
 *   - durationMs    : Total execution time
 *   - taskAnalysis  : (Pro Mode) OmniBrain task analysis
 *   - fallbackProviders : (Pro Mode) ordered fallback chain
 *   - endpointsCalled   : (Manus only) Manus API endpoints hit
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { authenticate } from "../../middleware/auth.js";
import { logger } from "../../utils/logger.js";
import { smartProviderSelector, type ProviderDecision, type TaskAnalysis } from "../../services/smartProviderSelector.js";
import { manusAgent } from "../../services/manusAgent.js";
import { omniBrainV2 } from "../../services/omniBrainV2.js";

// ─── Request / Response types ─────────────────────────────────────────────────

interface UnifiedChatRequest {
  message: string;
  conversationId?: string;
  proBrainMode?: boolean;
  manusApiKey?: string;
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
  endpointsCalled?: string[];
}

// ─── Validation schema ────────────────────────────────────────────────────────

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

// ─── Route registration ───────────────────────────────────────────────────────

export async function unifiedChatRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: UnifiedChatRequest }>(
    "/unified-chat",
    { preHandler: [authenticate], schema: { body: unifiedChatBodySchema } },
    async (request: FastifyRequest<{ Body: UnifiedChatRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const startMs = Date.now();

      const {
        message,
        conversationId = `conv-${Date.now()}`,
        proBrainMode = false,
        manusApiKey,
      } = request.body;

      // Use authenticated user id when available; fall back to "api-user"
      const userId = (request as any).user?.id ?? "api-user";

      logger.info(
        { message: message.slice(0, 80), proBrainMode, conversationId, userId },
        "[UnifiedChat] Processing request"
      );

      try {
        // ── Step 1: OmniBrainV2 — task analysis ──────────────────────────────
        const taskAnalysis = smartProviderSelector.analyzeTask(message);
        logger.info({ taskAnalysis }, "[UnifiedChat] Task analyzed by OmniBrain");

        // OmniBrainV2 routing check (complex / multi-step goals)
        const omniBrainShouldUseManus = omniBrainV2.shouldRouteToManus(message);
        if (omniBrainShouldUseManus) {
          logger.info("[UnifiedChat] OmniBrainV2 recommends Manus for this task");
          taskAnalysis.requiresManus = true;
        }

        // ── Step 2: Get available providers ──────────────────────────────────
        const availableProviders = smartProviderSelector.getAvailableProviders();
        // Allow per-request Manus key override
        if (manusApiKey) availableProviders.manus = true;
        logger.info({ availableProviders }, "[UnifiedChat] Available providers");

        // ── Step 3: SmartProviderSelector — pick best provider ────────────────
        const providerDecision = smartProviderSelector.selectProvider(taskAnalysis, availableProviders);
        logger.info({ providerDecision }, "[UnifiedChat] Provider selected");

        // ── Step 4: Execute with automatic fallback ───────────────────────────
        const response = await executeWithFallback(
          providerDecision,
          message,
          manusApiKey,
          conversationId,
          userId,
          startMs
        );

        // ── Step 5: Attach Pro Mode metadata ─────────────────────────────────
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
            error: {
              code: "INTERNAL_ERROR",
              message: error instanceof Error ? error.message : "Unknown error",
            },
          });
        }
      }
    }
  );
}

// ─── Execution with automatic fallback ───────────────────────────────────────

/**
 * Try the primary provider; on failure, iterate through fallback providers
 * automatically until one succeeds or all are exhausted.
 */
async function executeWithFallback(
  decision: ProviderDecision,
  message: string,
  manusApiKey: string | undefined,
  conversationId: string,
  userId: string,
  startMs: number
): Promise<UnifiedChatResponse> {
  const providersToTry = [decision.provider, ...decision.fallbackProviders];
  let lastError: Error | null = null;

  for (const providerName of providersToTry) {
    try {
      logger.info({ providerName }, "[UnifiedChat] Attempting provider");

      if (providerName === "manus") {
        const key = manusApiKey || process.env.MANUS_API_KEY;
        if (!key) {
          logger.warn("[UnifiedChat] Manus skipped — no API key");
          continue;
        }
        const manusResult = await manusAgent.runAutonomousTask(userId, message, { apiKey: key });
        return {
          content: manusResult.output,
          conversationId,
          provider: "manus",
          model: "manus-1.6",
          reason: decision.provider === "manus"
            ? decision.reason
            : `Fallback to Manus after primary provider failed`,
          confidence: decision.provider === "manus" ? decision.confidence : 0.7,
          durationMs: manusResult.durationMs,
          endpointsCalled: manusResult.endpointsCalled,
        };
      }

      // Standard LLM provider
      const providerDecisionForFallback: ProviderDecision = {
        ...decision,
        provider: providerName as ProviderDecision["provider"],
        model: getModelForProvider(providerName),
        reason: decision.provider === providerName
          ? decision.reason
          : `Fallback to ${providerName} after primary provider failed`,
        confidence: decision.provider === providerName ? decision.confidence : 0.6,
      };

      const providerResponse = await callStandardProvider(providerDecisionForFallback, message);
      return {
        ...providerResponse,
        conversationId,
        reason: providerDecisionForFallback.reason,
        confidence: providerDecisionForFallback.confidence,
        durationMs: Date.now() - startMs,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ providerName, error: lastError.message }, "[UnifiedChat] Provider failed, trying fallback");
    }
  }

  throw new AppError(
    `All providers failed. Last error: ${lastError?.message ?? "unknown"}`,
    503,
    "SERVICE_UNAVAILABLE"
  );
}

/** Default model for each provider when used as fallback */
function getModelForProvider(provider: string): string {
  const models: Record<string, string> = {
    claude: "claude-3-5-sonnet-20241022",
    openai: "gpt-4o",
    gemini: "gemini-2.0-flash",
    groq: "mixtral-8x7b-32768",
    mistral: "mistral-large-latest",
    deepseek: "deepseek-chat",
    openrouter: "auto",
  };
  return models[provider] ?? "auto";
}

// ─── Standard LLM provider dispatcher ────────────────────────────────────────

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

// ─── Provider implementations ─────────────────────────────────────────────────

async function callClaude(model: string, message: string, startMs: number) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AppError("Claude API key not configured", 503, "SERVICE_UNAVAILABLE");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: message }] }] }),
    }
  );

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
