import {
  AIProviderType,
  ChatRequest,
  ChatResponse,
  StreamResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  VisionRequest,
  VisionResponse,
  ProviderHealth,
} from "../../types/aiIntegration";

/**
 * Universal Provider Interface
 * All AI providers must implement this interface
 */

export interface IProvider {
  /**
   * Provider type identifier
   */
  readonly type: AIProviderType;

  /**
   * Initialize provider with configuration
   */
  initialize(): Promise<void>;

  /**
   * Check provider health and availability
   */
  healthCheck(): Promise<ProviderHealth>;

  /**
   * Chat completion
   */
  chat(request: ChatRequest): Promise<ChatResponse>;

  /**
   * Streaming chat completion
   */
  stream(request: ChatRequest): Promise<StreamResponse>;

  /**
   * Generate embeddings
   */
  embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  /**
   * Vision/image understanding
   */
  vision(request: VisionRequest): Promise<VisionResponse>;

  /**
   * Generate images
   */
  imageGeneration?(prompt: string, model?: string): Promise<{ url: string; cost: number }>;

  /**
   * Speech to text
   */
  speechToText?(audioUrl: string, model?: string): Promise<{ text: string; cost: number }>;

  /**
   * Text to speech
   */
  textToSpeech?(text: string, model?: string): Promise<{ audioUrl: string; cost: number }>;

  /**
   * Get available models
   */
  getModels(): Promise<Array<{ id: string; name: string; contextWindow: number }>>;

  /**
   * Estimate request cost
   */
  estimateCost(inputTokens: number, outputTokens: number, model?: string): number;

  /**
   * Estimate request latency
   */
  estimateLatency(model?: string): number;

  /**
   * Get provider capabilities
   */
  getCapabilities(): string[];

  /**
   * Validate API key
   */
  validateApiKey(): Promise<boolean>;

  /**
   * Get current usage/quota
   */
  getUsage(): Promise<{ used: number; limit: number; resetAt?: number }>;

  /**
   * Shutdown provider
   */
  shutdown(): Promise<void>;
}
