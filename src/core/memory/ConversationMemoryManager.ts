import { Message } from "../../types";
import { Logger } from "../system/Logger";

export interface ConversationContext {
  summary: string;
  keyTopics: string[];
  recentMessages: Message[];
  contextWindow: number; // Number of messages to keep in context
  lastUpdated: number;
}

export class ConversationMemoryManager {
  private static readonly DEFAULT_CONTEXT_WINDOW = 10;
  private static readonly MAX_CONTEXT_LENGTH = 4000; // Characters

  /**
   * Build conversation context from message history
   */
  static buildContext(messages: Message[]): ConversationContext {
    const recentMessages = messages.slice(-this.DEFAULT_CONTEXT_WINDOW);
    const keyTopics = this.extractKeyTopics(messages);
    const summary = this.generateSummary(recentMessages);

    return {
      summary,
      keyTopics,
      recentMessages,
      contextWindow: this.DEFAULT_CONTEXT_WINDOW,
      lastUpdated: Date.now()
    };
  }

  /**
   * Extract key topics from conversation
   */
  private static extractKeyTopics(messages: Message[]): string[] {
    const topics: Set<string> = new Set();

    // Simple topic extraction: look for common patterns
    const topicPatterns = [
      /about\s+([a-z\s]+)/gi,
      /discuss(?:ing)?\s+([a-z\s]+)/gi,
      /regarding\s+([a-z\s]+)/gi,
      /concerning\s+([a-z\s]+)/gi,
      /related to\s+([a-z\s]+)/gi
    ];

    for (const message of messages) {
      for (const pattern of topicPatterns) {
        let match;
        while ((match = pattern.exec(message.content)) !== null) {
          const topic = match[1]?.trim().toLowerCase();
          if (topic && topic.length > 2) {
            topics.add(topic);
          }
        }
      }
    }

    return Array.from(topics).slice(0, 5); // Return top 5 topics
  }

  /**
   * Generate summary of conversation
   */
  private static generateSummary(messages: Message[]): string {
    if (messages.length === 0) return "";

    // Create a simple summary by combining key user messages
    const userMessages = messages
      .filter(m => m.role === "user")
      .map(m => m.content.substring(0, 100))
      .join(" | ");

    return userMessages.substring(0, 200);
  }

  /**
   * Check if a new message is a continuation of previous context
   */
  static isContinuation(
    newMessage: string,
    context: ConversationContext
  ): boolean {
    const continuationIndicators = [
      /^(and|also|furthermore|additionally|moreover|besides)/i,
      /^(what about|how about|what if)/i,
      /^(can you|could you|would you|will you)/i,
      /^(tell me more|explain further|elaborate)/i,
      /^(same thing|same topic|same question)/i,
      /^(as mentioned|as discussed|as we talked about)/i
    ];

    // Check if message starts with continuation indicators
    const hasContinuationStart = continuationIndicators.some(pattern =>
      pattern.test(newMessage)
    );

    // Check if message references previous topics
    const hasPreviousTopic = context.keyTopics.some(topic =>
      newMessage.toLowerCase().includes(topic)
    );

    return hasContinuationStart || hasPreviousTopic;
  }

  /**
   * Maintain conversation continuity by injecting context
   */
  static injectContextIntoQuery(
    query: string,
    context: ConversationContext
  ): string {
    if (context.keyTopics.length === 0) {
      return query;
    }

    // If query is short and appears to be a continuation, inject context
    if (query.length < 50 && this.isContinuation(query, context)) {
      const contextPrefix = `[Context: We were discussing ${context.keyTopics.join(", ")}] `;
      return contextPrefix + query;
    }

    return query;
  }

  /**
   * Track conversation state for better understanding
   */
  static getConversationState(messages: Message[]): {
    messageCount: number;
    userTurns: number;
    averageMessageLength: number;
    conversationDuration: number; // in seconds
    isActive: boolean;
  } {
    const userMessages = messages.filter(m => m.role === "user");
    const assistantMessages = messages.filter(m => m.role === "assistant");

    const totalLength = messages.reduce((sum, m) => sum + m.content.length, 0);
    const avgLength = messages.length > 0 ? totalLength / messages.length : 0;

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];
    const duration = firstMessage && lastMessage 
      ? (lastMessage.timestamp - firstMessage.timestamp) / 1000 
      : 0;

    // Consider conversation active if last message is within 5 minutes
    const isActive = lastMessage 
      ? (Date.now() - lastMessage.timestamp) < 5 * 60 * 1000 
      : false;

    return {
      messageCount: messages.length,
      userTurns: userMessages.length,
      averageMessageLength: Math.round(avgLength),
      conversationDuration: Math.round(duration),
      isActive
    };
  }

  /**
   * Compress old conversation history to save memory
   */
  static compressHistory(messages: Message[], maxMessages: number = 50): Message[] {
    if (messages.length <= maxMessages) {
      return messages;
    }

    // Keep first message (context), last N messages, and sample middle messages
    const compressed: Message[] = [];

    // Always keep first message
    if (messages.length > 0) {
      compressed.push(messages[0]);
    }

    // Sample middle messages
    const middleStart = 1;
    const middleEnd = messages.length - maxMessages + 1;
    const sampleRate = Math.max(1, Math.floor((middleEnd - middleStart) / 5));

    for (let i = middleStart; i < middleEnd; i += sampleRate) {
      compressed.push(messages[i]);
    }

    // Keep last N messages
    compressed.push(...messages.slice(-maxMessages + 1));

    Logger.info("Conversation history compressed", {
      originalLength: messages.length,
      compressedLength: compressed.length
    });

    return compressed;
  }

  /**
   * Detect conversation topic shifts
   */
  static detectTopicShift(
    newMessage: string,
    context: ConversationContext
  ): boolean {
    // If new message doesn't reference any previous topics, it's likely a shift
    const hasReferenceToPreviousTopic = context.keyTopics.some(topic =>
      newMessage.toLowerCase().includes(topic)
    );

    // Also check for explicit topic shift indicators
    const topicShiftIndicators = [
      /^(by the way|anyway|speaking of|let's talk about)/i,
      /^(different topic|new question|something else)/i,
      /^(now|next|then|after that)/i
    ];

    const hasShiftIndicator = topicShiftIndicators.some(pattern =>
      pattern.test(newMessage)
    );

    return !hasReferenceToPreviousTopic && hasShiftIndicator;
  }
}
