/**
 * Tools Route — POST /tools/execute
 *
 * Executes a named tool with the provided parameters.
 * All tool calls are validated and logged.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";
import type { ToolExecuteRequest, ToolExecuteResponse } from "../../types/index.js";

// ─── Registered Tools Registry ────────────────────────────────────────────────
// In Phase 16.2, this will be loaded dynamically from the SkillRegistry.

const REGISTERED_TOOLS = new Set([
  "web_search",
  "image_generate",
  "file_parse",
  "code_execute",
  "memory_store",
  "memory_retrieve",
]);

// ─── JSON Schema ──────────────────────────────────────────────────────────────

const toolsBodySchema = {
  type: "object",
  required: ["toolName", "parameters"],
  additionalProperties: false,
  properties: {
    toolName: { type: "string", minLength: 1, maxLength: 100 },
    parameters: { type: "object" },
    context: { type: "object" },
  },
} as const;

// ─── Tool Execution Service ───────────────────────────────────────────────────

async function executeTool(body: ToolExecuteRequest): Promise<ToolExecuteResponse> {
  if (!REGISTERED_TOOLS.has(body.toolName)) {
    throw new AppError(
      `Tool "${body.toolName}" is not registered. Available tools: ${[...REGISTERED_TOOLS].join(", ")}`,
      400,
      "BAD_REQUEST"
    );
  }

  logger.info({ toolName: body.toolName }, "Executing tool");

  // Tool execution will be wired to the SkillRegistry in Phase 16.2.
  throw new AppError(
    `Tool "${body.toolName}" execution requires the full runtime environment (Phase 16.2).`,
    503,
    "SERVICE_UNAVAILABLE"
  );
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function toolsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: ToolExecuteRequest }>(
    "/tools/execute",
    {
      schema: {
        tags: ["Tools"],
        summary: "Execute a tool",
        description:
          "Execute a registered tool by name with the provided parameters. " +
          "Tools include web search, image generation, file parsing, and more.",
        security: [{ ApiKeyAuth: [] }],
        body: toolsBodySchema,
        response: {
          200: {
            description: "Tool executed successfully",
            type: "object",
            properties: {
              success: { type: "boolean" },
              requestId: { type: "string" },
              timestamp: { type: "string" },
              data: {
                type: "object",
                properties: {
                  toolName: { type: "string" },
                  result: {},
                  executionTimeMs: { type: "number" },
                  success: { type: "boolean" },
                  error: { type: "string" },
                },
              },
            },
          },
          400: { description: "Validation error or unknown tool", type: "object" },
          503: { description: "Tool runtime not available", type: "object" },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: ToolExecuteRequest }>,
      reply: FastifyReply
    ) => {
      const requestId =
        (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const result = await executeTool(request.body);
      void reply.status(200).send(successResponse(result, requestId));
    }
  );
}
