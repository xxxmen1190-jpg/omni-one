/**
 * Phase 14.4 — Voice Layer
 * Speech-to-Text, Text-to-Speech, Streaming, Realtime.
 * Uses OpenAI Whisper for STT and OpenAI TTS for speech output.
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

export type STTProvider = "openai" | "browser";
export type TTSProvider = "openai" | "browser";
export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type TTSModel = "tts-1" | "tts-1-hd";

export interface STTRequest {
  audioBlob: Blob;
  language?: string;
  provider?: STTProvider;
}

export interface STTResult {
  text: string;
  language?: string;
  duration?: number;
  provider: string;
}

export interface TTSRequest {
  text: string;
  voice?: TTSVoice;
  model?: TTSModel;
  speed?: number;
  provider?: TTSProvider;
}

export interface TTSResult {
  audioBlob: Blob;
  audioUrl: string;
  provider: string;
  duration?: number;
}

export interface VoiceRecordingState {
  isRecording: boolean;
  duration: number;
  audioBlob?: Blob;
}

export class VoiceSystem {
  private static mediaRecorder: MediaRecorder | null = null;
  private static audioChunks: Blob[] = [];
  private static recordingStartTime: number = 0;
  private static currentAudio: HTMLAudioElement | null = null;

  /**
   * Speech-to-Text: Convert audio to text.
   */
  static async speechToText(request: STTRequest): Promise<STTResult> {
    Logger.info(`[VoiceSystem] STT: ${request.audioBlob.size} bytes`);

    const provider = request.provider || this.selectSTTProvider();

    switch (provider) {
      case "openai":
        return this.sttWithOpenAI(request);
      case "browser":
        throw new Error("Browser STT requires real-time recording");
      default:
        return this.sttWithOpenAI(request);
    }
  }

  /**
   * Text-to-Speech: Convert text to audio.
   */
  static async textToSpeech(request: TTSRequest): Promise<TTSResult> {
    Logger.info(`[VoiceSystem] TTS: "${request.text.slice(0, 50)}..."`);

    const provider = request.provider || this.selectTTSProvider();

    switch (provider) {
      case "openai":
        return this.ttsWithOpenAI(request);
      case "browser":
        return this.ttsWithBrowser(request);
      default:
        return this.ttsWithOpenAI(request);
    }
  }

  /**
   * Start recording audio from microphone.
   */
  static async startRecording(): Promise<void> {
    if (this.mediaRecorder?.state === "recording") {
      Logger.warn("[VoiceSystem] Already recording");
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioChunks = [];
    this.recordingStartTime = Date.now();

    // Use webm/opus for best compatibility
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    this.mediaRecorder = new MediaRecorder(stream, { mimeType });
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.mediaRecorder.start(100); // Collect data every 100ms
    Logger.info("[VoiceSystem] Recording started");
  }

  /**
   * Stop recording and return the audio blob.
   */
  static async stopRecording(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== "recording") {
        reject(new Error("Not recording"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, {
          type: this.mediaRecorder?.mimeType || "audio/webm",
        });
        // Stop all tracks
        this.mediaRecorder?.stream.getTracks().forEach((track) => track.stop());
        Logger.info(`[VoiceSystem] Recording stopped: ${audioBlob.size} bytes`);
        resolve(audioBlob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Record and transcribe in one step.
   */
  static async recordAndTranscribe(durationMs?: number): Promise<STTResult> {
    await this.startRecording();

    if (durationMs) {
      await new Promise((resolve) => setTimeout(resolve, durationMs));
    }

    const audioBlob = await this.stopRecording();
    return this.speechToText({ audioBlob });
  }

  /**
   * Play TTS audio.
   */
  static async speak(text: string, voice: TTSVoice = "nova"): Promise<void> {
    const result = await this.textToSpeech({ text, voice });
    await this.playAudio(result.audioUrl);
  }

  /**
   * Stop current audio playback.
   */
  static stopSpeaking(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
  }

  private static async playAudio(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.stopSpeaking();
      const audio = new Audio(url);
      this.currentAudio = audio;
      audio.onended = () => resolve();
      audio.onerror = (e) => reject(e);
      audio.play().catch(reject);
    });
  }

  private static selectSTTProvider(): STTProvider {
    const keys = getAPIKeys();
    return keys.openai ? "openai" : "browser";
  }

  private static selectTTSProvider(): TTSProvider {
    const keys = getAPIKeys();
    return keys.openai ? "openai" : "browser";
  }

  private static async sttWithOpenAI(request: STTRequest): Promise<STTResult> {
    const keys = getAPIKeys();
    const apiKey = keys.openai;
    if (!apiKey) throw new Error("OpenAI API key not configured");

    const formData = new FormData();
    formData.append("file", request.audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    if (request.language) formData.append("language", request.language);
    formData.append("response_format", "json");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI STT error: ${err}`);
    }

    const data = await response.json();
    return {
      text: data.text || "",
      language: data.language,
      provider: "openai/whisper-1",
    };
  }

  private static async ttsWithOpenAI(request: TTSRequest): Promise<TTSResult> {
    const keys = getAPIKeys();
    const apiKey = keys.openai;
    if (!apiKey) throw new Error("OpenAI API key not configured");

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || "tts-1",
        input: request.text,
        voice: request.voice || "nova",
        speed: request.speed || 1.0,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI TTS error: ${err}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    return {
      audioBlob,
      audioUrl,
      provider: "openai/tts-1",
    };
  }

  private static async ttsWithBrowser(request: TTSRequest): Promise<TTSResult> {
    // Use Web Speech API as fallback
    return new Promise((resolve, reject) => {
      if (!("speechSynthesis" in window)) {
        reject(new Error("Browser TTS not supported"));
        return;
      }

      const utterance = new SpeechSynthesisUtterance(request.text);
      utterance.rate = request.speed || 1.0;
      utterance.onend = () => {
        // Return empty blob since browser TTS doesn't give us the audio
        resolve({
          audioBlob: new Blob([], { type: "audio/mp3" }),
          audioUrl: "",
          provider: "browser/speech-synthesis",
        });
      };
      utterance.onerror = (e) => reject(e);
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * Check if microphone is available.
   */
  static async isMicrophoneAvailable(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some((d) => d.kind === "audioinput");
    } catch {
      return false;
    }
  }

  /**
   * Get recording duration in seconds.
   */
  static getRecordingDuration(): number {
    if (!this.recordingStartTime) return 0;
    return (Date.now() - this.recordingStartTime) / 1000;
  }

  /**
   * Check if currently recording.
   */
  static isRecording(): boolean {
    return this.mediaRecorder?.state === "recording";
  }
}
