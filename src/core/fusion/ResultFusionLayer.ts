import { ExecutionResult } from "../brain/ParallelExecutionBrain";
import { FusionResult, ProviderResponse } from "../../types";
import { Logger } from "../system/Logger";

export class ResultFusionLayer {
  static async fuse(results: ExecutionResult[], query: string): Promise<FusionResult> {
    Logger.info("Fusing results from multiple sources", { sourceCount: results.length });

    let combinedText = "";
    let totalConfidence = 0;
    let successfulSources = 0;
    const rawResponses: ProviderResponse[] = [];

    for (const result of results) {
      if (result.success) {
        successfulSources++;
        if (result.source === "MultiModelRouter") {
          const routerResponses = result.data as ProviderResponse[];
          rawResponses.push(...routerResponses);
          combinedText += routerResponses.map(r => r.content).join("\n\n");
          totalConfidence += routerResponses.reduce((acc, r) => acc + r.confidence, 0) / routerResponses.length;
        } else if (result.source === "RAGCore") {
          combinedText += `[RAG] ${result.data.response}\n\n`;
          totalConfidence += result.data.confidence;
        } else if (result.source === "AgentManager") {
          combinedText += `[Agent] ${result.data.finalResponse}\n\n`;
          totalConfidence += result.data.confidenceScore;
        } else {
          combinedText += `[${result.source}] ${JSON.stringify(result.data)}\n\n`;
          totalConfidence += 0.8; // Default confidence for tools
        }
      }
    }

    const finalConfidence = successfulSources > 0 ? totalConfidence / successfulSources : 0;
    
    // In a real implementation, we would use an LLM to fuse these into a clean final answer.
    // For now, we return the combined text with a confidence engine summary.
    const finalResponse = successfulSources > 0 
      ? combinedText.trim() 
      : "I'm sorry, I couldn't gather enough information to answer your request.";

    const confidenceSummary = {
      score: Math.round(finalConfidence * 100),
      sourcesUsed: successfulSources,
      hasContradictions: false, // Placeholder for contradiction detection
    };

    Logger.info("Fusion completed", { confidence: confidenceSummary.score });

    return {
      finalResponse,
      confidenceScore: finalConfidence,
      rawResponses,
      metadata: {
        confidenceSummary,
        timestamp: Date.now(),
      }
    };
  }
}
