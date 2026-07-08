import { Logger } from "../system/Logger";

export interface RecoveryStrategy {
  name: string;
  description: string;
  execute: () => Promise<string>;
}

export class ErrorRecoveryLayer {
  private static readonly MAX_RETRY_ATTEMPTS = 2;
  private static readonly FALLBACK_RESPONSES = [
    "I'm having trouble processing your request right now. Could you try rephrasing it?",
    "Let me approach this differently. Could you provide more context about what you're looking for?",
    "I'm encountering some limitations with this query. Try breaking it down into smaller questions.",
    "I'm unable to fully process this right now. What specific aspect would you like to explore?"
  ];

  /**
   * Execute with automatic error recovery
   */
  static async executeWithRecovery<T>(
    operation: () => Promise<T>,
    operationName: string,
    fallbackValue?: T
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        Logger.info(`${operationName}: Attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS}`);
        return await operation();
      } catch (error: any) {
        lastError = error;
        Logger.warn(`${operationName}: Attempt ${attempt} failed`, { error: error.message });

        // Exponential backoff between retries
        if (attempt < this.MAX_RETRY_ATTEMPTS) {
          const delayMs = Math.pow(2, attempt - 1) * 100;
          await this.delay(delayMs);
        }
      }
    }

    // All retries failed
    Logger.error(`${operationName}: All ${this.MAX_RETRY_ATTEMPTS} attempts failed`, {
      lastError: lastError?.message
    });

    if (fallbackValue !== undefined) {
      return fallbackValue;
    }

    throw lastError || new Error(`${operationName} failed after ${this.MAX_RETRY_ATTEMPTS} attempts`);
  }

  /**
   * Generate a user-friendly fallback response
   */
  static generateFallbackResponse(originalQuery: string, errorContext?: string): string {
    // Select a random fallback response
    const baseResponse = this.FALLBACK_RESPONSES[
      Math.floor(Math.random() * this.FALLBACK_RESPONSES.length)
    ];

    let response = baseResponse;

    // Add context-specific guidance
    if (errorContext?.includes("timeout")) {
      response += "\n\nThe request took too long to process. Try a simpler query or enable Speed mode.";
    } else if (errorContext?.includes("network")) {
      response += "\n\nThere's a network issue. Please check your connection and try again.";
    } else if (errorContext?.includes("memory")) {
      response += "\n\nThe system is under heavy load. Try again in a moment.";
    }

    return response;
  }

  /**
   * Detect error type and suggest recovery
   */
  static classifyError(error: any): {
    type: "network" | "timeout" | "memory" | "validation" | "unknown";
    severity: "low" | "medium" | "high";
    recoverable: boolean;
  } {
    const errorMessage = error?.message?.toLowerCase() || "";
    const errorCode = error?.code?.toLowerCase() || "";

    if (errorMessage.includes("timeout") || errorCode.includes("timeout")) {
      return { type: "timeout", severity: "medium", recoverable: true };
    }

    if (
      errorMessage.includes("network") ||
      errorMessage.includes("fetch") ||
      errorCode.includes("econnrefused")
    ) {
      return { type: "network", severity: "high", recoverable: true };
    }

    if (
      errorMessage.includes("memory") ||
      errorMessage.includes("heap") ||
      errorCode.includes("oom")
    ) {
      return { type: "memory", severity: "high", recoverable: false };
    }

    if (
      errorMessage.includes("invalid") ||
      errorMessage.includes("validation") ||
      errorCode.includes("evalidation")
    ) {
      return { type: "validation", severity: "low", recoverable: true };
    }

    return { type: "unknown", severity: "medium", recoverable: true };
  }

  /**
   * Create a graceful degradation response
   */
  static createDegradedResponse(
    partialResult?: string,
    availableContext?: string
  ): string {
    let response = "";

    if (partialResult) {
      response = partialResult;
      response += "\n\n---\n";
      response += "⚠️ Note: This response may be incomplete due to processing limitations.";
    } else if (availableContext) {
      response = availableContext;
      response += "\n\n---\n";
      response += "⚠️ Note: I'm providing context from my training data, but couldn't process your full request.";
    } else {
      response = "I'm experiencing technical difficulties processing your request. ";
      response += "Please try again or rephrase your question.";
    }

    return response;
  }

  /**
   * Circuit breaker pattern for cascading failures
   */
  static async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string,
    threshold: number = 0.5, // Failure rate threshold
    timeout: number = 60000 // Circuit breaker timeout in ms
  ): Promise<T | null> {
    // In a real implementation, this would track failure rates
    // and open the circuit if too many failures occur
    
    try {
      return await Promise.race([
        operation(),
        this.createTimeout(timeout)
      ]) as T;
    } catch (error) {
      Logger.error(`Circuit breaker: ${operationName} failed`, { error });
      return null;
    }
  }

  /**
   * Helper: Create a timeout promise
   */
  private static createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms)
    );
  }

  /**
   * Helper: Delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error for monitoring and debugging
   */
  static logError(
    error: Error,
    context: {
      operation: string;
      query?: string;
      mode?: string;
      timestamp?: number;
    }
  ): void {
    Logger.error("Error Recovery", {
      error: error.message,
      stack: error.stack,
      ...context
    });
  }
}
