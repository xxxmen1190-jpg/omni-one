/**
 * Phase 12.3 — Capability Registry Integration
 * Bridges the ToolSDKRegistry with the existing CapabilityRegistry.
 * Every tool that registers in ToolSDKRegistry is automatically
 * reflected in the global CapabilityRegistry — no manual wiring.
 *
 * Usage: import this module once at app startup (e.g. in main.tsx).
 * After that, all tool imports trigger auto-registration in both registries.
 */

import { ToolSDKRegistry } from "./ToolSDKRegistry";
import { IToolSDK, ToolMetadataSDK } from "./IToolSDK";
import { Logger } from "../../system/Logger";

// ─── Discovery API ────────────────────────────────────────────────────────────

/**
 * ToolDiscovery provides a high-level API for the AI to find tools dynamically.
 * The AI calls these methods to understand what tools are available
 * without any hardcoded knowledge of specific tool IDs.
 */
export class ToolDiscovery {
  /**
   * Find tools that can handle a given intent described in natural language.
   * The AI uses this to plan which tools to use for a task.
   */
  static findToolsForIntent(intent: string): IToolSDK[] {
    const keywords = intent.toLowerCase().split(/\s+/);
    const scored: Array<{ tool: IToolSDK; score: number }> = [];

    for (const tool of ToolSDKRegistry.getAll()) {
      let score = 0;
      const searchText = [
        tool.metadata.name,
        tool.metadata.description,
        ...tool.metadata.tags,
        tool.metadata.category,
      ].join(" ").toLowerCase();

      for (const kw of keywords) {
        if (searchText.includes(kw)) score++;
      }

      if (score > 0) scored.push({ tool, score });
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .map((s) => s.tool);
  }

  /**
   * Get a structured capability map for the AI to reason about.
   * Returns a flat list of tool descriptors grouped by category.
   */
  static getCapabilityMap(): Record<string, ToolDescriptor[]> {
    const map: Record<string, ToolDescriptor[]> = {};

    for (const tool of ToolSDKRegistry.getAll()) {
      const cat = tool.metadata.category;
      if (!map[cat]) map[cat] = [];
      map[cat].push(toDescriptor(tool.metadata));
    }

    return map;
  }

  /**
   * Get a single tool descriptor by ID for the AI to inspect.
   */
  static getToolDescriptor(toolId: string): ToolDescriptor | null {
    const tool = ToolSDKRegistry.get(toolId);
    return tool ? toDescriptor(tool.metadata) : null;
  }

  /**
   * Get all tools that are safe to use without special permissions.
   */
  static getSafeTools(): IToolSDK[] {
    return ToolSDKRegistry.getAll().filter(
      (t) => t.metadata.dangerousPermissions.length === 0 && t.metadata.capabilities.isReadOnly
    );
  }

  /**
   * Get tools that can run in parallel.
   */
  static getParallelizableTools(): IToolSDK[] {
    return ToolSDKRegistry.getAll().filter(
      (t) => t.metadata.capabilities.supportsParallelExecution
    );
  }

  /**
   * Estimate total cost for a set of tool executions.
   */
  static estimateCost(toolIds: string[]): { totalUSD: number; breakdown: Record<string, number> } {
    const breakdown: Record<string, number> = {};
    let total = 0;
    for (const id of toolIds) {
      const tool = ToolSDKRegistry.get(id);
      if (tool) {
        const cost = tool.metadata.costEstimate.perExecutionUSD;
        breakdown[id] = cost;
        total += cost;
      }
    }
    return { totalUSD: total, breakdown };
  }

  /**
   * Estimate total latency for sequential tool execution.
   */
  static estimateLatency(toolIds: string[], parallel = false): { minMs: number; typicalMs: number; maxMs: number } {
    const tools = toolIds.map((id) => ToolSDKRegistry.get(id)).filter(Boolean) as IToolSDK[];
    if (tools.length === 0) return { minMs: 0, typicalMs: 0, maxMs: 0 };

    if (parallel) {
      return {
        minMs: Math.max(...tools.map((t) => t.metadata.latencyEstimate.minMs)),
        typicalMs: Math.max(...tools.map((t) => t.metadata.latencyEstimate.typicalMs)),
        maxMs: Math.max(...tools.map((t) => t.metadata.latencyEstimate.maxMs)),
      };
    }

    return {
      minMs: tools.reduce((s, t) => s + t.metadata.latencyEstimate.minMs, 0),
      typicalMs: tools.reduce((s, t) => s + t.metadata.latencyEstimate.typicalMs, 0),
      maxMs: tools.reduce((s, t) => s + t.metadata.latencyEstimate.maxMs, 0),
    };
  }
}

// ─── CapabilityRegistry Bridge ────────────────────────────────────────────────

/**
 * Syncs all tools from ToolSDKRegistry into the legacy CapabilityRegistry.
 * Called once at startup. After that, new tool registrations are bridged automatically
 * via the ToolSDKRegistry proxy.
 */
export async function syncToolsToCapabilityRegistry(): Promise<void> {
  Logger.info("[CapabilityRegistryIntegration] Syncing tools to CapabilityRegistry...");

  // Dynamically import to avoid circular deps
  const { CapabilityRegistry } = await import("../../runtime/registry/CapabilityRegistry");
  const registry = new CapabilityRegistry();

  for (const tool of ToolSDKRegistry.getAll()) {
    try {
      registry.register({
        id: tool.metadata.id,
        name: tool.metadata.name,
        description: tool.metadata.description,
        type: "tool" as any,
        pluginId: `native-tools-${tool.metadata.category}`,
        version: tool.metadata.version,
        dependencies: tool.metadata.requiredProviders.map((p) => p.name),
        config: {
          category: tool.metadata.category,
          permissions: tool.metadata.permissions,
          costEstimate: tool.metadata.costEstimate,
          latencyEstimate: tool.metadata.latencyEstimate,
        },
        enabled: true,
        performance: { avgLatency: tool.metadata.latencyEstimate.typicalMs, successRate: 1, totalCalls: 0 } as any,
        reliability: { uptime: 1, errorRate: 0, lastHealthCheck: Date.now() } as any,
      });
    } catch {
      // Already registered — skip
    }
  }

  Logger.info(`[CapabilityRegistryIntegration] Synced ${ToolSDKRegistry.size} tools`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ToolDescriptor {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  permissions: string[];
  dangerousPermissions: string[];
  isReadOnly: boolean;
  supportsStreaming: boolean;
  supportsCancellation: boolean;
  supportsParallelExecution: boolean;
  costPerExecutionUSD: number;
  typicalLatencyMs: number;
  requiredApiKeys: string[];
}

function toDescriptor(meta: ToolMetadataSDK): ToolDescriptor {
  return {
    id: meta.id,
    name: meta.name,
    category: meta.category,
    description: meta.description,
    tags: meta.tags,
    permissions: meta.permissions,
    dangerousPermissions: meta.dangerousPermissions,
    isReadOnly: meta.capabilities.isReadOnly,
    supportsStreaming: meta.capabilities.supportsStreaming,
    supportsCancellation: meta.capabilities.supportsCancellation,
    supportsParallelExecution: meta.capabilities.supportsParallelExecution,
    costPerExecutionUSD: meta.costEstimate.perExecutionUSD,
    typicalLatencyMs: meta.latencyEstimate.typicalMs,
    requiredApiKeys: meta.requiredApiKeys.filter((k) => k.required).map((k) => k.envVar),
  };
}
