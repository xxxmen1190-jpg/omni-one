/**
 * Core type definitions for Omni One Backend
 */

// ─── Environment ──────────────────────────────────────────────────────────────

export type NodeEnv = "development" | "production" | "testing";

export interface AppConfig {
  nodeEnv: NodeEnv;
  port: number;
  host: string;
  appName: string;
  appVersion: string;
  buildNumber: string;
  cors: {
    origins: string[];
  };
  rateLimit: {
    max: number;
    windowMs: number;
  };
  ai: {
    openaiApiKey: string;
    anthropicApiKey: string;
    geminiApiKey: string;
    groqApiKey: string;
    openrouterApiKey: string;
  };
  logging: {
    level: string;
    pretty: boolean;
  };
}

// ─── API Request / Response ───────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  requestId: string;
  timestamp: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  requestId: string;
  timestamp: string;
  error: {
    code: string;
    message: string;
    statusCode: number;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Health ───────────────────────────────────────────────────────────────────

export type ProviderStatus = "available" | "unavailable" | "unconfigured";

export interface AIProviderStatus {
  openai: ProviderStatus;
  anthropic: ProviderStatus;
  gemini: ProviderStatus;
  groq: ProviderStatus;
  openrouter: ProviderStatus;
}

export interface HealthData {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  timestamp: string;
  version: string;
  buildNumber: string;
  environment: NodeEnv;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  runtime: {
    node: string;
    platform: string;
    arch: string;
  };
  aiProviders: AIProviderStatus;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  stream?: boolean;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface ChatResponse {
  id: string;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: "stop" | "length" | "error";
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export interface ToolExecuteRequest {
  toolName: string;
  parameters: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface ToolExecuteResponse {
  toolName: string;
  result: unknown;
  executionTimeMs: number;
  success: boolean;
  error?: string;
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export interface AgentRunRequest {
  task: string;
  agentType?: string;
  context?: Record<string, unknown>;
  maxSteps?: number;
}

export interface AgentStep {
  step: number;
  action: string;
  result: string;
  timestamp: string;
}

export interface AgentRunResponse {
  agentId: string;
  task: string;
  status: "completed" | "failed" | "running";
  steps: AgentStep[];
  finalResult: string;
  executionTimeMs: number;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "BAD_REQUEST"
  | "PROVIDER_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;

  constructor(message: string, statusCode: number, code: ErrorCode) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
