import {
  Memory,
  UserMemory,
  MemoryContext,
  RetrievalContext,
} from "../../../types/knowledge";
import { LongTermMemory } from "./LongTermMemory";
import { Logger } from "../../system/Logger";

/**
 * Global Memory Fusion - Unifies all memory sources
 * Combines user memory, agent memory, runtime memory, and chat history
 */

export class GlobalMemoryFusion {
  private longTermMemory: LongTermMemory;
  private agentMemories: Map<string, Memory[]> = new Map();
  private runtimeMemories: Map<string, Memory[]> = new Map();
  private chatHistory: Array<{
    userId: string;
    conversationId: string;
    timestamp: number;
    message: string;
    response: string;
  }> = [];

  constructor(longTermMemory: LongTermMemory) {
    this.longTermMemory = longTermMemory;
    Logger.info("GlobalMemoryFusion initialized");
  }

  /**
   * Fuse all memory sources for a query
   */
  fuseMemoryContext(
    query: string,
    userId?: string,
    conversationId?: string,
    agentId?: string
  ): MemoryContext {
    const context: MemoryContext = {
      userId,
      conversationId,
      sessionId: agentId,
      timestamp: Date.now(),
      context: {},
    };

    // Get user memory
    if (userId) {
      const userMemory = this.longTermMemory.getUserMemory(userId);
      if (userMemory) {
        context.context.userPreferences = userMemory.preferences;
        context.context.userFacts = Array.from(userMemory.facts.entries());
        context.context.userGoals = userMemory.goals;
      }
    }

    // Get agent memory
    if (agentId) {
      const agentMemories = this.agentMemories.get(agentId) || [];
      context.context.agentMemories = agentMemories.map((m) => ({
        id: m.id,
        content: m.content,
        importance: m.importance,
      }));
    }

    // Get runtime memory
    const runtimeMemories = Array.from(this.runtimeMemories.values()).flat();
    context.context.runtimeMemories = runtimeMemories
      .slice(-10)
      .map((m) => ({
        id: m.id,
        content: m.content,
        importance: m.importance,
      }));

    // Get relevant chat history
    if (conversationId) {
      const relevantHistory = this.chatHistory.filter(
        (h) => h.conversationId === conversationId
      );

      context.context.chatHistory = relevantHistory
        .slice(-5)
        .map((h) => ({
          message: h.message,
          response: h.response,
          timestamp: h.timestamp,
        }));
    }

    // Get long-term memories
    const ltMemories = this.longTermMemory.getMemoriesByImportance(60);
    context.context.longTermMemories = ltMemories
      .slice(0, 5)
      .map((m) => ({
        id: m.id,
        content: m.content,
        importance: m.importance,
        type: m.type,
      }));

    Logger.debug("Memory context fused", {
      userId,
      conversationId,
      agentId,
      sources: Object.keys(context.context),
    });

    return context;
  }

  /**
   * Add agent memory
   */
  addAgentMemory(agentId: string, memory: Memory): void {
    if (!this.agentMemories.has(agentId)) {
      this.agentMemories.set(agentId, []);
    }

    this.agentMemories.get(agentId)!.push(memory);

    Logger.debug("Agent memory added", {
      agentId,
      memoryId: memory.id,
    });
  }

  /**
   * Add runtime memory
   */
  addRuntimeMemory(sessionId: string, memory: Memory): void {
    if (!this.runtimeMemories.has(sessionId)) {
      this.runtimeMemories.set(sessionId, []);
    }

    this.runtimeMemories.get(sessionId)!.push(memory);

    // Keep only last 100 runtime memories per session
    const memories = this.runtimeMemories.get(sessionId)!;
    if (memories.length > 100) {
      this.runtimeMemories.set(sessionId, memories.slice(-100));
    }

    Logger.debug("Runtime memory added", {
      sessionId,
      memoryId: memory.id,
    });
  }

  /**
   * Add chat history
   */
  addChatHistory(
    userId: string,
    conversationId: string,
    message: string,
    response: string
  ): void {
    this.chatHistory.push({
      userId,
      conversationId,
      timestamp: Date.now(),
      message,
      response,
    });

    // Keep only last 10,000 chat entries
    if (this.chatHistory.length > 10000) {
      this.chatHistory = this.chatHistory.slice(-5000);
    }

    Logger.debug("Chat history added", {
      userId,
      conversationId,
    });
  }

  /**
   * Get agent memory
   */
  getAgentMemory(agentId: string): Memory[] {
    return this.agentMemories.get(agentId) || [];
  }

  /**
   * Get runtime memory
   */
  getRuntimeMemory(sessionId: string): Memory[] {
    return this.runtimeMemories.get(sessionId) || [];
  }

  /**
   * Get chat history
   */
  getChatHistory(conversationId: string, limit: number = 20): Array<{
    message: string;
    response: string;
    timestamp: number;
  }> {
    return this.chatHistory
      .filter((h) => h.conversationId === conversationId)
      .slice(-limit)
      .map((h) => ({
        message: h.message,
        response: h.response,
        timestamp: h.timestamp,
      }));
  }

  /**
   * Get memory summary
   */
  getMemorySummary(userId?: string): Record<string, any> {
    const summary: Record<string, any> = {
      timestamp: Date.now(),
      sources: {},
    };

    // User memory
    if (userId) {
      const userMemory = this.longTermMemory.getUserMemory(userId);
      summary.sources.user = {
        preferences: Object.keys(userMemory?.preferences || {}).length,
        facts: userMemory?.facts.size || 0,
        goals: userMemory?.goals.length || 0,
      };
    }

    // Agent memory
    summary.sources.agent = {
      totalAgents: this.agentMemories.size,
      totalMemories: Array.from(this.agentMemories.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    };

    // Runtime memory
    summary.sources.runtime = {
      totalSessions: this.runtimeMemories.size,
      totalMemories: Array.from(this.runtimeMemories.values()).reduce(
        (sum, arr) => sum + arr.length,
        0
      ),
    };

    // Chat history
    summary.sources.chat = {
      totalEntries: this.chatHistory.length,
      uniqueConversations: new Set(this.chatHistory.map((h) => h.conversationId)).size,
    };

    // Long-term memory
    const ltMemories = this.longTermMemory.getAllMemories();
    summary.sources.longTerm = {
      totalMemories: ltMemories.length,
      averageImportance: (
        ltMemories.reduce((sum, m) => sum + m.importance, 0) / (ltMemories.length || 1)
      ).toFixed(2),
    };

    return summary;
  }

  /**
   * Clear agent memory
   */
  clearAgentMemory(agentId: string): void {
    this.agentMemories.delete(agentId);
    Logger.info("Agent memory cleared", { agentId });
  }

  /**
   * Clear runtime memory
   */
  clearRuntimeMemory(sessionId: string): void {
    this.runtimeMemories.delete(sessionId);
    Logger.info("Runtime memory cleared", { sessionId });
  }

  /**
   * Clear chat history
   */
  clearChatHistory(conversationId?: string): void {
    if (conversationId) {
      this.chatHistory = this.chatHistory.filter((h) => h.conversationId !== conversationId);
      Logger.info("Chat history cleared", { conversationId });
    } else {
      this.chatHistory = [];
      Logger.info("All chat history cleared");
    }
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    return {
      agentMemories: this.agentMemories.size,
      runtimeMemories: this.runtimeMemories.size,
      chatHistorySize: this.chatHistory.length,
      summary: this.getMemorySummary(),
    };
  }
}

export const createGlobalMemoryFusion = (
  longTermMemory: LongTermMemory
): GlobalMemoryFusion => {
  return new GlobalMemoryFusion(longTermMemory);
};
