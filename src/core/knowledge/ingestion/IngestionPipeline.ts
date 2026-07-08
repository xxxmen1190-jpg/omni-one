import {
  Document,
  DocumentType,
  IngestionTask,
  ChunkingStrategy,
} from "../../../types/knowledge";
import { DocumentChunker } from "./DocumentChunker";
import { EmbeddingGenerator } from "./EmbeddingGenerator";
import { VectorStore } from "../vector/VectorStore";
import { Logger } from "../../system/Logger";

/**
 * Document Ingestion Pipeline - Processes documents end-to-end
 * Handles: extraction, chunking, embedding, and storage
 */

export class IngestionPipeline {
  private chunker: DocumentChunker;
  private embeddingGenerator: EmbeddingGenerator;
  private vectorStore: VectorStore;
  private tasks: Map<string, IngestionTask> = new Map();
  private taskIdCounter: number = 0;

  constructor(
    chunker: DocumentChunker,
    embeddingGenerator: EmbeddingGenerator,
    vectorStore: VectorStore
  ) {
    this.chunker = chunker;
    this.embeddingGenerator = embeddingGenerator;
    this.vectorStore = vectorStore;

    Logger.info("IngestionPipeline initialized");
  }

  /**
   * Ingest document
   */
  async ingestDocument(
    document: Document,
    chunkingStrategy: ChunkingStrategy = "semantic"
  ): Promise<IngestionTask> {
    const taskId = this.generateTaskId();

    // Create task
    const task: IngestionTask = {
      id: taskId,
      documentId: document.id,
      status: "processing",
      progress: 0,
      startTime: Date.now(),
      chunks: [],
      metadata: {},
    };

    this.tasks.set(taskId, task);

    try {
      Logger.info("Starting document ingestion", {
        taskId,
        documentId: document.id,
        type: document.type,
      });

      // Step 1: Clean and normalize document
      const cleanedContent = this.cleanContent(document.content);
      const normalizedDocument = {
        ...document,
        content: cleanedContent,
      };

      task.progress = 20;

      // Step 2: Chunk document
      const chunkingResult = this.chunker.chunk(normalizedDocument, chunkingStrategy);
      task.progress = 40;

      Logger.info("Document chunked", {
        taskId,
        chunkCount: chunkingResult.totalChunks,
      });

      // Step 3: Generate embeddings
      const embeddings = await this.embeddingGenerator.batchGenerateEmbeddings(
        chunkingResult.chunks.map((c) => c.content),
        32
      );

      task.progress = 70;

      // Step 4: Add embeddings to chunks
      const chunksWithEmbeddings = chunkingResult.chunks.map((chunk, index) => ({
        ...chunk,
        embedding: embeddings[index]?.embedding,
      }));

      task.progress = 80;

      // Step 5: Store in vector store
      this.vectorStore.addChunks(chunksWithEmbeddings);

      task.progress = 100;
      task.status = "completed";
      task.endTime = Date.now();
      task.chunks = chunksWithEmbeddings.map((c) => c.id);

      Logger.info("Document ingestion completed", {
        taskId,
        documentId: document.id,
        duration: task.endTime - task.startTime,
        chunkCount: task.chunks.length,
      });

      return task;
    } catch (error: any) {
      task.status = "failed";
      task.endTime = Date.now();
      task.error = error.message;

      Logger.error("Document ingestion failed", {
        taskId,
        documentId: document.id,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Ingest multiple documents
   */
  async ingestDocuments(
    documents: Document[],
    chunkingStrategy: ChunkingStrategy = "semantic"
  ): Promise<IngestionTask[]> {
    const tasks: IngestionTask[] = [];

    for (const document of documents) {
      try {
        const task = await this.ingestDocument(document, chunkingStrategy);
        tasks.push(task);
      } catch (error: any) {
        Logger.error("Failed to ingest document", {
          documentId: document.id,
          error: error.message,
        });
      }
    }

    return tasks;
  }

  /**
   * Get ingestion task
   */
  getTask(taskId: string): IngestionTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): IngestionTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get active tasks
   */
  getActiveTasks(): IngestionTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === "processing");
  }

  /**
   * Get completed tasks
   */
  getCompletedTasks(): IngestionTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === "completed");
  }

  /**
   * Get failed tasks
   */
  getFailedTasks(): IngestionTask[] {
    return Array.from(this.tasks.values()).filter((t) => t.status === "failed");
  }

  /**
   * Clean and normalize content
   */
  private cleanContent(content: string): string {
    // Remove extra whitespace
    let cleaned = content.replace(/\s+/g, " ").trim();

    // Remove special characters (keep basic punctuation)
    cleaned = cleaned.replace(/[^\w\s.,!?;:\-'"()]/g, "");

    // Normalize quotes
    cleaned = cleaned.replace(/[""]/g, '"').replace(/['']/g, "'");

    return cleaned;
  }

  /**
   * Extract text from different file types
   */
  extractText(content: string, fileType: DocumentType): string {
    switch (fileType) {
      case "pdf":
        // In real implementation, use PDF parser
        return content;
      case "docx":
        // In real implementation, use DOCX parser
        return content;
      case "web":
        // Remove HTML tags
        return content.replace(/<[^>]*>/g, "");
      case "txt":
        return content;
      default:
        return content;
    }
  }

  /**
   * Get pipeline statistics
   */
  getStatistics(): Record<string, any> {
    const allTasks = Array.from(this.tasks.values());
    const completedTasks = allTasks.filter((t) => t.status === "completed");
    const failedTasks = allTasks.filter((t) => t.status === "failed");

    const totalChunks = completedTasks.reduce((sum, t) => sum + t.chunks.length, 0);
    const totalTime = completedTasks.reduce(
      (sum, t) => sum + ((t.endTime || 0) - t.startTime),
      0
    );

    return {
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      activeTasks: allTasks.filter((t) => t.status === "processing").length,
      totalChunks,
      averageChunksPerDocument: completedTasks.length > 0 ? totalChunks / completedTasks.length : 0,
      totalProcessingTime: totalTime,
      averageProcessingTime: completedTasks.length > 0 ? totalTime / completedTasks.length : 0,
    };
  }

  /**
   * Generate task ID
   */
  private generateTaskId(): string {
    return `task-${Date.now()}-${++this.taskIdCounter}`;
  }
}

export const createIngestionPipeline = (
  chunker: DocumentChunker,
  embeddingGenerator: EmbeddingGenerator,
  vectorStore: VectorStore
): IngestionPipeline => {
  return new IngestionPipeline(chunker, embeddingGenerator, vectorStore);
};
