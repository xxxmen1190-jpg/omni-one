import {
  IPlugin,
  PluginManifest,
  PluginConfig,
  PluginStatus,
  RuntimeEvent,
} from "../../../types/runtime";
import { EventBus } from "../events/EventBus";
import { CapabilityRegistry } from "../registry/CapabilityRegistry";
import { Logger } from "../../system/Logger";

/**
 * Plugin Runtime - Manages plugin lifecycle and execution
 * Handles loading, initialization, execution, and unloading of plugins
 */

export class PluginRuntime {
  private plugins: Map<string, IPlugin> = new Map();
  private eventBus: EventBus;
  private registry: CapabilityRegistry;
  private pluginInstances: Map<string, any[]> = new Map();
  private maxInstancesPerPlugin: number = 10;

  constructor(eventBus: EventBus, registry: CapabilityRegistry) {
    this.eventBus = eventBus;
    this.registry = registry;
    Logger.info("PluginRuntime initialized");
  }

  /**
   * Load a plugin
   */
  async loadPlugin(plugin: IPlugin): Promise<void> {
    const manifest = plugin.manifest;

    if (this.plugins.has(manifest.id)) {
      Logger.warn("Plugin already loaded", { pluginId: manifest.id });
      return;
    }

    try {
      Logger.info("Loading plugin", { pluginId: manifest.id, version: manifest.version });

      // Check dependencies
      for (const dep of manifest.dependencies) {
        if (!this.plugins.has(dep.pluginId)) {
          throw new Error(`Dependency not found: ${dep.pluginId}`);
        }
      }

      // Store plugin
      this.plugins.set(manifest.id, plugin);
      this.pluginInstances.set(manifest.id, []);

      // Emit event
      await this.eventBus.emit({
        type: "plugin:loaded",
        timestamp: Date.now(),
        source: "PluginRuntime",
        data: { pluginId: manifest.id },
        priority: "normal",
      });

      Logger.info("Plugin loaded", { pluginId: manifest.id });
    } catch (error: any) {
      Logger.error("Failed to load plugin", {
        pluginId: manifest.id,
        error: error.message,
      });

      await this.eventBus.emit({
        type: "plugin:failed",
        timestamp: Date.now(),
        source: "PluginRuntime",
        data: { pluginId: manifest.id, error: error.message },
        priority: "high",
      });

      throw error;
    }
  }

  /**
   * Initialize a plugin
   */
  async initializePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.status === "active") {
      Logger.warn("Plugin already initialized", { pluginId });
      return;
    }

    try {
      Logger.info("Initializing plugin", { pluginId });

      // Update status
      plugin.status = "loading";

      // Initialize plugin
      await plugin.initialize();

      // Update status
      plugin.status = "active";

      // Emit event
      await this.eventBus.emit({
        type: "plugin:initialized",
        timestamp: Date.now(),
        source: "PluginRuntime",
        data: { pluginId },
        priority: "normal",
      });

      Logger.info("Plugin initialized", { pluginId });
    } catch (error: any) {
      plugin.status = "failed";

      Logger.error("Failed to initialize plugin", {
        pluginId,
        error: error.message,
      });

      await this.eventBus.emit({
        type: "plugin:failed",
        timestamp: Date.now(),
        source: "PluginRuntime",
        data: { pluginId, error: error.message },
        priority: "high",
      });

      throw error;
    }
  }

  /**
   * Execute a plugin
   */
  async executePlugin(pluginId: string, input: any): Promise<any> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.status !== "active") {
      throw new Error(`Plugin not active: ${pluginId} (status: ${plugin.status})`);
    }

    const startTime = Date.now();

    try {
      // Emit start event
      await this.eventBus.emit({
        type: "tool:start",
        timestamp: startTime,
        source: pluginId,
        data: { pluginId, input },
        priority: "normal",
      });

      // Execute with timeout
      const timeout = plugin.config.timeout || 30000;
      const result = await this.executeWithTimeout(plugin, input, timeout);

      // Emit complete event
      const duration = Date.now() - startTime;
      await this.eventBus.emit({
        type: "tool:complete",
        timestamp: Date.now(),
        source: pluginId,
        data: { pluginId, duration, result },
        priority: "normal",
      });

      return result;
    } catch (error: any) {
      // Emit error event
      await this.eventBus.emit({
        type: "tool:error",
        timestamp: Date.now(),
        source: pluginId,
        data: { pluginId, error: error.message },
        priority: "high",
      });

      throw error;
    }
  }

  /**
   * Execute with timeout
   */
  private executeWithTimeout(plugin: IPlugin, input: any, timeout: number): Promise<any> {
    return Promise.race([
      plugin.execute(input),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Plugin execution timeout after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      Logger.warn("Plugin not found", { pluginId });
      return;
    }

    try {
      Logger.info("Unloading plugin", { pluginId });

      // Shutdown plugin
      await plugin.shutdown();

      // Remove plugin
      this.plugins.delete(pluginId);
      this.pluginInstances.delete(pluginId);

      // Emit event
      await this.eventBus.emit({
        type: "plugin:unloaded",
        timestamp: Date.now(),
        source: "PluginRuntime",
        data: { pluginId },
        priority: "normal",
      });

      Logger.info("Plugin unloaded", { pluginId });
    } catch (error: any) {
      Logger.error("Failed to unload plugin", {
        pluginId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Disable a plugin
   */
  async disablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    plugin.status = "disabled";

    await this.eventBus.emit({
      type: "plugin:disabled",
      timestamp: Date.now(),
      source: "PluginRuntime",
      data: { pluginId },
      priority: "normal",
    });

    Logger.info("Plugin disabled", { pluginId });
  }

  /**
   * Enable a plugin
   */
  async enablePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    if (plugin.status === "disabled") {
      plugin.status = "active";

      await this.eventBus.emit({
        type: "plugin:initialized",
        timestamp: Date.now(),
        source: "PluginRuntime",
        data: { pluginId },
        priority: "normal",
      });

      Logger.info("Plugin enabled", { pluginId });
    }
  }

  /**
   * Get plugin
   */
  getPlugin(pluginId: string): IPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all plugins
   */
  getAllPlugins(): IPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get active plugins
   */
  getActivePlugins(): IPlugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.status === "active");
  }

  /**
   * Get plugin status
   */
  getPluginStatus(pluginId: string): PluginStatus | undefined {
    return this.plugins.get(pluginId)?.status;
  }

  /**
   * Get all plugin statuses
   */
  getAllPluginStatuses(): Record<string, PluginStatus> {
    const statuses: Record<string, PluginStatus> = {};

    this.plugins.forEach((plugin) => {
      statuses[plugin.manifest.id] = plugin.status;
    });

    return statuses;
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    await this.unloadPlugin(pluginId);
    await this.loadPlugin(plugin);
    await this.initializePlugin(pluginId);
  }

  /**
   * Get runtime statistics
   */
  getStatistics(): Record<string, any> {
    const statuses: Record<PluginStatus, number> = {
      inactive: 0,
      loading: 0,
      active: 0,
      failed: 0,
      disabled: 0,
      updating: 0,
    };

    this.plugins.forEach((plugin) => {
      statuses[plugin.status]++;
    });

    return {
      totalPlugins: this.plugins.size,
      statuses,
      activePlugins: statuses.active,
      failedPlugins: statuses.failed,
      disabledPlugins: statuses.disabled,
    };
  }
}

export const createPluginRuntime = (
  eventBus: EventBus,
  registry: CapabilityRegistry
): PluginRuntime => {
  return new PluginRuntime(eventBus, registry);
};
