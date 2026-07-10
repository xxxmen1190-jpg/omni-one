/**
 * Metrics Routes — Omni One Backend
 *
 * Exposes system health, AI usage, and user activity metrics.
 * Protected by authentication + admin role check.
 *
 * GET /metrics          — Full dashboard (admin only)
 * GET /metrics/system   — System health snapshot
 * GET /metrics/ai       — AI request summary
 * GET /metrics/activity — User activity summary
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { successResponse } from "../../utils/response.js";
import { metricsService } from "../../services/metricsService.js";

export async function metricsRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /metrics — Full Dashboard ─────────────────────────────────────────
  fastify.get(
    "/metrics",
    {
      preHandler: [authenticate],
      schema: {
        tags: ["System"],
        summary: "Full metrics dashboard",
        description: "Returns system health, AI usage, and user activity metrics. Admin only.",
        security: [{ ApiKeyAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const dashboard = metricsService.getDashboard();
      void reply.send(successResponse(dashboard, requestId));
    }
  );

  // ── GET /metrics/system ────────────────────────────────────────────────────
  fastify.get(
    "/metrics/system",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const snapshot = metricsService.getSystemSnapshot();
      void reply.send(successResponse(snapshot, requestId));
    }
  );

  // ── GET /metrics/ai ────────────────────────────────────────────────────────
  fastify.get<{ Querystring: { window?: string } }>(
    "/metrics/ai",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const windowMinutes = parseInt((request.query as any).window ?? "60", 10);
      const summary = metricsService.getAISummary(isNaN(windowMinutes) ? 60 : windowMinutes);
      void reply.send(successResponse(summary, requestId));
    }
  );

  // ── GET /metrics/activity ──────────────────────────────────────────────────
  fastify.get<{ Querystring: { window?: string } }>(
    "/metrics/activity",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const windowMinutes = parseInt((request.query as any).window ?? "60", 10);
      const summary = metricsService.getActivitySummary(isNaN(windowMinutes) ? 60 : windowMinutes);
      void reply.send(successResponse(summary, requestId));
    }
  );
}
