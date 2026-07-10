/**
 * Request Logger Middleware — Omni One Backend
 *
 * Logs every incoming request and its response time using pino.
 * Sensitive headers are automatically redacted by the logger config.
 */

import type { FastifyInstance } from "fastify";
import { logger } from "../utils/logger.js";

export function registerRequestLoggerHooks(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", (request, _reply, done) => {
    const requestId = request.headers["x-request-id"] as string;
    request.log = logger.child({ requestId });

    request.log.info(
      { method: request.method, url: request.url, ip: request.ip },
      "Incoming request"
    );
    done();
  });

  fastify.addHook("onResponse", (request, reply, done) => {
    const requestId = request.headers["x-request-id"] as string;
    const responseTime = reply.elapsedTime;

    logger.info(
      {
        requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTimeMs: Math.round(responseTime),
      },
      "Request completed"
    );
    done();
  });
}
