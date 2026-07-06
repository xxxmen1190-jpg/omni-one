import {
  AIProviderType,
  ProviderHealth,
  AIGatewayState,
} from "../../types/aiIntegration";
import { IProvider } from "./IProvider";
import { Logger } from "../system/Logger";

/**
 * Provider Health Monitor - Tracks and manages provider health
 */

export class ProviderHealthMonitor {
  private providers: Map<AIProviderType, IProvider> = new Map();
  private healthChecks: Map<AIProviderType, ProviderHealth> = new Map();
  private checkInterval: number = 60000; // 1 minute
  private lastCheckTime: Map<AIProviderType, number> = new Map();
  private checkInProgress: Set<AIProviderType> = new Set();

  constructor() {
    Logger.info("ProviderHealthMonitor initialized");
  }

  /**
   * Register provider
   */
  registerProvider(provider: IProvider): void {
    this.providers.set(provider.type, provider);
    Logger.info("Provider registered", { provider: provider.type });
  }

  /**
   * Check provider health
   */
  async checkHealth(providerType: AIProviderType): Promise<ProviderHealth> {
    // Return cached health if recent
    const lastCheck = this.lastCheckTime.get(providerType) || 0;
    if (Date.now() - lastCheck < this.checkInterval) {
      return this.healthChecks.get(providerType) || this.getDefaultHealth(providerType);
    }

    // Prevent concurrent checks
    if (this.checkInProgress.has(providerType)) {
      return this.healthChecks.get(providerType) || this.getDefaultHealth(providerType);
    }

    this.checkInProgress.add(providerType);

    try {
      const provider = this.providers.get(providerType);
      if (!provider) {
        throw new Error(`Provider not registered: ${providerType}`);
      }

      const health = await provider.healthCheck();
      this.healthChecks.set(providerType, health);
      this.lastCheckTime.set(providerType, Date.now());

      Logger.debug("Health check completed", {
        provider: providerType,
        status: health.status,
        latency: health.latency,
      });

      return health;
    } catch (error: any) {
      Logger.error("Health check failed", {
        provider: providerType,
        error: error.message,
      });

      return {
        provider: providerType,
        status: "offline",
        latency: 0,
        availability: 0,
        errorRate: 1,
        lastChecked: Date.now(),
        consecutiveErrors: 999,
        averageResponseTime: 0,
        successRate: 0,
        costToday: 0,
        costThisMonth: 0,
      };
    } finally {
      this.checkInProgress.delete(providerType);
    }
  }

  /**
   * Check all providers health
   */
  async checkAllHealth(): Promise<Map<AIProviderType, ProviderHealth>> {
    const results = new Map<AIProviderType, ProviderHealth>();

    const checks = Array.from(this.providers.keys()).map((providerType) =>
      this.checkHealth(providerType).then((health) => {
        results.set(providerType, health);
      })
    );

    await Promise.all(checks);

    return results;
  }

  /**
   * Get provider health
   */
  getHealth(providerType: AIProviderType): ProviderHealth {
    return this.healthChecks.get(providerType) || this.getDefaultHealth(providerType);
  }

  /**
   * Get all health statuses
   */
  getAllHealth(): Map<AIProviderType, ProviderHealth> {
    return new Map(this.healthChecks);
  }

  /**
   * Get healthy providers
   */
  getHealthyProviders(): AIProviderType[] {
    return Array.from(this.healthChecks.entries())
      .filter(([, health]) => health.status === "healthy")
      .map(([provider]) => provider);
  }

  /**
   * Get degraded providers
   */
  getDegradedProviders(): AIProviderType[] {
    return Array.from(this.healthChecks.entries())
      .filter(([, health]) => health.status === "degraded")
      .map(([provider]) => provider);
  }

  /**
   * Get offline providers
   */
  getOfflineProviders(): AIProviderType[] {
    return Array.from(this.healthChecks.entries())
      .filter(([, health]) => health.status === "offline" || health.status === "unhealthy")
      .map(([provider]) => provider);
  }

  /**
   * Get fastest provider
   */
  getFastestProvider(): AIProviderType | null {
    let fastest: AIProviderType | null = null;
    let minLatency = Infinity;

    for (const [provider, health] of this.healthChecks.entries()) {
      if (health.status === "healthy" && health.latency < minLatency) {
        fastest = provider;
        minLatency = health.latency;
      }
    }

    return fastest;
  }

  /**
   * Get most reliable provider
   */
  getMostReliableProvider(): AIProviderType | null {
    let mostReliable: AIProviderType | null = null;
    let maxSuccessRate = -1;

    for (const [provider, health] of this.healthChecks.entries()) {
      if (health.status === "healthy" && health.successRate > maxSuccessRate) {
        mostReliable = provider;
        maxSuccessRate = health.successRate;
      }
    }

    return mostReliable;
  }

  /**
   * Get cheapest provider
   */
  getCheapestProvider(): AIProviderType | null {
    let cheapest: AIProviderType | null = null;
    let minCost = Infinity;

    for (const [provider, health] of this.healthChecks.entries()) {
      if (health.status === "healthy" && health.costToday < minCost) {
        cheapest = provider;
        minCost = health.costToday;
      }
    }

    return cheapest;
  }

  /**
   * Get provider availability percentage
   */
  getAvailability(providerType: AIProviderType): number {
    const health = this.healthChecks.get(providerType);
    return health ? health.availability * 100 : 0;
  }

  /**
   * Get provider error rate
   */
  getErrorRate(providerType: AIProviderType): number {
    const health = this.healthChecks.get(providerType);
    return health ? health.errorRate * 100 : 100;
  }

  /**
   * Get provider average latency
   */
  getAverageLatency(providerType: AIProviderType): number {
    const health = this.healthChecks.get(providerType);
    return health ? health.averageResponseTime : 0;
  }

  /**
   * Get provider success rate
   */
  getSuccessRate(providerType: AIProviderType): number {
    const health = this.healthChecks.get(providerType);
    return health ? health.successRate * 100 : 0;
  }

  /**
   * Get health report
   */
  getHealthReport(): Record<string, any> {
    const report: Record<string, any> = {};

    for (const [provider, health] of this.healthChecks.entries()) {
      report[provider] = {
        status: health.status,
        latency: `${health.latency}ms`,
        availability: `${(health.availability * 100).toFixed(2)}%`,
        errorRate: `${(health.errorRate * 100).toFixed(2)}%`,
        successRate: `${(health.successRate * 100).toFixed(2)}%`,
        consecutiveErrors: health.consecutiveErrors,
        costToday: `$${health.costToday.toFixed(4)}`,
        costThisMonth: `$${health.costThisMonth.toFixed(2)}`,
        lastChecked: new Date(health.lastChecked).toISOString(),
      };
    }

    return report;
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    const allHealth = Array.from(this.healthChecks.values());

    if (allHealth.length === 0) {
      return {
        totalProviders: 0,
        healthyProviders: 0,
        degradedProviders: 0,
        offlineProviders: 0,
      };
    }

    const healthyCount = allHealth.filter((h) => h.status === "healthy").length;
    const degradedCount = allHealth.filter((h) => h.status === "degraded").length;
    const offlineCount = allHealth.filter((h) => h.status === "offline" || h.status === "unhealthy").length;

    const avgLatency =
      allHealth.reduce((sum, h) => sum + h.latency, 0) / allHealth.length;
    const avgAvailability =
      allHealth.reduce((sum, h) => sum + h.availability, 0) / allHealth.length;
    const avgErrorRate =
      allHealth.reduce((sum, h) => sum + h.errorRate, 0) / allHealth.length;

    const totalCostToday = allHealth.reduce((sum, h) => sum + h.costToday, 0);
    const totalCostThisMonth = allHealth.reduce((sum, h) => sum + h.costThisMonth, 0);

    return {
      totalProviders: allHealth.length,
      healthyProviders: healthyCount,
      degradedProviders: degradedCount,
      offlineProviders: offlineCount,
      averageLatency: `${avgLatency.toFixed(2)}ms`,
      averageAvailability: `${(avgAvailability * 100).toFixed(2)}%`,
      averageErrorRate: `${(avgErrorRate * 100).toFixed(2)}%`,
      totalCostToday: `$${totalCostToday.toFixed(4)}`,
      totalCostThisMonth: `$${totalCostThisMonth.toFixed(2)}`,
    };
  }

  /**
   * Start continuous health monitoring
   */
  startMonitoring(interval: number = 60000): void {
    this.checkInterval = interval;

    setInterval(async () => {
      try {
        await this.checkAllHealth();
        Logger.debug("Continuous health check completed");
      } catch (error: any) {
        Logger.error("Continuous health check failed", { error: error.message });
      }
    }, interval);

    Logger.info("Health monitoring started", { interval });
  }

  /**
   * Get default health
   */
  private getDefaultHealth(providerType: AIProviderType): ProviderHealth {
    return {
      provider: providerType,
      status: "offline",
      latency: 0,
      availability: 0,
      errorRate: 1,
      lastChecked: 0,
      consecutiveErrors: 0,
      averageResponseTime: 0,
      successRate: 0,
      costToday: 0,
      costThisMonth: 0,
    };
  }
}

export const createProviderHealthMonitor = (): ProviderHealthMonitor => {
  return new ProviderHealthMonitor();
};
