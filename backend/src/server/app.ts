/**
 * Fastify Application Builder — Omni One Backend
 *
 * Assembles the Fastify server with all plugins, middleware, and routes.
 * This function is pure — it does not start the server (that is done in index.ts).
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import cookie from "@fastify/cookie";

import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { registerRequestIdHook } from "../middleware/requestId.js";
import { registerRequestLoggerHooks } from "../middleware/requestLogger.js";

import { healthRoutes } from "../api/routes/health.js";
import { versionRoutes } from "../api/routes/version.js";
import { statusRoutes } from "../api/routes/status.js";
import { chatRoutes } from "../api/routes/chat.js";
import { unifiedChatRoutes } from "../api/routes/unifiedChat.js";
import { toolsRoutes } from "../api/routes/tools.js";
import { agentsRoutes } from "../api/routes/agents.js";
import { authRoutes } from "../api/routes/auth.js";
import { userRoutes } from "../api/routes/users.js";
import { conversationRoutes } from "../api/routes/conversations.js";
import { filesRoutes } from "../api/routes/files.js";
import { metricsRoutes } from "../api/routes/metrics.js";
import { feedbackRoutes } from "../api/routes/feedback.js";
import { adminRoutes } from "../api/routes/admin.js";
import { marketplaceRoutes } from "../api/routes/marketplace.js";
import { publicApiRoutes } from "../api/routes/publicApi.js";
import { authRateLimitConfig } from "../middleware/security.js";
import { metricsService } from "../services/metricsService.js";

export async function buildApp() {
  const fastify = Fastify({
    logger: false, // We use our own pino logger
    trustProxy: true,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 10 * 1024 * 1024, // 10 MB request body limit
  });

  // ── Security: Helmet ────────────────────────────────────────────────────────
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false, // Required for Swagger UI
  });

  // ── Security: CORS ──────────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: config.cors.origins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-api-key"],
    exposedHeaders: ["x-request-id"],
    credentials: true,
    maxAge: 86400, // 24 hours preflight cache
  });

  // ── Security: Cookies ───────────────────────────────────────────────────────
  await fastify.register(cookie, {
    secret: config.auth.cookieSecret,
    parseOptions: {},
  });

  // ── Security: Rate Limiting ─────────────────────────────────────────────────
  await fastify.register(rateLimit, {
    global: true,
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    keyGenerator: (request: any) =>
      (request.headers["x-forwarded-for"] as string | undefined) ??
      request.ip ??
      "unknown",
    errorResponseBuilder: (_request: any, context: any) => ({
      success: false,
      requestId: "rate-limited",
      timestamp: new Date().toISOString(),
      error: {
        code: "RATE_LIMITED",
        message: `Too many requests. Retry after ${Math.ceil(context.ttl / 1000)}s.`,
        statusCode: 429,
      },
    }),
  });

  // ── OpenAPI / Swagger ───────────────────────────────────────────────────────
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Omni One API",
        description:
          "Production REST API for Omni One — AI orchestration platform. " +
          "Provides endpoints for chat, tool execution, agent orchestration, and system health.",
        version: config.appVersion,
        contact: {
          name: "Omni One Team",
        },
      },
      servers: [
        {
          url: `http://${config.host}:${config.port}`,
          description:
            config.nodeEnv === "production" ? "Production" : "Development",
        },
      ],
      tags: [
        { name: "System", description: "Health, version, and status endpoints" },
        { name: "Chat", description: "AI chat completion endpoints" },
        { name: "Tools", description: "Tool execution endpoints" },
        { name: "Agents", description: "Agent orchestration endpoints" },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "x-api-key",
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: false,
    transformStaticCSP: (header: any) => header,
  });

  // ── Middleware Hooks ────────────────────────────────────────────────────────
  registerRequestIdHook(fastify);
  registerRequestLoggerHooks(fastify);

  // ── Metrics: Track active requests ─────────────────────────────────────────
  fastify.addHook("onRequest", async () => {
    metricsService.incrementActiveRequests();
    metricsService.incrementTotalRequests();
  });
  fastify.addHook("onResponse", async (_request, reply) => {
    metricsService.decrementActiveRequests();
    if (reply.statusCode >= 500) metricsService.incrementErrors();
  });

  // ── Routes ──────────────────────────────────────────────────────────────────
  await fastify.register(healthRoutes, { prefix: "/" });
  await fastify.register(versionRoutes, { prefix: "/" });
  await fastify.register(statusRoutes, { prefix: "/" });
  await fastify.register(chatRoutes, { prefix: "/" });
  await fastify.register(unifiedChatRoutes, { prefix: "/" });
  await fastify.register(toolsRoutes, { prefix: "/" });
  await fastify.register(agentsRoutes, { prefix: "/" });
  await fastify.register(authRoutes, { prefix: "/" });
  await fastify.register(userRoutes, { prefix: "/" });
  await fastify.register(conversationRoutes, { prefix: "/" });
  await fastify.register(filesRoutes, { prefix: "/" });
  await fastify.register(metricsRoutes, { prefix: "/" });
  await fastify.register(feedbackRoutes, { prefix: "/" });
  await fastify.register(adminRoutes, { 
    prefix: "/",
    config: { rateLimit: authRateLimitConfig } // Stricter limits for admin
  });
  await fastify.register(marketplaceRoutes, { prefix: "/" });
  await fastify.register(publicApiRoutes, { prefix: "/api" });

  // ── Error Handler ───────────────────────────────────────────────────────────
  fastify.setErrorHandler(errorHandler);

  // ── 404 Handler ─────────────────────────────────────────────────────────────
  fastify.setNotFoundHandler((request, reply) => {
    const requestId =
      (request.headers["x-request-id"] as string | undefined) ?? "unknown";
    void reply.status(404).send({
      success: false,
      requestId,
      timestamp: new Date().toISOString(),
      error: {
        code: "NOT_FOUND",
        message: `Route ${request.method} ${request.url} not found`,
        statusCode: 404,
      },
    });
  });

  logger.info(
    { env: config.nodeEnv, version: config.appVersion },
    "Fastify application built"
  );

  return fastify;
}
