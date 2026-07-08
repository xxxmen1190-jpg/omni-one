/**
 * Phase 14.3 — Image Generation System
 * DALL-E, Gemini Image generation with edit, variations, and HD support.
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

export type ImageProvider = "dalle" | "gemini" | "auto";
export type ImageSize = "256x256" | "512x512" | "1024x1024" | "1024x1792" | "1792x1024";
export type ImageQuality = "standard" | "hd";
export type ImageStyle = "vivid" | "natural";

export interface ImageGenerationRequest {
  prompt: string;
  provider?: ImageProvider;
  size?: ImageSize;
  quality?: ImageQuality;
  style?: ImageStyle;
  n?: number;
  model?: string;
}

export interface ImageEditRequest {
  prompt: string;
  imageBase64: string;
  maskBase64?: string;
  size?: ImageSize;
}

export interface ImageVariationRequest {
  imageBase64: string;
  n?: number;
  size?: ImageSize;
}

export interface GeneratedImage {
  url?: string;
  base64?: string;
  revisedPrompt?: string;
  provider: string;
  model: string;
  timestamp: number;
}

export interface ImageGenerationResult {
  images: GeneratedImage[];
  provider: string;
  model: string;
  prompt: string;
  timestamp: number;
}

export class ImageGenerationSystem {
  /**
   * Generate images from a text prompt.
   */
  static async generate(request: ImageGenerationRequest): Promise<ImageGenerationResult> {
    Logger.info(`[ImageGen] Generating image: "${request.prompt.slice(0, 50)}..."`);

    const provider = request.provider === "auto" || !request.provider
      ? this.selectProvider()
      : request.provider;

    switch (provider) {
      case "dalle":
        return this.generateWithDALLE(request);
      case "gemini":
        return this.generateWithGemini(request);
      default:
        return this.generateWithDALLE(request);
    }
  }

  /**
   * Edit an existing image with a prompt.
   */
  static async edit(request: ImageEditRequest): Promise<ImageGenerationResult> {
    Logger.info(`[ImageGen] Editing image with prompt: "${request.prompt.slice(0, 50)}..."`);
    return this.editWithDALLE(request);
  }

  /**
   * Generate variations of an existing image.
   */
  static async variations(request: ImageVariationRequest): Promise<ImageGenerationResult> {
    Logger.info(`[ImageGen] Generating ${request.n || 1} variation(s)`);
    return this.variationsWithDALLE(request);
  }

  private static selectProvider(): ImageProvider {
    const keys = getAPIKeys();
    if (keys.openai) return "dalle";
    if (keys.gemini || keys.google) return "gemini";
    return "dalle";
  }

  private static async generateWithDALLE(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    const keys = getAPIKeys();
    const apiKey = keys.openai;
    if (!apiKey) throw new Error("OpenAI API key not configured");

    const model = request.model || (request.quality === "hd" ? "dall-e-3" : "dall-e-3");
    const size = request.size || "1024x1024";
    const quality = request.quality || "standard";
    const style = request.style || "vivid";
    const n = request.n || 1;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        n: model === "dall-e-3" ? 1 : n, // DALL-E 3 only supports n=1
        size,
        quality,
        style,
        response_format: "url",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DALL-E generation error: ${err}`);
    }

    const data = await response.json();
    const images: GeneratedImage[] = (data.data || []).map((item: any) => ({
      url: item.url,
      revisedPrompt: item.revised_prompt,
      provider: "openai",
      model,
      timestamp: Date.now(),
    }));

    return {
      images,
      provider: "openai",
      model,
      prompt: request.prompt,
      timestamp: Date.now(),
    };
  }

  private static async generateWithGemini(
    request: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    const keys = getAPIKeys();
    const apiKey = keys.gemini || keys.google;
    if (!apiKey) throw new Error("Gemini API key not configured");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instances: [{ prompt: request.prompt }],
          parameters: {
            sampleCount: request.n || 1,
            aspectRatio: "1:1",
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini image generation error: ${err}`);
    }

    const data = await response.json();
    const images: GeneratedImage[] = (data.predictions || []).map((pred: any) => ({
      base64: pred.bytesBase64Encoded,
      provider: "google",
      model: "imagen-3",
      timestamp: Date.now(),
    }));

    return {
      images,
      provider: "google",
      model: "imagen-3",
      prompt: request.prompt,
      timestamp: Date.now(),
    };
  }

  private static async editWithDALLE(request: ImageEditRequest): Promise<ImageGenerationResult> {
    const keys = getAPIKeys();
    const apiKey = keys.openai;
    if (!apiKey) throw new Error("OpenAI API key not configured");

    // Convert base64 to Blob for FormData
    const imageBlob = this.base64ToBlob(request.imageBase64, "image/png");
    const formData = new FormData();
    formData.append("image", imageBlob, "image.png");
    formData.append("prompt", request.prompt);
    formData.append("model", "dall-e-2");
    formData.append("n", "1");
    formData.append("size", request.size || "1024x1024");
    formData.append("response_format", "url");

    if (request.maskBase64) {
      const maskBlob = this.base64ToBlob(request.maskBase64, "image/png");
      formData.append("mask", maskBlob, "mask.png");
    }

    const response = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DALL-E edit error: ${err}`);
    }

    const data = await response.json();
    const images: GeneratedImage[] = (data.data || []).map((item: any) => ({
      url: item.url,
      provider: "openai",
      model: "dall-e-2",
      timestamp: Date.now(),
    }));

    return {
      images,
      provider: "openai",
      model: "dall-e-2",
      prompt: request.prompt,
      timestamp: Date.now(),
    };
  }

  private static async variationsWithDALLE(
    request: ImageVariationRequest
  ): Promise<ImageGenerationResult> {
    const keys = getAPIKeys();
    const apiKey = keys.openai;
    if (!apiKey) throw new Error("OpenAI API key not configured");

    const imageBlob = this.base64ToBlob(request.imageBase64, "image/png");
    const formData = new FormData();
    formData.append("image", imageBlob, "image.png");
    formData.append("model", "dall-e-2");
    formData.append("n", String(request.n || 1));
    formData.append("size", request.size || "1024x1024");
    formData.append("response_format", "url");

    const response = await fetch("https://api.openai.com/v1/images/variations", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`DALL-E variations error: ${err}`);
    }

    const data = await response.json();
    const images: GeneratedImage[] = (data.data || []).map((item: any) => ({
      url: item.url,
      provider: "openai",
      model: "dall-e-2",
      timestamp: Date.now(),
    }));

    return {
      images,
      provider: "openai",
      model: "dall-e-2",
      prompt: "variation",
      timestamp: Date.now(),
    };
  }

  private static base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteArrays: Uint8Array[] = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays as unknown as BlobPart[], { type: mimeType });
  }
}
