/**
 * Conversations Routes — Omni One Backend
 *
 * Full CRUD for conversations and their messages.
 * All routes require authentication.
 *
 * GET    /conversations
 * POST   /conversations
 * GET    /conversations/:id
 * PATCH  /conversations/:id
 * DELETE /conversations/:id
 * GET    /conversations/:id/messages
 * POST   /conversations/:id/messages
 * PATCH  /conversations/:id/messages/:msgId
 * DELETE /conversations/:id/messages/:msgId
 */

import type { FastifyInstance, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { authenticate } from "../../middleware/auth.js";
import { prisma } from "../../database/prisma.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getUserId(request: FastifyRequest): string {
  const user = (request as FastifyRequest & { user?: { id: string } }).user;
  if (!user?.id) throw new AppError("Unauthorized", 401, "UNAUTHORIZED");
  return user.id;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function conversationRoutes(fastify: FastifyInstance): Promise<void> {
  

  // ── GET /conversations ─────────────────────────────────────────────────────
  fastify.get("/conversations", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = getUserId(request);
    const conversations = await prisma.conversation.findMany({
      where: { userId },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true, title: true, userId: true, projectId: true,
        isPinned: true, isFavorite: true, isArchived: true, isDeleted: true,
        summary: true, metadata: true, createdAt: true, updatedAt: true,
        _count: { select: { messages: true } },
      },
    });
    void reply.send(successResponse(conversations, request.id));
  });

  // ── POST /conversations ────────────────────────────────────────────────────
  fastify.post<{ Body: { title?: string; projectId?: string } }>(
    "/conversations",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = getUserId(request);
      const { title = "New Conversation", projectId } = request.body ?? {};
      const conv = await prisma.conversation.create({
        data: { title, userId, projectId: projectId ?? null },
      });
      void reply.status(201).send(successResponse(conv, request.id));
    }
  );

  // ── GET /conversations/:id ─────────────────────────────────────────────────
  fastify.get<{ Params: { id: string }; Querystring: { includeMessages?: string } }>(
    "/conversations/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = getUserId(request);
      const { id } = request.params;
      const includeMessages = request.query.includeMessages === "true";
      const conv = await prisma.conversation.findFirst({
        where: { id, userId },
        include: includeMessages ? { messages: { orderBy: { createdAt: "asc" } } } : undefined,
      });
      if (!conv) throw new AppError("Conversation not found", 404, "NOT_FOUND");
      void reply.send(successResponse(conv, request.id));
    }
  );

  // ── PATCH /conversations/:id ───────────────────────────────────────────────
  fastify.patch<{
    Params: { id: string };
    Body: {
      title?: string;
      isPinned?: boolean;
      isFavorite?: boolean;
      isArchived?: boolean;
      isDeleted?: boolean;
      summary?: string;
    };
  }>(
    "/conversations/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = getUserId(request);
      const { id } = request.params;
      const existing = await prisma.conversation.findFirst({ where: { id, userId } });
      if (!existing) throw new AppError("Conversation not found", 404, "NOT_FOUND");
      const updated = await prisma.conversation.update({
        where: { id },
        data: { ...request.body, updatedAt: new Date() },
      });
      void reply.send(successResponse(updated, request.id));
    }
  );

  // ── DELETE /conversations/:id ──────────────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    "/conversations/:id",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = getUserId(request);
      const { id } = request.params;
      const existing = await prisma.conversation.findFirst({ where: { id, userId } });
      if (!existing) throw new AppError("Conversation not found", 404, "NOT_FOUND");
      await prisma.conversation.delete({ where: { id } });
      void reply.send(successResponse({ message: "Deleted" }, request.id));
    }
  );

  // ── GET /conversations/:id/messages ───────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/conversations/:id/messages",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = getUserId(request);
      const { id } = request.params;
      const conv = await prisma.conversation.findFirst({ where: { id, userId } });
      if (!conv) throw new AppError("Conversation not found", 404, "NOT_FOUND");
      const messages = await prisma.message.findMany({
        where: { conversationId: id },
        orderBy: { createdAt: "asc" },
      });
      void reply.send(successResponse(messages, request.id));
    }
  );

  // ── POST /conversations/:id/messages ──────────────────────────────────────
  fastify.post<{
    Params: { id: string };
    Body: { role: string; content: string; model?: string; metadata?: Record<string, unknown> };
  }>(
    "/conversations/:id/messages",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = getUserId(request);
      const { id } = request.params;
      const conv = await prisma.conversation.findFirst({ where: { id, userId } });
      if (!conv) throw new AppError("Conversation not found", 404, "NOT_FOUND");

      const { role, content, model, metadata } = request.body;
      const validRoles = ["USER", "ASSISTANT", "SYSTEM", "TOOL"];
      const normalizedRole = role.toUpperCase();
      if (!validRoles.includes(normalizedRole)) {
        throw new AppError(`Invalid role: ${role}`, 400, "VALIDATION_ERROR");
      }

      const message = await prisma.message.create({
        data: {
          conversationId: id,
          role: normalizedRole as "USER" | "ASSISTANT" | "SYSTEM" | "TOOL",
          content,
          model: model ?? null,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
      });

      // Update conversation updatedAt
      await prisma.conversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      void reply.status(201).send(successResponse(message, request.id));
    }
  );

  // ── PATCH /conversations/:id/messages/:msgId ───────────────────────────────
  fastify.patch<{
    Params: { id: string; msgId: string };
    Body: { content: string };
  }>(
    "/conversations/:id/messages/:msgId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = getUserId(request);
      const { id, msgId } = request.params;
      const conv = await prisma.conversation.findFirst({ where: { id, userId } });
      if (!conv) throw new AppError("Conversation not found", 404, "NOT_FOUND");
      const msg = await prisma.message.findFirst({ where: { id: msgId, conversationId: id } });
      if (!msg) throw new AppError("Message not found", 404, "NOT_FOUND");
      const updated = await prisma.message.update({
        where: { id: msgId },
        data: { content: request.body.content },
      });
      void reply.send(successResponse(updated, request.id));
    }
  );

  // ── DELETE /conversations/:id/messages/:msgId ──────────────────────────────
  fastify.delete<{ Params: { id: string; msgId: string } }>(
    "/conversations/:id/messages/:msgId",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const userId = getUserId(request);
      const { id, msgId } = request.params;
      const conv = await prisma.conversation.findFirst({ where: { id, userId } });
      if (!conv) throw new AppError("Conversation not found", 404, "NOT_FOUND");
      const msg = await prisma.message.findFirst({ where: { id: msgId, conversationId: id } });
      if (!msg) throw new AppError("Message not found", 404, "NOT_FOUND");
      await prisma.message.delete({ where: { id: msgId } });
      void reply.send(successResponse({ message: "Deleted" }, request.id));
    }
  );
}
