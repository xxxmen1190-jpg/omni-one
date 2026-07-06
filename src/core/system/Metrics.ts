import { ProviderName } from "../../types";
import { Logger } from "./Logger";

export interface ProviderStats {
  requests: number;
  successes: number;
  failures: number;
  totalLatency: number;
  avgLatency: number;
  successRate: number;
  lastResponseTime: number;
  tokens?: number;
  cost?: number;
}

export class Metrics {
  private static providerStats = new Map<ProviderName, ProviderStats>();

  private static getOrCreateStats(provider: ProviderName): ProviderStats {
    if (!this.providerStats.has(provider)) {
      this.providerStats.set(provider, {
        requests: 0,
        successes: 0,
        failures: 0,
        totalLatency: 0,
        avgLatency: 0,
        successRate: 0,
        lastResponseTime: 0,
        tokens: 0,
        cost: 0,
      });
    }
    return this.providerStats.get(provider)!;
  }

  static recordRequest(provider: ProviderName, latency: number, success: boolean, tokens?: number, cost?: number): void {
    const stats = this.getOrCreateStats(provider);
    stats.requests++;
    if (success) {
      stats.successes++;
    } else {
      stats.failures++;
    }
    stats.totalLatency += latency;
    stats.avgLatency = stats.totalLatency / (stats.successes + stats.failures);
    stats.successRate = stats.successes / stats.requests;
    stats.lastResponseTime = latency;
    if (tokens) stats.tokens = (stats.tokens || 0) + tokens;
    if (cost) stats.cost = (stats.cost || 0) + cost;

    Logger.debug(`Metrics updated for ${provider}`, { stats });
  }

  static getStats(provider: ProviderName): ProviderStats | undefined {
    return this.providerStats.get(provider);
  }

  static getAllStats(): Record<ProviderName, ProviderStats> {
    const all: any = {};
    for (const [name, stats] of this.providerStats.entries()) {
      all[name] = stats;
    }
    return all;
  }
}
