import {
  VectorStoreConfig,
  DocumentChunk,
  VectorSearchResult,
  VectorSearchQuery,
  SearchFilter,
  EmbeddingCache,
  RetrievalCache,
} from "../../../types/knowledge";
import { Logger } from "../../system/Logger";

/**
 * Vector Store - In-memory vector database with similarity search
 * Supports semantic search, filtering, and caching
 */

export class VectorStore {
  private config: VectorStoreConfig;
  private chunks: Map<string, DocumentChunk> = new Map();
  private vectors: Map<string, number[]> = new Map();
  private documentIndex: Map<string, Set<string>> = new Map(); // documentId -> chunkIds
  private embeddingCache: Map<string, EmbeddingCache> = new Map();
  private retrievalCache: Map<string, RetrievalCache> = new Map();

  constructor(config: Partial<VectorStoreConfig> = {}) {
    this.config = {
      dimension: config.dimension || 384, // Default to small embedding dimension
      maxDocuments: config.maxDocuments || 10000,
      maxChunks: config.maxChunks || 100000,
      similarityThreshold: config.similarityThreshold || 0.5,
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 1000,
    };

    Logger.info("VectorStore initialized", { config: this.config });
  }

  /**
   * Add chunk to vector store
   */
  addChunk(chunk: DocumentChunk): void {
    if (this.chunks.size >= this.config.maxChunks) {
      Logger.warn("Vector store is full", { maxChunks: this.config.maxChunks });
      return;
    }

    this.chunks.set(chunk.id, chunk);

    // Store embedding if available
    if (chunk.embedding) {
      this.vectors.set(chunk.id, chunk.embedding);
    }

    // Index by document
    if (!this.documentIndex.has(chunk.documentId)) {
      this.documentIndex.set(chunk.documentId, new Set());
    }
    this.documentIndex.get(chunk.documentId)!.add(chunk.id);

    Logger.debug("Chunk added to vector store", {
      chunkId: chunk.id,
      documentId: chunk.documentId,
    });
  }

  /**
   * Add multiple chunks
   */
  addChunks(chunks: DocumentChunk[]): void {
    for (const chunk of chunks) {
      this.addChunk(chunk);
    }
  }

  /**
   * Remove chunk from vector store
   */
  removeChunk(chunkId: string): void {
    const chunk = this.chunks.get(chunkId);
    if (!chunk) {
      return;
    }

    this.chunks.delete(chunkId);
    this.vectors.delete(chunkId);

    // Remove from document index
    const docChunks = this.documentIndex.get(chunk.documentId);
    if (docChunks) {
      docChunks.delete(chunkId);
      if (docChunks.size === 0) {
        this.documentIndex.delete(chunk.documentId);
      }
    }

    Logger.debug("Chunk removed from vector store", { chunkId });
  }

  /**
   * Remove all chunks for a document
   */
  removeDocument(documentId: string): void {
    const chunkIds = this.documentIndex.get(documentId);
    if (!chunkIds) {
      return;
    }

    for (const chunkId of chunkIds) {
      this.chunks.delete(chunkId);
      this.vectors.delete(chunkId);
    }

    this.documentIndex.delete(documentId);

    Logger.info("Document removed from vector store", {
      documentId,
      chunkCount: chunkIds.size,
    });
  }

  /**
   * Search similar chunks
   */
  search(query: VectorSearchQuery): VectorSearchResult[] {
    // Check cache
    if (this.config.enableCaching) {
      const cached = this.retrievalCache.get(query.query);
      if (cached && Date.now() - cached.timestamp < cached.ttl) {
        Logger.debug("Retrieval cache hit", { query: query.query });
        return cached.results;
      }
    }

    // Get query embedding
    const queryEmbedding = query.embedding || this.generateRandomEmbedding();

    // Calculate similarities
    const similarities: Array<{
      chunkId: string;
      similarity: number;
      chunk: DocumentChunk;
    }> = [];

    for (const [chunkId, chunk] of this.chunks) {
      // Apply filters
      if (query.filters && !this.matchesFilters(chunk, query.filters)) {
        continue;
      }

      // Calculate similarity
      const embedding = this.vectors.get(chunkId);
      if (embedding) {
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);

        if (similarity >= (query.threshold || this.config.similarityThreshold)) {
          similarities.push({
            chunkId,
            similarity,
            chunk,
          });
        }
      }
    }

    // Sort by similarity
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Limit results
    const limit = query.limit || 10;
    const results = similarities.slice(0, limit).map((s) => ({
      chunkId: s.chunkId,
      documentId: s.chunk.documentId,
      content: s.chunk.content,
      similarity: s.similarity,
      metadata: s.chunk.metadata,
    }));

    // Cache results
    if (this.config.enableCaching) {
      this.retrievalCache.set(query.query, {
        query: query.query,
        results,
        timestamp: Date.now(),
        ttl: 3600000, // 1 hour
      });

      // Cleanup old cache entries
      if (this.retrievalCache.size > this.config.cacheSize) {
        const oldest = Array.from(this.retrievalCache.entries()).sort(
          (a, b) => a[1].timestamp - b[1].timestamp
        )[0];
        this.retrievalCache.delete(oldest[0]);
      }
    }

    Logger.debug("Search completed", {
      query: query.query,
      results: results.length,
    });

    return results;
  }

  /**
   * Hybrid search (keyword + vector)
   */
  hybridSearch(
    query: string,
    queryEmbedding: number[],
    keywords: string[],
    limit: number = 10
  ): VectorSearchResult[] {
    // Vector search
    const vectorResults = this.search({
      query,
      embedding: queryEmbedding,
      limit: limit * 2,
    });

    // Keyword search
    const keywordResults = this.keywordSearch(keywords, limit * 2);

    // Merge and deduplicate
    const merged = new Map<string, VectorSearchResult>();

    // Add vector results with higher weight
    vectorResults.forEach((r) => {
      merged.set(r.chunkId, {
        ...r,
        similarity: r.similarity * 0.7,
      });
    });

    // Add keyword results
    keywordResults.forEach((r) => {
      if (merged.has(r.chunkId)) {
        const existing = merged.get(r.chunkId)!;
        existing.similarity = Math.max(existing.similarity, r.similarity * 0.3);
      } else {
        merged.set(r.chunkId, {
          ...r,
          similarity: r.similarity * 0.3,
        });
      }
    });

    // Sort by combined similarity
    const results = Array.from(merged.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  /**
   * Keyword search
   */
  private keywordSearch(keywords: string[], limit: number = 10): VectorSearchResult[] {
    const results: Array<{
      chunkId: string;
      chunk: DocumentChunk;
      matches: number;
    }> = [];

    for (const [chunkId, chunk] of this.chunks) {
      const content = chunk.content.toLowerCase();
      let matches = 0;

      for (const keyword of keywords) {
        if (content.includes(keyword.toLowerCase())) {
          matches++;
        }
      }

      if (matches > 0) {
        results.push({
          chunkId,
          chunk,
          matches,
        });
      }
    }

    // Sort by match count
    results.sort((a, b) => b.matches - a.matches);

    return results.slice(0, limit).map((r) => ({
      chunkId: r.chunkId,
      documentId: r.chunk.documentId,
      content: r.chunk.content,
      similarity: r.matches / keywords.length,
      metadata: r.chunk.metadata,
    }));
  }

  /**
   * Get chunk by ID
   */
  getChunk(chunkId: string): DocumentChunk | undefined {
    return this.chunks.get(chunkId);
  }

  /**
   * Get all chunks for a document
   */
  getDocumentChunks(documentId: string): DocumentChunk[] {
    const chunkIds = this.documentIndex.get(documentId);
    if (!chunkIds) {
      return [];
    }

    return Array.from(chunkIds)
      .map((id) => this.chunks.get(id))
      .filter((c) => c !== undefined) as DocumentChunk[];
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    return {
      totalChunks: this.chunks.size,
      totalDocuments: this.documentIndex.size,
      totalVectors: this.vectors.size,
      cacheSize: this.retrievalCache.size,
      embeddingCacheSize: this.embeddingCache.size,
      config: this.config,
    };
  }

  /**
   * Clear vector store
   */
  clear(): void {
    this.chunks.clear();
    this.vectors.clear();
    this.documentIndex.clear();
    this.embeddingCache.clear();
    this.retrievalCache.clear();

    Logger.info("Vector store cleared");
  }

  /**
   * Cosine similarity
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Generate random embedding (placeholder)
   */
  private generateRandomEmbedding(): number[] {
    const embedding: number[] = [];
    for (let i = 0; i < this.config.dimension; i++) {
      embedding.push(Math.random() - 0.5);
    }
    return embedding;
  }

  /**
   * Match filters
   */
  private matchesFilters(chunk: DocumentChunk, filters: SearchFilter[]): boolean {
    for (const filter of filters) {
      const value = (chunk.metadata as any)[filter.field];

      switch (filter.operator) {
        case "eq":
          if (value !== filter.value) return false;
          break;
        case "ne":
          if (value === filter.value) return false;
          break;
        case "gt":
          if (!(value > filter.value)) return false;
          break;
        case "lt":
          if (!(value < filter.value)) return false;
          break;
        case "in":
          if (!filter.value.includes(value)) return false;
          break;
        case "contains":
          if (!String(value).includes(filter.value)) return false;
          break;
      }
    }

    return true;
  }
}

export const createVectorStore = (config?: Partial<VectorStoreConfig>): VectorStore => {
  return new VectorStore(config);
};
