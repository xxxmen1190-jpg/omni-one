/**
 * Audit Service — Omni One Backend
 *
 * Tracks system-wide events for security and compliance.
 */

import { auditLogRepository } from "../database/auditLogRepository.js";
import { logger } from "../utils/logger.js";
import type { FastifyRequest } from "fastify";

export class AuditService {
  /**
   * Log a system event.
   */
  async log(params: {
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    metadata?: any;
    request?: FastifyRequest;
  }): Promise<void> {
    try {
      await auditLogRepository.log({
        user: params.userId ? { connect: { id: params.userId } } : undefined,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId,
        metadata: params.metadata,
        ip: params.request?.ip,
        userAgent: params.request?.headers["user-agent"] as string,
      });
    } catch (err) {
      // Don't throw on audit log failure, just log it
      logger.error({ err, action: params.action }, "Failed to write audit log");
    }
  }
}

export const auditService = new AuditService();
