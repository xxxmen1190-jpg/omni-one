/**
 * Omni One Integration Types
 * Types for unified execution flow, chat engine, and system integration
 */

/**
 * Chat Message Types
 */

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, any>;
}

/**
 * Execution Flow Types
 */

export type ExecutionStage =
  | "input_processing"
  | "query_understanding"
  | "planning"
  | "knowledge_retrieval"
  | "memory_injection"
  | "execution"
  | "response_generation"
  | "complete";

export interface ExecutionStep {
  stage: ExecutionStage;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "pending" | "running" | "completed" | "failed";
  data?: Record<string, any>;
  error?: string;
}

export interface ExecutionContext {
  id: string;
  userId: string;
  conversationId: string;
  userMessage: string;
  steps: ExecutionStep[];
  metadata: {
    queryAnalysis?: Record<string, any>;
    plan?: Record<string, any>;
    ragResults?: Record<string, any>;
    memoryContext?: Record<string, any>;
    toolsUsed?: string[];
    agentsUsed?: string[];
  };
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  success: boolean;
  finalResponse?: string;
}

/**
 * Smart Context Types
 */

export interface ContextItem {
  id: string;
  type: "document" | "memory" | "entity" | "tool_output" | "chat_history";
  content: string;
  importance: number; // 0-100
  relevance: number; // 0-1
  tokens: number;
  source: string;
}

export interface SmartContext {
  items: ContextItem[];
  totalTokens: number;
  maxTokens: number;
  utilizationRate: number; // 0-1
  includedItems: ContextItem[];
  excludedItems: ContextItem[];
  reasoning: string;
}

/**
 * Memory Injection Types
 */

export interface InjectedMemory {
  userPreferences: Record<string, any>;
  userFacts: Array<[string, string]>;
  userGoals: string[];
  recentDecisions: Array<{
    decision: string;
    timestamp: number;
    outcome?: string;
  }>;
  relevantMemories: Array<{
    id: string;
    content: string;
    importance: number;
    type: string;
  }>;
  knowledgeGraphContext: Array<{
    entity: string;
    relations: string[];
    importance: number;
  }>;
}

/**
 * Chat Engine Types
 */

export interface ChatEngineConfig {
  enableRAG: boolean;
  enableMemory: boolean;
  enableReasoning: boolean;
  enableAgents: boolean;
  enableTools: boolean;
  maxContextTokens: number;
  maxResponseTokens: number;
  responseTimeout: number;
  enableLatencyOptimization: boolean;
  enableFailureRecovery: boolean;
}

export interface ChatResponse {
  id: string;
  conversationId: string;
  content: string;
  timestamp: number;
  metadata: {
    sources: string[];
    toolsUsed: string[];
    agentsUsed: string[];
    memoryUsed: boolean;
    ragUsed: boolean;
    reasoning?: string;
    confidence: number;
  };
  executionContext: ExecutionContext;
}

/**
 * Failure Recovery Types
 */

export interface RecoveryStrategy {
  level: 1 | 2 | 3; // 1 = try alternative, 2 = fallback, 3 = simple response
  attempts: number;
  maxAttempts: number;
  backoffMs: number;
}

export interface FailureRecoveryContext {
  originalError: Error;
  failedStage: ExecutionStage;
  recoveryStrategies: RecoveryStrategy[];
  attemptedRecoveries: Array<{
    strategy: RecoveryStrategy;
    result: "success" | "failed";
    error?: string;
  }>;
}

/**
 * Latency Optimization Types
 */

export interface LatencyMetrics {
  inputProcessing: number;
  queryUnderstanding: number;
  planning: number;
  knowledgeRetrieval: number;
  memoryInjection: number;
  execution: number;
  responseGeneration: number;
  total: number;
}

export interface LatencyOptimization {
  parallelRetrieval: boolean;
  lazyLoadingRAG: boolean;
  cacheHits: number;
  cacheMisses: number;
  taskCancellations: number;
  metrics: LatencyMetrics;
}

/**
 * UI Display Types
 */

export interface ExecutionTimeline {
  stages: Array<{
    stage: ExecutionStage;
    startTime: number;
    endTime: number;
    duration: number;
    status: "completed" | "failed";
    label: string;
    icon: string;
  }>;
  totalDuration: number;
}

export interface ReasoningDisplay {
  enabled: boolean;
  steps: Array<{
    step: number;
    description: string;
    reasoning: string;
    conclusion: string;
  }>;
  finalConclusion: string;
}

export interface SourcesDisplay {
  documents: Array<{
    id: string;
    title: string;
    relevance: number;
  }>;
  memories: Array<{
    id: string;
    content: string;
    importance: number;
  }>;
  tools: Array<{
    id: string;
    name: string;
    result: string;
  }>;
  agents: Array<{
    id: string;
    name: string;
    action: string;
  }>;
}

/**
 * Integration Status Types
 */

export interface IntegrationStatus {
  omniBrain: "ready" | "busy" | "error";
  knowledgeEngine: "ready" | "busy" | "error";
  planner: "ready" | "busy" | "error";
  runtime: "ready" | "busy" | "error";
  tools: "ready" | "busy" | "error";
  agents: "ready" | "busy" | "error";
  memory: "ready" | "busy" | "error";
  lastUpdated: number;
}

/**
 * System Health Types
 */

export interface SystemHealth {
  overallHealth: number; // 0-100
  componentHealth: Record<string, number>;
  latency: LatencyMetrics;
  errorRate: number;
  successRate: number;
  averageResponseTime: number;
  activeUsers: number;
  totalRequests: number;
  timestamp: number;
}
