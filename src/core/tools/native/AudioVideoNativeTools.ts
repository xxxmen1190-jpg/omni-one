/**
 * Phase 12.2 — Native Tool Library: Audio & Video Tools
 * Audio: Speech-to-Text, Text-to-Speech
 * Video: Metadata, Frame Extraction
 */

import { AbstractToolSDK } from "../sdk/AbstractToolSDK";
import { ToolSDKRegistry } from "../sdk/ToolSDKRegistry";
import { ToolMetadataSDK } from "../sdk/IToolSDK";

function audioMeta(
  id: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  tags: string[] = []
): ToolMetadataSDK {
  return {
    id,
    name,
    version: "1.0.0",
    description,
    category: "audio",
    capabilities: {
      supportsStreaming: true,
      supportsCancellation: true,
      supportsParallelExecution: false,
      supportsRetry: true,
      isReadOnly: true,
      requiresNetwork: false,
      hasSideEffects: false,
      maxConcurrency: 2,
    },
    permissions: ["read", "filesystem"],
    dangerousPermissions: [],
    costEstimate: { perExecutionUSD: 0.006, isVariable: true, description: "~$0.006/minute of audio" },
    latencyEstimate: { minMs: 500, typicalMs: 3000, maxMs: 30000 },
    requiredProviders: [],
    requiredApiKeys: [
      { envVar: "OPENAI_API_KEY", description: "OpenAI Whisper for STT / TTS", required: false },
    ],
    inputSchema,
    outputSchema,
    tags: ["audio", ...tags],
    author: "omni-one",
  };
}

function videoMeta(
  id: string,
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  outputSchema: Record<string, unknown>,
  tags: string[] = []
): ToolMetadataSDK {
  return {
    id,
    name,
    version: "1.0.0",
    description,
    category: "video",
    capabilities: {
      supportsStreaming: false,
      supportsCancellation: true,
      supportsParallelExecution: false,
      supportsRetry: true,
      isReadOnly: true,
      requiresNetwork: false,
      hasSideEffects: false,
      maxConcurrency: 1,
    },
    permissions: ["read", "filesystem"],
    dangerousPermissions: [],
    costEstimate: { perExecutionUSD: 0, isVariable: false, description: "Local video processing — no cost" },
    latencyEstimate: { minMs: 1000, typicalMs: 5000, maxMs: 60000 },
    requiredProviders: [],
    requiredApiKeys: [],
    inputSchema,
    outputSchema,
    tags: ["video", ...tags],
    author: "omni-one",
  };
}

// ─── Audio: Speech To Text ────────────────────────────────────────────────────

export class AudioSpeechToTextTool extends AbstractToolSDK {
  constructor() {
    super(
      audioMeta(
        "audio.speech-to-text",
        "Audio: Speech To Text",
        "Transcribe speech from an audio file to text using Whisper or compatible STT engine.",
        {
          type: "object",
          properties: {
            path: { type: "string", description: "Path to audio file (mp3, wav, m4a, ogg, flac)" },
            language: { type: "string", description: "ISO 639-1 language code (e.g. 'en', 'he')" },
            model: { type: "string", default: "whisper-1" },
            timestamps: { type: "boolean", default: false },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            text: { type: "string" },
            language: { type: "string" },
            duration: { type: "number" },
            segments: { type: "array" },
          },
        },
        ["stt", "transcription", "whisper"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path, language, model = "whisper-1", timestamps = false } = input as {
      path: string;
      language?: string;
      model?: string;
      timestamps?: boolean;
    };
    return {
      path,
      text: `[Transcription of ${path}]`,
      language: language ?? "auto-detected",
      duration: 0,
      segments: timestamps ? [] : null,
      model,
      note: "Requires OpenAI Whisper API or local Whisper model in production runtime",
    };
  }
}

// ─── Audio: Text To Speech ────────────────────────────────────────────────────

export class AudioTextToSpeechTool extends AbstractToolSDK {
  constructor() {
    super({
      ...audioMeta(
        "audio.text-to-speech",
        "Audio: Text To Speech",
        "Convert text to speech and save as an audio file.",
        {
          type: "object",
          properties: {
            text: { type: "string" },
            outputPath: { type: "string" },
            voice: { type: "string", default: "alloy", description: "Voice ID (alloy, echo, fable, onyx, nova, shimmer)" },
            model: { type: "string", default: "tts-1" },
            speed: { type: "number", default: 1.0, minimum: 0.25, maximum: 4.0 },
          },
          required: ["text", "outputPath"],
        },
        {
          type: "object",
          properties: {
            outputPath: { type: "string" },
            durationSeconds: { type: "number" },
            fileSize: { type: "number" },
          },
        },
        ["tts", "speech", "voice"]
      ),
      capabilities: {
        supportsStreaming: true,
        supportsCancellation: true,
        supportsParallelExecution: false,
        supportsRetry: true,
        isReadOnly: false,
        requiresNetwork: true,
        hasSideEffects: true,
        maxConcurrency: 2,
      },
      permissions: ["read", "write", "filesystem", "network"],
      dangerousPermissions: [],
    });
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { text, outputPath, voice = "alloy", model = "tts-1", speed = 1.0 } = input as {
      text: string;
      outputPath: string;
      voice?: string;
      model?: string;
      speed?: number;
    };
    return {
      outputPath,
      text: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
      voice,
      model,
      speed,
      durationSeconds: 0,
      fileSize: 0,
      note: "Requires OpenAI TTS API in production runtime",
    };
  }
}

// ─── Video: Metadata ──────────────────────────────────────────────────────────

export class VideoMetadataTool extends AbstractToolSDK {
  constructor() {
    super(
      videoMeta(
        "video.metadata",
        "Video: Metadata",
        "Extract metadata from a video file (duration, resolution, codec, bitrate, etc.).",
        {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
        {
          type: "object",
          properties: {
            duration: { type: "number" },
            width: { type: "number" },
            height: { type: "number" },
            fps: { type: "number" },
            codec: { type: "string" },
            bitrate: { type: "number" },
            fileSize: { type: "number" },
            format: { type: "string" },
          },
        },
        ["metadata", "info", "probe"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path } = input as { path: string };
    return {
      path,
      duration: 0,
      width: 0,
      height: 0,
      fps: 0,
      codec: "unknown",
      bitrate: 0,
      fileSize: 0,
      format: "unknown",
      note: "Requires ffprobe (ffmpeg) in production runtime",
    };
  }
}

// ─── Video: Frame Extraction ──────────────────────────────────────────────────

export class VideoFrameExtractionTool extends AbstractToolSDK {
  constructor() {
    super(
      videoMeta(
        "video.frame-extraction",
        "Video: Frame Extraction",
        "Extract frames from a video at specified timestamps or intervals.",
        {
          type: "object",
          properties: {
            path: { type: "string" },
            outputDir: { type: "string" },
            timestamps: {
              type: "array",
              items: { type: "number" },
              description: "Timestamps in seconds to extract frames at",
            },
            interval: { type: "number", description: "Extract one frame every N seconds" },
            format: { type: "string", default: "png", enum: ["png", "jpeg", "webp"] },
          },
          required: ["path", "outputDir"],
        },
        {
          type: "object",
          properties: {
            frames: { type: "array", items: { type: "string" } },
            count: { type: "number" },
          },
        },
        ["frames", "extract", "ffmpeg"]
      )
    );
  }

  protected async onExecute(input: unknown): Promise<unknown> {
    const { path, outputDir, timestamps, interval, format = "png" } = input as {
      path: string;
      outputDir: string;
      timestamps?: number[];
      interval?: number;
      format?: string;
    };
    return {
      path,
      outputDir,
      frames: [],
      count: 0,
      timestamps: timestamps ?? null,
      interval: interval ?? null,
      format,
      note: "Requires ffmpeg in production runtime",
    };
  }
}

// ─── Auto-register ────────────────────────────────────────────────────────────

ToolSDKRegistry.register(new AudioSpeechToTextTool());
ToolSDKRegistry.register(new AudioTextToSpeechTool());
ToolSDKRegistry.register(new VideoMetadataTool());
ToolSDKRegistry.register(new VideoFrameExtractionTool());
