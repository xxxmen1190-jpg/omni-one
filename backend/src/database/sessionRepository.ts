/**
 * Session Repository — Omni One Backend
 */

import { BaseRepository } from "./baseRepository.js";
import type { Session, Prisma } from "@prisma/client";

export class SessionRepository extends BaseRepository {
  async findByTokenHash(tokenHash: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  async create(data: Prisma.SessionCreateInput): Promise<Session> {
    return this.prisma.session.create({ data });
  }

  async listByUser(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId, isActive: true },
      orderBy: { lastUsedAt: "desc" },
    });
  }

  async deactivate(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async deactivateAllForUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
  }

  async deleteExpired(): Promise<Prisma.BatchPayload> {
    return this.prisma.session.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
  }

  async updateLastUsed(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }
}

export const sessionRepository = new SessionRepository();
