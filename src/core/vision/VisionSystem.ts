/**
 * Phase 14.2 — Vision System
 * Real vision analysis using GPT-4 Vision, Gemini Vision, Claude Vision.
 * Auto-selects provider based on ProviderSelector.
 */

import { Logger } from "../system/Logger";
// Phase 14: Read API keys from environment (Vite env vars)
function getAPIKeys() {
  return {
    openai: (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_OPENAI_API_KEY : "") || "",
    anthropic: (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_ANTHROPIC_API_KEY : "") || "",
    gemini: (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_GEMINI_API_KEY : "") || "",
    google: (typeof import.meta !== "undefined" ? (import.meta as any).env?.VITE_GEMINI_API_KEY : "") || "",
  };
}

export type VisionOperation =
  | "analyze"
  | "ocr"
  | "describe"
  | "detect_objects"
  | "detect_text"
  | "compare"
  | "qa";

export interface VisionRequest {
  operation: VisionOperation;
  imageBase64?: string;
  imageUrl?: string;
  imageBase64B?: string; // for compare
  imageUrlB?: string;    // for compare
  question?: string;
  language?: string;
}

export interface VisionResult {
  operation: VisionOperation;
  result: string;
  provider: string;
  confidence?: number;
  objects?: Array<{ label: string; confidence: number }>;
  texts?: string[];
  metadata?: Record<string, any>;
}

export class VisionSystem {
  /**
   * Run vision analysis using the best available provider.
   */
  static async analyze(request: VisionRequest): Promise<VisionResult> {
    Logger.info(`[VisionSystem] Running ${request.operation}`);

    // Try providers in order of preference
    const providers = this.getAvailableProviders();

    for (const provider of providers) {
      try {
        const result = await this.runWithProvider(provider, request);
        return result;
      } catch (error) {
        Logger.warn(`[VisionSystem] Provider ${provider} failed`, { error });
        continue;
      }
    }

    throw new Error("No vision provider available. Please configure an API key for OpenAI, Anthropic, or Google Gemini.");
  }

  private static getAvailableProviders(): string[] {
    const providers: string[] = [];
    const keys = getAPIKeys();

    if (keys.openai) providers.push("openai");
    if (keys.anthropic) providers.push("anthropic");
    if (keys.gemini || keys.google) providers.push("gemini");

    // Default order: OpenAI > Anthropic > Gemini
    return providers.length > 0 ? providers : ["openai"];
  }

  private static async runWithProvider(
    provider: string,
    request: VisionRequest
  ): Promise<VisionResult> {
    switch (provider) {
      case "openai":
        return this.runOpenAIVision(request);
      case "anthropic":
        return this.runAnthropicVision(request);
      case "gemini":
        return this.runGeminiVision(request);
      default:
        return this.runOpenAIVision(request);
    }
  }

  private static buildVisionPrompt(request: VisionRequest): string {
    switch (request.operation) {
      case "analyze":
        return "Analyze this image in detail. Describe what you see, including objects, people, text, colors, composition, and any notable features.";
      case "ocr":
        return "Extract ALL text from this image. Return only the extracted text, preserving formatting as much as possible.";
      case "describe":
        return "Provide a clear, concise description of this image suitable for someone who cannot see it.";
      case "detect_objects":
        return "List all objects you can identify in this image. For each object, provide its name and approximate location in the image.";
      case "detect_text":
        return "Identify and extract all text visible in this image, including signs, labels, captions, and any written content.";
      case "compare":
        return "Compare these two images. Describe the similarities and differences between them.";
      case "qa":
        return request.question || "What do you see in this image?";
      default:
        return "Describe this image.";
    }
  }

  private static async runOpenAIVision(request: VisionRequest): Promise<VisionResult> {
    const keys = getAPIKeys();
    const apiKey = keys.openai;
    if (!apiKey) throw new Error("OpenAI API key not configured");

    const prompt = this.buildVisionPrompt(request);
    const content: any[] = [{ type: "text", text: prompt }];

    // Add primary image
    if (request.imageBase64) {
      const mimeType = this.detectMimeType(request.imageBase64);
      content.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${request.imageBase64}`, detail: "high" },
      });
    } else if (request.imageUrl) {
      content.push({
        type: "image_url",
        image_url: { url: request.imageUrl, detail: "high" },
      });
    }

    // Add secondary image for compare
    if (request.operation === "compare") {
      if (request.imageBase64B) {
        const mimeType = this.detectMimeType(request.imageBase64B);
        content.push({
          type: "image_url",
          image_url: { url: `data:${mimeType};base64,${request.imageBase64B}`, detail: "high" },
        });
      } else if (request.imageUrlB) {
        content.push({
          type: "image_url",
          image_url: { url: request.imageUrlB, detail: "high" },
        });
      }
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content }],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI Vision error: ${err}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || "";

    return {
      operation: request.operation,
      result,
      provider: "openai/gpt-4o",
    };
  }

  private static async runAnthropicVision(request: VisionRequest): Promise<VisionResult> {
    const keys = getAPIKeys();
    const apiKey = keys.anthropic;
    if (!apiKey) throw new Error("Anthropic API key not configured");

    const prompt = this.buildVisionPrompt(request);
    const content: any[] = [];

    // Add primary image
    if (request.imageBase64) {
      const mimeType = this.detectMimeType(request.imageBase64) as any;
      content.push({
        type: "image",
        source: { type: "base64", media_type: mimeType, data: request.imageBase64 },
      });
    } else if (request.imageUrl) {
      content.push({
        type: "image",
        source: { type: "url", url: request.imageUrl },
      });
    }

    // Add secondary image for compare
    if (request.operation === "compare") {
      if (request.imageBase64B) {
        const mimeType = this.detectMimeType(request.imageBase64B) as any;
        content.push({
          type: "image",
          source: { type: "base64", media_type: mimeType, data: request.imageBase64B },
        });
      }
    }

    content.push({ type: "text", text: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 2048,
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic Vision error: ${err}`);
    }

    const data = await response.json();
    const result = data.content?.[0]?.text || "";

    return {
      operation: request.operation,
      result,
      provider: "anthropic/claude-3-5-sonnet",
    };
  }

  private static async runGeminiVision(request: VisionRequest): Promise<VisionResult> {
    const keys = getAPIKeys();
    const apiKey = keys.gemini || keys.google;
    if (!apiKey) throw new Error("Gemini API key not configured");

    const prompt = this.buildVisionPrompt(request);
    const parts: any[] = [{ text: prompt }];

    if (request.imageBase64) {
      const mimeType = this.detectMimeType(request.imageBase64);
      parts.push({
        inlineData: { mimeType, data: request.imageBase64 },
      });
    } else if (request.imageUrl) {
      // Gemini supports URL via fileData
      parts.push({
        fileData: { mimeType: "image/jpeg", fileUri: request.imageUrl },
      });
    }

    if (request.operation === "compare" && request.imageBase64B) {
      const mimeType = this.detectMimeType(request.imageBase64B);
      parts.push({
        inlineData: { mimeType, data: request.imageBase64B },
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { maxOutputTokens: 2048 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini Vision error: ${err}`);
    }

    const data = await response.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return {
      operation: request.operation,
      result,
      provider: "google/gemini-1.5-pro",
    };
  }

  private static detectMimeType(base64: string): string {
    // Detect from base64 magic bytes
    if (base64.startsWith("/9j/")) return "image/jpeg";
    if (base64.startsWith("iVBOR")) return "image/png";
    if (base64.startsWith("R0lGO")) return "image/gif";
    if (base64.startsWith("UklGR")) return "image/webp";
    return "image/jpeg"; // default
  }

  /**
   * Quick OCR helper.
   */
  static async ocr(imageBase64: string): Promise<string> {
    const result = await this.analyze({ operation: "ocr", imageBase64 });
    return result.result;
  }

  /**
   * Quick describe helper.
   */
  static async describe(imageBase64: string): Promise<string> {
    const result = await this.analyze({ operation: "describe", imageBase64 });
    return result.result;
  }

  /**
   * Image Q&A helper.
   */
  static async qa(imageBase64: string, question: string): Promise<string> {
    const result = await this.analyze({ operation: "qa", imageBase64, question });
    return result.result;
  }
}
