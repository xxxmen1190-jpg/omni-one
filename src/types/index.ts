export type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type Intent = {
  type: string;
  confidence: number;
  payload?: Record<string, unknown>;
};

export type ProviderName = "local" | "openai" | "claude" | "gemini" | "groq";
