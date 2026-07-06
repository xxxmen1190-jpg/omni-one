import { ProviderResponse, FusionResult } from "../../types";

export class ResponseFusion {
  static fuseResponses(responses: ProviderResponse[]): FusionResult {
    if (responses.length === 0) {
      return { finalResponse: "", confidenceScore: 0, rawResponses: [] };
    }

    // Filter out responses with errors and sort by confidence (descending)
    const validResponses = responses.filter(res => !res.error && res.content.trim() !== "");
    validResponses.sort((a, b) => b.confidence - a.confidence);

    if (validResponses.length === 0) {
      // If all responses had errors or were empty, return the first error or a generic message
      const firstError = responses.find(res => res.error)?.error || "No valid responses could be generated.";
      return { finalResponse: firstError, confidenceScore: 0, rawResponses: responses };
    }

    let finalResponse = "";
    let totalConfidence = 0;
    let usedResponsesCount = 0;

    // Simple fusion strategy: prioritize higher confidence responses and combine them.
    // This can be made more sophisticated with NLP techniques for summarization, redundancy removal, etc.
    for (const res of validResponses) {
      // Avoid adding duplicate content if a similar response already exists
      if (!finalResponse.includes(res.content.trim())) {
        finalResponse += (finalResponse ? "\n\n" : "") + res.content.trim();
        totalConfidence += res.confidence;
        usedResponsesCount++;
      }
    }

    const confidenceScore = usedResponsesCount > 0 ? totalConfidence / usedResponsesCount : 0;

    // If after fusion, the response is still empty, use the highest confidence valid response
    if (!finalResponse && validResponses.length > 0) {
      finalResponse = validResponses[0].content.trim();
      // If only one response was used, its confidence is the score
      if (usedResponsesCount === 0) {
        totalConfidence = validResponses[0].confidence;
        usedResponsesCount = 1;
      }
    }

    return {
      finalResponse,
      confidenceScore,
      rawResponses: responses,
    };
  }
}
