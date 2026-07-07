import { Logger } from "./Logger";
import { Metrics } from "./Metrics";
import { ProviderHealth } from "./ProviderHealth";
import { RequestQueue } from "./RequestQueue";
import { SmartCache } from "./SmartCache";
import { SkillRegistry } from "../skills/skillRegistry";
import { PluginManager } from "./PluginSystem";
import { KnowledgeEngine } from "../knowledge/KnowledgeEngine";
import { RuntimeManager } from "../runtime/RuntimeManager";

/**
 * System Health Dashboard - Phase 11.6
 * Provides a single source of truth for system-wide health and statistics
 */
export class SystemHealth {
  private static knowledgeEngine = new KnowledgeEngine();
  private static runtimeManager = new RuntimeManager();

  /**
   * Get full system health and status report
   */
  static async getSystemHealth(): Promise<Record<string, any>> {
    Logger.info("Generating System Health Report");

    try {
      // Initialize engines for statistics if needed
      await this.knowledgeEngine.initialize();
      
      const providerStats = Metrics.getAllStats();
      const activeProviders = Object.keys(SkillRegistry.getProviders());
      const activeAgents = PluginManager.getPluginsByCategory("agent").map(p => p.manifest.name);
      
      const healthReport = {
        timestamp: Date.now(),
        status: "healthy",
        
        // 1. Active Providers & Agents
        activeProviders: {
          count: activeProviders.length,
          list: activeProviders,
          health: activeProviders.map(p => ({
            name: p,
            status: ProviderHealth.getStatus(p) ? "available" : "unavailable"
          }))
        },
        
        activeAgents: {
          count: activeAgents.length,
          list: activeAgents
        },

        // 2. Runtime Health
        runtime: {
          status: this.runtimeManager.getState().running ? "active" : "inactive",
          initialized: this.runtimeManager.getState().initialized,
          metrics: this.runtimeManager.getStatus().metrics,
          activePlugins: this.runtimeManager.getState().metrics.activePlugins
        },

        // 3. Memory & Knowledge Engine Health
        knowledgeEngine: {
          stats: this.knowledgeEngine.getStatistics(),
          memory: this.knowledgeEngine.getStatistics().memorySummary
        },

        // 4. Cache Statistics
        cache: {
          // Note: SmartCache doesn't expose full stats, but we can report on its existence
          status: "active",
          type: "InMemory / SmartCache"
        },

        // 5. Queue Statistics
        queue: {
          pendingCount: RequestQueue.getPendingCount(),
          maxConcurrency: 5 // Hardcoded in RequestQueue
        },

        // 6. Performance & Error Rates
        performance: {
          providerStats,
          averageLatency: this.calculateAverageLatency(providerStats),
          totalErrorRate: this.calculateTotalErrorRate(providerStats)
        }
      };

      Logger.info("System Health Report generated successfully");
      return healthReport;
    } catch (error: any) {
      Logger.error("Failed to generate System Health Report", { error: error.message });
      return {
        timestamp: Date.now(),
        status: "error",
        error: error.message
      };
    }
  }

  /**
   * Calculate average latency across all providers
   */
  private static calculateAverageLatency(stats: Record<string, any>): number {
    const providers = Object.values(stats);
    if (providers.length === 0) return 0;
    
    const totalLatency = providers.reduce((sum, p) => sum + (p.avgLatency || 0), 0);
    return totalLatency / providers.length;
  }

  /**
   * Calculate total error rate across all providers
   */
  private static calculateTotalErrorRate(stats: Record<string, any>): number {
    const providers = Object.values(stats);
    if (providers.length === 0) return 0;
    
    const totalRequests = providers.reduce((sum, p) => sum + (p.requests || 0), 0);
    const totalFailures = providers.reduce((sum, p) => sum + (p.failures || 0), 0);
    
    return totalRequests > 0 ? totalFailures / totalRequests : 0;
  }
}
