/**
 * Version Route — GET /version
 *
 * Returns the current application version and build metadata.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../../config/index.js";
import { successResponse } from "../../utils/response.js";

export async function versionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/version",
    {
      schema: {
        tags: ["System"],
        summary: "Application version",
        description: "Returns the current application version, build number, and environment.",
        response: {
          200: {
            description: "Version information",
            type: "object",
            properties: {
              success: { type: "boolean" },
              requestId: { type: "string" },
              timestamp: { type: "string" },
              data: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  version: { type: "string" },
                  buildNumber: { type: "string" },
                  environment: { type: "string" },
                  nodeVersion: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    (_request: FastifyRequest, reply: FastifyReply) => {
      const requestId =
        (_request.headers["x-request-id"] as string | undefined) ?? "unknown";

      void reply.status(200).send(
        successResponse(
          {
            name: config.appName,
            version: config.appVersion,
            buildNumber: config.buildNumber,
            environment: config.nodeEnv,
            nodeVersion: process.version,
          },
          requestId
        )
      );
    }
  );
}
