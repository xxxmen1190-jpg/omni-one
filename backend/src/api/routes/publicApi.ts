/**
 * Public API Routes — Omni One Backend
 * 
 * External-facing API for developers and integrations.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { successResponse } from "../../utils/response.js";
import { AppError } from "../../types/index.js";

export async function publicApiRoutes(fastify: FastifyInstance): Promise<void> {
  // Middleware to verify API Keys (simulated)
  async function verifyApiKey(request: FastifyRequest) {
    const apiKey = request.headers["x-api-key"];
    if (!apiKey) throw new AppError("Unauthorized: Missing API Key", 401);
    // In a real app, validate against prisma.apiKey
  }

  // ── Chat API ───────────────────────────────────────────────────────────────

  fastify.post(
    "/v1/chat/completions",
    { preHandler: [verifyApiKey] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { messages, model, stream } = request.body as any;
      
      if (stream) {
        // Handle streaming response...
        return reply.status(501).send({ error: "Streaming not yet implemented in public API" });
      }

      return successResponse({
        id: "chatcmpl-" + Math.random().toString(36).slice(2),
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model || "omni-brain-v2",
        choices: [{
          message: { role: "assistant", content: "Hello! This is the Omni One Public API." },
          finish_reason: "stop"
        }],
        usage: { prompt_tokens: 10, completion_tokens: 12, total_tokens: 22 }
      }, request.id);
    }
  );

  // ── Workflows API ──────────────────────────────────────────────────────────

  fastify.post(
    "/v1/workflows/:id/execute",
    { preHandler: [verifyApiKey] },
    async (request: FastifyRequest) => {
      const { id } = request.params as any;
      const { input } = request.body as any;
      // Execute workflow...
      return successResponse({ executionId: "exec-" + id, status: "PENDING" }, request.id);
    }
  );

  // ── Webhooks API ───────────────────────────────────────────────────────────

  fastify.post(
    "/v1/webhooks",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      const { url, events } = request.body as any;
      // Register webhook...
      return successResponse({ id: "wh-" + Math.random().toString(36).slice(2), url, events }, request.id);
    }
  );
}
