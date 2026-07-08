import {
  RuntimeConfig,
  RuntimeState,
  IPlugin,
  CapabilityMetadata,
} from "../../types/runtime";
import { EventBus } from "./events/EventBus";
import { CapabilityRegistry } from "./registry/CapabilityRegistry";
import { PluginRuntime } from "./plugins/PluginRuntime";
import { CapabilityInjector } from "./injection/CapabilityInjector";
import { ExecutionSandbox } from "./sandbox/ExecutionSandbox";
import { SelfHealingSystem } from "./healing/SelfHealingSystem";
import { AdaptiveLearning } from "./learning/AdaptiveLearning";
import { CompositionEngine } from "./composition/CompositionEngine";
import { RuntimeObservability } from "./observability/RuntimeObservability";
import { Logger } from "../system/Logger";

/**
 * Runtime Manager - Central orchestrator for the modular runtime system
 * Manages all runtime components and provides unified interface
 */

export class RuntimeManager {
  private config: RuntimeConfig;
  private state: RuntimeState;
  private eventBus: EventBus;
  private registry: CapabilityRegistry;
  private pluginRuntime: PluginRuntime;
  private injector: CapabilityInjector;
  private sandbox: ExecutionSandbox;
  private healingSystem: SelfHealingSystem;
  private adaptiveLearning: AdaptiveLearning;
  private compositionEngine: CompositionEngine;
  private observability: RuntimeObservability;

  constructor(config: Partial<RuntimeConfig> = {}) {
    // Initialize configuration
    this.config = {
      pluginDirectory: config.pluginDirectory || "./plugins",
      maxPlugins: config.maxPlugins || 100,
      maxConcurrentExecutions: config.maxConcurrentExecutions || 10,
      defaultTimeout: config.defaultTimeout || 30000,
      enableAutoHealing: config.enableAutoHealing !== false,
      enableAdaptiveLearning: config.enableAdaptiveLearning !== false,
      enableComposition: config.enableComposition !== false,
      eventBusConfig: config.eventBusConfig || {
        maxListeners: 100,
        enableLogging: true,
        enablePersistence: false,
      },
      sandboxConfig: config.sandboxConfig || {
        timeout: 30000,
        memoryLimit: 512 * 1024 * 1024,
        cpuLimit: 100,
        networkAccess: true,
        fileSystemAccess: true,
        allowedPaths: [],
      },
      debugContext: config.debugContext || {
        enabled: false,
        traceLevel: "normal",
        captureEvents: false,
        captureMetrics: false,
        captureTraces: false,
        filters: {},
      },
      metadata: config.metadata || {},
    };

    // Initialize state
    this.state = {
      initialized: false,
      running: false,
      plugins: new Map(),
      capabilities: [],
      compositions: new Map(),
      executionTraces: [],
      metrics: {
        uptime: 0,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        activePlugins: 0,
        totalPlugins: 0,
        systemHealth: 100,
        memoryUsage: 0,
        cpuUsage: 0,
      },
      healthChecks: new Map(),
      performanceProfiles: new Map(),
    };

    // Initialize components
    this.eventBus = new EventBus(this.config.eventBusConfig);
    this.registry = new CapabilityRegistry();
    this.pluginRuntime = new PluginRuntime(this.eventBus, this.registry);
    this.injector = new CapabilityInjector(this.eventBus, this.registry);
    this.sandbox = new ExecutionSandbox(this.config.sandboxConfig);
    this.healingSystem = new SelfHealingSystem(this.eventBus, this.pluginRuntime);
    this.adaptiveLearning = new AdaptiveLearning(this.registry);
    this.compositionEngine = new CompositionEngine(
      this.eventBus,
      this.registry,
      this.pluginRuntime
    );
    this.observability = new RuntimeObservability(
      this.eventBus,
      this.config.debugContext
    );

    Logger.info("RuntimeManager initialized", { config: this.config });
  }

  /**
   * Initialize the runtime
   */
  async initialize(): Promise<void> {
    try {
      Logger.info("Initializing runtime");

      // Start event bus
      this.eventBus.on("plugin:initialized", async (event) => {
        this.state.metrics.activePlugins++;
      });

      this.eventBus.on("plugin:failed", async (event) => {
        this.state.metrics.activePlugins--;
      });

      // Start healing system if enabled
      if (this.config.enableAutoHealing) {
        this.healingSystem.startMonitoring();
      }

      // Mark as initialized
      this.state.initialized = true;
      this.state.running = true;

      Logger.info("Runtime initialized successfully");
    } catch (error: any) {
      Logger.error("Runtime initialization failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Shutdown the runtime
   */
  async shutdown(): Promise<void> {
    try {
      Logger.info("Shutting down runtime");

      // Stop healing system
      this.healingSystem.stopMonitoring();

      // Unload all plugins
      for (const plugin of this.pluginRuntime.getAllPlugins()) {
        await this.pluginRuntime.unloadPlugin(plugin.manifest.id);
      }

      // Mark as not running
      this.state.running = false;

      Logger.info("Runtime shutdown completed");
    } catch (error: any) {
      Logger.error("Runtime shutdown failed", { error: error.message });
      throw error;
    }
  }

  /**
   * Load and initialize a plugin
   */
  async loadPlugin(plugin: IPlugin): Promise<void> {
    await this.pluginRuntime.loadPlugin(plugin);
    await this.pluginRuntime.initializePlugin(plugin.manifest.id);
    this.state.plugins.set(plugin.manifest.id, plugin);
    this.state.metrics.totalPlugins++;
  }

  /**
   * Inject a capability
   */
  async injectCapability(capability: CapabilityMetadata): Promise<void> {
    await this.injector.injectCapability(capability);
    this.state.capabilities.push(capability);
  }

  /**
   * Execute a capability
   */
  async executeCapability(capabilityId: string, input: any): Promise<any> {
    const trace = this.observability.startTrace("executeCapability", {
      capabilityId,
    });

    try {
      const startTime = Date.now();

      // Execute in sandbox
      const contextId = `exec-${Date.now()}`;
      const context = {
        id: contextId,
        pluginId: capabilityId,
        input,
        config: this.config.sandboxConfig,
        startTime,
        status: "running" as const,
        logs: [],
      };

      const result = await this.sandbox.execute(context);

      // Record learning
      const duration = Date.now() - startTime;
      this.adaptiveLearning.recordExecution(capabilityId, duration, true);
      this.observability.recordExecution(true, duration);

      // Add trace event
      this.observability.addTraceEvent(
        trace.id,
        "exit",
        "executeCapability",
        { result },
        duration
      );

      return result;
    } catch (error: any) {
      // Record learning
      this.adaptiveLearning.recordExecution(capabilityId, 0, false, error.message);
      this.observability.recordExecution(false, 0);

      // Add trace event
      this.observability.addTraceEvent(
        trace.id,
        "error",
        "executeCapability",
        { error: error.message }
      );

      throw error;
    } finally {
      this.observability.endTrace(trace.id);
    }
  }

  /**
   * Get component
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  getRegistry(): CapabilityRegistry {
    return this.registry;
  }

  getPluginRuntime(): PluginRuntime {
    return this.pluginRuntime;
  }

  getInjector(): CapabilityInjector {
    return this.injector;
  }

  getSandbox(): ExecutionSandbox {
    return this.sandbox;
  }

  getHealingSystem(): SelfHealingSystem {
    return this.healingSystem;
  }

  getAdaptiveLearning(): AdaptiveLearning {
    return this.adaptiveLearning;
  }

  getCompositionEngine(): CompositionEngine {
    return this.compositionEngine;
  }

  getObservability(): RuntimeObservability {
    return this.observability;
  }

  /**
   * Get runtime state
   */
  getState(): RuntimeState {
    return this.state;
  }

  /**
   * Get runtime config
   */
  getConfig(): RuntimeConfig {
    return this.config;
  }

  /**
   * Get system status
   */
  getStatus(): Record<string, any> {
    return {
      initialized: this.state.initialized,
      running: this.state.running,
      metrics: this.observability.getMetrics(),
      plugins: this.pluginRuntime.getStatistics(),
      capabilities: this.registry.getStatistics(),
      health: this.healingSystem.getStatistics(),
      learning: this.adaptiveLearning.getStatistics(),
      composition: this.compositionEngine.getStatistics(),
      observability: this.observability.getPerformanceReport(),
    };
  }

  /**
   * Enable debug mode
   */
  enableDebugMode(): void {
    this.observability.enableDebugMode();
  }

  /**
   * Disable debug mode
   */
  disableDebugMode(): void {
    this.observability.disableDebugMode();
  }
}

export const createRuntimeManager = (
  config?: Partial<RuntimeConfig>
): RuntimeManager => {
  return new RuntimeManager(config);
};
