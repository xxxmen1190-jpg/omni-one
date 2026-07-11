/**
 * Agents Route — POST /agents/run
 *
 * Routes tasks to Manus AI (real API v2 calls) or other providers.
 * Accepts optional x-manus-api-key header or manusApiKey body field.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";
import { manusAgent } from "../../services/manusAgent.js";
import { manusProvider } from "../../providers/ManusProvider.js";

const agentsBodySchema = {
  type: "object",
  required: ["task"],
  additionalProperties: false,
  properties: {
    task: { type: "string", minLength: 1, maxLength: 8000 },
    agentType: {
      type: "string",
      enum: ["research", "code", "analysis", "automation", "general", "manus"],
    },
    context: { type: "object" },
    maxSteps: { type: "integer", minimum: 1, maximum: 50 },
    manusApiKey: { type: "string" },
  },
} as const;

interface AgentRunRequest {
  task: string;
  agentType?: string;
  context?: Record<string, unknown>;
  maxSteps?: number;
  manusApiKey?: string;
}

export async function agentsRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /agents/run ─────────────────────────────────────────────────────────
  fastify.post<{ Body: AgentRunRequest }>(
    "/agents/run",
    { schema: { body: agentsBodySchema } },
    async (request: FastifyRequest<{ Body: AgentRunRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";

      const { task, agentType = "general", context = {}, manusApiKey } = request.body;
      const headerApiKey = request.headers["x-manus-api-key"] as string | undefined;
      const resolvedManusKey = manusApiKey ?? headerApiKey ?? process.env.MANUS_API_KEY;

      logger.info(
        { agentType, taskLength: task.length, hasManusKey: !!resolvedManusKey },
        "[AgentsRoute] Run agent"
      );

      // ── Route to Manus ──────────────────────────────────────────────────────
      if (agentType === "manus" || resolvedManusKey) {
        if (!resolvedManusKey) {
          throw new AppError(
            "Manus API key required. Pass x-manus-api-key header, manusApiKey body field, or set MANUS_API_KEY env var.",
            400,
            "BAD_REQUEST"
          );
        }

        logger.info({ task: task.slice(0, 80) }, "[AgentsRoute] Routing to Manus API v2");

        const result = await manusAgent.runAutonomousTask("api-user", task, {
          apiKey: resolvedManusKey,
          tools: (context.tools as unknown[]) ?? [],
        });

        void reply.status(200).send(
          successResponse(
            {
              agentId: result.taskId,
              task,
              status: result.status === "COMPLETED" ? "completed" : "failed",
              taskUrl: result.taskUrl,
              finalResult: result.output,
              endpointsCalled: result.endpointsCalled,
              executionTimeMs: result.durationMs,
              steps: (result.steps ?? []).map((s, i) => ({
                step: i + 1,
                action: s,
                result: "ok",
                timestamp: new Date().toISOString(),
              })),
            },
            requestId
          )
        );
        return;
      }

      // ── No provider ─────────────────────────────────────────────────────────
      throw new AppError(
        "No AI provider configured. Pass x-manus-api-key header or set agentType=manus.",
        503,
        "SERVICE_UNAVAILABLE"
      );
    }
  );

  // ── GET /agents/manus/validate ───────────────────────────────────────────────
  fastify.get(
    "/agents/manus/validate",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const apiKey = request.headers["x-manus-api-key"] as string | undefined;
      if (!apiKey) {
        throw new AppError("x-manus-api-key header required", 400, "BAD_REQUEST");
      }
      const valid = await manusProvider.validateApiKey(apiKey);
      void reply.status(200).send(successResponse({ valid, provider: "manus" }, requestId));
    }
  );
}
