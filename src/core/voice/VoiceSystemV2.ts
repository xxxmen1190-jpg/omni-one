/**
 * Voice System V2 — Frontend
 *
 * Phase 20.6 — Final System Wiring
 *
 * Refactored to use Backend API instead of direct provider calls.
 * All voice processing goes through: Frontend → Backend API → Providers
 *
 * Replaces: src/core/voice/VoiceSystem.ts
 */

import { Logger } from "../system/Logger";
import { apiClient } from "../../lib/api/client";

export interface TranscribeRequest {
  audioBase64: string;
  audioUrl?: string;
  language?: string;
  provider?: "openai" | "auto";
}

export interface TTSRequest {
  text: string;
  voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
  speed?: number;
  provider?: "openai" | "auto";
}

export interface TranscribeResult {
  text: string;
  provider: string;
  language?: string;
  durationMs: number;
}

export interface TTSResult {
  audioBase64: string;
  provider: string;
  mimeType: string;
  durationMs: number;
}

export class VoiceSystemV2 {
  /**
   * Transcribe audio to text through the Backend API.
   * 
   * Flow: Frontend → Backend API (/voice/transcribe) → OpenAI Whisper
   */
  static async transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
    Logger.info(`[VoiceSystemV2] Transcribing audio`);

    try {
      const result = await apiClient.post<TranscribeResult>(
        "/voice/transcribe",
        {
          audioBase64: request.audioBase64,
          audioUrl: request.audioUrl,
          language: request.language,
          provider: request.provider || "auto",
        },
        { timeoutMs: 60_000 } // 1 minute timeout for transcription
      );

      Logger.info(`[VoiceSystemV2] Transcription complete — provider: ${result.provider}`);
      return result;
    } catch (error) {
      Logger.error(`[VoiceSystemV2] Transcription failed`, { error });
      throw new Error(`Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate speech from text through the Backend API.
   * 
   * Flow: Frontend → Backend API (/voice/tts) → OpenAI TTS
   */
  static async generateSpeech(request: TTSRequest): Promise<TTSResult> {
    Logger.info(`[VoiceSystemV2] Generating speech — text length: ${request.text.length}`);

    try {
      const result = await apiClient.post<TTSResult>(
        "/voice/tts",
        {
          text: request.text,
          voice: request.voice || "nova",
          speed: request.speed || 1,
          provider: request.provider || "auto",
        },
        { timeoutMs: 60_000 } // 1 minute timeout for TTS
      );

      Logger.info(`[VoiceSystemV2] Speech generation complete — provider: ${result.provider}`);
      return result;
    } catch (error) {
      Logger.error(`[VoiceSystemV2] Speech generation failed`, { error });
      throw new Error(`Speech generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }
}

// Export as default for backward compatibility
export default VoiceSystemV2;
