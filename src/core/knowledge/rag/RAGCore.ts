import {
  RAGConfig,
  RAGResult,
  RetrievalContext,
  ContextWindow,
  Document,
  DocumentChunk,
  Memory,
  KnowledgeEntity,
} from "../../../types/knowledge";
import { VectorStore } from "../vector/VectorStore";
import { IngestionPipeline } from "../ingestion/IngestionPipeline";
import { EmbeddingGenerator } from "../ingestion/EmbeddingGenerator";
import { Logger } from "../../system/Logger";

/**
 * RAG Core - Retrieval-Augmented Generation system
 * Handles semantic search, context building, and source tracking
 */

export class RAGCore {
  private config: RAGConfig;
  private vectorStore: VectorStore;
  private embeddingGenerator: EmbeddingGenerator;
  private documents: Map<string, Document> = new Map();
  private memories: Map<string, Memory> = new Map();
  private entities: Map<string, KnowledgeEntity> = new Map();

  constructor(
    config: RAGConfig,
    vectorStore: VectorStore,
    embeddingGenerator: EmbeddingGenerator
  ) {
    this.config = config;
    this.vectorStore = vectorStore;
    this.embeddingGenerator = embeddingGenerator;

    Logger.info("RAGCore initialized", { config });
  }

  /**
   * Retrieve context for a query
   */
  async retrieveContext(context: RetrievalContext): Promise<RAGResult> {
    const startTime = Date.now();

    try {
      Logger.info("Retrieving context", { query: context.query });

      // Generate query embedding
      const queryEmbedding = await this.embeddingGenerator.generateEmbedding(
        context.query
      );

      // Search vector store
      const searchResults = this.config.retrievalConfig.useHybridSearch
        ? this.vectorStore.hybridSearch(
            context.query,
            queryEmbedding.embedding,
            this.extractKeywords(context.query),
            context.maxResults || 10
          )
        : this.vectorStore.search({
            query: context.query,
            embedding: queryEmbedding.embedding,
            limit: context.maxResults || 10,
            filters: context.filters,
            threshold: this.config.retrievalConfig.similarityThreshold,
          });

      // Get documents and chunks
      const documents: Document[] = [];
      const chunks: DocumentChunk[] = [];

      for (const result of searchResults) {
        const doc = this.documents.get(result.documentId);
        if (doc) {
          documents.push(doc);
        }

        const chunk = this.vectorStore.getChunk(result.chunkId);
        if (chunk) {
          chunks.push(chunk);
        }
      }

      // Retrieve relevant memories
      const memories = this.retrieveMemories(context.query, context.userId);

      // Retrieve relevant entities
      const entities = this.retrieveEntities(context.query);

      // Build context window
      const contextWindow = this.buildContextWindow(
        context.query,
        documents,
        chunks,
        memories,
        entities
      );

      // Calculate confidence
      const confidence =
        searchResults.length > 0
          ? searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length
          : 0;

      const retrievalTime = Date.now() - startTime;

      const result: RAGResult = {
        query: context.query,
        context: contextWindow,
        sources: documents,
        memories,
        entities,
        confidence,
        retrievalTime,
      };

      Logger.info("Context retrieved", {
        query: context.query,
        chunks: chunks.length,
        memories: memories.length,
        entities: entities.length,
        confidence: confidence.toFixed(2),
        retrievalTime,
      });

      return result;
    } catch (error: any) {
      Logger.error("Context retrieval failed", {
        query: context.query,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Build context window
   */
  private buildContextWindow(
    query: string,
    documents: Document[],
    chunks: DocumentChunk[],
    memories: Memory[],
    entities: KnowledgeEntity[]
  ): ContextWindow {
    // Estimate total tokens
    let totalTokens = 0;

    const chunkTexts = chunks.map((c) => c.content);
    for (const text of chunkTexts) {
      totalTokens += this.estimateTokens(text);
    }

    for (const memory of memories) {
      totalTokens += this.estimateTokens(memory.content);
    }

    // Calculate relevance score
    const relevanceScore =
      (chunks.length * 0.5 + memories.length * 0.3 + entities.length * 0.2) / 10;

    return {
      query,
      documents,
      chunks,
      memories,
      entities,
      totalTokens,
      relevanceScore: Math.min(1, relevanceScore),
    };
  }

  /**
   * Retrieve relevant memories
   */
  private retrieveMemories(query: string, userId?: string): Memory[] {
    const memories: Memory[] = [];

    // Filter memories by user if specified
    const candidateMemories = userId
      ? Array.from(this.memories.values()).filter((m) => m.metadata.userId === userId)
      : Array.from(this.memories.values());

    // Simple keyword matching (can be improved with embeddings)
    const queryKeywords = this.extractKeywords(query);

    for (const memory of candidateMemories) {
      const memoryKeywords = this.extractKeywords(memory.content);
      const matches = queryKeywords.filter((k) =>
        memoryKeywords.some((mk) => mk.includes(k) || k.includes(mk))
      ).length;

      if (matches > 0) {
        memories.push(memory);
      }
    }

    // Sort by importance and recency
    memories.sort((a, b) => {
      const scoreA = a.importance * 0.7 + (Date.now() - a.lastAccessed) * 0.3;
      const scoreB = b.importance * 0.7 + (Date.now() - b.lastAccessed) * 0.3;
      return scoreB - scoreA;
    });

    return memories.slice(0, 5);
  }

  /**
   * Retrieve relevant entities
   */
  private retrieveEntities(query: string): KnowledgeEntity[] {
    const entities: KnowledgeEntity[] = [];
    const queryKeywords = this.extractKeywords(query);

    for (const entity of this.entities.values()) {
      const entityKeywords = this.extractKeywords(entity.name + " " + entity.description);
      const matches = queryKeywords.filter((k) =>
        entityKeywords.some((ek) => ek.includes(k) || k.includes(ek))
      ).length;

      if (matches > 0) {
        entities.push(entity);
      }
    }

    // Sort by importance
    entities.sort((a, b) => b.importance - a.importance);

    return entities.slice(0, 5);
  }

  /**
   * Add document
   */
  addDocument(document: Document): void {
    this.documents.set(document.id, document);
    Logger.debug("Document added to RAG", { documentId: document.id });
  }

  /**
   * Add memory
   */
  addMemory(memory: Memory): void {
    this.memories.set(memory.id, memory);
    Logger.debug("Memory added to RAG", { memoryId: memory.id });
  }

  /**
   * Add entity
   */
  addEntity(entity: KnowledgeEntity): void {
    this.entities.set(entity.id, entity);
    Logger.debug("Entity added to RAG", { entityId: entity.id });
  }

  /**
   * Extract keywords
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 10);
  }

  /**
   * Estimate tokens
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    return {
      documents: this.documents.size,
      memories: this.memories.size,
      entities: this.entities.size,
      vectorStoreStats: this.vectorStore.getStatistics(),
    };
  }
}

export const createRAGCore = (
  config: RAGConfig,
  vectorStore: VectorStore,
  embeddingGenerator: EmbeddingGenerator
): RAGCore => {
  return new RAGCore(config, vectorStore, embeddingGenerator);
};
