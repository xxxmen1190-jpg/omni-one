import { QueryAnalysis } from "../../../types/knowledge";
import { Logger } from "../../system/Logger";

/**
 * Query Understanding - Analyzes user queries to determine intent and requirements
 * Decides whether RAG, memory, or reasoning is needed
 */

export class QueryUnderstanding {
  private ragKeywords: Set<string> = new Set([
    "what",
    "who",
    "where",
    "when",
    "how",
    "explain",
    "describe",
    "tell",
    "find",
    "search",
    "look",
    "information",
    "fact",
    "knowledge",
  ]);

  private reasoningKeywords: Set<string> = new Set([
    "why",
    "reason",
    "cause",
    "effect",
    "consequence",
    "result",
    "analysis",
    "analyze",
    "compare",
    "contrast",
    "evaluate",
    "assess",
    "think",
    "consider",
  ]);

  private memoryKeywords: Set<string> = new Set([
    "remember",
    "recall",
    "forget",
    "memory",
    "history",
    "past",
    "previous",
    "before",
    "earlier",
    "last",
    "previous",
    "earlier",
  ]);

  constructor() {
    Logger.info("QueryUnderstanding initialized");
  }

  /**
   * Analyze query
   */
  analyzeQuery(query: string): QueryAnalysis {
    const normalized = this.normalizeQuery(query);
    const words = normalized.toLowerCase().split(/\s+/);
    const entities = this.extractEntities(query);
    const keywords = this.extractKeywords(query);
    const complexity = this.determineComplexity(query, words);

    // Determine intent
    const intent = this.determineIntent(words);

    // Determine if RAG is needed
    const requiresRag =
      intent === "search" ||
      complexity === "complex" ||
      this.containsKeywords(words, this.ragKeywords);

    // Determine if memory is needed
    const requiresMemory = this.containsKeywords(words, this.memoryKeywords);

    // Determine if reasoning is needed
    const requiresReasoning =
      intent === "reasoning" ||
      complexity === "complex" ||
      this.containsKeywords(words, this.reasoningKeywords);

    // Calculate confidence
    const confidence = this.calculateConfidence(
      requiresRag,
      requiresMemory,
      requiresReasoning,
      complexity
    );

    const analysis: QueryAnalysis = {
      originalQuery: query,
      normalizedQuery: normalized,
      intent,
      entities,
      keywords,
      complexity,
      requiresRag,
      requiresMemory,
      requiresReasoning,
      confidence,
    };

    Logger.debug("Query analyzed", {
      query: query.substring(0, 50),
      intent,
      complexity,
      confidence: confidence.toFixed(2),
    });

    return analysis;
  }

  /**
   * Normalize query
   */
  private normalizeQuery(query: string): string {
    return query
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[^\w\s?]/g, "");
  }

  /**
   * Extract entities (simple NER)
   */
  private extractEntities(query: string): string[] {
    const entities: string[] = [];

    // Simple pattern matching for common entities
    const patterns = [
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Capitalized words
      /\b(?:the|a|an)\s+(\w+)\b/gi, // Nouns after articles
    ];

    for (const pattern of patterns) {
      const matches = query.match(pattern);
      if (matches) {
        entities.push(...matches);
      }
    }

    // Remove duplicates and limit
    return Array.from(new Set(entities)).slice(0, 5);
  }

  /**
   * Extract keywords
   */
  private extractKeywords(query: string): string[] {
    const words = query.toLowerCase().split(/\s+/);

    // Filter out stop words
    const stopWords = new Set([
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "from",
      "is",
      "are",
      "was",
      "were",
      "be",
      "have",
      "has",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "what",
      "which",
      "who",
      "when",
      "where",
      "why",
      "how",
    ]);

    return words.filter((w) => w.length > 2 && !stopWords.has(w)).slice(0, 10);
  }

  /**
   * Determine intent
   */
  private determineIntent(
    words: string[]
  ): "search" | "reasoning" | "memory" | "composition" | "unknown" {
    const firstWord = words[0]?.toLowerCase() || "";

    if (this.ragKeywords.has(firstWord)) {
      return "search";
    }

    if (this.reasoningKeywords.has(firstWord)) {
      return "reasoning";
    }

    if (this.memoryKeywords.has(firstWord)) {
      return "memory";
    }

    // Check for composition keywords
    if (
      words.some((w) => ["combine", "merge", "integrate", "compose"].includes(w))
    ) {
      return "composition";
    }

    return "unknown";
  }

  /**
   * Determine complexity
   */
  private determineComplexity(
    query: string,
    words: string[]
  ): "simple" | "moderate" | "complex" {
    let score = 0;

    // Length
    if (words.length > 20) score += 2;
    else if (words.length > 10) score += 1;

    // Punctuation (questions, multiple clauses)
    if (query.includes("?")) score += 1;
    if (query.split(",").length > 2) score += 1;
    if (query.split(";").length > 1) score += 1;

    // Complex keywords
    const complexKeywords = [
      "compare",
      "contrast",
      "analyze",
      "evaluate",
      "synthesize",
      "integrate",
      "relationship",
      "connection",
      "pattern",
    ];

    if (words.some((w) => complexKeywords.includes(w.toLowerCase()))) {
      score += 2;
    }

    // Negations
    if (query.toLowerCase().includes("not") || query.toLowerCase().includes("no")) {
      score += 1;
    }

    if (score >= 4) return "complex";
    if (score >= 2) return "moderate";
    return "simple";
  }

  /**
   * Check if words contain keywords
   */
  private containsKeywords(words: string[], keywords: Set<string>): boolean {
    return words.some((w) => keywords.has(w.toLowerCase()));
  }

  /**
   * Calculate confidence
   */
  private calculateConfidence(
    requiresRag: boolean,
    requiresMemory: boolean,
    requiresReasoning: boolean,
    complexity: string
  ): number {
    let confidence = 0.5; // Base confidence

    // Add confidence based on requirements
    if (requiresRag) confidence += 0.15;
    if (requiresMemory) confidence += 0.1;
    if (requiresReasoning) confidence += 0.15;

    // Adjust based on complexity
    if (complexity === "simple") confidence += 0.1;
    else if (complexity === "moderate") confidence += 0.05;
    else if (complexity === "complex") confidence -= 0.05;

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Should use RAG
   */
  shouldUseRag(analysis: QueryAnalysis): boolean {
    return (
      analysis.requiresRag &&
      (analysis.intent === "search" || analysis.complexity !== "simple")
    );
  }

  /**
   * Should use memory
   */
  shouldUseMemory(analysis: QueryAnalysis): boolean {
    return analysis.requiresMemory || analysis.intent === "memory";
  }

  /**
   * Should use reasoning
   */
  shouldUseReasoning(analysis: QueryAnalysis): boolean {
    return (
      analysis.requiresReasoning &&
      (analysis.intent === "reasoning" || analysis.complexity === "complex")
    );
  }

  /**
   * Get recommended strategy
   */
  getRecommendedStrategy(analysis: QueryAnalysis): string[] {
    const strategies: string[] = [];

    if (this.shouldUseRag(analysis)) {
      strategies.push("rag");
    }

    if (this.shouldUseMemory(analysis)) {
      strategies.push("memory");
    }

    if (this.shouldUseReasoning(analysis)) {
      strategies.push("reasoning");
    }

    if (strategies.length === 0) {
      strategies.push("direct");
    }

    return strategies;
  }
}

export const createQueryUnderstanding = (): QueryUnderstanding => {
  return new QueryUnderstanding();
};
