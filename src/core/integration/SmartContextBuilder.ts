import {
  SmartContext,
  ContextItem,
  RAGResult,
  InjectedMemory,
} from "../../types/integration";
import { Logger } from "../system/Logger";

/**
 * Smart Context Builder - Intelligently selects context for LLM
 * Decides what goes into context window based on relevance and token limits
 */

export class SmartContextBuilder {
  private maxTokens: number;
  private priorityWeights: Record<string, number> = {
    document: 0.8,
    memory: 0.7,
    entity: 0.6,
    tool_output: 0.9,
    chat_history: 0.5,
  };

  constructor(maxTokens: number = 4000) {
    this.maxTokens = maxTokens;
    Logger.info("SmartContextBuilder initialized", { maxTokens });
  }

  /**
   * Build smart context
   */
  buildContext(
    query: string,
    ragResults: RAGResult | null,
    memoryContext: InjectedMemory | null,
    executionResult: any
  ): SmartContext {
    const items: ContextItem[] = [];

    // Extract items from RAG results
    if (ragResults) {
      items.push(...this.extractRAGItems(ragResults));
    }

    // Extract items from memory
    if (memoryContext) {
      items.push(...this.extractMemoryItems(memoryContext));
    }

    // Extract items from execution result
    if (executionResult) {
      items.push(...this.extractExecutionItems(executionResult));
    }

    // Score and rank items
    const scoredItems = items.map((item) => ({
      ...item,
      score: this.scoreItem(item, query),
    }));

    scoredItems.sort((a, b) => b.score - a.score);

    // Select items within token limit
    const { included, excluded } = this.selectItems(scoredItems);

    const context: SmartContext = {
      items: included,
      totalTokens: included.reduce((sum, item) => sum + item.tokens, 0),
      maxTokens: this.maxTokens,
      utilizationRate: included.reduce((sum, item) => sum + item.tokens, 0) / this.maxTokens,
      includedItems: included,
      excludedItems: excluded,
      reasoning: this.generateReasoning(included, excluded),
    };

    Logger.info("Context built", {
      itemsIncluded: included.length,
      itemsExcluded: excluded.length,
      totalTokens: context.totalTokens,
      utilizationRate: context.utilizationRate.toFixed(2),
    });

    return context;
  }

  /**
   * Extract RAG items
   */
  private extractRAGItems(ragResults: RAGResult): ContextItem[] {
    const items: ContextItem[] = [];

    // Add document chunks
    for (const chunk of ragResults.context.chunks) {
      items.push({
        id: chunk.id,
        type: "document",
        content: chunk.content,
        importance: 80,
        relevance: chunk.metadata.confidence || 0.8,
        tokens: this.estimateTokens(chunk.content),
        source: `document:${chunk.documentId}`,
      });
    }

    // Add entities
    for (const entity of ragResults.context.entities) {
      items.push({
        id: entity.id,
        type: "entity",
        content: `${entity.name}: ${entity.description}`,
        importance: entity.importance,
        relevance: 0.7,
        tokens: this.estimateTokens(entity.name + entity.description),
        source: `entity:${entity.id}`,
      });
    }

    return items;
  }

  /**
   * Extract memory items
   */
  private extractMemoryItems(memoryContext: InjectedMemory): ContextItem[] {
    const items: ContextItem[] = [];

    // Add user preferences
    if (Object.keys(memoryContext.userPreferences).length > 0) {
      const prefContent = Object.entries(memoryContext.userPreferences)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");

      items.push({
        id: "user_preferences",
        type: "memory",
        content: `User Preferences: ${prefContent}`,
        importance: 60,
        relevance: 0.6,
        tokens: this.estimateTokens(prefContent),
        source: "user_preferences",
      });
    }

    // Add user facts
    for (const [key, value] of memoryContext.userFacts) {
      items.push({
        id: `fact_${key}`,
        type: "memory",
        content: `${key}: ${value}`,
        importance: 70,
        relevance: 0.7,
        tokens: this.estimateTokens(value),
        source: "user_facts",
      });
    }

    // Add recent decisions
    for (const decision of memoryContext.recentDecisions) {
      items.push({
        id: `decision_${decision.decision}`,
        type: "memory",
        content: `Recent Decision: ${decision.decision}${decision.outcome ? ` (Outcome: ${decision.outcome})` : ""}`,
        importance: 65,
        relevance: 0.65,
        tokens: this.estimateTokens(decision.decision),
        source: "recent_decisions",
      });
    }

    return items;
  }

  /**
   * Extract execution items
   */
  private extractExecutionItems(executionResult: any): ContextItem[] {
    const items: ContextItem[] = [];

    // Add tool outputs
    if (executionResult.toolOutputs && Array.isArray(executionResult.toolOutputs)) {
      for (const output of executionResult.toolOutputs) {
        items.push({
          id: output.id,
          type: "tool_output",
          content: output.result,
          importance: 85,
          relevance: 0.85,
          tokens: this.estimateTokens(output.result),
          source: `tool:${output.toolId}`,
        });
      }
    }

    // Add agent actions
    if (executionResult.agentActions && Array.isArray(executionResult.agentActions)) {
      for (const action of executionResult.agentActions) {
        items.push({
          id: action.id,
          type: "tool_output",
          content: `Agent ${action.agentId} performed: ${action.action}`,
          importance: 80,
          relevance: 0.8,
          tokens: this.estimateTokens(action.action),
          source: `agent:${action.agentId}`,
        });
      }
    }

    return items;
  }

  /**
   * Score item for relevance
   */
  private scoreItem(item: ContextItem & { score?: number }, query: string): number {
    let score = 0;

    // Base score from type
    score += this.priorityWeights[item.type] || 0.5;

    // Relevance score
    score *= item.relevance;

    // Importance score
    score += (item.importance / 100) * 0.3;

    // Query relevance (simple keyword matching)
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = item.content.toLowerCase().split(/\s+/);
    const matches = queryWords.filter((w) => contentWords.some((cw) => cw.includes(w))).length;
    score += (matches / queryWords.length) * 0.2;

    return score;
  }

  /**
   * Select items within token limit
   */
  private selectItems(
    scoredItems: Array<ContextItem & { score: number }>
  ): { included: ContextItem[]; excluded: ContextItem[] } {
    const included: ContextItem[] = [];
    const excluded: ContextItem[] = [];
    let totalTokens = 0;

    for (const item of scoredItems) {
      if (totalTokens + item.tokens <= this.maxTokens) {
        included.push(item);
        totalTokens += item.tokens;
      } else {
        excluded.push(item);
      }
    }

    return { included, excluded };
  }

  /**
   * Generate reasoning
   */
  private generateReasoning(included: ContextItem[], excluded: ContextItem[]): string {
    const reasons: string[] = [];

    const typeCount: Record<string, number> = {};
    for (const item of included) {
      typeCount[item.type] = (typeCount[item.type] || 0) + 1;
    }

    for (const [type, count] of Object.entries(typeCount)) {
      reasons.push(`${count} ${type}(s)`);
    }

    if (excluded.length > 0) {
      reasons.push(`${excluded.length} items excluded due to token limit`);
    }

    return `Selected context: ${reasons.join(", ")}`;
  }

  /**
   * Estimate tokens
   */
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Set max tokens
   */
  setMaxTokens(maxTokens: number): void {
    this.maxTokens = maxTokens;
    Logger.info("Max tokens updated", { maxTokens });
  }

  /**
   * Set priority weight
   */
  setPriorityWeight(type: string, weight: number): void {
    this.priorityWeights[type] = weight;
  }

  /**
   * Get statistics
   */
  getStatistics(): Record<string, any> {
    return {
      maxTokens: this.maxTokens,
      priorityWeights: this.priorityWeights,
    };
  }
}

export const createSmartContextBuilder = (maxTokens?: number): SmartContextBuilder => {
  return new SmartContextBuilder(maxTokens);
};
