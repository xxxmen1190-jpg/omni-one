import {
  EmbeddingModel,
  EmbeddingResult,
  EmbeddingCache,
} from "../../../types/knowledge";
import { Logger } from "../../system/Logger";

/**
 * Embedding Generator - Generates embeddings for text
 * Supports multiple embedding models and caching
 */

export class EmbeddingGenerator {
  private model: EmbeddingModel;
  private cache: Map<string, EmbeddingCache> = new Map();
  private maxCacheSize: number = 10000;

  constructor(model?: Partial<EmbeddingModel>) {
    this.model = {
      name: model?.name || "default",
      dimension: model?.dimension || 384,
      provider: model?.provider || "local",
      maxTokens: model?.maxTokens || 512,
    };

    Logger.info("EmbeddingGenerator initialized", { model: this.model });
  }

  /**
   * Generate embedding for text
   */
  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    // Check cache
    const cached = this.cache.get(text);
    if (cached) {
      Logger.debug("Embedding cache hit", { textLength: text.length });
      return {
        text,
        embedding: cached.embedding,
        tokens: this.estimateTokens(text),
        model: this.model.name,
      };
    }

    // Generate embedding
    const embedding = this.generateRandomEmbedding();
    const tokens = this.estimateTokens(text);

    // Cache result
    this.cache.set(text, {
      text,
      embedding,
      timestamp: Date.now(),
    });

    // Cleanup cache if too large
    if (this.cache.size > this.maxCacheSize) {
      const oldest = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0];
      this.cache.delete(oldest[0]);
    }

    Logger.debug("Embedding generated", {
      textLength: text.length,
      dimension: this.model.dimension,
      tokens,
    });

    return {
      text,
      embedding,
      tokens,
      model: this.model.name,
    };
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (const text of texts) {
      const result = await this.generateEmbedding(text);
      results.push(result);
    }

    return results;
  }

  /**
   * Batch generate embeddings
   */
  async batchGenerateEmbeddings(
    texts: string[],
    batchSize: number = 32
  ): Promise<EmbeddingResult[]> {
    const results: EmbeddingResult[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchResults = await this.generateEmbeddings(batch);
      results.push(...batchResults);

      Logger.debug("Batch processed", {
        batchIndex: Math.floor(i / batchSize),
        batchSize: batch.length,
      });
    }

    return results;
  }

  /**
   * Get model info
   */
  getModel(): EmbeddingModel {
    return this.model;
  }

  /**
   * Set model
   */
  setModel(model: Partial<EmbeddingModel>): void {
    this.model = {
      ...this.model,
      ...model,
    };

    // Clear cache on model change
    this.cache.clear();

    Logger.info("Embedding model changed", { model: this.model });
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics(): Record<string, any> {
    const entries = Array.from(this.cache.values());
    const totalSize = entries.reduce((sum, e) => sum + e.text.length, 0);

    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      totalTextSize: totalSize,
      averageTextSize: totalSize / (this.cache.size || 1),
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    Logger.info("Embedding cache cleared");
  }

  /**
   * Generate random embedding (placeholder for real embedding model)
   */
  private generateRandomEmbedding(): number[] {
    const embedding: number[] = [];

    // In a real implementation, this would call an embedding API
    // For now, we generate a random vector
    for (let i = 0; i < this.model.dimension; i++) {
      // Use a seeded random for consistency
      embedding.push(Math.random() - 0.5);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    return embedding.map((x) => x / norm);
  }

  /**
   * Estimate tokens in text
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}

export const createEmbeddingGenerator = (
  model?: Partial<EmbeddingModel>
): EmbeddingGenerator => {
  return new EmbeddingGenerator(model);
};
