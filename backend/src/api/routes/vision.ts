/**
 * Vision API Route — Backend
 *
 * Phase 20.6 — Final System Wiring
 *
 * Replaces frontend direct calls to OpenAI, Anthropic, Gemini Vision APIs.
 * All vision analysis now goes through the backend unified gateway.
 *
 * Endpoints:
 *   POST /api/vision/analyze   — Analyze images (OCR, object detection, description, etc.)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";

interface VisionRequest {
  operation: "analyze" | "ocr" | "describe" | "detect_objects" | "detect_text" | "compare" | "qa";
  imageBase64?: string;
  imageUrl?: string;
  imageBase64B?: string; // for compare
  imageUrlB?: string;    // for compare
  question?: string;
  language?: string;
  provider?: "openai" | "anthropic" | "gemini" | "auto";
}

interface VisionResult {
  operation: string;
  result: string;
  provider: string;
  confidence?: number;
  objects?: Array<{ label: string; confidence: number }>;
  texts?: string[];
  metadata?: Record<string, any>;
  durationMs: number;
}

const visionBodySchema = {
  type: "object",
  required: ["operation"],
  properties: {
    operation: { type: "string", enum: ["analyze", "ocr", "describe", "detect_objects", "detect_text", "compare", "qa"] },
    imageBase64: { type: "string" },
    imageUrl: { type: "string" },
    imageBase64B: { type: "string" },
    imageUrlB: { type: "string" },
    question: { type: "string" },
    language: { type: "string" },
    provider: { type: "string", enum: ["openai", "anthropic", "gemini", "auto"] },
  },
} as const;

export async function visionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: VisionRequest }>(
    "/vision/analyze",
    { schema: { body: visionBodySchema } },
    async (request: FastifyRequest<{ Body: VisionRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const startMs = Date.now();

      const { operation, imageBase64, imageUrl, imageBase64B, imageUrlB, question, language, provider = "auto" } = request.body;

      logger.info({ operation, provider }, "[VisionRoute] Analyze request");

      try {
        // Determine which provider to use
        const selectedProvider = provider === "auto" ? selectBestProvider() : provider;

        let result: VisionResult;

        switch (selectedProvider) {
          case "openai":
            result = await analyzeWithOpenAI(operation, imageBase64, imageUrl, imageBase64B, imageUrlB, question, language);
            break;
          case "anthropic":
            result = await analyzeWithAnthropic(operation, imageBase64, imageUrl, imageBase64B, imageUrlB, question, language);
            break;
          case "gemini":
            result = await analyzeWithGemini(operation, imageBase64, imageUrl, imageBase64B, imageUrlB, question, language);
            break;
          default:
            throw new AppError(`Unknown vision provider: ${selectedProvider}`, 400, "BAD_REQUEST");
        }

        result.durationMs = Date.now() - startMs;

        void reply.status(200).send(successResponse(result, requestId));
      } catch (error) {
        logger.error({ error }, "[VisionRoute] Analysis failed");
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

function selectBestProvider(): "openai" | "anthropic" | "gemini" {
  // Priority: OpenAI > Anthropic > Gemini
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  throw new AppError("No vision provider configured", 503, "SERVICE_UNAVAILABLE");
}

async function analyzeWithOpenAI(
  operation: string,
  imageBase64?: string,
  imageUrl?: string,
  imageBase64B?: string,
  imageUrlB?: string,
  question?: string,
  language?: string
): Promise<VisionResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("OpenAI API key not configured", 503, "SERVICE_UNAVAILABLE");

  const prompt = buildVisionPrompt(operation, question, language);
  const content: any[] = [{ type: "text", text: prompt }];

  // Add primary image
  if (imageBase64) {
    const mimeType = detectMimeType(imageBase64);
    content.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" },
    });
  } else if (imageUrl) {
    content.push({
      type: "image_url",
      image_url: { url: imageUrl, detail: "high" },
    });
  }

  // Add secondary image for compare
  if (operation === "compare") {
    if (imageBase64B) {
      const mimeType = detectMimeType(imageBase64B);
      content.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${imageBase64B}`, detail: "high" },
      });
    } else if (imageUrlB) {
      content.push({
        type: "image_url",
        image_url: { url: imageUrlB, detail: "high" },
      });
    }
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content }],
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`OpenAI Vision error: ${err}`, res.status, "PROVIDER_ERROR");
  }

  const data = (await res.json()) as any;
  const result = data.choices?.[0]?.message?.content || "";

  return {
    operation,
    result,
    provider: "openai/gpt-4o",
  };
}

async function analyzeWithAnthropic(
  operation: string,
  imageBase64?: string,
  imageUrl?: string,
  imageBase64B?: string,
  imageUrlB?: string,
  question?: string,
  language?: string
): Promise<VisionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AppError("Anthropic API key not configured", 503, "SERVICE_UNAVAILABLE");

  const prompt = buildVisionPrompt(operation, question, language);
  const content: any[] = [];

  // Add primary image
  if (imageBase64) {
    const mimeType = detectMimeType(imageBase64) as any;
    content.push({
      type: "image",
      source: { type: "base64", media_type: mimeType, data: imageBase64 },
    });
  } else if (imageUrl) {
    content.push({
      type: "image",
      source: { type: "url", url: imageUrl },
    });
  }

  // Add secondary image for compare
  if (operation === "compare") {
    if (imageBase64B) {
      const mimeType = detectMimeType(imageBase64B) as any;
      content.push({
        type: "image",
        source: { type: "base64", media_type: mimeType, data: imageBase64B },
      });
    } else if (imageUrlB) {
      content.push({
        type: "image",
        source: { type: "url", url: imageUrlB },
      });
    }
  }

  content.push({ type: "text", text: prompt });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
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

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`Anthropic Vision error: ${err}`, res.status, "PROVIDER_ERROR");
  }

  const data = (await res.json()) as any;
  const result = data.content?.[0]?.text || "";

  return {
    operation,
    result,
    provider: "anthropic/claude-3-5-sonnet",
  };
}

async function analyzeWithGemini(
  operation: string,
  imageBase64?: string,
  imageUrl?: string,
  imageBase64B?: string,
  imageUrlB?: string,
  question?: string,
  language?: string
): Promise<VisionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError("Gemini API key not configured", 503, "SERVICE_UNAVAILABLE");

  const prompt = buildVisionPrompt(operation, question, language);
  const content: any[] = [];

  // Add primary image
  if (imageBase64) {
    const mimeType = detectMimeType(imageBase64);
    content.push({
      type: "image",
      inlineData: { mimeType, data: imageBase64 },
    });
  } else if (imageUrl) {
    content.push({
      type: "image",
      fileData: { mimeType: "image/jpeg", fileUri: imageUrl },
    });
  }

  // Add secondary image for compare
  if (operation === "compare") {
    if (imageBase64B) {
      const mimeType = detectMimeType(imageBase64B);
      content.push({
        type: "image",
        inlineData: { mimeType, data: imageBase64B },
      });
    } else if (imageUrlB) {
      content.push({
        type: "image",
        fileData: { mimeType: "image/jpeg", fileUri: imageUrlB },
      });
    }
  }

  content.push({ type: "text", text: prompt });

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: content }] }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`Gemini Vision error: ${err}`, res.status, "PROVIDER_ERROR");
  }

  const data = (await res.json()) as any;
  const result = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  return {
    operation,
    result,
    provider: "gemini/gemini-2.0-flash",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildVisionPrompt(operation: string, question?: string, language?: string): string {
  const lang = language || "English";

  switch (operation) {
    case "analyze":
      return question || `Analyze this image in detail. Respond in ${lang}.`;
    case "ocr":
      return `Extract all text from this image. Respond in ${lang}.`;
    case "describe":
      return `Provide a detailed description of this image. Respond in ${lang}.`;
    case "detect_objects":
      return `Identify and list all objects in this image with their locations. Respond in ${lang}.`;
    case "detect_text":
      return `Find and extract all visible text from this image. Respond in ${lang}.`;
    case "compare":
      return question || `Compare these two images and describe the differences. Respond in ${lang}.`;
    case "qa":
      return question || `Answer questions about this image. Respond in ${lang}.`;
    default:
      return `Analyze this image. Respond in ${lang}.`;
  }
}

function detectMimeType(base64Data: string): string {
  // Simple detection based on base64 header
  if (base64Data.startsWith("/9j/")) return "image/jpeg";
  if (base64Data.startsWith("iVBORw0KGgo")) return "image/png";
  if (base64Data.startsWith("R0lGODlh")) return "image/gif";
  if (base64Data.startsWith("Qk0")) return "image/bmp";
  if (base64Data.startsWith("UklGRi")) return "image/webp";
  return "image/jpeg"; // default
}
