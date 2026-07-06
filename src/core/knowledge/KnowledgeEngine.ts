import {
  KnowledgeEngineConfig,
  KnowledgeEngineState,
  Document,
  DocumentType,
  RAGResult,
  RetrievalContext,
  Memory,
  MemoryType,
  KnowledgeEntity,
} from "../../types/knowledge";
import { VectorStore } from "./vector/VectorStore";
import { DocumentChunker } from "./ingestion/DocumentChunker";
import { EmbeddingGenerator } from "./ingestion/EmbeddingGenerator";
import { IngestionPipeline } from "./ingestion/IngestionPipeline";
import { RAGCore } from "./rag/RAGCore";
import { LongTermMemory } from "./memory/LongTermMemory";
import { GlobalMemoryFusion } from "./memory/GlobalMemoryFusion";
import { QueryUnderstanding } from "./retrieval/QueryUnderstanding";
import { KnowledgeGraph } from "./graph/KnowledgeGraph";
import { Logger } from "../system/Logger";

/**
 * Knowledge Engine - Central orchestrator for RAG + Memory + Knowledge Graph
 * Unified interface for all knowledge management
 */

export class KnowledgeEngine {
  private config: KnowledgeEngineConfig;
  private state: KnowledgeEngineState;
  private vectorStore: VectorStore;
  private chunker: DocumentChunker;
  private embeddingGenerator: EmbeddingGenerator;
  private ingestionPipeline: IngestionPipeline;
  private ragCore: RAGCore;
  private longTermMemory: LongTermMemory;
  private globalMemoryFusion: GlobalMemoryFusion;
  private queryUnderstanding: QueryUnderstanding;
  private knowledgeGraph: KnowledgeGraph;

  constructor(config: Partial<KnowledgeEngineConfig> = {}) {
    // Initialize configuration
    this.config = {
      ragConfig: config.ragConfig || {
        chunkSize: 512,
        chunkOverlap: 50,
        embeddingModel: {
          name: "default",
          dimension: 384,
          provider: "local",
          maxTokens: 512,
        },
        vectorStoreConfig: {
          dimension: 384,
          maxDocuments: 10000,
          maxChunks: 100000,
          similarityThreshold: 0.5,
          enableCaching: true,
          cacheSize: 1000,
        },
        retrievalConfig: {
          topK: 10,
          similarityThreshold: 0.5,
          useHybridSearch: true,
          useReranking: false,
        },
        memoryConfig: {
          enableLongTermMemory: true,
          enableUserMemory: true,
          memoryRetentionDays: 30,
        },
      },
      vectorStoreConfig: config.vectorStoreConfig || {
        dimension: 384,
        maxDocuments: 10000,
        maxChunks: 100000,
        similarityThreshold: 0.5,
        enableCaching: true,
        cacheSize: 1000,
      },
      enableKnowledgeGraph: config.enableKnowledgeGraph !== false,
      enableLongTermMemory: config.enableLongTermMemory !== false,
      enableUserMemory: config.enableUserMemory !== false,
      maxDocuments: config.maxDocuments || 10000,
      maxMemories: config.maxMemories || 100000,
      pruningStrategy: config.pruningStrategy || "hybrid",
      pruningThreshold: config.pruningThreshold || 0.3,
    };

    // Initialize components
    this.vectorStore = new VectorStore(this.config.vectorStoreConfig);
    this.chunker = new DocumentChunker(
      this.config.ragConfig.chunkSize,
      this.config.ragConfig.chunkOverlap
    );
    this.embeddingGenerator = new EmbeddingGenerator(
      this.config.ragConfig.embeddingModel
    );
    this.ingestionPipeline = new IngestionPipeline(
      this.chunker,
      this.embeddingGenerator,
      this.vectorStore
    );
    this.ragCore = new RAGCore(
      this.config.ragConfig,
      this.vectorStore,
      this.embeddingGenerator
    );
    this.longTermMemory = new LongTermMemory();
    this.globalMemoryFusion = new GlobalMemoryFusion(this.longTermMemory);
    this.queryUnderstanding = new QueryUnderstanding();
    this.knowledgeGraph = new KnowledgeGraph();

    // Initialize state
    this.state = {
      documents: new Map(),
      chunks: new Map(),
      memories: new Map(),
      userMemories: new Map(),
      knowledgeGraph: this.knowledgeGraph.export(),
      ingestionTasks: new Map(),
      statistics: {
        totalDocuments: 0,
        totalChunks: 0,
        totalMemories: 0,
        totalEntities: 0,
        totalRelations: 0,
        averageChunkSize: 0,
        averageEmbeddingTime: 0,
        cacheHitRate: 0,
        lastUpdated: Date.now(),
      },
    };

    Logger.info("KnowledgeEngine initialized", { config: this.config });
  }

  /**
   * Ingest document
   */
  async ingestDocument(document: Document): Promise<void> {
    try {
      Logger.info("Ingesting document", {
        documentId: document.id,
        type: document.type,
      });

      // Ingest via pipeline
      const task = await this.ingestionPipeline.ingestDocument(document);

      // Store document
      this.state.documents.set(document.id, document);

      // Add to RAG core
      this.ragCore.addDocument(document);

      // Add entity to knowledge graph
      if (this.config.enableKnowledgeGraph) {
        this.knowledgeGraph.addEntity(
          document.title,
          "document",
          document.title,
          {
            type: document.type,
            source: document.source,
          }
        );
      }

      // Update statistics
      this.updateStatistics();

      Logger.info("Document ingested", {
        documentId: document.id,
        chunks: task.chunks.length,
      });
    } catch (error: any) {
      Logger.error("Document ingestion failed", {
        documentId: document.id,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Retrieve context for query
   */
  async retrieveContext(
    query: string,
    userId?: string,
    conversationId?: string
  ): Promise<RAGResult> {
    try {
      // Analyze query
      const analysis = this.queryUnderstanding.analyzeQuery(query);

      Logger.info("Query analyzed", {
        query: query.substring(0, 50),
        intent: analysis.intent,
        requiresRag: analysis.requiresRag,
      });

      // Retrieve context
      const context: RetrievalContext = {
        query,
        userId,
        conversationId,
        maxResults: this.config.ragConfig.retrievalConfig.topK,
      };

      const ragResult = await this.ragCore.retrieveContext(context);

      // Fuse with memory context
      const memoryContext = this.globalMemoryFusion.fuseMemoryContext(
        query,
        userId,
        conversationId
      );

      // Add memory to RAG result
      ragResult.memories = Object.values(memoryContext.context.longTermMemories || {}) as Memory[];

      return ragResult;
    } catch (error: any) {
      Logger.error("Context retrieval failed", {
        query: query.substring(0, 50),
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Add memory
   */
  addMemory(
    type: MemoryType,
    content: string,
    importance: number = 50,
    userId?: string,
    agentId?: string
  ): Memory {
    const memory = this.longTermMemory.addMemory(type, content, importance, {
      userId,
      agentId,
    });

    // Add to RAG core
    this.ragCore.addMemory(memory);

    // Add to global fusion
    if (agentId) {
      this.globalMemoryFusion.addAgentMemory(agentId, memory);
    }

    // Update statistics
    this.updateStatistics();

    return memory;
  }

  /**
   * Add entity to knowledge graph
   */
  addEntity(
    name: string,
    type: string,
    description: string = "",
    importance: number = 50
  ): KnowledgeEntity {
    const entity = this.knowledgeGraph.addEntity(
      name,
      type,
      description,
      {},
      importance
    );

    // Add to RAG core
    this.ragCore.addEntity(entity);

    // Update statistics
    this.updateStatistics();

    return entity;
  }

  /**
   * Add relation between entities
   */
  addRelation(
    sourceId: string,
    targetId: string,
    type: string,
    weight: number = 1
  ): void {
    this.knowledgeGraph.addRelation(sourceId, targetId, type, weight);

    // Update statistics
    this.updateStatistics();
  }

  /**
   * Start long-term memory consolidation
   */
  startMemoryConsolidation(): void {
    this.longTermMemory.startConsolidation();
    Logger.info("Memory consolidation started");
  }

  /**
   * Stop long-term memory consolidation
   */
  stopMemoryConsolidation(): void {
    this.longTermMemory.stopConsolidation();
    Logger.info("Memory consolidation stopped");
  }

  /**
   * Get component
   */
  getVectorStore(): VectorStore {
    return this.vectorStore;
  }

  getRAGCore(): RAGCore {
    return this.ragCore;
  }

  getLongTermMemory(): LongTermMemory {
    return this.longTermMemory;
  }

  getGlobalMemoryFusion(): GlobalMemoryFusion {
    return this.globalMemoryFusion;
  }

  getQueryUnderstanding(): QueryUnderstanding {
    return this.queryUnderstanding;
  }

  getKnowledgeGraph(): KnowledgeGraph {
    return this.knowledgeGraph;
  }

  /**
   * Get engine state
   */
  getState(): KnowledgeEngineState {
    return this.state;
  }

  /**
   * Update statistics
   */
  private updateStatistics(): void {
    const documents = this.state.documents.size;
    const memories = this.longTermMemory.getAllMemories().length;
    const entities = this.knowledgeGraph.export().entities.size;
    const relations = this.knowledgeGraph.export().relations.size;

    this.state.statistics = {
      totalDocuments: documents,
      totalChunks: this.vectorStore.getStatistics().totalChunks,
      totalMemories: memories,
      totalEntities: entities,
      totalRelations: relations,
      averageChunkSize: 512, // Config value
      averageEmbeddingTime: 10, // Placeholder
      cacheHitRate: 0.5, // Placeholder
      lastUpdated: Date.now(),
    };
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    return {
      config: this.config,
      state: {
        documents: this.state.documents.size,
        memories: this.state.memories.size,
        entities: this.knowledgeGraph.export().entities.size,
        relations: this.knowledgeGraph.export().relations.size,
      },
      vectorStore: this.vectorStore.getStatistics(),
      ragCore: this.ragCore.getStatistics(),
      longTermMemory: this.longTermMemory.getStatistics(),
      globalMemoryFusion: this.globalMemoryFusion.getStatistics(),
      knowledgeGraph: this.knowledgeGraph.getStatistics(),
      ingestionPipeline: this.ingestionPipeline.getStatistics(),
    };
  }
}

export const createKnowledgeEngine = (
  config?: Partial<KnowledgeEngineConfig>
): KnowledgeEngine => {
  return new KnowledgeEngine(config);
};
