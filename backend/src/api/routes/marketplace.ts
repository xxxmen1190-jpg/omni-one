/**
 * Marketplace Routes — Omni One Backend
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { authenticate } from "../../middleware/auth.js";
import { marketplaceService } from "../../services/marketplaceService.js";
import { successResponse } from "../../utils/response.js";

export async function marketplaceRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Discovery ──────────────────────────────────────────────────────────────
  
  fastify.get("/marketplace", async (request: FastifyRequest) => {
    const query = request.query as any;
    const result = await marketplaceService.listItems(query);
    return successResponse(result, request.id);
  });

  fastify.get("/marketplace/:id", async (request: FastifyRequest) => {
    const { id } = request.params as any;
    const item = await marketplaceService.getItemDetails(id);
    return successResponse(item, request.id);
  });

  // ── Installations (Protected) ──────────────────────────────────────────────

  fastify.get(
    "/marketplace/installations",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      const user = (request as any).user;
      const installations = await marketplaceService.getUserInstallations(user.id);
      return successResponse(installations, request.id);
    }
  );

  fastify.post(
    "/marketplace/install/:id",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      const user = (request as any).user;
      const { id } = request.params as any;
      const installation = await marketplaceService.installItem(user.id, id);
      return successResponse(installation, request.id);
    }
  );

  fastify.delete(
    "/marketplace/install/:id",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      const user = (request as any).user;
      const { id } = request.params as any;
      await marketplaceService.uninstallItem(user.id, id);
      return successResponse({ message: "Uninstalled" }, request.id);
    }
  );

  fastify.patch(
    "/marketplace/install/:id/toggle",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      const user = (request as any).user;
      const { id } = request.params as any;
      const { isEnabled } = request.body as any;
      const installation = await marketplaceService.toggleInstallation(user.id, id, isEnabled);
      return successResponse(installation, request.id);
    }
  );

  // ── Reviews ────────────────────────────────────────────────────────────────

  fastify.post(
    "/marketplace/:id/reviews",
    { preHandler: [authenticate] },
    async (request: FastifyRequest) => {
      const user = (request as any).user;
      const { id } = request.params as any;
      const { rating, comment } = request.body as any;
      const review = await marketplaceService.submitReview(user.id, id, rating, comment);
      return successResponse(review, request.id);
    }
  );
}
