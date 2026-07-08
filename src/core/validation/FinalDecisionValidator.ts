import { FusionResult } from "../../types";
import { Logger } from "../system/Logger";

export interface ValidationResult {
  isValid: boolean;
  score: number; // 0-1
  issues: string[];
  suggestions: string[];
  shouldRetry: boolean;
}

export class FinalDecisionValidator {
  /**
   * Final validation pass before showing response to user
   */
  static validate(result: FusionResult, originalQuery: string): ValidationResult {
    const validation: ValidationResult = {
      isValid: true,
      score: 1.0,
      issues: [],
      suggestions: [],
      shouldRetry: false
    };

    // 1. Check if response is empty
    if (!result.finalResponse || result.finalResponse.trim().length === 0) {
      validation.issues.push("Response is empty");
      validation.isValid = false;
      validation.score -= 0.3;
    }

    // 2. Check for error indicators
    if (this.hasErrorIndicators(result.finalResponse)) {
      validation.issues.push("Response contains error indicators");
      validation.isValid = false;
      validation.score -= 0.2;
    }

    // 3. Check for incomplete responses
    if (this.isIncomplete(result.finalResponse)) {
      validation.issues.push("Response appears incomplete");
      validation.suggestions.push("Consider re-running with higher depth");
      validation.score -= 0.15;
    }

    // 4. Check for contradictions
    const contradictions = this.findContradictions(result.finalResponse);
    if (contradictions.length > 0) {
      validation.issues.push(`Found ${contradictions.length} potential contradictions`);
      validation.suggestions.push("Review the response for consistency");
      validation.score -= 0.25;
    }

    // 5. Check confidence score
    if (result.confidenceScore < 0.5) {
      validation.issues.push("Low confidence score");
      validation.suggestions.push("Consider enabling Pro Mode to see reasoning");
      validation.score -= 0.1;
      validation.shouldRetry = true;
    }

    // 6. Check response relevance to query
    if (!this.isRelevantToQuery(result.finalResponse, originalQuery)) {
      validation.issues.push("Response may not be relevant to the query");
      validation.suggestions.push("Rephrase your question for better results");
      validation.score -= 0.2;
    }

    // 7. Ensure minimum quality threshold
    if (validation.score < 0.4) {
      validation.shouldRetry = true;
    }

    // Normalize score to 0-1 range
    validation.score = Math.max(0, Math.min(1, validation.score));

    Logger.info("Final decision validation", {
      isValid: validation.isValid,
      score: validation.score,
      issues: validation.issues,
      shouldRetry: validation.shouldRetry
    });

    return validation;
  }

  /**
   * Check for common error indicators in response
   */
  private static hasErrorIndicators(response: string): boolean {
    const errorPatterns = [
      /^error:/i,           // Starts with "error:" (likely a raw error message)
      /failed to complete/i,
      /unable to process/i,
      /unhandled exception/i,
      /cannot process your request/i,
      /something went wrong/i
    ];

    return errorPatterns.some(pattern => pattern.test(response));
  }

  /**
   * Check if response appears incomplete
   */
  private static isIncomplete(response: string): boolean {
    // Check for incomplete sentences or truncation
    const incompletePatterns = [
      /\.\.\.$/, // Ends with ellipsis
      /\s+$/,     // Ends with whitespace
      /^[^.!?]*$/, // No ending punctuation
      /^.{0,20}$/ // Very short response
    ];

    return incompletePatterns.some(pattern => pattern.test(response.trim()));
  }

  /**
   * Find potential contradictions in response
   */
  private static findContradictions(response: string): string[] {
    const contradictions: string[] = [];
    
    // Look for common contradiction patterns
    const lines = response.split('\n');
    
    for (let i = 0; i < lines.length - 1; i++) {
      const current = lines[i].toLowerCase();
      const next = lines[i + 1].toLowerCase();
      
      // Check for "yes/no" contradictions
      if ((current.includes('yes') && next.includes('no')) ||
          (current.includes('true') && next.includes('false'))) {
        contradictions.push(`Lines ${i + 1}-${i + 2}: Potential yes/no contradiction`);
      }
      
      // Check for "always/never" contradictions
      if ((current.includes('always') && next.includes('never')) ||
          (current.includes('never') && next.includes('always'))) {
        contradictions.push(`Lines ${i + 1}-${i + 2}: Potential always/never contradiction`);
      }
    }
    
    return contradictions;
  }

  /**
   * Check if response is relevant to the original query
   */
  private static isRelevantToQuery(response: string, query: string): boolean {
    // Extract key words from query
    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3); // Only significant words
    
    const responseText = response.toLowerCase();
    
    // Check if at least 30% of key query words appear in response
    const matchCount = queryWords.filter(word => responseText.includes(word)).length;
    const matchRatio = matchCount / Math.max(queryWords.length, 1);
    
    return matchRatio >= 0.3;
  }

  /**
   * Generate validation report
   */
  static generateReport(validation: ValidationResult): string {
    let report = `Validation Score: ${(validation.score * 100).toFixed(0)}%\n`;
    
    if (validation.issues.length > 0) {
      report += `\nIssues:\n${validation.issues.map(i => `• ${i}`).join('\n')}\n`;
    }
    
    if (validation.suggestions.length > 0) {
      report += `\nSuggestions:\n${validation.suggestions.map(s => `• ${s}`).join('\n')}\n`;
    }
    
    return report;
  }
}
