/**
 * Voice API Route — Backend
 *
 * Phase 20.6 — Final System Wiring
 *
 * Replaces frontend direct calls to OpenAI Voice APIs.
 * All voice processing now goes through the backend unified gateway.
 *
 * Endpoints:
 *   POST /api/voice/transcribe   — Transcribe audio to text (speech-to-text)
 *   POST /api/voice/tts          — Generate speech from text (text-to-speech)
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../../types/index.js";
import { successResponse } from "../../utils/response.js";
import { logger } from "../../utils/logger.js";

interface TranscribeRequest {
  audioBase64: string;
  audioUrl?: string;
  language?: string;
  provider?: "openai" | "auto";
}

interface TTSRequest {
  text: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  speed?: number;
  provider?: "openai" | "auto";
}

interface TranscribeResult {
  text: string;
  provider: string;
  language?: string;
  durationMs: number;
}

interface TTSResult {
  audioBase64: string;
  provider: string;
  mimeType: string;
  durationMs: number;
}

const transcribeSchema = {
  type: "object",
  required: ["audioBase64"],
  properties: {
    audioBase64: { type: "string" },
    audioUrl: { type: "string" },
    language: { type: "string" },
    provider: { type: "string", enum: ["openai", "auto"] },
  },
} as const;

const ttsSchema = {
  type: "object",
  required: ["text"],
  properties: {
    text: { type: "string", maxLength: 4096 },
    voice: { type: "string", enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] },
    speed: { type: "number", minimum: 0.25, maximum: 4 },
    provider: { type: "string", enum: ["openai", "auto"] },
  },
} as const;

export async function voiceRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /voice/transcribe ─────────────────────────────────────────────────
  fastify.post<{ Body: TranscribeRequest }>(
    "/voice/transcribe",
    { schema: { body: transcribeSchema } },
    async (request: FastifyRequest<{ Body: TranscribeRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const startMs = Date.now();

      const { audioBase64, audioUrl, language, provider = "auto" } = request.body;

      logger.info({ provider, language }, "[VoiceRoute] Transcribe request");

      try {
        const selectedProvider = provider === "auto" ? "openai" : provider;

        let result: TranscribeResult;

        switch (selectedProvider) {
          case "openai":
            result = await transcribeWithOpenAI(audioBase64, audioUrl, language);
            break;
          default:
            throw new AppError(`Unknown voice provider: ${selectedProvider}`, 400, "BAD_REQUEST");
        }

        result.durationMs = Date.now() - startMs;

        void reply.status(200).send(successResponse(result, requestId));
      } catch (error) {
        logger.error({ error }, "[VoiceRoute] Transcription failed");
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

  // ── POST /voice/tts ────────────────────────────────────────────────────────
  fastify.post<{ Body: TTSRequest }>(
    "/voice/tts",
    { schema: { body: ttsSchema } },
    async (request: FastifyRequest<{ Body: TTSRequest }>, reply: FastifyReply) => {
      const requestId = (request.headers["x-request-id"] as string | undefined) ?? "unknown";
      const startMs = Date.now();

      const { text, voice = "nova", speed = 1, provider = "auto" } = request.body;

      logger.info({ provider, textLength: text.length }, "[VoiceRoute] TTS request");

      try {
        const selectedProvider = provider === "auto" ? "openai" : provider;

        let result: TTSResult;

        switch (selectedProvider) {
          case "openai":
            result = await ttsWithOpenAI(text, voice, speed);
            break;
          default:
            throw new AppError(`Unknown voice provider: ${selectedProvider}`, 400, "BAD_REQUEST");
        }

        result.durationMs = Date.now() - startMs;

        void reply.status(200).send(successResponse(result, requestId));
      } catch (error) {
        logger.error({ error }, "[VoiceRoute] TTS failed");
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

async function transcribeWithOpenAI(audioBase64: string, audioUrl?: string, language?: string): Promise<TranscribeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("OpenAI API key not configured", 503, "SERVICE_UNAVAILABLE");

  // Convert base64 to blob for FormData
  const buffer = Buffer.from(audioBase64, "base64");
  const blob = new Blob([buffer], { type: "audio/mp3" });

  const formData = new FormData();
  formData.append("file", blob, "audio.mp3");
  formData.append("model", "whisper-1");
  if (language) formData.append("language", language);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData as any,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`OpenAI Transcription error: ${err}`, res.status, "PROVIDER_ERROR");
  }

  const data = (await res.json()) as any;

  return {
    text: data.text || "",
    provider: "openai/whisper-1",
    language: data.language,
  };
}

async function ttsWithOpenAI(text: string, voice: string, speed: number): Promise<TTSResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError("OpenAI API key not configured", 503, "SERVICE_UNAVAILABLE");

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      speed,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new AppError(`OpenAI TTS error: ${err}`, res.status, "PROVIDER_ERROR");
  }

  const buffer = await res.arrayBuffer();
  const audioBase64 = Buffer.from(buffer).toString("base64");

  return {
    audioBase64,
    provider: "openai/tts-1",
    mimeType: "audio/mp3",
  };
}
