/**
 * Admin Service — Omni One Backend
 * 
 * Handles administrative tasks:
 * - User management
 * - Beta invite code generation
 * - Feature flag management
 */

import { prisma } from "../database/prisma.js";
import { AppError } from "../types/index.js";
import { logger } from "../utils/logger.js";
import crypto from "crypto";

class AdminServiceClass {
  // ─── User Management ────────────────────────────────────────────────────────

  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          email: true,
          displayName: true,
          role: true,
          status: true,
          createdAt: true,
          lastSeenAt: true,
        }
      }),
      prisma.user.count(),
    ]);

    return { users, total, page, pages: Math.ceil(total / limit) };
  }

  async updateUserRole(userId: string, role: any) {
    return await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  // ─── Beta Invites ───────────────────────────────────────────────────────────

  async createInvite(data: { email?: string; maxUses?: number; expiresAt?: string }) {
    const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // e.g. "A1B2C3D4"
    
    return await prisma.betaInvite.create({
      data: {
        code,
        email: data.email,
        maxUses: data.maxUses || 1,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
  }

  async validateInvite(code: string) {
    const invite = await prisma.betaInvite.findUnique({ where: { code } });
    
    if (!invite) return false;
    if (invite.uses >= invite.maxUses) return false;
    if (invite.expiresAt && invite.expiresAt < new Date()) return false;
    
    return true;
  }

  async useInvite(code: string) {
    const valid = await this.validateInvite(code);
    if (!valid) throw new AppError("Invalid or expired invite code", 400);

    return await prisma.betaInvite.update({
      where: { code },
      data: { uses: { increment: 1 } },
    });
  }

  // ─── Feature Flags ──────────────────────────────────────────────────────────

  async getFeatureFlags() {
    return await prisma.featureFlag.findMany();
  }

  async toggleFeatureFlag(name: string, isEnabled: boolean) {
    return await prisma.featureFlag.upsert({
      where: { name },
      update: { isEnabled },
      create: { name, isEnabled },
    });
  }
}

export const adminService = new AdminServiceClass();
