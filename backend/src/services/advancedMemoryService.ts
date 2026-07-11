/**
 * Advanced Memory Service — Omni One Backend
 * 
 * Handles multi-tier memory (Working, Session, Long-Term, Semantic, etc.)
 * with importance scoring, decay, and reinforcement.
 */

import { prisma } from "../database/prisma.js";
import { AppError } from "../types/index.js";
import { logger } from "../utils/logger.js";

export enum MemoryType {
  WORKING = "WORKING",
  SESSION = "SESSION",
  LONG_TERM = "LONG_TERM",
  PROJECT = "PROJECT",
  SEMANTIC = "SEMANTIC",
  PREFERENCE = "PREFERENCE",
}

class AdvancedMemoryServiceClass {
  /**
   * Store a new memory with importance scoring.
   */
  async storeMemory(data: { userId: string; type: MemoryType; content: string; importance?: number; metadata?: any }) {
    try {
      return await prisma.advancedMemory.create({
        data: {
          userId: data.userId,
          type: data.type,
          content: data.content,
          importance: data.importance || 1.0,
          metadata: data.metadata || {},
        },
      });
    } catch (error) {
      logger.error({ error, data }, "Failed to store advanced memory");
      throw new AppError("Memory storage failed", 500);
    }
  }

  /**
   * Retrieve relevant memories using semantic search and importance/decay.
   */
  async retrieveMemories(userId: string, query: string, type?: MemoryType, limit = 5) {
    // In a real implementation, we would use vector search (pgvector) here.
    // For now, we simulate with a weighted retrieval based on importance and recency.
    
    const memories = await prisma.advancedMemory.findMany({
      where: { 
        userId,
        ...(type ? { type } : {}),
      },
      orderBy: [
        { importance: "desc" },
        { lastAccessedAt: "desc" },
      ],
      take: limit * 2, // Fetch more to filter/rank
    });

    // Apply simulated decay: score = importance * (decay ^ days_since_last_access)
    const now = new Date().getTime();
    const ranked = memories.map(m => {
      const daysSinceAccess = (now - m.lastAccessedAt.getTime()) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.pow(m.decay, daysSinceAccess);
      return { ...m, rankScore: m.importance * decayFactor };
    }).sort((a, b) => b.rankScore - a.rankScore);

    return ranked.slice(0, limit);
  }

  /**
   * Consolidate working/session memory into long-term memory.
   */
  async consolidateMemory(userId: string) {
    const sessionMemories = await prisma.advancedMemory.findMany({
      where: { userId, type: MemoryType.SESSION, importance: { gte: 0.7 } },
    });

    for (const mem of sessionMemories) {
      await prisma.advancedMemory.update({
        where: { id: mem.id },
        data: { type: MemoryType.LONG_TERM },
      });
    }

    logger.info({ userId, count: sessionMemories.length }, "Memory consolidated");
  }

  /**
   * Reinforce a memory (increase importance on access).
   */
  async reinforceMemory(id: string) {
    return await prisma.advancedMemory.update({
      where: { id },
      data: { 
        importance: { multiply: 1.1 }, // Increase by 10%
        lastAccessedAt: new Date(),
      },
    });
  }

  /**
   * Automatic forgetting (delete memories with very low importance).
   */
  async pruneMemories(userId: string) {
    const result = await prisma.advancedMemory.deleteMany({
      where: { userId, importance: { lt: 0.1 } },
    });
    return result.count;
  }
}

export const advancedMemoryService = new AdvancedMemoryServiceClass();
