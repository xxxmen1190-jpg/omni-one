/**
 * Vision System V2 — Frontend
 *
 * Phase 20.6 — Final System Wiring
 *
 * Refactored to use Backend API instead of direct provider calls.
 * All vision analysis goes through: Frontend → Backend API → Providers
 *
 * Replaces: src/core/vision/VisionSystem.ts
 */

import { Logger } from "../system/Logger";
import { apiClient } from "../../lib/api/client";

export type VisionOperation = "analyze" | "ocr" | "describe" | "detect_objects" | "detect_text" | "compare" | "qa";

export interface VisionRequest {
  operation: VisionOperation;
  imageBase64?: string;
  imageUrl?: string;
  imageBase64B?: string; // for compare
  imageUrlB?: string;    // for compare
  question?: string;
  language?: string;
  provider?: "openai" | "anthropic" | "gemini" | "auto";
}

export interface VisionResult {
  operation: VisionOperation;
  result: string;
  provider: string;
  confidence?: number;
  objects?: Array<{ label: string; confidence: number }>;
  texts?: string[];
  metadata?: Record<string, any>;
  durationMs: number;
}

export class VisionSystemV2 {
  /**
   * Run vision analysis through the Backend API.
   * 
   * Flow: Frontend → Backend API (/vision/analyze) → Provider (OpenAI/Anthropic/Gemini)
   */
  static async analyze(request: VisionRequest): Promise<VisionResult> {
    Logger.info(`[VisionSystemV2] Running ${request.operation}`);

    try {
      const result = await apiClient.post<VisionResult>(
        "/vision/analyze",
        {
          operation: request.operation,
          imageBase64: request.imageBase64,
          imageUrl: request.imageUrl,
          imageBase64B: request.imageBase64B,
          imageUrlB: request.imageUrlB,
          question: request.question,
          language: request.language,
          provider: request.provider || "auto",
        },
        { timeoutMs: 60_000 } // 1 minute timeout for vision analysis
      );

      Logger.info(`[VisionSystemV2] Analysis complete — provider: ${result.provider}`);
      return result;
    } catch (error) {
      Logger.error(`[VisionSystemV2] Analysis failed`, { error });
      throw new Error(`Vision analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

// Export as default for backward compatibility
export default VisionSystemV2;
