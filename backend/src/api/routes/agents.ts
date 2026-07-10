/**
 * Agents Route — POST /agents/run
 *
 * Submits a task to the agent orchestration system.
 * Validates input, selects the appropriate agent type, and returns results.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";
import { getProviderStatus } from "../../services/providerStatus.js";
import type { AgentRunRequest, AgentRunResponse } from "../../types/index.js";

// ─── Supported Agent Types ────────────────────────────────────────────────────

const SUPPORTED_AGENT_TYPES = new Set([
  "research",
  "code",
  "analysis",
  "automation",
  "general",
]);

// ─── JSON Schema ──────────────────────────────────────────────────────────────

const agentsBodySchema = {
  type: "object",
  required: ["task"],
  additionalProperties: false,
  properties: {
    task: { type: "string", minLength: 1, maxLength: 8000 },
    agentType: {
      type: "string",
      enum: ["research", "code", "analysis", "automation", "general"],
    },
    context: { type: "object" },
    maxSteps: { type: "integer", minimum: 1, maximum: 50 },
  },
} as const;

// ─── Agent Execution Service ──────────────────────────────────────────────────

async function runAgent(body: AgentRunRequest): Promise<AgentRunResponse> {
  const providers = getProviderStatus();
  const hasProvider = Object.values(providers).some((s) => s === "available");

  if (!hasProvider) {
    throw new AppError(
      "No AI provider is configured. Agent execution requires at least one provider API key.",
      503,
      "SERVICE_UNAVAILABLE"
    );
  }

  const agentType = body.agentType ?? "general";
  if (!SUPPORTED_AGENT_TYPES.has(agentType)) {
    throw new AppError(
      `Agent type "${agentType}" is not supported. Supported types: ${[...SUPPORTED_AGENT_TYPES].join(", ")}`,
      400,
      "BAD_REQUEST"
    );
  }

  logger.info(
    { agentType, taskLength: body.task.length, maxSteps: body.maxSteps ?? 10 },
    "Running agent"
  );

  // Agent execution will be wired to the AgentManager in Phase 16.2.
  throw new AppError(
    "Agent execution requires the full runtime environment (Phase 16.2).",
    503,
    "SERVICE_UNAVAILABLE"
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function agentsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: AgentRunRequest }>(
    "/agents/run",
    {
      schema: {
        body: agentsBodySchema,
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              requestId: { type: "string" },
              timestamp: { type: "string" },
              data: {
                type: "object",
                properties: {
                  agentId: { type: "string" },
                  task: { type: "string" },
                  status: { type: "string", enum: ["completed", "failed", "running"] },
                  steps: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        step: { type: "number" },
                        action: { type: "string" },
                        result: { type: "string" },
                        timestamp: { type: "string" },
                      },
                    },
                  },
                  finalResult: { type: "string" },
                  executionTimeMs: { type: "number" },
                },
              },
            },
          },
          400: { description: "Validation error", type: "object" },
          503: { description: "No AI provider available", type: "object" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: AgentRunRequest }>,
      reply: FastifyReply
    ) => {
      const requestId =
        (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const result = await runAgent(request.body);
      void reply.status(200).send(successResponse(result, requestId));
    }
  );
}
