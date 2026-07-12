/**
 * Image Generation API Route — Backend
 *
 * Phase 20.6 — Final System Wiring
 *
 * Replaces frontend direct calls to OpenAI and Gemini Image Generation APIs.
 * All image generation now goes through the backend unified gateway.
 *
 * Endpoints:
 *   POST /api/images/generate   — Generate images from text
 *   POST /api/images/edit       — Edit images
 *   POST /api/images/variations — Create image variations
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";

interface GenerateImageRequest {
  prompt: string;
  model?: "dall-e-3" | "dall-e-2" | "imagen-3";
  size?: "256x256" | "512x512" | "1024x1024" | "1024x1792" | "1792x1024";
  quality?: "standard" | "hd";
  n?: number;
  provider?: "openai" | "gemini" | "auto";
}

interface EditImageRequest {
  imageBase64: string;
  maskBase64?: string;
  prompt: string;
  size?: "256x256" | "512x512" | "1024x1024";
  n?: number;
  provider?: "openai" | "auto";
}

interface VariationImageRequest {
  imageBase64: string;
  size?: "256x256" | "512x512" | "1024x1024";
  n?: number;
  provider?: "openai" | "auto";
}

interface ImageGenerationResult {
  images: Array<{ url?: string; base64?: string; revisedPrompt?: string }>;
  provider: string;
  model: string;
  durationMs: number;
}

const generateImageSchema = {
  type: "object",
  required: ["prompt"],
  properties: {
    prompt: { type: "string", maxLength: 4000 },
    model: { type: "string", enum: ["dall-e-3", "dall-e-2", "imagen-3"] },
    size: { type: "string", enum: ["256x256", "512x512", "1024x1024", "1024x1792", "1792x1024"] },
    quality: { type: "string", enum: ["standard", "hd"] },
    n: { type: "number", minimum: 1, maximum: 10 },
    provider: { type: "string", enum: ["openai", "gemini", "auto"] },
  },
} as const;

const editImageSchema = {
  type: "object",
  required: ["imageBase64", "prompt"],
  properties: {
    imageBase64: { type: "string" },
    maskBase64: { type: "string" },
    prompt: { type: "string", maxLength: 1000 },
    size: { type: "string", enum: ["256x256", "512x512", "1024x1024"] },
    n: { type: "number", minimum: 1, maximum: 10 },
    provider: { type: "string", enum: ["openai", "auto"] },
  },
} as const;

const variationImageSchema = {
  type: "object",
  required: ["imageBase64"],
  properties: {
    imageBase64: { type: "string" },
    size: { type: "string", enum: ["256x256", "512x512", "1024x1024"] },
    n: { type: "number", minimum: 1, maximum: 10 },
    provider: { type: "string", enum: ["openai", "auto"] },
  },
} as const;

export async function imageGenRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /images/generate ──────────────────────────────────────────────────
  fastify.post<{ Body: GenerateImageRequest }>(
    "/images/generate",
    { schema: { body: generateImageSchema } },
    async (request: FastifyRequest<{ Body: GenerateImageRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const startMs = Date.now();

      const { prompt, model = "dall-e-3", size = "1024x1024", quality = "standard", n = 1, provider = "auto" } = request.body;

      logger.info({ provider, model, promptLength: prompt.length }, "[ImageGenRoute] Generate request");

      try {
        const selectedProvider = provider === "auto" ? selectBestImageProvider() : provider;

        let result: ImageGenerationResult;

        switch (selectedProvider) {
          case "openai":
            result = await generateWithOpenAI(prompt, model as "dall-e-3" | "dall-e-2", size as any, quality as any, n);
            break;
          case "gemini":
            result = await generateWithGemini(prompt, size as any, n);
            break;
          default:
            throw new AppError(`Unknown image provider: ${selectedProvider}`, 400, "BAD_REQUEST");
        }

        result.durationMs = Date.now() - startMs;

        void reply.status(200).send(successResponse(result, requestId));
      } catch (error) {
        logger.error({ error }, "[ImageGenRoute] Generation failed");
        if (error instanceof AppError) {
          void reply.status(error.statusCode).send({
            success: false,
            requestId,
            error: { code: error.code, message: error.message },
          });
        } else {
          void reply.status(500).send({
            success: false,
            requestId,
            error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unknown error" },
          });
        }
      }
    }
  );

  // ── POST /images/edit ──────────────────────────────────────────────────────
  fastify.post<{ Body: EditImageRequest }>(
    "/images/edit",
    { schema: { body: editImageSchema } },
    async (request: FastifyRequest<{ Body: EditImageRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const startMs = Date.now();

      const { imageBase64, maskBase64, prompt, size = "1024x1024", n = 1, provider = "auto" } = request.body;

      logger.info({ provider }, "[ImageGenRoute] Edit request");

      try {
        const selectedProvider = provider === "auto" ? "openai" : provider;

        let result: ImageGenerationResult;

        switch (selectedProvider) {
          case "openai":
            result = await editWithOpenAI(imageBase64, maskBase64, prompt, size as any, n);
            break;
          default:
            throw new AppError(`Unknown image provider: ${selectedProvider}`, 400, "BAD_REQUEST");
        }

        result.durationMs = Date.now() - startMs;

        void reply.status(200).send(successResponse(result, requestId));
      } catch (error) {
        logger.error({ error }, "[ImageGenRoute] Edit failed");
        if (error instanceof AppError) {
          void reply.status(error.statusCode).send({
            success: false,
            requestId,
            error: { code: error.code, message: error.message },
          });
        } else {
          void reply.status(500).send({
            success: false,
            requestId,
            error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unknown error" },
          });
        }
      }
    }
  );

  // ── POST /images/variations ────────────────────────────────────────────────
  fastify.post<{ Body: VariationImageRequest }>(
    "/images/variations",
    { schema: { body: variationImageSchema } },
    async (request: FastifyRequest<{ Body: VariationImageRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const startMs = Date.now();

      const { imageBase64, size = "1024x1024", n = 1, provider = "auto" } = request.body;

      logger.info({ provider }, "[ImageGenRoute] Variations request");

      try {
        const selectedProvider = provider === "auto" ? "openai" : provider;

        let result: ImageGenerationResult;

        switch (selectedProvider) {
          case "openai":
            result = await variationsWithOpenAI(imageBase64, size as any, n);
            break;
          default:
            throw new AppError(`Unknown image provider: ${selectedProvider}`, 400, "BAD_REQUEST");
        }

        result.durationMs = Date.now() - startMs;

        void reply.status(200).send(successResponse(result, requestId));
      } catch (error) {
        logger.error({ error }, "[ImageGenRoute] Variations failed");
        if (error instanceof AppError) {
          void reply.status(error.statusCode).send({
            success: false,
            requestId,
            error: { code: error.code, message: error.message },
          });
        } else {
          void reply.status(500).send({
            success: false,
            requestId,
            error: { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Unknown error" },
          });
        }
      }
    }
  );
}

// ─── Provider implementations ─────────────────────────────────────────────────

function selectBestImageProvider(): "openai" | "gemini" {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  throw new AppError("No image provider configured", 503, "SERVICE_UNAVAILABLE");
}

async function generateWithOpenAI(
  prompt: string,
  model: "dall-e-3" | "dall-e-2",
  size: string,
  quality: string,
  n: number
): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("OpenAI API key not configured", 503, "SERVICE_UNAVAILABLE");

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality,
      n,
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`OpenAI Image Generation error: ${err}`, res.status, "PROVIDER_ERROR");
  }

  const data = (await res.json()) as any;

  return {
    images: data.data?.map((img: any) => ({
      base64: img.b64_json,
      revisedPrompt: img.revised_prompt,
    })) || [],
    provider: "openai",
    model,
    durationMs: 0,
  };
}

async function generateWithGemini(prompt: string, size: string, n: number): Promise<ImageGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError("Gemini API key not configured", 503, "SERVICE_UNAVAILABLE");

  // Gemini image generation is available through Imagen API
  // For now, fallback to OpenAI if Gemini is not available
  throw new AppError("Gemini image generation not yet implemented", 501, "NOT_IMPLEMENTED");
}

async function editWithOpenAI(
  imageBase64: string,
  maskBase64: string | undefined,
  prompt: string,
  size: string,
  n: number
): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("OpenAI API key not configured", 503, "SERVICE_UNAVAILABLE");

  const formData = new FormData();
  formData.append("image", new Blob([Buffer.from(imageBase64, "base64")], { type: "image/png" }), "image.png");
  if (maskBase64) {
    formData.append("mask", new Blob([Buffer.from(maskBase64, "base64")], { type: "image/png" }), "mask.png");
  }
  formData.append("prompt", prompt);
  formData.append("size", size);
  formData.append("n", n.toString());
  formData.append("response_format", "b64_json");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData as any,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`OpenAI Image Edit error: ${err}`, res.status, "PROVIDER_ERROR");
  }

  const data = (await res.json()) as any;

  return {
    images: data.data?.map((img: any) => ({ base64: img.b64_json })) || [],
    provider: "openai",
    model: "dall-e-2",
    durationMs: 0,
  };
}

async function variationsWithOpenAI(imageBase64: string, size: string, n: number): Promise<ImageGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("OpenAI API key not configured", 503, "SERVICE_UNAVAILABLE");

  const formData = new FormData();
  formData.append("image", new Blob([Buffer.from(imageBase64, "base64")], { type: "image/png" }), "image.png");
  formData.append("size", size);
  formData.append("n", n.toString());
  formData.append("response_format", "b64_json");

  const res = await fetch("https://api.openai.com/v1/images/variations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData as any,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`OpenAI Image Variations error: ${err}`, res.status, "PROVIDER_ERROR");
  }

  const data = (await res.json()) as any;

  return {
    images: data.data?.map((img: any) => ({ base64: img.b64_json })) || [],
    provider: "openai",
    model: "dall-e-2",
    durationMs: 0,
  };
}
