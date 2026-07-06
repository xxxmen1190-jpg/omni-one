export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
};

export type IntentType = "chat" | "code" | "reasoning" | "search" | "image";

export type Intent = {
  type: IntentType;
  confidence: number;
  payload?: Record<string, unknown>;
};

export type ProviderName = "openai" | "anthropic" | "gemini" | "groq" | "openrouter" | "local";

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface ProviderRequest {
  messages: Message[];
  options?: Record<string, any>;
  signal?: AbortSignal;
}
