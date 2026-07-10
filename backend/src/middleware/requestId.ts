/**
 * Request ID Middleware — Omni One Backend
 *
 * Ensures every request has a unique `x-request-id` header.
 * If the client provides one, it is preserved; otherwise a new UUID is generated.
 * The request ID is attached to the reply header and to the request object.
 */

import type { FastifyInstance } from "fastify";
import { generateRequestId } from "../utils/response.js";

export function registerRequestIdHook(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", (request, reply, done) => {
    const existing = request.headers["x-request-id"] as string | undefined;
    const requestId = existing ?? generateRequestId();

    // Attach to request headers so downstream handlers can read it
    request.headers["x-request-id"] = requestId;

    // Echo back in response headers
    void reply.header("x-request-id", requestId);

    done();
  });
}
