/**
 * Auth Routes — Omni One Backend
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authService } from "../../services/authService.js";
import { auditService } from "../../services/auditService.js";
import { authenticate } from "../../middleware/auth.js";
import { successResponse } from "../../utils/response.js";
import { sanitizeEmail, sanitizeString } from "../../middleware/security.js";


export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── Register ──────────────────────────────────────────────────────────────
  
  fastify.post(
    "/auth/register",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            displayName: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const body = request.body as any;
      // Sanitize inputs before processing
      const email = sanitizeEmail(body.email);
      const displayName = body.displayName ? sanitizeString(body.displayName, 100) : undefined;
      const user = await authService.register({ ...body, email, displayName });
      
      const { token } = await authService.createSession(user.id, {
        ip: request.ip,
         // userAgent: request.headers["user-agent"],
      });

      await auditService.log({
        userId: user.id,
        action: "REGISTER",
        resource: "USER",
        resourceId: user.id,
        request,
      });

      void (reply as any)
        .setCookie("session", token, {
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "strict",
        })
        .status(201)
        .send(successResponse({ user, token }, requestId));
    }
  );

  // ─── Login ─────────────────────────────────────────────────────────────────

  fastify.post(
    "/auth/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string" },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const body = request.body as any;
      // Sanitize email before lookup to prevent injection
      const email = sanitizeEmail(body.email);
      const user = await authService.login(email, body.password);
      
      const { token } = await authService.createSession(user.id, {
        ip: request.ip,
         // userAgent: request.headers["user-agent"],
      });

      await auditService.log({
        userId: user.id,
        action: "LOGIN",
        resource: "USER",
        resourceId: user.id,
        request,
      });

      void (reply as any)
        .setCookie("session", token, {
          path: "/",
          httpOnly: true,
          secure: true,
          sameSite: "strict",
        })
        .send(successResponse({ user, token }, requestId));
    }
  );

  // ─── Logout ────────────────────────────────────────────────────────────────

  fastify.post(
    "/auth/logout",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const user = (request as any).user;
      const token = (request as any).cookies?.session;
      if (token) {
        await authService.logout(token);
      }
      
      await auditService.log({
        userId: user.id,
        action: "LOGOUT",
        resource: "USER",
        resourceId: user.id,
        request,
      });

      void (reply as any)
        .clearCookie("session")
        .send(successResponse({ message: "Logged out successfully" }, requestId));
    }
  );

  // ─── Me ────────────────────────────────────────────────────────────────────

  fastify.get(
    "/auth/me",
    { preHandler: [authenticate] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string) ?? "unknown";
      const user = (request as any).user;
      void reply.send(successResponse({ user }, requestId));
    }
  );
}
