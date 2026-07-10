/**
 * Health Route — GET /health
 *
 * Returns comprehensive system health including uptime, memory,
 * runtime info, and AI provider availability.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "../../config/index.js";
import { successResponse } from "../../utils/response.js";
import { getProviderStatus } from "../../services/providerStatus.js";
import { testDbConnection } from "../../database/prisma.js";
import { testRedisConnection } from "../../database/redis.js";
import type { HealthData } from "../../types/index.js";

const startTime = Date.now();

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get(
    "/health",
    {
      schema: {
        tags: ["System"],
        summary: "Health check",
        description:
          "Returns comprehensive server health: uptime, memory usage, runtime info, and AI provider status.",
        response: {
          200: {
            description: "Server is healthy",
            type: "object",
            properties: {
              success: { type: "boolean" },
              requestId: { type: "string" },
              timestamp: { type: "string" },
              data: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["healthy", "degraded", "unhealthy"] },
                  uptime: { type: "number", description: "Uptime in seconds" },
                  timestamp: { type: "string" },
                  version: { type: "string" },
                  buildNumber: { type: "string" },
                  environment: { type: "string" },
                  memory: {
                    type: "object",
                    properties: {
                      used: { type: "number", description: "Used memory in MB" },
                      total: { type: "number", description: "Total heap in MB" },
                      percentage: { type: "number" },
                    },
                  },
                  runtime: {
                    type: "object",
                    properties: {
                      node: { type: "string" },
                      platform: { type: "string" },
                      arch: { type: "string" },
                    },
                  },
                  aiProviders: {
                    type: "object",
                    properties: {
                      openai: { type: "string" },
                      anthropic: { type: "string" },
                      gemini: { type: "string" },
                      groq: { type: "string" },
                      openrouter: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const requestId =
        (_request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const memUsage = process.memoryUsage();
      const usedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const totalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const providers = getProviderStatus();
      
      const dbConnected = await testDbConnection();
      const redisConnected = await testRedisConnection();

      const health: HealthData = {
        status: dbConnected && redisConnected ? "healthy" : "degraded",
        uptime: Math.round((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
        version: config.appVersion,
        buildNumber: config.buildNumber,
        environment: config.nodeEnv,
        memory: {
          used: usedMB,
          total: totalMB,
          percentage: Math.round((usedMB / totalMB) * 100),
        },
        runtime: {
          node: process.version,
          platform: process.platform,
          arch: process.arch,
        },
        aiProviders: providers,
        persistence: {
          database: dbConnected ? "connected" : "disconnected",
          redis: redisConnected ? "connected" : "disconnected",
          storage: config.storage.provider,
        },
      };

      void reply.status(200).send(successResponse(health, requestId));
    }
  );
}
