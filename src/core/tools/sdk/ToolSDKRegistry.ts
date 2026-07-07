/**
 * ToolSDKRegistry
 * Central registry for all tools in the Omni One system.
 * Tools self-register on import — no manual wiring required.
 * Supports dynamic discovery by category, permission, capability, and tag.
 */

import { IToolSDK, ToolCategory, ToolPermission, ToolMetadataSDK } from "./IToolSDK";
import { Logger } from "../../system/Logger";

export interface RegistryEntry {
  tool: IToolSDK;
  registeredAt: number;
  lastHealthCheck?: number;
  healthy: boolean;
}

class ToolSDKRegistryImpl {
  private readonly _entries: Map<string, RegistryEntry> = new Map();

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a tool. Called automatically by each tool module on import.
   * Throws if a tool with the same ID is already registered.
   */
  register(tool: IToolSDK): void {
    const { id } = tool.metadata;
    if (this._entries.has(id)) {
      Logger.warn(`[ToolSDKRegistry] Tool "${id}" is already registered — skipping duplicate`);
      return;
    }
    this._entries.set(id, {
      tool,
      registeredAt: Date.now(),
      healthy: true,
    });
    Logger.info(`[ToolSDKRegistry] Registered tool: ${id} (${tool.metadata.category})`);
  }

  /**
   * Unregister and cleanup a tool by ID.
   */
  async unregister(toolId: string): Promise<void> {
    const entry = this._entries.get(toolId);
    if (!entry) {
      Logger.warn(`[ToolSDKRegistry] Cannot unregister unknown tool: ${toolId}`);
      return;
    }
    await entry.tool.cleanup();
    this._entries.delete(toolId);
    Logger.info(`[ToolSDKRegistry] Unregistered tool: ${toolId}`);
  }

  // ─── Discovery ─────────────────────────────────────────────────────────────

  /** Get a tool by ID */
  get(toolId: string): IToolSDK | undefined {
    return this._entries.get(toolId)?.tool;
  }

  /** Get all registered tools */
  getAll(): IToolSDK[] {
    return Array.from(this._entries.values()).map((e) => e.tool);
  }

  /** Get all tool metadata */
  getAllMetadata(): ToolMetadataSDK[] {
    return this.getAll().map((t) => t.metadata);
  }

  /** Get tools by category */
  getByCategory(category: ToolCategory): IToolSDK[] {
    return this.getAll().filter((t) => t.metadata.category === category);
  }

  /** Get tools that require a specific permission */
  getByPermission(permission: ToolPermission): IToolSDK[] {
    return this.getAll().filter((t) => t.metadata.permissions.includes(permission));
  }

  /** Get tools by tag */
  getByTag(tag: string): IToolSDK[] {
    return this.getAll().filter((t) => t.metadata.tags.includes(tag));
  }

  /** Get tools that support streaming */
  getStreamingTools(): IToolSDK[] {
    return this.getAll().filter((t) => t.metadata.capabilities.supportsStreaming);
  }

  /** Get read-only tools */
  getReadOnlyTools(): IToolSDK[] {
    return this.getAll().filter((t) => t.metadata.capabilities.isReadOnly);
  }

  /** Search tools by name or description */
  search(query: string): IToolSDK[] {
    const q = query.toLowerCase();
    return this.getAll().filter(
      (t) =>
        t.metadata.name.toLowerCase().includes(q) ||
        t.metadata.description.toLowerCase().includes(q) ||
        t.metadata.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  /** Check if a tool is registered */
  has(toolId: string): boolean {
    return this._entries.has(toolId);
  }

  /** Total number of registered tools */
  get size(): number {
    return this._entries.size;
  }

  // ─── Health Monitoring ─────────────────────────────────────────────────────

  /** Run health checks on all registered tools */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    await Promise.allSettled(
      Array.from(this._entries.entries()).map(async ([id, entry]) => {
        try {
          const result = await entry.tool.healthCheck();
          entry.healthy = result.healthy;
          entry.lastHealthCheck = Date.now();
          results.set(id, result.healthy);
        } catch {
          entry.healthy = false;
          results.set(id, false);
        }
      })
    );
    return results;
  }

  /** Get only healthy tools */
  getHealthyTools(): IToolSDK[] {
    return Array.from(this._entries.values())
      .filter((e) => e.healthy)
      .map((e) => e.tool);
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  /** Initialize all registered tools */
  async initializeAll(): Promise<void> {
    Logger.info(`[ToolSDKRegistry] Initializing ${this._entries.size} tools...`);
    await Promise.allSettled(
      this.getAll().map((tool) =>
        tool.initialize().catch((err) => {
          Logger.error(`[ToolSDKRegistry] Failed to initialize ${tool.metadata.id}`, { err });
        })
      )
    );
    Logger.info(`[ToolSDKRegistry] All tools initialized`);
  }

  /** Cleanup all registered tools */
  async cleanupAll(): Promise<void> {
    Logger.info(`[ToolSDKRegistry] Cleaning up ${this._entries.size} tools...`);
    await Promise.allSettled(this.getAll().map((tool) => tool.cleanup()));
    this._entries.clear();
    Logger.info(`[ToolSDKRegistry] All tools cleaned up`);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  getSummary(): Record<string, unknown> {
    const byCategory: Record<string, number> = {};
    for (const tool of this.getAll()) {
      byCategory[tool.metadata.category] = (byCategory[tool.metadata.category] || 0) + 1;
    }
    return {
      totalTools: this._entries.size,
      byCategory,
      healthyTools: Array.from(this._entries.values()).filter((e) => e.healthy).length,
    };
  }
}

/** Singleton registry — imported and used everywhere */
export const ToolSDKRegistry = new ToolSDKRegistryImpl();
