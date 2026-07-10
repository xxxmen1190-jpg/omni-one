/**
 * Audit Log Repository — Omni One Backend
 */

import { BaseRepository } from "./baseRepository.js";
import type { AuditLog, Prisma } from "@prisma/client";

export class AuditLogRepository extends BaseRepository {
  async log(data: Prisma.AuditLogCreateInput): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }

  async listByUser(userId: string, limit = 50): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  async findByResource(resource: string, resourceId: string): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { resource, resourceId },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const auditLogRepository = new AuditLogRepository();
