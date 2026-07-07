/**
 * Phase 12.4 — Permission System
 * Every tool declares its required permissions and dangerous actions.
 * The runtime validates permissions before any execution.
 *
 * Permission levels:
 *   read       — read-only access to data
 *   write      — can modify data or files
 *   admin      — can perform administrative actions
 *   network    — can make outbound network requests
 *   filesystem — can access the local filesystem
 *   database   — can query databases
 *   email      — can send or read email
 *   calendar   — can create/modify calendar events
 *   execute    — can run arbitrary code
 */

import { ToolPermission } from "./IToolSDK";
import { ToolSDKRegistry } from "./ToolSDKRegistry";
import { Logger } from "../../system/Logger";

// ─── Permission Grant ─────────────────────────────────────────────────────────

export interface PermissionGrant {
  /** The set of permissions that have been granted */
  granted: Set<ToolPermission>;
  /** Who/what granted these permissions */
  grantedBy: string;
  /** When the grant was issued (Unix ms) */
  issuedAt: number;
  /** Optional expiry (Unix ms). Undefined = never expires. */
  expiresAt?: number;
}

// ─── Permission Context ───────────────────────────────────────────────────────

export interface PermissionContext {
  /** Unique ID for this execution context (e.g. session ID) */
  contextId: string;
  /** Active permission grants */
  grants: PermissionGrant[];
}

// ─── Validation Result ────────────────────────────────────────────────────────

export interface PermissionValidationResult {
  /** Whether execution is allowed */
  allowed: boolean;
  /** Missing permissions that blocked execution */
  missing: ToolPermission[];
  /** Dangerous permissions that require explicit confirmation */
  dangerousRequested: ToolPermission[];
  /** Human-readable reason */
  reason: string;
}

// ─── Permission Validator ─────────────────────────────────────────────────────

export class PermissionValidator {
  /**
   * Validate that a permission context grants all permissions required by a tool.
   * Also flags dangerous permissions for explicit confirmation.
   *
   * @param toolId - The tool to validate
   * @param context - The permission context for this execution
   * @param confirmDangerous - Whether the caller has explicitly confirmed dangerous actions
   */
  static validate(
    toolId: string,
    context: PermissionContext,
    confirmDangerous = false
  ): PermissionValidationResult {
    const tool = ToolSDKRegistry.get(toolId);
    if (!tool) {
      return {
        allowed: false,
        missing: [],
        dangerousRequested: [],
        reason: `Tool "${toolId}" is not registered`,
      };
    }

    const { permissions, dangerousPermissions } = tool.metadata;
    const effectiveGrants = PermissionValidator.getEffectiveGrants(context);

    // Check required permissions
    const missing = permissions.filter((p) => !effectiveGrants.has(p));

    // Check dangerous permissions
    const dangerousRequested = dangerousPermissions.filter((p) => permissions.includes(p));

    if (missing.length > 0) {
      Logger.warn(`[PermissionSystem] Tool "${toolId}" blocked — missing permissions`, { missing });
      return {
        allowed: false,
        missing,
        dangerousRequested,
        reason: `Missing required permissions: ${missing.join(", ")}`,
      };
    }

    if (dangerousRequested.length > 0 && !confirmDangerous) {
      Logger.warn(`[PermissionSystem] Tool "${toolId}" requires dangerous permission confirmation`, {
        dangerousRequested,
      });
      return {
        allowed: false,
        missing: [],
        dangerousRequested,
        reason: `Tool requires dangerous permissions that need explicit confirmation: ${dangerousRequested.join(", ")}`,
      };
    }

    Logger.info(`[PermissionSystem] Tool "${toolId}" permission check passed`);
    return { allowed: true, missing: [], dangerousRequested, reason: "All permissions granted" };
  }

  /**
   * Collect all non-expired permissions from a context's grants.
   */
  static getEffectiveGrants(context: PermissionContext): Set<ToolPermission> {
    const now = Date.now();
    const effective = new Set<ToolPermission>();
    for (const grant of context.grants) {
      if (grant.expiresAt !== undefined && grant.expiresAt < now) continue;
      for (const p of grant.granted) effective.add(p);
    }
    return effective;
  }

  /**
   * Check if a context has a specific permission.
   */
  static hasPermission(context: PermissionContext, permission: ToolPermission): boolean {
    return PermissionValidator.getEffectiveGrants(context).has(permission);
  }
}

// ─── Permission Manager ───────────────────────────────────────────────────────

export class PermissionManager {
  private contexts: Map<string, PermissionContext> = new Map();

  /**
   * Create a new permission context with a default set of safe permissions.
   */
  createContext(contextId: string, initialPermissions: ToolPermission[] = []): PermissionContext {
    const context: PermissionContext = {
      contextId,
      grants: [],
    };
    if (initialPermissions.length > 0) {
      this.grant(contextId, initialPermissions, "system-init");
    }
    this.contexts.set(contextId, context);
    Logger.info(`[PermissionManager] Created context: ${contextId}`, { initialPermissions });
    return context;
  }

  /**
   * Grant permissions to a context.
   */
  grant(
    contextId: string,
    permissions: ToolPermission[],
    grantedBy: string,
    ttlMs?: number
  ): void {
    let context = this.contexts.get(contextId);
    if (!context) {
      context = this.createContext(contextId);
    }
    const grant: PermissionGrant = {
      granted: new Set(permissions),
      grantedBy,
      issuedAt: Date.now(),
      expiresAt: ttlMs !== undefined ? Date.now() + ttlMs : undefined,
    };
    context.grants.push(grant);
    Logger.info(`[PermissionManager] Granted permissions to ${contextId}`, { permissions, grantedBy });
  }

  /**
   * Revoke all permissions from a context.
   */
  revoke(contextId: string): void {
    const context = this.contexts.get(contextId);
    if (context) {
      context.grants = [];
      Logger.info(`[PermissionManager] Revoked all permissions for ${contextId}`);
    }
  }

  /**
   * Get a context by ID.
   */
  getContext(contextId: string): PermissionContext | undefined {
    return this.contexts.get(contextId);
  }

  /**
   * Validate a tool execution against a context.
   */
  validateExecution(
    toolId: string,
    contextId: string,
    confirmDangerous = false
  ): PermissionValidationResult {
    const context = this.contexts.get(contextId);
    if (!context) {
      return {
        allowed: false,
        missing: [],
        dangerousRequested: [],
        reason: `Permission context "${contextId}" does not exist`,
      };
    }
    return PermissionValidator.validate(toolId, context, confirmDangerous);
  }

  /**
   * Create a default permissive context for development/testing.
   * WARNING: Do not use in production.
   */
  createPermissiveContext(contextId: string): PermissionContext {
    const allPermissions: ToolPermission[] = [
      "read", "write", "admin", "network", "filesystem",
      "database", "email", "calendar", "execute",
    ];
    return this.createContext(contextId, allPermissions);
  }

  /**
   * Create a read-only context (safe for untrusted tools).
   */
  createReadOnlyContext(contextId: string): PermissionContext {
    return this.createContext(contextId, ["read", "network"]);
  }
}

/** Singleton permission manager */
export const permissionManager = new PermissionManager();

// ─── Runtime Guard ────────────────────────────────────────────────────────────

/**
 * RuntimePermissionGuard wraps tool execution with permission validation.
 * Use this instead of calling tool.execute() directly.
 */
export class RuntimePermissionGuard {
  constructor(private manager: PermissionManager = permissionManager) {}

  async executeWithPermissionCheck<T>(
    toolId: string,
    contextId: string,
    input: unknown,
    confirmDangerous = false
  ): Promise<{ allowed: boolean; result?: T; permissionError?: string }> {
    const validation = this.manager.validateExecution(toolId, contextId, confirmDangerous);

    if (!validation.allowed) {
      Logger.warn(`[RuntimePermissionGuard] Blocked execution of "${toolId}"`, {
        reason: validation.reason,
      });
      return { allowed: false, permissionError: validation.reason };
    }

    const tool = ToolSDKRegistry.get(toolId);
    if (!tool) {
      return { allowed: false, permissionError: `Tool "${toolId}" not found` };
    }

    const executionResult = await tool.execute(input);
    return { allowed: true, result: executionResult as T };
  }
}

export const runtimePermissionGuard = new RuntimePermissionGuard();
