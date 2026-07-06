import {
  AIProviderType,
  AICapability,
  SelectionStrategy,
  SelectionCriteria,
  ModelConfig,
  ProviderHealth,
} from "../../types/aiIntegration";
import { ProviderHealthMonitor } from "./ProviderHealthMonitor";
import { Logger } from "../system/Logger";

/**
 * Smart Provider Selector - Intelligently selects best provider and model
 */

export class SmartProviderSelector {
  private healthMonitor: ProviderHealthMonitor;
  private models: Map<string, ModelConfig> = new Map();
  private selectionHistory: Array<{
    timestamp: number;
    strategy: SelectionStrategy;
    selectedProvider: AIProviderType;
    selectedModel: string;
    success: boolean;
  }> = [];

  constructor(healthMonitor: ProviderHealthMonitor) {
    this.healthMonitor = healthMonitor;
    Logger.info("SmartProviderSelector initialized");
  }

  /**
   * Register model
   */
  registerModel(model: ModelConfig): void {
    this.models.set(model.id, model);
  }

  /**
   * Select best provider and model
   */
  async selectBest(
    criteria: SelectionCriteria
  ): Promise<{ provider: AIProviderType; model: string }> {
    const strategy = criteria.strategy || "balanced";

    Logger.debug("Selecting provider", { strategy, criteria });

    // Get candidates
    const candidates = this.getCandidates(criteria);

    if (candidates.length === 0) {
      throw new Error("No suitable providers found");
    }

    // Score candidates
    const scored = await Promise.all(
      candidates.map(async (candidate) => ({
        ...candidate,
        score: await this.scoreCandidate(candidate, strategy),
      }))
    );

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    const selected = scored[0];

    // Record selection
    this.selectionHistory.push({
      timestamp: Date.now(),
      strategy,
      selectedProvider: selected.provider,
      selectedModel: selected.model,
      success: true,
    });

    Logger.info("Provider selected", {
      provider: selected.provider,
      model: selected.model,
      score: selected.score,
    });

    return {
      provider: selected.provider,
      model: selected.model,
    };
  }

  /**
   * Get candidate providers and models
   */
  private getCandidates(criteria: SelectionCriteria): Array<{
    provider: AIProviderType;
    model: string;
  }> {
    const candidates: Array<{
      provider: AIProviderType;
      model: string;
    }> = [];

    for (const [modelId, model] of this.models.entries()) {
      // Check if provider is excluded
      if (criteria.excludeProviders?.includes(model.provider)) {
        continue;
      }

      // Check if provider is preferred (if specified)
      if (
        criteria.preferredProviders &&
        criteria.preferredProviders.length > 0 &&
        !criteria.preferredProviders.includes(model.provider)
      ) {
        continue;
      }

      // Check required capabilities
      if (criteria.requiredCapabilities) {
        const hasAllCapabilities = criteria.requiredCapabilities.every((cap) =>
          model.capabilities.includes(cap)
        );

        if (!hasAllCapabilities) {
          continue;
        }
      }

      // Check minimum context window
      if (criteria.minContextWindow && model.contextWindow < criteria.minContextWindow) {
        continue;
      }

      // Check if model is enabled
      if (!model.enabled) {
        continue;
      }

      // Check provider health
      const health = this.healthMonitor.getHealth(model.provider);
      if (health.status === "offline") {
        continue;
      }

      candidates.push({
        provider: model.provider,
        model: modelId,
      });
    }

    return candidates;
  }

  /**
   * Score candidate
   */
  private async scoreCandidate(
    candidate: { provider: AIProviderType; model: string },
    strategy: SelectionStrategy
  ): Promise<number> {
    const model = this.models.get(candidate.model);
    if (!model) {
      return 0;
    }

    const health = this.healthMonitor.getHealth(candidate.provider);

    let score = 100; // Base score

    // Apply strategy-specific scoring
    switch (strategy) {
      case "cost_optimized":
        score = this.scoreCost(model, health);
        break;

      case "speed_optimized":
        score = this.scoreSpeed(model, health);
        break;

      case "quality_optimized":
        score = this.scoreQuality(model, health);
        break;

      case "availability_optimized":
        score = this.scoreAvailability(health);
        break;

      case "balanced":
      default:
        score = this.scoreBalanced(model, health);
        break;
    }

    // Apply health penalties
    if (health.status === "degraded") {
      score *= 0.8;
    }

    if (health.status === "unhealthy") {
      score *= 0.5;
    }

    return score;
  }

  /**
   * Score for cost optimization
   */
  private scoreCost(model: ModelConfig, health: ProviderHealth): number {
    const costScore = 100 - Math.min(100, model.costPer1kInputTokens * 10000);
    const availabilityScore = health.availability * 100;

    return costScore * 0.7 + availabilityScore * 0.3;
  }

  /**
   * Score for speed optimization
   */
  private scoreSpeed(model: ModelConfig, health: ProviderHealth): number {
    const speedScore = 100 - Math.min(100, model.averageLatency / 100);
    const successScore = health.successRate * 100;

    return speedScore * 0.7 + successScore * 0.3;
  }

  /**
   * Score for quality optimization
   */
  private scoreQuality(model: ModelConfig, health: ProviderHealth): number {
    // Assume larger models are higher quality
    const contextScore = Math.min(100, (model.contextWindow / 100000) * 100);
    const successScore = health.successRate * 100;

    return contextScore * 0.6 + successScore * 0.4;
  }

  /**
   * Score for availability optimization
   */
  private scoreAvailability(health: ProviderHealth): number {
    return health.availability * 100;
  }

  /**
   * Score for balanced optimization
   */
  private scoreBalanced(model: ModelConfig, health: ProviderHealth): number {
    const costScore = 100 - Math.min(100, model.costPer1kInputTokens * 10000);
    const speedScore = 100 - Math.min(100, model.averageLatency / 100);
    const availabilityScore = health.availability * 100;
    const successScore = health.successRate * 100;

    return (
      costScore * 0.25 +
      speedScore * 0.25 +
      availabilityScore * 0.25 +
      successScore * 0.25
    );
  }

  /**
   * Get selection history
   */
  getSelectionHistory(limit: number = 100): typeof this.selectionHistory {
    return this.selectionHistory.slice(-limit);
  }

  /**
   * Get selection statistics
   */
  getSelectionStatistics(): Record<string, any> {
    const stats: Record<string, any> = {
      totalSelections: this.selectionHistory.length,
      byProvider: {},
      byModel: {},
      byStrategy: {},
    };

    for (const entry of this.selectionHistory) {
      // By provider
      if (!stats.byProvider[entry.selectedProvider]) {
        stats.byProvider[entry.selectedProvider] = 0;
      }
      stats.byProvider[entry.selectedProvider]++;

      // By model
      if (!stats.byModel[entry.selectedModel]) {
        stats.byModel[entry.selectedModel] = 0;
      }
      stats.byModel[entry.selectedModel]++;

      // By strategy
      if (!stats.byStrategy[entry.strategy]) {
        stats.byStrategy[entry.strategy] = 0;
      }
      stats.byStrategy[entry.strategy]++;
    }

    return stats;
  }

  /**
   * Get most used provider
   */
  getMostUsedProvider(): AIProviderType | null {
    const stats = this.getSelectionStatistics();
    let mostUsed: AIProviderType | null = null;
    let maxCount = 0;

    for (const [provider, count] of Object.entries(stats.byProvider)) {
      if ((count as number) > maxCount) {
        mostUsed = provider as AIProviderType;
        maxCount = count as number;
      }
    }

    return mostUsed;
  }

  /**
   * Get most used model
   */
  getMostUsedModel(): string | null {
    const stats = this.getSelectionStatistics();
    let mostUsed: string | null = null;
    let maxCount = 0;

    for (const [model, count] of Object.entries(stats.byModel)) {
      if ((count as number) > maxCount) {
        mostUsed = model;
        maxCount = count as number;
      }
    }

    return mostUsed;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.selectionHistory = [];
  }
}

export const createSmartProviderSelector = (
  healthMonitor: ProviderHealthMonitor
): SmartProviderSelector => {
  return new SmartProviderSelector(healthMonitor);
};
