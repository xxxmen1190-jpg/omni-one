/**
 * Omni One Knowledge Engine Types
 * Types for RAG, Vector Store, Memory, and Knowledge Graph
 */

/**
 * Document Types
 */

export type DocumentType = "pdf" | "txt" | "docx" | "web" | "chat" | "tool_output" | "memory";
export type ChunkingStrategy = "semantic" | "fixed_size" | "sliding_window" | "hierarchical";

export interface Document {
  id: string;
  type: DocumentType;
  title: string;
  content: string;
  source: string;
  metadata: DocumentMetadata;
  createdAt: number;
  updatedAt: number;
  embedding?: number[];
}

export interface DocumentMetadata {
  author?: string;
  language?: string;
  tags?: string[];
  category?: string;
  importance?: number; // 0-100
  expiresAt?: number;
  sourceUrl?: string;
  fileSize?: number;
  pageCount?: number;
  [key: string]: any;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  startIndex: number;
  endIndex: number;
  embedding?: number[];
  metadata: ChunkMetadata;
  createdAt: number;
}

export interface ChunkMetadata {
  chunkIndex: number;
  totalChunks: number;
  confidence?: number;
  keywords?: string[];
  summary?: string;
  [key: string]: any;
}

/**
 * Vector Store Types
 */

export interface VectorStoreConfig {
  dimension: number;
  maxDocuments: number;
  maxChunks: number;
  similarityThreshold: number;
  enableCaching: boolean;
  cacheSize: number;
}

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  similarity: number;
  metadata: ChunkMetadata;
}

export interface VectorSearchQuery {
  query: string;
  embedding?: number[];
  limit?: number;
  threshold?: number;
  filters?: SearchFilter[];
}

export interface SearchFilter {
  field: string;
  operator: "eq" | "ne" | "gt" | "lt" | "in" | "contains";
  value: any;
}

/**
 * Embedding Types
 */

export interface EmbeddingModel {
  name: string;
  dimension: number;
  provider: string;
  maxTokens: number;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  tokens: number;
  model: string;
}

/**
 * Memory Types
 */

export type MemoryType = "short_term" | "long_term" | "episodic" | "semantic" | "procedural";

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  embedding?: number[];
  importance: number; // 0-100
  accessCount: number;
  lastAccessed: number;
  createdAt: number;
  expiresAt?: number;
  relatedMemories: string[];
  metadata: Record<string, any>;
}

export interface MemoryContext {
  userId?: string;
  conversationId?: string;
  sessionId?: string;
  timestamp: number;
  context: Record<string, any>;
}

export interface UserMemory {
  userId: string;
  preferences: Record<string, any>;
  history: Memory[];
  facts: Map<string, string>;
  goals: string[];
  lastUpdated: number;
}

/**
 * Knowledge Graph Types
 */

export interface KnowledgeEntity {
  id: string;
  name: string;
  type: string;
  description: string;
  properties: Record<string, any>;
  relatedEntities: string[];
  importance: number;
  createdAt: number;
  updatedAt: number;
}

export interface KnowledgeRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  weight: number;
  properties: Record<string, any>;
  createdAt: number;
}

export interface KnowledgeGraph {
  entities: Map<string, KnowledgeEntity>;
  relations: Map<string, KnowledgeRelation>;
  entityIndex: Map<string, Set<string>>; // type -> entity ids
  relationIndex: Map<string, Set<string>>; // type -> relation ids
}

/**
 * Retrieval Types
 */

export interface RetrievalContext {
  query: string;
  userId?: string;
  conversationId?: string;
  filters?: SearchFilter[];
  maxResults?: number;
  includeMetadata?: boolean;
}

export interface RetrievalResult {
  query: string;
  results: VectorSearchResult[];
  memories: Memory[];
  entities: KnowledgeEntity[];
  totalRelevance: number;
  retrievedAt: number;
}

export interface ContextWindow {
  query: string;
  documents: Document[];
  chunks: DocumentChunk[];
  memories: Memory[];
  entities: KnowledgeEntity[];
  totalTokens: number;
  relevanceScore: number;
}

/**
 * Query Understanding Types
 */

export interface QueryAnalysis {
  originalQuery: string;
  normalizedQuery: string;
  intent: "search" | "reasoning" | "memory" | "composition" | "unknown";
  entities: string[];
  keywords: string[];
  complexity: "simple" | "moderate" | "complex";
  requiresRag: boolean;
  requiresMemory: boolean;
  requiresReasoning: boolean;
  confidence: number;
}

/**
 * Ingestion Types
 */

export interface IngestionTask {
  id: string;
  documentId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
  chunks: string[];
  metadata: Record<string, any>;
}

export interface ChunkingResult {
  documentId: string;
  chunks: DocumentChunk[];
  totalChunks: number;
  totalTokens: number;
  strategy: ChunkingStrategy;
  metadata: Record<string, any>;
}

/**
 * RAG Pipeline Types
 */

export interface RAGConfig {
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: EmbeddingModel;
  vectorStoreConfig: VectorStoreConfig;
  retrievalConfig: {
    topK: number;
    similarityThreshold: number;
    useHybridSearch: boolean;
    useReranking: boolean;
  };
  memoryConfig: {
    enableLongTermMemory: boolean;
    enableUserMemory: boolean;
    memoryRetentionDays: number;
  };
}

export interface RAGResult {
  query: string;
  context: ContextWindow;
  sources: Document[];
  memories: Memory[];
  entities: KnowledgeEntity[];
  confidence: number;
  retrievalTime: number;
}

/**
 * Knowledge Engine Types
 */

export interface KnowledgeEngineConfig {
  ragConfig: RAGConfig;
  vectorStoreConfig: VectorStoreConfig;
  enableKnowledgeGraph: boolean;
  enableLongTermMemory: boolean;
  enableUserMemory: boolean;
  maxDocuments: number;
  maxMemories: number;
  pruningStrategy: "lru" | "importance" | "hybrid";
  pruningThreshold: number;
}

export interface KnowledgeEngineState {
  documents: Map<string, Document>;
  chunks: Map<string, DocumentChunk>;
  memories: Map<string, Memory>;
  userMemories: Map<string, UserMemory>;
  knowledgeGraph: KnowledgeGraph;
  ingestionTasks: Map<string, IngestionTask>;
  statistics: KnowledgeEngineStatistics;
}

export interface KnowledgeEngineStatistics {
  totalDocuments: number;
  totalChunks: number;
  totalMemories: number;
  totalEntities: number;
  totalRelations: number;
  averageChunkSize: number;
  averageEmbeddingTime: number;
  cacheHitRate: number;
  lastUpdated: number;
}

/**
 * Performance Types
 */

export interface EmbeddingCache {
  text: string;
  embedding: number[];
  timestamp: number;
}

export interface RetrievalCache {
  query: string;
  results: VectorSearchResult[];
  timestamp: number;
  ttl: number;
}
