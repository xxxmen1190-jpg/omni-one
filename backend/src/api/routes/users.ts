/**
 * User Routes — Omni One Backend
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { userRepository } from "../../database/userRepository.js";
import { sessionRepository } from "../../database/sessionRepository.js";
import { authenticate } from "../../middleware/auth.js";
import { successResponse } from "../../utils/response.js";

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── Update Profile ────────────────────────────────────────────────────────
  
  fastify.patch(
    "/users/me",
    {
      preHandler: [authenticate],
      schema: {
        body: {
          type: "object",
          properties: {
            displayName: { type: "string" },
            username: { type: "string" },
            bio: { type: "string" },
            timezone: { type: "string" },
            language: { type: "string" },
            preferences: { type: "object" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const user = (request as any).user;
      const body = request.body as any;
      
      const updatedUser = await userRepository.update(user.id, body);
      void reply.send(successResponse({ user: updatedUser }, requestId));
    }
  );

  // ─── List Sessions ─────────────────────────────────────────────────────────

  fastify.get(
    "/sessions",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const user = (request as any).user;
      const sessions = await sessionRepository.listByUser(user.id);
      void reply.send(successResponse({ sessions }, requestId));
    }
  );

  // ─── Terminate Session ─────────────────────────────────────────────────────

  fastify.delete(
    "/sessions/:id",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const user = (request as any).user;
      const { id } = request.params as { id: string };
      
      // Ensure the session belongs to the user
      const sessions = await sessionRepository.listByUser(user.id);
      const session = sessions.find(s => s.id === id);
      
      if (session) {
        await sessionRepository.deactivate(id);
      }
      
      void reply.send(successResponse({ message: "Session terminated" }, requestId));
    }
  );
}
