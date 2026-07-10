/**
 * Memory Repository — Omni One Backend
 *
 * Handles long-term memory and vector-based semantic search.
 */

import { BaseRepository } from "./baseRepository.js";
import type { Memory, Prisma } from "@prisma/client";

export class MemoryRepository extends BaseRepository {
  async findById(id: string): Promise<Memory | null> {
    return this.prisma.memory.findUnique({ where: { id } });
  }

  async create(data: Prisma.MemoryCreateInput): Promise<Memory> {
    return this.prisma.memory.create({ data });
  }

  /**
   * Semantic search using pgvector.
   * Note: Raw query is required for vector similarity in Prisma.
   */
  async searchSimilar(userId: string, embedding: number[], limit = 5): Promise<any[]> {
    const vectorString = `[${embedding.join(",")}]`;
    
    // We use <=> for cosine distance (pgvector)
    return this.prisma.$queryRawUnsafe(`
      SELECT id, content, metadata, "createdAt",
      (embedding <=> $1::vector) as distance
      FROM "Memory"
      WHERE "userId" = $2
      ORDER BY distance ASC
      LIMIT $3
    `, vectorString, userId, limit);
  }

  async delete(id: string): Promise<Memory> {
    return this.prisma.memory.delete({ where: { id } });
  }

  async clearUserMemory(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.memory.deleteMany({ where: { userId } });
  }
}

export const memoryRepository = new MemoryRepository();
