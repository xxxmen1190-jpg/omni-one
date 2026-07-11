/**
 * Marketplace Service — Omni One Backend
 * 
 * Manages the ecosystem of Agents, Skills, and Plugins.
 */

import { prisma } from "../database/prisma.js";
import { AppError } from "../types/index.js";
import { logger } from "../utils/logger.js";

export interface MarketplaceItemManifest {
  permissions: string[];
  requiredTools: string[];
  requiredModels: string[];
  memoryRequirements?: string;
  inputs?: any[];
  outputs?: any[];
}

class MarketplaceServiceClass {
  // ─── Marketplace Discovery ──────────────────────────────────────────────────

  async listItems(query: { type?: any; category?: string; search?: string; page?: number; limit?: number }) {
    const { type, category, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (type) where.type = type;
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.marketplaceItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isFeatured: "desc" }, { installCount: "desc" }],
      }),
      prisma.marketplaceItem.count({ where }),
    ]);

    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  async getItemDetails(id: string) {
    const item = await prisma.marketplaceItem.findUnique({
      where: { id },
      include: { reviews: { take: 5, orderBy: { createdAt: "desc" } } },
    });
    if (!item) throw new AppError("Item not found", 404);
    return item;
  }

  // ─── Installation Management ────────────────────────────────────────────────

  async installItem(userId: string, itemId: string) {
    const item = await prisma.marketplaceItem.findUnique({ where: { id: itemId } });
    if (!item) throw new AppError("Marketplace item not found", 404);

    const installation = await prisma.marketplaceInstallation.upsert({
      where: { userId_itemId: { userId, itemId } },
      update: { version: item.version, isEnabled: true },
      create: { userId, itemId, version: item.version },
    });

    // Increment install count
    await prisma.marketplaceItem.update({
      where: { id: itemId },
      data: { installCount: { increment: 1 } },
    });

    logger.info({ userId, itemId }, "Marketplace item installed");
    return installation;
  }

  async uninstallItem(userId: string, itemId: string) {
    return await prisma.marketplaceInstallation.delete({
      where: { userId_itemId: { userId, itemId } },
    });
  }

  async toggleInstallation(userId: string, itemId: string, isEnabled: boolean) {
    return await prisma.marketplaceInstallation.update({
      where: { userId_itemId: { userId, itemId } },
      data: { isEnabled },
    });
  }

  async getUserInstallations(userId: string) {
    return await prisma.marketplaceInstallation.findMany({
      where: { userId },
      include: { item: true },
    });
  }

  // ─── Reviews & Ratings ──────────────────────────────────────────────────────

  async submitReview(userId: string, itemId: string, rating: number, comment?: string) {
    const review = await prisma.marketplaceReview.create({
      data: { userId, itemId, rating, comment },
    });

    // Recalculate item rating
    const allReviews = await prisma.marketplaceReview.findMany({ where: { itemId } });
    const avgRating = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;

    await prisma.marketplaceItem.update({
      where: { id: itemId },
      data: { 
        rating: avgRating,
        reviewCount: allReviews.length,
      },
    });

    return review;
  }
}

export const marketplaceService = new MarketplaceServiceClass();
