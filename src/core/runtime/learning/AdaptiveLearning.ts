import {
  PerformanceProfile,
  LearningDecision,
  CapabilityMetadata,
} from "../../../types/runtime";
import { CapabilityRegistry } from "../registry/CapabilityRegistry";
import { Logger } from "../../system/Logger";

/**
 * Adaptive Learning Layer (Lite) - Analyzes performance and improves decisions
 * Learns which tools/providers work best without heavy ML
 */

export class AdaptiveLearning {
  private registry: CapabilityRegistry;
  private profiles: Map<string, PerformanceProfile> = new Map();
  private decisions: Array<{
    timestamp: number;
    decision: LearningDecision;
  }> = [];

  constructor(registry: CapabilityRegistry) {
    this.registry = registry;
    Logger.info("AdaptiveLearning initialized");
  }

  /**
   * Record execution for learning
   */
  recordExecution(
    capabilityId: string,
    executionTime: number,
    success: boolean,
    error?: string
  ): void {
    const capability = this.registry.get(capabilityId);
    if (!capability) {
      return;
    }

    // Get or create profile
    let profile = this.profiles.get(capabilityId);
    if (!profile) {
      profile = {
        pluginId: capability.pluginId,
        executionTimes: [],
        successRates: [],
        errorPatterns: {},
        preferredProviders: [],
        optimalConfiguration: {},
        lastUpdated: Date.now(),
      };
      this.profiles.set(capabilityId, profile);
    }

    // Record execution time
    profile.executionTimes.push(executionTime);

    // Keep last 100 executions
    if (profile.executionTimes.length > 100) {
      profile.executionTimes = profile.executionTimes.slice(-100);
    }

    // Record error pattern
    if (error) {
      profile.errorPatterns[error] = (profile.errorPatterns[error] || 0) + 1;
    }

    // Update success rate
    const successCount = profile.successRates.filter((r) => r === 1).length;
    const successRate = success ? 1 : 0;
    profile.successRates.push(successRate);

    if (profile.successRates.length > 100) {
      profile.successRates = profile.successRates.slice(-100);
    }

    profile.lastUpdated = Date.now();

    // Update registry
    this.registry.updatePerformanceMetrics(capabilityId, {
      averageExecutionTime: this.calculateAverage(profile.executionTimes),
      maxExecutionTime: Math.max(...profile.executionTimes),
      minExecutionTime: Math.min(...profile.executionTimes),
      successRate: this.calculateAverage(profile.successRates),
      errorRate: 1 - this.calculateAverage(profile.successRates),
    });
  }

  /**
   * Get recommendation for tool selection
   */
  getToolRecommendation(
    toolType: string,
    context?: Record<string, any>
  ): LearningDecision {
    // Get all tools of this type
    const tools = this.registry.getByType("tool" as any);
    const filteredTools = tools.filter((t) => t.name.includes(toolType));

    if (filteredTools.length === 0) {
      return {
        type: "tool_selection",
        recommendation: "No tools found",
        confidence: 0,
        reasoning: "No tools match the requested type",
      };
    }

    // Sort by performance
    const sorted = filteredTools.sort((a, b) => {
      const scoreA = a.reliability.healthScore * a.performanceMetrics.successRate;
      const scoreB = b.reliability.healthScore * b.performanceMetrics.successRate;
      return scoreB - scoreA;
    });

    const best = sorted[0];
    const profile = this.profiles.get(best.id);

    return {
      type: "tool_selection",
      recommendation: best.id,
      confidence: best.reliability.healthScore / 100,
      reasoning: `Selected ${best.name} based on ${profile?.executionTimes.length || 0} executions with ${(best.performanceMetrics.successRate * 100).toFixed(1)}% success rate`,
    };
  }

  /**
   * Get recommendation for provider selection
   */
  getProviderRecommendation(
    taskType: string,
    context?: Record<string, any>
  ): LearningDecision {
    // Get all providers
    const providers = this.registry.getByType("provider" as any);

    if (providers.length === 0) {
      return {
        type: "provider_selection",
        recommendation: "No providers available",
        confidence: 0,
        reasoning: "No providers configured",
      };
    }

    // Sort by reliability
    const sorted = providers.sort((a, b) => {
      const scoreA = a.reliability.healthScore;
      const scoreB = b.reliability.healthScore;
      return scoreB - scoreA;
    });

    const best = sorted[0];

    return {
      type: "provider_selection",
      recommendation: best.id,
      confidence: best.reliability.healthScore / 100,
      reasoning: `Selected ${best.name} with health score ${best.reliability.healthScore}`,
    };
  }

  /**
   * Get strategy recommendation
   */
  getStrategyRecommendation(
    taskComplexity: "simple" | "moderate" | "complex"
  ): LearningDecision {
    let strategy = "sequential";
    let confidence = 0.8;

    if (taskComplexity === "simple") {
      strategy = "direct";
      confidence = 0.9;
    } else if (taskComplexity === "moderate") {
      strategy = "sequential";
      confidence = 0.8;
    } else {
      strategy = "hierarchical";
      confidence = 0.7;
    }

    return {
      type: "strategy_selection",
      recommendation: strategy,
      confidence,
      reasoning: `Selected ${strategy} strategy for ${taskComplexity} task complexity`,
    };
  }

  /**
   * Get parameter tuning recommendation
   */
  getParameterTuningRecommendation(
    capabilityId: string
  ): LearningDecision {
    const profile = this.profiles.get(capabilityId);
    if (!profile) {
      return {
        type: "parameter_tuning",
        recommendation: "No data available",
        confidence: 0,
        reasoning: "Insufficient execution history",
      };
    }

    const avgTime = this.calculateAverage(profile.executionTimes);
    const successRate = this.calculateAverage(profile.successRates);

    // Suggest timeout based on execution times
    const suggestedTimeout = Math.ceil(avgTime * 1.5);

    // Suggest retries based on success rate
    const suggestedRetries = successRate < 0.8 ? 2 : 1;

    return {
      type: "parameter_tuning",
      recommendation: JSON.stringify({
        timeout: suggestedTimeout,
        retries: suggestedRetries,
        priority: successRate < 0.7 ? "low" : "normal",
      }),
      confidence: Math.min(profile.executionTimes.length / 100, 1),
      reasoning: `Based on ${profile.executionTimes.length} executions: avg time ${avgTime.toFixed(0)}ms, success rate ${(successRate * 100).toFixed(1)}%`,
    };
  }

  /**
   * Get learning insights
   */
  getLearningInsights(): Record<string, any> {
    const insights: Record<string, any> = {
      totalProfiles: this.profiles.size,
      profiles: {},
      topPerformers: [],
      bottomPerformers: [],
      commonErrors: {},
    };

    // Analyze profiles
    this.profiles.forEach((profile, capabilityId) => {
      const capability = this.registry.get(capabilityId);
      if (!capability) return;

      const avgTime = this.calculateAverage(profile.executionTimes);
      const successRate = this.calculateAverage(profile.successRates);

      insights.profiles[capabilityId] = {
        executions: profile.executionTimes.length,
        avgTime,
        successRate,
        errors: Object.keys(profile.errorPatterns).length,
      };

      // Track top performers
      if (successRate > 0.9) {
        insights.topPerformers.push({
          id: capabilityId,
          name: capability.name,
          successRate,
        });
      }

      // Track bottom performers
      if (successRate < 0.7) {
        insights.bottomPerformers.push({
          id: capabilityId,
          name: capability.name,
          successRate,
        });
      }

      // Track common errors
      Object.entries(profile.errorPatterns).forEach(([error, count]) => {
        insights.commonErrors[error] = (insights.commonErrors[error] || 0) + count;
      });
    });

    // Sort top and bottom performers
    insights.topPerformers.sort((a: any, b: any) => b.successRate - a.successRate);
    insights.bottomPerformers.sort((a: any, b: any) => a.successRate - b.successRate);

    return insights;
  }

  /**
   * Get profile
   */
  getProfile(capabilityId: string): PerformanceProfile | undefined {
    return this.profiles.get(capabilityId);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): PerformanceProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get decision history
   */
  getDecisionHistory(limit: number = 100): Array<{
    timestamp: number;
    decision: LearningDecision;
  }> {
    return this.decisions.slice(-limit);
  }

  /**
   * Record decision
   */
  recordDecision(decision: LearningDecision): void {
    this.decisions.push({
      timestamp: Date.now(),
      decision,
    });

    // Keep last 1000 decisions
    if (this.decisions.length > 1000) {
      this.decisions = this.decisions.slice(-500);
    }
  }

  /**
   * Calculate average
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    const insights = this.getLearningInsights();

    return {
      totalProfiles: this.profiles.size,
      totalDecisions: this.decisions.length,
      insights,
      timestamp: Date.now(),
    };
  }

  /**
   * Clear learning data
   */
  clearLearningData(): void {
    this.profiles.clear();
    this.decisions = [];
    Logger.info("Learning data cleared");
  }
}

export const createAdaptiveLearning = (
  registry: CapabilityRegistry
): AdaptiveLearning => {
  return new AdaptiveLearning(registry);
};
