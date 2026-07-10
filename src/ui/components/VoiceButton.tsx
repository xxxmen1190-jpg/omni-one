/**
 * Phase 14.4 — Voice Button Component
 * Record audio, transcribe with Whisper, and inject into chat input.
 */

import React, { useState, useEffect, useCallback } from "react";
import { VoiceSystem } from "../../core/voice/VoiceSystem";

interface VoiceButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

type RecordingState = "idle" | "recording" | "processing" | "error";

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onTranscription,
  disabled = false,
  className = "",
}) => {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micAvailable, setMicAvailable] = useState(true);

  useEffect(() => {
    VoiceSystem.isMicrophoneAvailable().then(setMicAvailable);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state === "recording") {
      interval = setInterval(() => {
        setDuration(VoiceSystem.getRecordingDuration());
      }, 100);
    } else {
      setDuration(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  const handleClick = useCallback(async () => {
    if (disabled || !micAvailable) return;

    if (state === "recording") {
      // Stop recording and transcribe
      setState("processing");
      setError(null);
      try {
        const audioBlob = await VoiceSystem.stopRecording();
        const result = await VoiceSystem.speechToText({ audioBlob });
        onTranscription(result.text);
        setState("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Transcription failed");
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    } else if (state === "idle" || state === "error") {
      // Start recording
      setError(null);
      try {
        await VoiceSystem.startRecording();
        setState("recording");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Microphone access denied");
        setState("error");
        setTimeout(() => setState("idle"), 3000);
      }
    }
  }, [state, disabled, micAvailable, onTranscription]);

  const formatDuration = (secs: number): string => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!micAvailable) return null;

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={handleClick}
        disabled={disabled || state === "processing"}
        title={
          state === "recording"
            ? "Stop recording"
            : state === "processing"
            ? "Processing..."
            : "Start voice input"
        }
        aria-label={
          state === "recording"
            ? "Stop recording"
            : state === "processing"
            ? "Processing audio"
            : "Start voice input"
        }
        className={`
          relative flex items-center justify-center w-9 h-9 rounded-lg transition-all
          ${state === "recording"
            ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30"
            : state === "processing"
            ? "bg-ink-700 text-ink-400 cursor-wait"
            : state === "error"
            ? "bg-red-900/50 text-red-400"
            : "text-ink-400 hover:text-white hover:bg-ink-700"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        {state === "processing" ? (
          <div className="w-4 h-4 border-2 border-ink-400 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
        ) : state === "recording" ? (
          <div className="relative">
            {/* Pulsing animation */}
            <div className="absolute inset-0 bg-red-400 rounded-full animate-ping opacity-50" />
            <svg className="w-4 h-4 relative" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </div>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-7 9a7 7 0 0 0 14 0h2a9 9 0 0 1-8 8.94V23h-2v-2.06A9 9 0 0 1 3 12H5z" />
          </svg>
        )}
      </button>

      {/* Recording duration badge */}
      {state === "recording" && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-mono">
          ● {formatDuration(duration)}
        </div>
      )}

      {/* Error tooltip */}
      {state === "error" && error && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-red-900 text-red-200 text-xs px-2 py-1 rounded whitespace-nowrap max-w-[200px] text-center">
          {error}
        </div>
      )}
    </div>
  );
};

export default VoiceButton;
