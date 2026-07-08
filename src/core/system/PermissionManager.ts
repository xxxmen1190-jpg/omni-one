import { ToolPermission, PermissionGrant } from "../tools/types";
import { Logger } from "./Logger";
import { AuditLog } from "./AuditLog";

export class PermissionManager {
  private static grants = new Map<string, PermissionGrant>(); // key: toolId-permission

  static requestPermission(
    toolId: string,
    permission: ToolPermission,
    allowOnce: boolean = false,
    expiresAt?: number
  ): boolean {
    // In a real UI, this would trigger a user prompt.
    // For now, we'll auto-grant for simplicity in backend logic.
    // This method should ideally be called by a UI component.
    Logger.warn(`Auto-granting permission for tool ${toolId} to ${permission}. In production, this requires user confirmation.`);
    this.grantPermission(toolId, permission, allowOnce, expiresAt);
    return true;
  }

  static grantPermission(
    toolId: string,
    permission: ToolPermission,
    allowOnce: boolean = false,
    expiresAt?: number
  ): void {
    const key = `${toolId}-${permission}`;
    this.grants.set(key, {
      toolId,
      permission,
      grantedAt: Date.now(),
      expiresAt,
      allowOnce,
    });
    Logger.info(`Permission granted: ${permission} for tool ${toolId}`, { allowOnce, expiresAt });
    AuditLog.record("permission_granted", "user", toolId, "success", { permission, allowOnce, expiresAt });
  }

  static checkPermission(toolId: string, permission: ToolPermission): boolean {
    const key = `${toolId}-${permission}`;
    const grant = this.grants.get(key);

    if (!grant) {
      Logger.debug(`Permission not found: ${permission} for tool ${toolId}`);
      return false;
    }

    if (grant.expiresAt && Date.now() > grant.expiresAt) {
      this.grants.delete(key);
      Logger.info(`Expired permission removed: ${permission} for tool ${toolId}`);
      return false;
    }

    // If it was a one-time grant, remove it after checking
    if (grant.allowOnce) {
      this.grants.delete(key);
      Logger.info(`One-time permission used and removed: ${permission} for tool ${toolId}`);
    }

    return true;
  }

  static revokePermission(toolId: string, permission: ToolPermission): void {
    const key = `${toolId}-${permission}`;
    this.grants.delete(key);
    Logger.info(`Permission revoked: ${permission} for tool ${toolId}`);
    AuditLog.record("permission_revoked", "user", toolId, "success", { permission });
  }

  static getGrantsForTool(toolId: string): PermissionGrant[] {
    return Array.from(this.grants.values()).filter(grant => grant.toolId === toolId);
  }

  static clearAllGrants(): void {
    this.grants.clear();
    Logger.info("All permission grants cleared.");
  }
}
