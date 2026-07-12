/**
 * Image Generation System V2 — Frontend
 *
 * Phase 20.6 — Final System Wiring
 *
 * Refactored to use Backend API instead of direct provider calls.
 * All image generation goes through: Frontend → Backend API → Providers
 *
 * Replaces: src/core/imageGen/ImageGenerationSystem.ts
 */

import { Logger } from "../system/Logger";
import { apiClient } from "../../lib/api/client";

export interface GenerateImageRequest {
  prompt: string;
  model?: "dall-e-3" | "dall-e-2" | "imagen-3";
  size?: "256x256" | "512x512" | "1024x1024" | "1024x1792" | "1792x1024";
  quality?: "standard" | "hd";
  n?: number;
  provider?: "openai" | "gemini" | "auto";
}

export interface EditImageRequest {
  imageBase64: string;
  maskBase64?: string;
  prompt: string;
  size?: "256x256" | "512x512" | "1024x1024";
  n?: number;
  provider?: "openai" | "auto";
}

export interface VariationImageRequest {
  imageBase64: string;
  size?: "256x256" | "512x512" | "1024x1024";
  n?: number;
  provider?: "openai" | "auto";
}

export interface ImageGenerationResult {
  images: Array<{ url?: string; base64?: string; revisedPrompt?: string }>;
  provider: string;
  model: string;
  durationMs: number;
}

export class ImageGenerationSystemV2 {
  /**
   * Generate images from text through the Backend API.
   * 
   * Flow: Frontend → Backend API (/images/generate) → OpenAI DALL-E or Gemini
   */
  static async generate(request: GenerateImageRequest): Promise<ImageGenerationResult> {
    Logger.info(`[ImageGenerationSystemV2] Generating images — prompt: ${request.prompt.slice(0, 50)}...`);

    try {
      const result = await apiClient.post<ImageGenerationResult>(
        "/images/generate",
        {
          prompt: request.prompt,
          model: request.model || "dall-e-3",
          size: request.size || "1024x1024",
          quality: request.quality || "standard",
          n: request.n || 1,
          provider: request.provider || "auto",
        },
        { timeoutMs: 120_000 } // 2 minute timeout for image generation
      );

      Logger.info(`[ImageGenerationSystemV2] Generation complete — provider: ${result.provider}`);
      return result;
    } catch (error) {
      Logger.error(`[ImageGenerationSystemV2] Generation failed`, { error });
      throw new Error(`Image generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Edit an image through the Backend API.
   * 
   * Flow: Frontend → Backend API (/images/edit) → OpenAI DALL-E
   */
  static async edit(request: EditImageRequest): Promise<ImageGenerationResult> {
    Logger.info(`[ImageGenerationSystemV2] Editing image`);

    try {
      const result = await apiClient.post<ImageGenerationResult>(
        "/images/edit",
        {
          imageBase64: request.imageBase64,
          maskBase64: request.maskBase64,
          prompt: request.prompt,
          size: request.size || "1024x1024",
          n: request.n || 1,
          provider: request.provider || "auto",
        },
        { timeoutMs: 120_000 } // 2 minute timeout for image editing
      );

      Logger.info(`[ImageGenerationSystemV2] Edit complete — provider: ${result.provider}`);
      return result;
    } catch (error) {
      Logger.error(`[ImageGenerationSystemV2] Edit failed`, { error });
      throw new Error(`Image edit failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Create image variations through the Backend API.
   * 
   * Flow: Frontend → Backend API (/images/variations) → OpenAI DALL-E
   */
  static async variations(request: VariationImageRequest): Promise<ImageGenerationResult> {
    Logger.info(`[ImageGenerationSystemV2] Creating image variations`);

    try {
      const result = await apiClient.post<ImageGenerationResult>(
        "/images/variations",
        {
          imageBase64: request.imageBase64,
          size: request.size || "1024x1024",
          n: request.n || 1,
          provider: request.provider || "auto",
        },
        { timeoutMs: 120_000 } // 2 minute timeout for image variations
      );

      Logger.info(`[ImageGenerationSystemV2] Variations complete — provider: ${result.provider}`);
      return result;
    } catch (error) {
      Logger.error(`[ImageGenerationSystemV2] Variations failed`, { error });
      throw new Error(`Image variations failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

// Export as default for backward compatibility
export default ImageGenerationSystemV2;
