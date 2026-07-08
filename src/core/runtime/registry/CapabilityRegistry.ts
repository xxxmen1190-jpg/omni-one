import {
  CapabilityMetadata,
  PluginType,
  PerformanceMetrics,
  ReliabilityMetrics,
} from "../../../types/runtime";
import { Logger } from "../../system/Logger";

/**
 * Global Capability Registry - Centralized registry for all capabilities
 * Tracks all Tools, Agents, Providers, Workflows, etc.
 */

export class CapabilityRegistry {
  private capabilities: Map<string, CapabilityMetadata> = new Map();
  private byType: Map<PluginType, Set<string>> = new Map();
  private byPlugin: Map<string, Set<string>> = new Map();
  private dependencyGraph: Map<string, Set<string>> = new Map();

  constructor() {
    Logger.info("CapabilityRegistry initialized");
  }

  /**
   * Register a capability
   */
  register(capability: CapabilityMetadata): void {
    // Check if already exists
    if (this.capabilities.has(capability.id)) {
      Logger.warn("Capability already registered", { capabilityId: capability.id });
      return;
    }

    // Validate dependencies
    for (const dep of capability.dependencies) {
      if (!this.capabilities.has(dep)) {
        Logger.warn("Dependency not found", {
          capabilityId: capability.id,
          dependency: dep,
        });
      }
    }

    // Register capability
    this.capabilities.set(capability.id, capability);

    // Index by type
    if (!this.byType.has(capability.type)) {
      this.byType.set(capability.type, new Set());
    }
    this.byType.get(capability.type)!.add(capability.id);

    // Index by plugin
    if (!this.byPlugin.has(capability.pluginId)) {
      this.byPlugin.set(capability.pluginId, new Set());
    }
    this.byPlugin.get(capability.pluginId)!.add(capability.id);

    // Build dependency graph
    for (const dep of capability.dependencies) {
      if (!this.dependencyGraph.has(dep)) {
        this.dependencyGraph.set(dep, new Set());
      }
      this.dependencyGraph.get(dep)!.add(capability.id);
    }

    Logger.info("Capability registered", {
      capabilityId: capability.id,
      type: capability.type,
      pluginId: capability.pluginId,
    });
  }

  /**
   * Unregister a capability
   */
  unregister(capabilityId: string): void {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      Logger.warn("Capability not found", { capabilityId });
      return;
    }

    // Remove from main registry
    this.capabilities.delete(capabilityId);

    // Remove from type index
    const typeSet = this.byType.get(capability.type);
    if (typeSet) {
      typeSet.delete(capabilityId);
      if (typeSet.size === 0) {
        this.byType.delete(capability.type);
      }
    }

    // Remove from plugin index
    const pluginSet = this.byPlugin.get(capability.pluginId);
    if (pluginSet) {
      pluginSet.delete(capabilityId);
      if (pluginSet.size === 0) {
        this.byPlugin.delete(capability.pluginId);
      }
    }

    // Remove from dependency graph
    this.dependencyGraph.delete(capabilityId);
    this.dependencyGraph.forEach((deps) => {
      deps.delete(capabilityId);
    });

    Logger.info("Capability unregistered", { capabilityId });
  }

  /**
   * Get a capability by ID
   */
  get(capabilityId: string): CapabilityMetadata | undefined {
    return this.capabilities.get(capabilityId);
  }

  /**
   * Get all capabilities of a type
   */
  getByType(type: PluginType): CapabilityMetadata[] {
    const ids = this.byType.get(type) || new Set();
    return Array.from(ids)
      .map((id) => this.capabilities.get(id)!)
      .filter((c) => c !== undefined);
  }

  /**
   * Get all capabilities from a plugin
   */
  getByPlugin(pluginId: string): CapabilityMetadata[] {
    const ids = this.byPlugin.get(pluginId) || new Set();
    return Array.from(ids)
      .map((id) => this.capabilities.get(id)!)
      .filter((c) => c !== undefined);
  }

  /**
   * Search capabilities
   */
  search(query: string): CapabilityMetadata[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.capabilities.values()).filter(
      (c) =>
        c.id.toLowerCase().includes(lowerQuery) ||
        c.name.toLowerCase().includes(lowerQuery) ||
        c.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get all capabilities
   */
  getAll(): CapabilityMetadata[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get capabilities sorted by performance
   */
  getByPerformance(type?: PluginType, limit: number = 10): CapabilityMetadata[] {
    let capabilities = this.getAll();

    if (type) {
      capabilities = capabilities.filter((c) => c.type === type);
    }

    return capabilities
      .sort((a, b) => {
        const scoreA = a.reliability.healthScore * a.performanceMetrics.successRate;
        const scoreB = b.reliability.healthScore * b.performanceMetrics.successRate;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * Get capabilities sorted by reliability
   */
  getByReliability(type?: PluginType, limit: number = 10): CapabilityMetadata[] {
    let capabilities = this.getAll();

    if (type) {
      capabilities = capabilities.filter((c) => c.type === type);
    }

    return capabilities
      .sort((a, b) => b.reliability.healthScore - a.reliability.healthScore)
      .slice(0, limit);
  }

  /**
   * Get capabilities sorted by speed
   */
  getBySpeed(type?: PluginType, limit: number = 10): CapabilityMetadata[] {
    let capabilities = this.getAll();

    if (type) {
      capabilities = capabilities.filter((c) => c.type === type);
    }

    return capabilities
      .sort((a, b) => a.performanceMetrics.averageExecutionTime - b.performanceMetrics.averageExecutionTime)
      .slice(0, limit);
  }

  /**
   * Check if capability exists
   */
  has(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }

  /**
   * Get dependency chain
   */
  getDependencies(capabilityId: string): string[] {
    const capability = this.capabilities.get(capabilityId);
    if (!capability) {
      return [];
    }

    const deps = new Set<string>();
    const queue = [...capability.dependencies];

    while (queue.length > 0) {
      const dep = queue.shift()!;
      if (!deps.has(dep)) {
        deps.add(dep);
        const depCapability = this.capabilities.get(dep);
        if (depCapability) {
          queue.push(...depCapability.dependencies);
        }
      }
    }

    return Array.from(deps);
  }

  /**
   * Get dependents (capabilities that depend on this one)
   */
  getDependents(capabilityId: string): string[] {
    return Array.from(this.dependencyGraph.get(capabilityId) || new Set());
  }

  /**
   * Check compatibility
   */
  isCompatible(capabilityId1: string, capabilityId2: string): boolean {
    const cap1 = this.capabilities.get(capabilityId1);
    const cap2 = this.capabilities.get(capabilityId2);

    if (!cap1 || !cap2) {
      return false;
    }

    return (
      cap1.compatibleWith.includes(capabilityId2) ||
      cap2.compatibleWith.includes(capabilityId1)
    );
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(
    capabilityId: string,
    metrics: Partial<PerformanceMetrics>
  ): void {
    const capability = this.capabilities.get(capabilityId);
    if (capability) {
      capability.performanceMetrics = {
        ...capability.performanceMetrics,
        ...metrics,
      };
      capability.lastUsed = Date.now();
      capability.usageCount++;
    }
  }

  /**
   * Update reliability metrics
   */
  updateReliabilityMetrics(
    capabilityId: string,
    metrics: Partial<ReliabilityMetrics>
  ): void {
    const capability = this.capabilities.get(capabilityId);
    if (capability) {
      capability.reliability = {
        ...capability.reliability,
        ...metrics,
      };
    }
  }

  /**
   * Get registry statistics
   */
  getStatistics(): Record<string, any> {
    const stats = {
      totalCapabilities: this.capabilities.size,
      byType: {} as Record<string, number>,
      byPlugin: {} as Record<string, number>,
      averageHealthScore: 0,
      averageSuccessRate: 0,
    };

    this.byType.forEach((ids, type) => {
      stats.byType[type] = ids.size;
    });

    this.byPlugin.forEach((ids, pluginId) => {
      stats.byPlugin[pluginId] = ids.size;
    });

    let totalHealth = 0;
    let totalSuccess = 0;

    this.capabilities.forEach((capability) => {
      totalHealth += capability.reliability.healthScore;
      totalSuccess += capability.performanceMetrics.successRate;
    });

    if (this.capabilities.size > 0) {
      stats.averageHealthScore = totalHealth / this.capabilities.size;
      stats.averageSuccessRate = totalSuccess / this.capabilities.size;
    }

    return stats;
  }

  /**
   * Export registry
   */
  export(): Record<string, any> {
    return {
      capabilities: Array.from(this.capabilities.values()),
      statistics: this.getStatistics(),
      timestamp: Date.now(),
    };
  }

  /**
   * Clear registry
   */
  clear(): void {
    this.capabilities.clear();
    this.byType.clear();
    this.byPlugin.clear();
    this.dependencyGraph.clear();
    Logger.info("CapabilityRegistry cleared");
  }
}

export const createCapabilityRegistry = (): CapabilityRegistry => {
  return new CapabilityRegistry();
};
