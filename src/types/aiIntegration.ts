/**
 * Omni One AI Integration Types
 * Production-grade types for AI provider integration
 */

/**
 * Provider Types
 */

export type AIProviderType =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "openrouter"
  | "together"
  | "fireworks"
  | "huggingface"
  | "mistral"
  | "deepseek"
  | "qwen"
  | "llama";

export type AIModelFamily =
  | "gpt"
  | "claude"
  | "gemini"
  | "groq"
  | "deepseek"
  | "qwen"
  | "llama"
  | "mistral";

export type AICapability =
  | "chat"
  | "vision"
  | "embeddings"
  | "image_generation"
  | "speech_to_text"
  | "text_to_speech"
  | "function_calling"
  | "json_mode"
  | "long_context"
  | "reasoning"
  | "code_execution";

/**
 * Provider Configuration
 */

export interface ProviderConfig {
  type: AIProviderType;
  apiKey: string;
  apiUrl?: string;
  timeout?: number;
  retries?: number;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  enabled: boolean;
  priority?: number;
}

/**
 * Model Configuration
 */

export interface ModelConfig {
  id: string;
  provider: AIProviderType;
  name: string;
  family: AIModelFamily;
  contextWindow: number;
  capabilities: AICapability[];
  costPer1kInputTokens: number;
  costPer1kOutputTokens: number;
  costPer1mInputTokens?: number;
  costPer1mOutputTokens?: number;
  averageLatency: number; // ms
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  enabled: boolean;
  priority?: number;
  tags?: string[];
}

/**
 * Provider Health
 */

export interface ProviderHealth {
  provider: AIProviderType;
  status: "healthy" | "degraded" | "unhealthy" | "offline";
  latency: number; // ms
  availability: number; // 0-1
  errorRate: number; // 0-1
  lastChecked: number;
  consecutiveErrors: number;
  quota?: {
    used: number;
    limit: number;
    resetAt?: number;
  };
  rateLimit?: {
    remaining: number;
    limit: number;
    resetAt?: number;
  };
  costToday: number;
  costThisMonth: number;
  averageResponseTime: number;
  successRate: number; // 0-1
}

/**
 * Chat Request/Response
 */

export interface AIMessage {
  role: "system" | "user" | "assistant" | "function";
  content: string;
  name?: string;
  toolCalls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface ChatRequest {
  messages: AIMessage[];
  model?: string;
  provider?: AIProviderType;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: Array<{
    type: "function";
    function: {
      name: string;
      description: string;
      parameters: Record<string, any>;
    };
  }>;
  responseFormat?: "text" | "json_object";
}

export interface ChatResponse {
  id: string;
  model: string;
  provider: AIProviderType;
  content: string;
  finishReason: "stop" | "length" | "tool_calls" | "error";
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  cost: number;
  latency: number;
  toolCalls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  metadata?: Record<string, any>;
}

/**
 * Streaming
 */

export interface StreamChunk {
  type: "content" | "tool_call" | "metadata" | "error";
  content?: string;
  toolCall?: {
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  };
  metadata?: Record<string, any>;
  error?: {
    code: string;
    message: string;
  };
}

export interface StreamResponse {
  id: string;
  model: string;
  provider: AIProviderType;
  stream: AsyncIterable<StreamChunk>;
  cancel: () => void;
  onComplete: (callback: (response: ChatResponse) => void) => void;
}

/**
 * Embeddings
 */

export interface EmbeddingRequest {
  text: string | string[];
  model?: string;
  provider?: AIProviderType;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  provider: AIProviderType;
  usage: {
    tokens: number;
  };
  cost: number;
}

/**
 * Vision
 */

export interface VisionRequest {
  imageUrl: string;
  prompt: string;
  model?: string;
  provider?: AIProviderType;
  maxTokens?: number;
}

export interface VisionResponse {
  description: string;
  model: string;
  provider: AIProviderType;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  cost: number;
}

/**
 * Provider Selection Strategy
 */

export type SelectionStrategy =
  | "cost_optimized"
  | "speed_optimized"
  | "quality_optimized"
  | "balanced"
  | "availability_optimized";

export interface SelectionCriteria {
  strategy: SelectionStrategy;
  requiredCapabilities?: AICapability[];
  minContextWindow?: number;
  maxLatency?: number;
  maxCostPerRequest?: number;
  preferredProviders?: AIProviderType[];
  excludeProviders?: AIProviderType[];
}

/**
 * Cost Tracking
 */

export interface CostMetrics {
  provider: AIProviderType;
  model: string;
  totalCost: number;
  requestCount: number;
  tokenCount: number;
  averageCostPerRequest: number;
  averageTokensPerRequest: number;
  costPerDay: Record<string, number>;
  costPerUser?: Record<string, number>;
}

/**
 * API Key Management
 */

export interface APIKeyEntry {
  id: string;
  provider: AIProviderType;
  key: string; // encrypted
  createdAt: number;
  lastUsed?: number;
  rotatedAt?: number;
  enabled: boolean;
  metadata?: Record<string, any>;
}

/**
 * Gateway Configuration
 */

export interface AIGatewayConfig {
  providers: ProviderConfig[];
  models: ModelConfig[];
  defaultStrategy: SelectionStrategy;
  healthCheckInterval: number; // ms
  costAlertThreshold?: number;
  enableCaching: boolean;
  cacheTTL: number; // ms
  enableRetries: boolean;
  maxRetries: number;
  retryBackoffMs: number;
  enableRateLimiting: boolean;
  enableCostTracking: boolean;
  enableStreamingByDefault: boolean;
}

/**
 * Gateway State
 */

export interface AIGatewayState {
  providers: Map<AIProviderType, ProviderHealth>;
  models: Map<string, ModelConfig>;
  costMetrics: Map<string, CostMetrics>;
  cache: Map<string, { response: ChatResponse; timestamp: number }>;
  requestQueue: Array<{
    id: string;
    request: ChatRequest;
    timestamp: number;
    retries: number;
  }>;
  activeStreams: Map<string, StreamResponse>;
  statistics: {
    totalRequests: number;
    totalCost: number;
    averageLatency: number;
    successRate: number;
    lastUpdated: number;
  };
}

/**
 * Benchmark Results
 */

export interface BenchmarkResult {
  model: string;
  provider: AIProviderType;
  metric: "speed" | "quality" | "cost" | "reliability";
  score: number; // 0-100
  timestamp: number;
  sampleSize: number;
}

/**
 * Error Handling
 */

export interface AIError {
  code: string;
  message: string;
  provider: AIProviderType;
  model?: string;
  retryable: boolean;
  statusCode?: number;
  timestamp: number;
}
