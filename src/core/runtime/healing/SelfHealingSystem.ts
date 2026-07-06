import {
  HealthCheckResult,
  HealthIssue,
  RecoveryAction,
  PluginPriority,
} from "../../../types/runtime";
import { EventBus } from "../events/EventBus";
import { PluginRuntime } from "../plugins/PluginRuntime";
import { Logger } from "../../system/Logger";

/**
 * Self-Healing System - Detects and recovers from failures
 * Monitors plugin health and automatically attempts recovery
 */

export class SelfHealingSystem {
  private eventBus: EventBus;
  private pluginRuntime: PluginRuntime;
  private healthChecks: Map<string, HealthCheckResult> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();
  private maxRecoveryAttempts: Map<string, number> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 5000; // 5 seconds

  constructor(eventBus: EventBus, pluginRuntime: PluginRuntime) {
    this.eventBus = eventBus;
    this.pluginRuntime = pluginRuntime;
    Logger.info("SelfHealingSystem initialized");
  }

  /**
   * Start health monitoring
   */
  startMonitoring(): void {
    if (this.checkInterval) {
      Logger.warn("Monitoring already started");
      return;
    }

    this.checkInterval = setInterval(() => {
      this.performHealthCheck();
    }, this.checkIntervalMs);

    Logger.info("Health monitoring started", { intervalMs: this.checkIntervalMs });
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      Logger.info("Health monitoring stopped");
    }
  }

  /**
   * Perform health check on all plugins
   */
  private async performHealthCheck(): Promise<void> {
    const plugins = this.pluginRuntime.getAllPlugins();

    for (const plugin of plugins) {
      try {
        const result = await this.checkPluginHealth(plugin.manifest.id);

        // If unhealthy, attempt recovery
        if (result.status !== "healthy") {
          await this.attemptRecovery(plugin.manifest.id, result);
        }
      } catch (error: any) {
        Logger.error("Health check error", {
          pluginId: plugin.manifest.id,
          error: error.message,
        });
      }
    }
  }

  /**
   * Check health of a specific plugin
   */
  private async checkPluginHealth(pluginId: string): Promise<HealthCheckResult> {
    const plugin = this.pluginRuntime.getPlugin(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    const issues: HealthIssue[] = [];
    let score = 100;

    // Check plugin status
    if (plugin.status === "failed") {
      issues.push({
        type: "failure",
        severity: "critical",
        description: "Plugin is in failed state",
        suggestion: "Restart the plugin",
      });
      score -= 50;
    } else if (plugin.status === "disabled") {
      issues.push({
        type: "failure",
        severity: "high",
        description: "Plugin is disabled",
        suggestion: "Enable the plugin",
      });
      score -= 30;
    }

    // Check memory usage (simulated)
    const memoryUsage = process.memoryUsage().heapUsed;
    const memoryLimit = 512 * 1024 * 1024; // 512MB

    if (memoryUsage > memoryLimit * 0.9) {
      issues.push({
        type: "memory",
        severity: "high",
        description: "Memory usage is high",
        suggestion: "Restart the plugin or increase memory limit",
      });
      score -= 20;
    }

    const result: HealthCheckResult = {
      pluginId,
      status: score >= 80 ? "healthy" : score >= 50 ? "degraded" : "unhealthy",
      score: Math.max(0, score),
      issues,
      lastCheck: Date.now(),
      nextCheck: Date.now() + this.checkIntervalMs,
    };

    this.healthChecks.set(pluginId, result);

    // Emit health check event
    await this.eventBus.emit({
      type: "health:check",
      timestamp: Date.now(),
      source: "SelfHealingSystem",
      data: {
        pluginId,
        result,
      },
      priority: result.status === "unhealthy" ? "high" : "normal",
    });

    return result;
  }

  /**
   * Attempt recovery for unhealthy plugin
   */
  private async attemptRecovery(
    pluginId: string,
    healthResult: HealthCheckResult
  ): Promise<void> {
    // Determine recovery action
    const action = this.determineRecoveryAction(pluginId, healthResult);

    if (!action) {
      Logger.warn("No recovery action determined", { pluginId });
      return;
    }

    // Check max attempts
    const attempts = this.recoveryAttempts.get(pluginId) || 0;
    const maxAttempts = this.maxRecoveryAttempts.get(pluginId) || action.maxAttempts;

    if (attempts >= maxAttempts) {
      Logger.error("Max recovery attempts exceeded", {
        pluginId,
        attempts,
        maxAttempts,
      });

      await this.eventBus.emit({
        type: "system:error",
        timestamp: Date.now(),
        source: "SelfHealingSystem",
        data: {
          pluginId,
          message: "Max recovery attempts exceeded",
        },
        priority: "critical",
      });

      return;
    }

    try {
      Logger.info("Attempting recovery", {
        pluginId,
        action: action.type,
        attempt: attempts + 1,
      });

      switch (action.type) {
        case "restart":
          await this.pluginRuntime.reloadPlugin(pluginId);
          break;
        case "reload":
          await this.pluginRuntime.reloadPlugin(pluginId);
          break;
        case "disable":
          await this.pluginRuntime.disablePlugin(pluginId);
          break;
        case "fallback":
          // Fallback is handled by the planner
          Logger.info("Fallback triggered", { pluginId });
          break;
        case "alert":
          Logger.warn("Alert triggered", { pluginId });
          break;
      }

      // Increment recovery attempts
      this.recoveryAttempts.set(pluginId, attempts + 1);

      // Emit recovery event
      await this.eventBus.emit({
        type: "recovery:attempted",
        timestamp: Date.now(),
        source: "SelfHealingSystem",
        data: {
          pluginId,
          action: action.type,
          attempt: attempts + 1,
        },
        priority: "normal",
      });

      Logger.info("Recovery attempted", {
        pluginId,
        action: action.type,
      });
    } catch (error: any) {
      Logger.error("Recovery failed", {
        pluginId,
        action: action.type,
        error: error.message,
      });

      await this.eventBus.emit({
        type: "system:error",
        timestamp: Date.now(),
        source: "SelfHealingSystem",
        data: {
          pluginId,
          action: action.type,
          error: error.message,
        },
        priority: "high",
      });
    }
  }

  /**
   * Determine recovery action based on health issues
   */
  private determineRecoveryAction(
    pluginId: string,
    healthResult: HealthCheckResult
  ): RecoveryAction | null {
    if (healthResult.issues.length === 0) {
      return null;
    }

    const criticalIssues = healthResult.issues.filter(
      (i) => i.severity === "critical"
    );
    const highIssues = healthResult.issues.filter((i) => i.severity === "high");

    // Critical issues: restart
    if (criticalIssues.length > 0) {
      return {
        type: "restart",
        target: pluginId,
        priority: "critical",
        maxAttempts: 3,
        backoffMultiplier: 2,
      };
    }

    // High issues: reload
    if (highIssues.length > 0) {
      return {
        type: "reload",
        target: pluginId,
        priority: "high",
        maxAttempts: 2,
        backoffMultiplier: 1.5,
      };
    }

    // Low issues: fallback
    return {
      type: "fallback",
      target: pluginId,
      priority: "normal",
      maxAttempts: 1,
      backoffMultiplier: 1,
    };
  }

  /**
   * Get health check result
   */
  getHealthCheck(pluginId: string): HealthCheckResult | undefined {
    return this.healthChecks.get(pluginId);
  }

  /**
   * Get all health checks
   */
  getAllHealthChecks(): HealthCheckResult[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get system health score
   */
  getSystemHealthScore(): number {
    const checks = Array.from(this.healthChecks.values());
    if (checks.length === 0) {
      return 100;
    }

    const totalScore = checks.reduce((sum, check) => sum + check.score, 0);
    return totalScore / checks.length;
  }

  /**
   * Reset recovery attempts
   */
  resetRecoveryAttempts(pluginId: string): void {
    this.recoveryAttempts.delete(pluginId);
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    const checks = Array.from(this.healthChecks.values());
    const statusCounts = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
    };

    checks.forEach((check) => {
      statusCounts[check.status]++;
    });

    return {
      totalPlugins: checks.length,
      statusCounts,
      systemHealth: this.getSystemHealthScore(),
      recoveryAttempts: Object.fromEntries(this.recoveryAttempts),
    };
  }
}

export const createSelfHealingSystem = (
  eventBus: EventBus,
  pluginRuntime: PluginRuntime
): SelfHealingSystem => {
  return new SelfHealingSystem(eventBus, pluginRuntime);
};
