/**
 * Universal Tool SDK — IToolSDK
 * Every tool in the Omni One system MUST implement this interface.
 * No tool may be added to the system without satisfying this contract.
 */

// ─── Enumerations ────────────────────────────────────────────────────────────

export type ToolPermission = "read" | "write" | "admin" | "network" | "filesystem" | "database" | "email" | "calendar" | "execute";
export type ToolStatus = "idle" | "initializing" | "ready" | "executing" | "streaming" | "cancelling" | "error" | "disposed";
export type ToolCategory =
  | "browser"
  | "files"
  | "images"
  | "audio"
  | "video"
  | "github"
  | "email"
  | "calendar"
  | "http"
  | "database"
  | "code"
  | "productivity"
  | "custom";

// ─── Cost & Latency Estimates ─────────────────────────────────────────────────

export interface CostEstimate {
  /** Estimated cost in USD for a single execution */
  perExecutionUSD: number;
  /** Whether cost is variable (e.g. token-based) */
  isVariable: boolean;
  /** Human-readable cost description */
  description: string;
}

export interface LatencyEstimate {
  /** Minimum expected latency in milliseconds */
  minMs: number;
  /** Typical (p50) latency in milliseconds */
  typicalMs: number;
  /** Maximum expected latency in milliseconds */
  maxMs: number;
}

// ─── Tool Capabilities ────────────────────────────────────────────────────────

export interface ToolCapabilities {
  /** Whether the tool supports streaming output */
  supportsStreaming: boolean;
  /** Whether the tool supports cancellation mid-execution */
  supportsCancellation: boolean;
  /** Whether the tool can run in parallel with other instances */
  supportsParallelExecution: boolean;
  /** Whether the tool supports retry on failure */
  supportsRetry: boolean;
  /** Whether the tool is read-only (no side effects) */
  isReadOnly: boolean;
  /** Whether the tool requires network access */
  requiresNetwork: boolean;
  /** Whether the tool modifies external state */
  hasSideEffects: boolean;
  /** Maximum number of concurrent executions */
  maxConcurrency: number;
}

// ─── Provider & API Key Requirements ─────────────────────────────────────────

export interface ProviderRequirement {
  /** Provider name (e.g. "openai", "anthropic") */
  name: string;
  /** Whether this provider is required or optional */
  required: boolean;
  /** Minimum version of the provider API */
  minVersion?: string;
}

export interface ApiKeyRequirement {
  /** Environment variable name for the API key */
  envVar: string;
  /** Human-readable description of what this key is for */
  description: string;
  /** Whether this key is required or optional */
  required: boolean;
}

// ─── Health Check ─────────────────────────────────────────────────────────────

export interface HealthCheckResult {
  /** Whether the tool is healthy and ready to execute */
  healthy: boolean;
  /** Human-readable status message */
  message: string;
  /** Timestamp of the health check */
  timestamp: number;
  /** Optional details about the health check */
  details?: Record<string, unknown>;
}

// ─── Streaming ────────────────────────────────────────────────────────────────

export interface StreamChunk {
  /** Chunk index (0-based) */
  index: number;
  /** Chunk data */
  data: unknown;
  /** Whether this is the final chunk */
  done: boolean;
  /** Optional error in this chunk */
  error?: string;
}

export type StreamCallback = (chunk: StreamChunk) => void | Promise<void>;

// ─── Execution Context ────────────────────────────────────────────────────────

export interface ToolExecutionContext {
  /** Unique execution ID */
  executionId: string;
  /** Tool ID being executed */
  toolId: string;
  /** Input data for the tool */
  input: unknown;
  /** Optional timeout override in milliseconds */
  timeout?: number;
  /** Optional retry count override */
  retries?: number;
  /** Optional streaming callback */
  onStream?: StreamCallback;
  /** Execution metadata */
  metadata?: Record<string, unknown>;
}

// ─── Execution Result ─────────────────────────────────────────────────────────

export interface ToolExecutionResult<T = unknown> {
  /** Whether execution succeeded */
  success: boolean;
  /** Output data (present on success) */
  data?: T;
  /** Error message (present on failure) */
  error?: string;
  /** Execution duration in milliseconds */
  durationMs: number;
  /** Timestamp when execution completed */
  timestamp: number;
  /** Execution ID for tracing */
  executionId: string;
  /** Whether result was streamed */
  wasStreamed: boolean;
}

// ─── Tool Metadata ────────────────────────────────────────────────────────────

export interface ToolMetadataSDK {
  /** Unique tool identifier (e.g. "browser.open-url") */
  id: string;
  /** Human-readable tool name */
  name: string;
  /** Tool version (semver) */
  version: string;
  /** Human-readable description */
  description: string;
  /** Tool category */
  category: ToolCategory;
  /** Tool capabilities */
  capabilities: ToolCapabilities;
  /** Required permissions */
  permissions: ToolPermission[];
  /** Whether any permission is considered dangerous */
  dangerousPermissions: ToolPermission[];
  /** Cost estimate */
  costEstimate: CostEstimate;
  /** Latency estimate */
  latencyEstimate: LatencyEstimate;
  /** Required AI providers */
  requiredProviders: ProviderRequirement[];
  /** Required API keys */
  requiredApiKeys: ApiKeyRequirement[];
  /** JSON Schema for input validation */
  inputSchema: Record<string, unknown>;
  /** JSON Schema for output validation */
  outputSchema: Record<string, unknown>;
  /** Tags for discovery */
  tags: string[];
  /** Author/maintainer */
  author: string;
}

// ─── The Universal Tool Interface ─────────────────────────────────────────────

export interface IToolSDK {
  /** Immutable tool metadata */
  readonly metadata: ToolMetadataSDK;

  /** Current tool status */
  readonly status: ToolStatus;

  /**
   * Initialize the tool — set up connections, load models, warm up caches.
   * Called once before first use.
   */
  initialize(): Promise<void>;

  /**
   * Validate the input against the tool's input schema.
   * Returns true if valid, throws or returns false if invalid.
   */
  validate(input: unknown): Promise<boolean>;

  /**
   * Execute the tool with the given input.
   * Returns a structured result.
   */
  execute(input: unknown): Promise<ToolExecutionResult>;

  /**
   * Stream the tool's output chunk by chunk.
   * Calls the callback for each chunk as it becomes available.
   */
  stream(input: unknown, callback: StreamCallback): Promise<ToolExecutionResult>;

  /**
   * Cancel an in-progress execution.
   * @param executionId The ID of the execution to cancel
   */
  cancel(executionId: string): Promise<void>;

  /**
   * Clean up resources — close connections, flush buffers, free memory.
   * Called when the tool is being removed or the system is shutting down.
   */
  cleanup(): Promise<void>;

  /**
   * Check if the tool is healthy and ready to execute.
   * Used by the registry for monitoring.
   */
  healthCheck(): Promise<HealthCheckResult>;
}
