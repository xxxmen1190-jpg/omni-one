/**
 * Omni One Runtime System Types
 * Core types for the modular, plugin-based runtime architecture
 */

import { Intent } from "./index";

/**
 * Plugin Types and Interfaces
 */

export type PluginType = "tool" | "agent" | "provider" | "workflow" | "middleware" | "extension";
export type PluginStatus = "inactive" | "loading" | "active" | "failed" | "disabled" | "updating";
export type PluginPriority = "critical" | "high" | "normal" | "low";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  description: string;
  author: string;
  license: string;
  dependencies: PluginDependency[];
  capabilities: string[];
  requiredPermissions: string[];
  metadata: Record<string, any>;
}

export interface PluginDependency {
  pluginId: string;
  version: string;
  optional: boolean;
}

export interface PluginConfig {
  enabled: boolean;
  priority: PluginPriority;
  timeout: number;
  retries: number;
  maxInstances: number;
  environment: Record<string, string>;
}

export interface IPlugin {
  manifest: PluginManifest;
  config: PluginConfig;
  status: PluginStatus;
  initialize(): Promise<void>;
  execute(input: any): Promise<any>;
  shutdown(): Promise<void>;
  getMetadata(): Record<string, any>;
}

/**
 * Runtime Event System
 */

export type RuntimeEventType =
  | "plugin:loaded"
  | "plugin:initialized"
  | "plugin:executed"
  | "plugin:failed"
  | "plugin:unloaded"
  | "plugin:disabled"
  | "tool:start"
  | "tool:complete"
  | "tool:error"
  | "agent:spawn"
  | "agent:complete"
  | "agent:fail"
  | "plan:created"
  | "plan:updated"
  | "plan:executed"
  | "execution:start"
  | "execution:complete"
  | "execution:error"
  | "fallback:triggered"
  | "recovery:attempted"
  | "health:check"
  | "capability:added"
  | "capability:removed"
  | "composition:created"
  | "system:error"
  | "system:warning";

export interface RuntimeEvent {
  type: RuntimeEventType;
  timestamp: number;
  source: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
  priority: "low" | "normal" | "high" | "critical";
}

export interface RuntimeEventListener {
  (event: RuntimeEvent): void | Promise<void>;
}

export interface EventBusConfig {
  maxListeners: number;
  enableLogging: boolean;
  enablePersistence: boolean;
  persistencePath?: string;
}

/**
 * Capability Registry
 */

export interface CapabilityMetadata {
  id: string;
  name: string;
  description: string;
  type: PluginType;
  version: string;
  pluginId: string;
  dependencies: string[];
  compatibleWith: string[];
  performanceMetrics: PerformanceMetrics;
  reliability: ReliabilityMetrics;
  lastUsed: number;
  usageCount: number;
}

export interface PerformanceMetrics {
  averageExecutionTime: number;
  maxExecutionTime: number;
  minExecutionTime: number;
  successRate: number;
  errorRate: number;
}

export interface ReliabilityMetrics {
  uptime: number;
  failureCount: number;
  recoveryCount: number;
  lastFailure?: number;
  healthScore: number; // 0-100
}

export interface CapabilityRegistry {
  register(capability: CapabilityMetadata): void;
  unregister(capabilityId: string): void;
  get(capabilityId: string): CapabilityMetadata | undefined;
  getByType(type: PluginType): CapabilityMetadata[];
  getByPlugin(pluginId: string): CapabilityMetadata[];
  search(query: string): CapabilityMetadata[];
  getAll(): CapabilityMetadata[];
}

/**
 * Execution Sandbox
 */

export interface SandboxConfig {
  timeout: number;
  memoryLimit: number;
  cpuLimit: number;
  networkAccess: boolean;
  fileSystemAccess: boolean;
  allowedPaths: string[];
}

export interface SandboxExecutionContext {
  id: string;
  pluginId: string;
  input: any;
  config: SandboxConfig;
  startTime: number;
  endTime?: number;
  status: "running" | "completed" | "failed" | "timeout";
  result?: any;
  error?: Error;
  logs: string[];
}

export interface ISandbox {
  execute(context: SandboxExecutionContext): Promise<any>;
  terminate(contextId: string): void;
  getContext(contextId: string): SandboxExecutionContext | undefined;
}

/**
 * Self-Healing System
 */

export interface HealthCheckResult {
  pluginId: string;
  status: "healthy" | "degraded" | "unhealthy";
  score: number; // 0-100
  issues: HealthIssue[];
  lastCheck: number;
  nextCheck: number;
}

export interface HealthIssue {
  type: "failure" | "timeout" | "memory" | "cpu" | "network" | "dependency";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  suggestion: string;
}

export interface RecoveryAction {
  type: "restart" | "reload" | "disable" | "fallback" | "alert";
  target: string;
  priority: PluginPriority;
  maxAttempts: number;
  backoffMultiplier: number;
}

/**
 * Adaptive Learning
 */

export interface PerformanceProfile {
  pluginId: string;
  executionTimes: number[];
  successRates: number[];
  errorPatterns: Record<string, number>;
  preferredProviders: string[];
  optimalConfiguration: Record<string, any>;
  lastUpdated: number;
}

export interface LearningDecision {
  type: "tool_selection" | "provider_selection" | "strategy_selection" | "parameter_tuning";
  recommendation: string;
  confidence: number;
  reasoning: string;
}

/**
 * Capability Composition
 */

export interface ComposedCapability {
  id: string;
  name: string;
  description: string;
  components: string[]; // Plugin IDs
  workflow: CompositionWorkflow;
  metadata: Record<string, any>;
  createdAt: number;
  usageCount: number;
}

export interface CompositionWorkflow {
  steps: CompositionStep[];
  dataFlow: DataFlowMapping[];
  errorHandling: ErrorHandlingStrategy;
}

export interface CompositionStep {
  id: string;
  pluginId: string;
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  condition?: (context: any) => boolean;
  fallback?: string; // Alternative plugin ID
}

export interface DataFlowMapping {
  from: string; // step.id or "input"
  to: string; // step.id or "output"
  transform?: (data: any) => any;
}

export interface ErrorHandlingStrategy {
  onStepError: "fail" | "skip" | "retry" | "fallback";
  onCompositionError: "fail" | "partial" | "rollback";
  maxRetries: number;
  retryDelay: number;
}

/**
 * Runtime Observability
 */

export interface ExecutionTrace {
  id: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  events: TraceEvent[];
  metadata: Record<string, any>;
}

export interface TraceEvent {
  timestamp: number;
  type: "enter" | "exit" | "event" | "error" | "log";
  source: string;
  data: any;
  duration?: number;
}

export interface RuntimeMetrics {
  uptime: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  activePlugins: number;
  totalPlugins: number;
  systemHealth: number; // 0-100
  memoryUsage: number;
  cpuUsage: number;
}

export interface DebugContext {
  enabled: boolean;
  traceLevel: "none" | "minimal" | "normal" | "verbose" | "debug";
  captureEvents: boolean;
  captureMetrics: boolean;
  captureTraces: boolean;
  filters: Record<string, boolean>;
}

/**
 * Runtime Configuration
 */

export interface RuntimeConfig {
  pluginDirectory: string;
  maxPlugins: number;
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  enableAutoHealing: boolean;
  enableAdaptiveLearning: boolean;
  enableComposition: boolean;
  eventBusConfig: EventBusConfig;
  sandboxConfig: SandboxConfig;
  debugContext: DebugContext;
  metadata: Record<string, any>;
}

/**
 * Runtime State
 */

export interface RuntimeState {
  initialized: boolean;
  running: boolean;
  plugins: Map<string, IPlugin>;
  capabilities: CapabilityMetadata[];
  compositions: Map<string, ComposedCapability>;
  executionTraces: ExecutionTrace[];
  metrics: RuntimeMetrics;
  healthChecks: Map<string, HealthCheckResult>;
  performanceProfiles: Map<string, PerformanceProfile>;
}
