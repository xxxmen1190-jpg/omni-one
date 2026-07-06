import {
  CapabilityMetadata,
  RuntimeEvent,
} from "../../../types/runtime";
import { EventBus } from "../events/EventBus";
import { CapabilityRegistry } from "../registry/CapabilityRegistry";
import { Logger } from "../../system/Logger";

/**
 * Dynamic Capability Injector - Injects capabilities into the system at runtime
 * Handles dynamic capability addition, removal, and updates
 */

export class CapabilityInjector {
  private eventBus: EventBus;
  private registry: CapabilityRegistry;
  private injectedCapabilities: Map<string, CapabilityMetadata> = new Map();
  private injectionHistory: Array<{
    timestamp: number;
    action: "inject" | "remove" | "update";
    capabilityId: string;
  }> = [];

  constructor(eventBus: EventBus, registry: CapabilityRegistry) {
    this.eventBus = eventBus;
    this.registry = registry;
    Logger.info("CapabilityInjector initialized");
  }

  /**
   * Inject a capability into the system
   */
  async injectCapability(capability: CapabilityMetadata): Promise<void> {
    try {
      // Check if already exists
      if (this.registry.has(capability.id)) {
        Logger.warn("Capability already exists", { capabilityId: capability.id });
        return;
      }

      // Validate dependencies
      const dependencies = capability.dependencies;
      for (const dep of dependencies) {
        if (!this.registry.has(dep)) {
          throw new Error(`Dependency not found: ${dep}`);
        }
      }

      // Register capability
      this.registry.register(capability);
      this.injectedCapabilities.set(capability.id, capability);

      // Record injection
      this.injectionHistory.push({
        timestamp: Date.now(),
        action: "inject",
        capabilityId: capability.id,
      });

      // Emit event
      await this.eventBus.emit({
        type: "capability:added",
        timestamp: Date.now(),
        source: "CapabilityInjector",
        data: {
          capabilityId: capability.id,
          type: capability.type,
          pluginId: capability.pluginId,
        },
        priority: "normal",
      });

      Logger.info("Capability injected", {
        capabilityId: capability.id,
        type: capability.type,
      });
    } catch (error: any) {
      Logger.error("Failed to inject capability", {
        capabilityId: capability.id,
        error: error.message,
      });

      await this.eventBus.emit({
        type: "system:error",
        timestamp: Date.now(),
        source: "CapabilityInjector",
        data: {
          error: error.message,
          capabilityId: capability.id,
        },
        priority: "high",
      });

      throw error;
    }
  }

  /**
   * Remove an injected capability
   */
  async removeCapability(capabilityId: string): Promise<void> {
    try {
      // Check if capability exists
      if (!this.registry.has(capabilityId)) {
        throw new Error(`Capability not found: ${capabilityId}`);
      }

      // Check for dependents
      const dependents = this.registry.getDependents(capabilityId);
      if (dependents.length > 0) {
        throw new Error(
          `Cannot remove capability with dependents: ${dependents.join(", ")}`
        );
      }

      // Unregister capability
      this.registry.unregister(capabilityId);
      this.injectedCapabilities.delete(capabilityId);

      // Record removal
      this.injectionHistory.push({
        timestamp: Date.now(),
        action: "remove",
        capabilityId,
      });

      // Emit event
      await this.eventBus.emit({
        type: "capability:removed",
        timestamp: Date.now(),
        source: "CapabilityInjector",
        data: { capabilityId },
        priority: "normal",
      });

      Logger.info("Capability removed", { capabilityId });
    } catch (error: any) {
      Logger.error("Failed to remove capability", {
        capabilityId,
        error: error.message,
      });

      await this.eventBus.emit({
        type: "system:error",
        timestamp: Date.now(),
        source: "CapabilityInjector",
        data: {
          error: error.message,
          capabilityId,
        },
        priority: "high",
      });

      throw error;
    }
  }

  /**
   * Update a capability
   */
  async updateCapability(
    capabilityId: string,
    updates: Partial<CapabilityMetadata>
  ): Promise<void> {
    try {
      const capability = this.registry.get(capabilityId);
      if (!capability) {
        throw new Error(`Capability not found: ${capabilityId}`);
      }

      // Merge updates
      const updated = { ...capability, ...updates };

      // Unregister old, register new
      this.registry.unregister(capabilityId);
      this.registry.register(updated);

      // Record update
      this.injectionHistory.push({
        timestamp: Date.now(),
        action: "update",
        capabilityId,
      });

      // Emit event
      await this.eventBus.emit({
        type: "capability:added",
        timestamp: Date.now(),
        source: "CapabilityInjector",
        data: {
          capabilityId,
          updates,
        },
        priority: "normal",
      });

      Logger.info("Capability updated", { capabilityId });
    } catch (error: any) {
      Logger.error("Failed to update capability", {
        capabilityId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Inject multiple capabilities
   */
  async injectCapabilities(capabilities: CapabilityMetadata[]): Promise<void> {
    for (const capability of capabilities) {
      await this.injectCapability(capability);
    }
  }

  /**
   * Get injected capabilities
   */
  getInjectedCapabilities(): CapabilityMetadata[] {
    return Array.from(this.injectedCapabilities.values());
  }

  /**
   * Get injection history
   */
  getInjectionHistory(limit: number = 100): Array<{
    timestamp: number;
    action: "inject" | "remove" | "update";
    capabilityId: string;
  }> {
    return this.injectionHistory.slice(-limit);
  }

  /**
   * Clear injection history
   */
  clearInjectionHistory(): void {
    this.injectionHistory = [];
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    const injected = this.getInjectedCapabilities();
    const byType: Record<string, number> = {};

    injected.forEach((cap) => {
      byType[cap.type] = (byType[cap.type] || 0) + 1;
    });

    const historyStats = {
      inject: 0,
      remove: 0,
      update: 0,
    };

    this.injectionHistory.forEach((entry) => {
      historyStats[entry.action]++;
    });

    return {
      totalInjected: injected.length,
      byType,
      history: historyStats,
      historyLength: this.injectionHistory.length,
    };
  }
}

export const createCapabilityInjector = (
  eventBus: EventBus,
  registry: CapabilityRegistry
): CapabilityInjector => {
  return new CapabilityInjector(eventBus, registry);
};
