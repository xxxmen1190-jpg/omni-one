export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
};

export type IntentType = "chat" | "code" | "reasoning" | "search" | "image" | "summarize" | "translate" | "vision" | "ocr" | "voice" | "browser" | "documents";

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

export type TaskType = IntentType; // TaskType is derived from IntentType for now

export type SkillName = IntentType; // SkillName is also derived from IntentType for now

export interface Skill {
  name: SkillName;
  description: string;
  execute: (input: any, context: { executor: typeof UniversalToolExecutor, signal?: AbortSignal, callbacks?: StreamCallbacks }) => Promise<any>;
  supportedProviders: ProviderName[];
  supportedTools?: string[]; // New: Tools that this skill can use
}

export interface TaskClassification {
  taskType: TaskType;
  confidence: number;
  parameters?: Record<string, any>;
}

export interface ProviderResponse {
  provider: ProviderName;
  content: string;
  confidence: number;
  latency: number;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
}

export interface FusionResult {
  finalResponse: string;
  confidenceScore: number;
  rawResponses: ProviderResponse[];
  metadata?: Record<string, any>;
}

export interface OmniBrainDecision {
  skill: SkillName;
  providers: ProviderName[];
  routingStrategy: "single" | "parallel" | "sequential";
  fallbackProviders: ProviderName[];
  parameters?: Record<string, any>;
}

export interface LogEntry {
  timestamp: number;
  level: "info" | "warn" | "error" | "debug";
  message: string;
  context?: Record<string, any>;
}

export interface CacheEntry {
  key: string;
  value: any;
  expiry: number;
}

export interface RequestQueueItem {
  id: string;
  priority: number;
  request: ProviderRequest;
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  signal: AbortSignal;
}

export * from "../core/tools/types";
