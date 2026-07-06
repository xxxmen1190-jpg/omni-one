import { FusionResult } from "../../types";
import { Logger } from "../system/Logger";

export interface QualityMetrics {
  confidenceScore: number;
  completeness: number; // 0-1
  relevance: number; // 0-1
  consistency: number; // 0-1
  isValid: boolean;
  issues: string[];
}

export class ResponseQualityFilter {
  private static readonly MIN_CONFIDENCE_THRESHOLD = 0.5;
  private static readonly MIN_COMPLETENESS_THRESHOLD = 0.6;
  private static readonly MIN_RELEVANCE_THRESHOLD = 0.5;

  /**
   * Analyze response quality and determine if it meets production standards
   */
  static analyzeQuality(result: FusionResult): QualityMetrics {
    const metrics: QualityMetrics = {
      confidenceScore: result.confidenceScore,
      completeness: this.calculateCompleteness(result),
      relevance: this.calculateRelevance(result),
      consistency: this.calculateConsistency(result),
      isValid: false,
      issues: []
    };

    // Check confidence
    if (metrics.confidenceScore < this.MIN_CONFIDENCE_THRESHOLD) {
      metrics.issues.push(`Low confidence score: ${(metrics.confidenceScore * 100).toFixed(0)}%`);
    }

    // Check completeness
    if (metrics.completeness < this.MIN_COMPLETENESS_THRESHOLD) {
      metrics.issues.push(`Incomplete response: ${(metrics.completeness * 100).toFixed(0)}%`);
    }

    // Check relevance
    if (metrics.relevance < this.MIN_RELEVANCE_THRESHOLD) {
      metrics.issues.push(`Low relevance: ${(metrics.relevance * 100).toFixed(0)}%`);
    }

    // Determine if response is valid
    metrics.isValid = metrics.issues.length === 0;

    Logger.info("Response quality analysis", {
      confidence: metrics.confidenceScore,
      completeness: metrics.completeness,
      relevance: metrics.relevance,
      consistency: metrics.consistency,
      isValid: metrics.isValid,
      issues: metrics.issues
    });

    return metrics;
  }

  /**
   * Calculate response completeness (0-1)
   */
  private static calculateCompleteness(result: FusionResult): number {
    const responseLength = result.finalResponse.length;
    const minLength = 50; // Minimum reasonable response length
    const maxLength = 5000; // Maximum reasonable response length

    if (responseLength < minLength) return 0.3;
    if (responseLength > maxLength) return 0.8;
    
    // Linear interpolation between min and max
    return 0.3 + ((responseLength - minLength) / (maxLength - minLength)) * 0.7;
  }

  /**
   * Calculate response relevance (0-1)
   */
  private static calculateRelevance(result: FusionResult): number {
    // If we have multiple responses with high confidence, relevance is higher
    const avgConfidence = result.rawResponses.reduce((sum, r) => sum + r.confidence, 0) / result.rawResponses.length;
    
    // If responses agree (low variance), relevance is higher
    const variance = this.calculateVariance(result.rawResponses.map(r => r.confidence));
    
    // Combine average confidence and agreement
    const relevance = (avgConfidence * 0.7) + ((1 - Math.min(variance, 1)) * 0.3);
    
    return Math.min(1, Math.max(0, relevance));
  }

  /**
   * Calculate response consistency (0-1)
   */
  private static calculateConsistency(result: FusionResult): number {
    if (result.rawResponses.length <= 1) return 1.0;

    // Check if responses are similar in length and structure
    const lengths = result.rawResponses.map(r => r.content.length);
    const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const lengthVariance = this.calculateVariance(lengths);
    
    // Normalize variance to 0-1 range
    const maxVariance = avgLength * 0.5; // Allow 50% variance
    const normalizedVariance = Math.min(lengthVariance / maxVariance, 1);
    
    return 1 - normalizedVariance;
  }

  /**
   * Calculate variance of a numeric array
   */
  private static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Determine if response should be re-processed
   */
  static shouldReprocess(metrics: QualityMetrics): boolean {
    // Re-process if confidence is too low or completeness is poor
    return metrics.confidenceScore < 0.6 || metrics.completeness < 0.5;
  }

  /**
   * Generate fallback response for low-quality results
   */
  static generateFallbackResponse(originalQuery: string, metrics: QualityMetrics): string {
    let fallback = "I encountered some difficulty providing a complete answer. Here's what I can tell you:\n\n";

    if (metrics.issues.length > 0) {
      fallback += `Issues encountered: ${metrics.issues.join(", ")}\n\n`;
    }

    fallback += `Regarding your question about "${originalQuery}":\n`;
    fallback += "I recommend:\n";
    fallback += "1. Breaking down your question into smaller parts\n";
    fallback += "2. Providing more context or examples\n";
    fallback += "3. Trying a more specific query\n\n";
    fallback += "Feel free to rephrase and try again, and I'll do my best to help!";

    return fallback;
  }
}
