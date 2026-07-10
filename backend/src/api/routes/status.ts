/**
 * Status Route — GET /status
 *
 * Returns a lightweight operational status summary.
 * Suitable for load balancer and monitoring probes.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../../config/index.js";
import { successResponse } from "../../utils/response.js";
import { getProviderStatus, hasAnyProvider } from "../../services/providerStatus.js";

const startTime = Date.now();

export async function statusRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/status",
    {
      schema: {
        tags: ["System"],
        summary: "Operational status",
        description:
          "Lightweight status check for load balancers and monitoring systems. " +
          "Returns operational state and provider availability summary.",
        response: {
          200: {
            description: "Operational status",
            type: "object",
            properties: {
              success: { type: "boolean" },
              requestId: { type: "string" },
              timestamp: { type: "string" },
              data: {
                type: "object",
                properties: {
                  operational: { type: "boolean" },
                  environment: { type: "string" },
                  uptimeSeconds: { type: "number" },
                  aiReady: { type: "boolean" },
                  providers: {
                    type: "object",
                    properties: {
                      configured: { type: "number" },
                      total: { type: "number" },
                    },
                  },
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
      const providers = getProviderStatus();
      const configuredCount = Object.values(providers).filter(
        (s) => s === "available"
      ).length;

      void reply.status(200).send(
        successResponse(
          {
            operational: true,
            environment: config.nodeEnv,
            uptimeSeconds: Math.round((Date.now() - startTime) / 1000),
            aiReady: hasAnyProvider(),
            providers: {
              configured: configuredCount,
              total: Object.keys(providers).length,
            },
          },
          requestId
        )
      );
    }
  );
}
