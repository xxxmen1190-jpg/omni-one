/**
 * Feedback Routes — Omni One Backend
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { feedbackService } from "../../services/feedbackService.js";
import { successResponse } from "../../utils/response.js";

export async function feedbackRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /feedback ─────────────────────────────────────────────────────────
  fastify.post(
    "/feedback",
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: "object",
          required: ["rating"],
          properties: {
            conversationId: { type: "string" },
            messageId: { type: "string" },
            rating: { type: "integer", enum: [1, -1] },
            comment: { type: "string" },
            model: { type: "string" },
            provider: { type: "string" },
            toolsUsed: { type: "array", items: { type: "string" } },
            confidence: { type: "number" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      const body = request.body as any;
      
      const feedback = await feedbackService.submitFeedback({
        ...body,
        userId: user.id,
      });

      void reply.status(201).send(successResponse(feedback, request.id));
    }
  );

  // ── GET /feedback/stats ────────────────────────────────────────────────────
  fastify.get(
    "/feedback/stats",
    { preHandler: [authenticate] }, // Should be admin-only in production
    async (request: FastifyRequest, reply: FastifyReply) => {
      const stats = await feedbackService.getFeedbackStats();
      void reply.send(successResponse(stats, request.id));
    }
  );
}
