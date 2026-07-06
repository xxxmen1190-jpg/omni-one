import {
  Document,
  DocumentChunk,
  ChunkingStrategy,
  ChunkingResult,
} from "../../../types/knowledge";
import { Logger } from "../../system/Logger";

/**
 * Document Chunker - Intelligently splits documents into chunks
 * Supports multiple chunking strategies
 */

export class DocumentChunker {
  private chunkSize: number;
  private chunkOverlap: number;
  private chunkIdCounter: number = 0;

  constructor(chunkSize: number = 512, chunkOverlap: number = 50) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
    Logger.info("DocumentChunker initialized", {
      chunkSize,
      chunkOverlap,
    });
  }

  /**
   * Chunk document using specified strategy
   */
  chunk(
    document: Document,
    strategy: ChunkingStrategy = "semantic"
  ): ChunkingResult {
    let chunks: DocumentChunk[] = [];

    switch (strategy) {
      case "semantic":
        chunks = this.semanticChunking(document);
        break;
      case "fixed_size":
        chunks = this.fixedSizeChunking(document);
        break;
      case "sliding_window":
        chunks = this.slidingWindowChunking(document);
        break;
      case "hierarchical":
        chunks = this.hierarchicalChunking(document);
        break;
      default:
        chunks = this.fixedSizeChunking(document);
    }

    // Calculate statistics
    const totalTokens = chunks.reduce((sum, c) => sum + this.estimateTokens(c.content), 0);

    Logger.info("Document chunked", {
      documentId: document.id,
      strategy,
      chunkCount: chunks.length,
      totalTokens,
    });

    return {
      documentId: document.id,
      chunks,
      totalChunks: chunks.length,
      totalTokens,
      strategy,
      metadata: {
        originalLength: document.content.length,
        averageChunkSize: document.content.length / chunks.length,
      },
    };
  }

  /**
   * Semantic chunking - splits at sentence/paragraph boundaries
   */
  private semanticChunking(document: Document): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const sentences = this.splitIntoSentences(document.content);

    let currentChunk = "";
    let startIndex = 0;
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const testChunk = currentChunk + (currentChunk ? " " : "") + sentence;

      if (this.estimateTokens(testChunk) > this.chunkSize) {
        // Save current chunk
        if (currentChunk) {
          chunks.push(this.createChunk(document, currentChunk, startIndex, chunkIndex));
          chunkIndex++;
        }

        // Start new chunk
        currentChunk = sentence;
        startIndex = document.content.indexOf(sentence, startIndex);
      } else {
        currentChunk = testChunk;
      }
    }

    // Add last chunk
    if (currentChunk) {
      chunks.push(this.createChunk(document, currentChunk, startIndex, chunkIndex));
    }

    return chunks;
  }

  /**
   * Fixed size chunking - splits at fixed character boundaries
   */
  private fixedSizeChunking(document: Document): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const content = document.content;

    for (let i = 0; i < content.length; i += this.chunkSize - this.chunkOverlap) {
      const end = Math.min(i + this.chunkSize, content.length);
      const chunkContent = content.substring(i, end);

      chunks.push(
        this.createChunk(
          document,
          chunkContent,
          i,
          Math.floor(i / (this.chunkSize - this.chunkOverlap))
        )
      );
    }

    return chunks;
  }

  /**
   * Sliding window chunking - overlapping windows
   */
  private slidingWindowChunking(document: Document): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const content = document.content;
    const step = this.chunkSize - this.chunkOverlap;

    for (let i = 0; i < content.length; i += step) {
      const end = Math.min(i + this.chunkSize, content.length);
      const chunkContent = content.substring(i, end);

      chunks.push(
        this.createChunk(
          document,
          chunkContent,
          i,
          Math.floor(i / step)
        )
      );

      if (end === content.length) break;
    }

    return chunks;
  }

  /**
   * Hierarchical chunking - respects document structure
   */
  private hierarchicalChunking(document: Document): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];

    // Split by paragraphs first
    const paragraphs = document.content.split(/\n\n+/);

    let currentChunk = "";
    let startIndex = 0;
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const testChunk = currentChunk + (currentChunk ? "\n\n" : "") + paragraph;

      if (this.estimateTokens(testChunk) > this.chunkSize) {
        // Save current chunk
        if (currentChunk) {
          chunks.push(this.createChunk(document, currentChunk, startIndex, chunkIndex));
          chunkIndex++;
        }

        // If paragraph itself is too large, split it
        if (this.estimateTokens(paragraph) > this.chunkSize) {
          const subChunks = this.fixedSizeChunking({
            ...document,
            content: paragraph,
          });

          for (const subChunk of subChunks) {
            chunks.push({
              ...subChunk,
              metadata: {
                ...subChunk.metadata,
                chunkIndex,
              },
            });
            chunkIndex++;
          }

          currentChunk = "";
          startIndex = document.content.indexOf(paragraph) + paragraph.length;
        } else {
          currentChunk = paragraph;
          startIndex = document.content.indexOf(paragraph);
        }
      } else {
        currentChunk = testChunk;
      }
    }

    // Add last chunk
    if (currentChunk) {
      chunks.push(this.createChunk(document, currentChunk, startIndex, chunkIndex));
    }

    return chunks;
  }

  /**
   * Create a chunk object
   */
  private createChunk(
    document: Document,
    content: string,
    startIndex: number,
    chunkIndex: number
  ): DocumentChunk {
    return {
      id: this.generateChunkId(),
      documentId: document.id,
      content,
      startIndex,
      endIndex: startIndex + content.length,
      metadata: {
        chunkIndex,
        totalChunks: 0, // Will be set later
        keywords: this.extractKeywords(content),
        summary: this.generateSummary(content),
      },
      createdAt: Date.now(),
    };
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting (can be improved)
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * Extract keywords from content
   */
  private extractKeywords(content: string): string[] {
    // Simple keyword extraction (can be improved with NLP)
    const words = content
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Count word frequency
    const frequency: Record<string, number> = {};
    for (const word of words) {
      frequency[word] = (frequency[word] || 0) + 1;
    }

    // Get top keywords
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((e) => e[0]);
  }

  /**
   * Generate summary of content
   */
  private generateSummary(content: string): string {
    // Simple summary (first 100 chars)
    return content.substring(0, 100) + (content.length > 100 ? "..." : "");
  }

  /**
   * Estimate tokens in text (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Generate chunk ID
   */
  private generateChunkId(): string {
    return `chunk-${Date.now()}-${++this.chunkIdCounter}`;
  }
}

export const createDocumentChunker = (
  chunkSize?: number,
  chunkOverlap?: number
): DocumentChunker => {
  return new DocumentChunker(chunkSize, chunkOverlap);
};
