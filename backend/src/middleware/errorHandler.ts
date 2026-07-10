/**
 * Centralized Error Handler Middleware — Omni One Backend
 *
 * Catches all errors thrown in route handlers and formats them
 * into a consistent API error response. Stack traces are never
 * exposed to the client.
 */

import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../types/index.js";
import { errorResponse } from "../utils/response.js";
import { logger } from "../utils/logger.js";

export function errorHandler(
  error: FastifyError | AppError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId =
    (request.headers["x-request-id"] as string | undefined) ?? "unknown";

  // ── Fastify validation errors (schema mismatch) ──────────────────────────
  if ("statusCode" in error && error.statusCode === 400 && "validation" in error) {
    logger.warn({ requestId, path: request.url, error: error.message }, "Validation error");
    void reply.status(400).send(
      errorResponse(error.message, "VALIDATION_ERROR", 400, requestId)
    );
    return;
  }

  // ── Application-level errors ─────────────────────────────────────────────
  if (error instanceof AppError) {
    logger.warn(
      { requestId, code: error.code, statusCode: error.statusCode, path: request.url },
      error.message
    );
    void reply.status(error.statusCode).send(
      errorResponse(error.message, error.code, error.statusCode, requestId)
    );
    return;
  }

  // ── Fastify 404 ───────────────────────────────────────────────────────────
  if ("statusCode" in error && error.statusCode === 404) {
    void reply.status(404).send(
      errorResponse("Route not found", "NOT_FOUND", 404, requestId)
    );
    return;
  }

  // ── Fastify rate limit ────────────────────────────────────────────────────
  if ("statusCode" in error && error.statusCode === 429) {
    void reply.status(429).send(
      errorResponse("Too many requests", "RATE_LIMITED", 429, requestId)
    );
    return;
  }

  // ── Unexpected errors — log fully, respond generically ───────────────────
  logger.error(
    { requestId, path: request.url, err: error },
    "Unhandled internal error"
  );
  void reply.status(500).send(
    errorResponse(
      "An unexpected error occurred. Please try again later.",
      "INTERNAL_ERROR",
      500,
      requestId
    )
  );
}
