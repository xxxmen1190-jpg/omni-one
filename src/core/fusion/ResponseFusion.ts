import { ProviderResponse, FusionResult } from "../../types";
import { Logger } from "../system/Logger";

export class ResponseFusion {
  static fuseResponses(responses: ProviderResponse[]): FusionResult {
    if (responses.length === 0) {
      return { finalResponse: "No responses received.", confidenceScore: 0, rawResponses: [] };
    }

    const validResponses = responses.filter(res => !res.error && res.content.trim() !== "");
    
    if (validResponses.length === 0) {
      const errorMsg = responses.find(res => res.error)?.error || "All providers failed.";
      return { finalResponse: `Error: ${errorMsg}`, confidenceScore: 0, rawResponses: responses };
    }

    // Sort by confidence and latency (prefer faster if confidence is same)
    validResponses.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.latency - b.latency;
    });

    // 1. Quality Ranking & Best Info Selection
    // For now, we use the highest confidence response as the primary base.
    const primaryResponse = validResponses[0];
    let finalResponse = primaryResponse.content.trim();
    
    // 2. Deduplication and Integration of unique info from others
    // This is a simple semantic overlap check (placeholder for more complex NLP)
    for (let i = 1; i < validResponses.length; i++) {
      const other = validResponses[i];
      if (!this.isRedundant(finalResponse, other.content)) {
        finalResponse += "\n\n---\n\n" + other.content.trim();
      }
    }

    // 3. Confidence Score Calculation
    const avgConfidence = validResponses.reduce((sum, res) => sum + res.confidence, 0) / validResponses.length;
    const confidenceScore = Math.min(1, avgConfidence * (1 + (validResponses.length - 1) * 0.1)); // Bonus for multiple agreeing providers

    Logger.info("Response fusion completed", { 
      providerCount: validResponses.length, 
      bestProvider: primaryResponse.provider,
      confidenceScore 
    });

    return {
      finalResponse,
      confidenceScore,
      rawResponses: responses,
    };
  }

  private static isRedundant(base: string, candidate: string): boolean {
    // Simple heuristic: if 70% of candidate words are in base, it's redundant
    const baseWords = new Set(base.toLowerCase().split(/\s+/));
    const candidateWords = candidate.toLowerCase().split(/\s+/);
    let overlap = 0;
    
    for (const word of candidateWords) {
      if (baseWords.has(word)) overlap++;
    }
    
    return (overlap / candidateWords.length) > 0.7;
  }
}
