/**
 * Admin Routes — Omni One Backend
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { adminService } from "../../services/adminService.js";
import { successResponse } from "../../utils/response.js";
import { AppError } from "../../types/index.js";

/**
 * Middleware to check if user is an admin
 */
async function requireAdmin(request: FastifyRequest) {
  const user = (request as any).user;
  if (user.role !== "ADMIN" && user.role !== "OWNER") {
    throw new AppError("Forbidden: Admin access required", 403);
  }
}

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", authenticate);
  fastify.addHook("preHandler", requireAdmin);

  // ── User Management ────────────────────────────────────────────────────────
  
  fastify.get("/admin/users", async (request: FastifyRequest) => {
    const { page, limit } = request.query as any;
    const result = await adminService.listUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20
    );
    return successResponse(result, request.id);
  });

  fastify.patch("/admin/users/:id/role", async (request: FastifyRequest) => {
    const { id } = request.params as any;
    const { role } = request.body as any;
    const user = await adminService.updateUserRole(id, role);
    return successResponse(user, request.id);
  });

  // ── Beta Invites ───────────────────────────────────────────────────────────

  fastify.post("/admin/invites", async (request: FastifyRequest) => {
    const body = request.body as any;
    const invite = await adminService.createInvite(body);
    return successResponse(invite, request.id);
  });

  // ── Feature Flags ──────────────────────────────────────────────────────────

  fastify.get("/admin/features", async (request: FastifyRequest) => {
    const features = await adminService.getFeatureFlags();
    return successResponse(features, request.id);
  });

  fastify.post("/admin/features/toggle", async (request: FastifyRequest) => {
    const { name, isEnabled } = request.body as any;
    const feature = await adminService.toggleFeatureFlag(name, isEnabled);
    return successResponse(feature, request.id);
  });
}
