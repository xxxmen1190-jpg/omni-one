/**
 * Omni One UX Types
 * Types for UI components, visualization, and user experience
 */

/**
 * Display Modes
 */

export type DisplayMode = "simple" | "pro" | "debug";

/**
 * Execution Timeline Types
 */

export interface TimelineStage {
  id: string;
  name: string;
  displayName: string;
  icon: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  progress?: number; // 0-100
  details?: string;
  error?: string;
}

export interface ExecutionTimeline {
  id: string;
  stages: TimelineStage[];
  totalDuration: number;
  startTime: number;
  endTime?: number;
  overallStatus: "pending" | "running" | "completed" | "failed";
}

/**
 * Reasoning Trace Types
 */

export interface ReasoningStep {
  step: number;
  title: string;
  description: string;
  reasoning: string;
  decision: string;
  alternatives?: string[];
  selectedAlternative?: string;
  confidence: number;
}

export interface ReasoningTrace {
  enabled: boolean;
  steps: ReasoningStep[];
  finalConclusion: string;
  totalSteps: number;
}

/**
 * Sources Display Types
 */

export interface SourceReference {
  id: string;
  type: "document" | "memory" | "tool" | "agent" | "entity";
  title: string;
  content?: string;
  relevance: number;
  confidence: number;
  metadata?: Record<string, any>;
}

export interface SourcesPanel {
  documents: SourceReference[];
  memories: SourceReference[];
  tools: SourceReference[];
  agents: SourceReference[];
  entities: SourceReference[];
  totalSources: number;
}

/**
 * Live Execution Indicator Types
 */

export type ExecutionPhase =
  | "thinking"
  | "analyzing"
  | "planning"
  | "searching"
  | "retrieving"
  | "executing_tools"
  | "executing_agents"
  | "generating"
  | "complete";

export interface LiveIndicator {
  phase: ExecutionPhase;
  message: string;
  progress: number; // 0-100
  estimatedTimeRemaining?: number;
  subPhases?: Array<{
    name: string;
    status: "pending" | "running" | "completed";
  }>;
}

/**
 * Debug Panel Types
 */

export interface DebugMetrics {
  latencyPerStage: Record<string, number>;
  cacheHits: number;
  cacheMisses: number;
  toolUsage: Array<{
    toolId: string;
    toolName: string;
    callCount: number;
    totalTime: number;
    successRate: number;
  }>;
  agentUsage: Array<{
    agentId: string;
    agentName: string;
    actionCount: number;
    totalTime: number;
    successRate: number;
  }>;
  failureRecoveryEvents: Array<{
    timestamp: number;
    stage: string;
    error: string;
    recoveryLevel: 1 | 2 | 3;
    success: boolean;
  }>;
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost?: number;
  };
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

export interface DebugPanel {
  enabled: boolean;
  metrics: DebugMetrics;
  logs: Array<{
    timestamp: number;
    level: "info" | "warn" | "error" | "debug";
    message: string;
    data?: Record<string, any>;
  }>;
}

/**
 * Enhanced Message Types
 */

export interface EnhancedChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  
  // For assistant messages
  finalAnswer?: string;
  reasoningTrace?: ReasoningTrace;
  executionTimeline?: ExecutionTimeline;
  sourcesPanel?: SourcesPanel;
  confidenceScore?: number;
  liveIndicator?: LiveIndicator;
  debugMetrics?: DebugMetrics;
  
  // Display settings
  displayMode: DisplayMode;
  expanded?: boolean;
  showDetails?: boolean;
  
  metadata?: Record<string, any>;
}

/**
 * Chat UI State Types
 */

export interface ChatUIState {
  displayMode: DisplayMode;
  expandedMessages: Set<string>;
  showReasoningByDefault: boolean;
  showSourcesByDefault: boolean;
  showDebugByDefault: boolean;
  autoScroll: boolean;
  compactMode: boolean;
  theme: "light" | "dark" | "auto";
}

/**
 * Message Expansion State
 */

export interface MessageExpansionState {
  messageId: string;
  sections: {
    reasoning: boolean;
    timeline: boolean;
    sources: boolean;
    debug: boolean;
  };
  expandedAt: number;
}

/**
 * Replay State
 */

export interface ReplayState {
  messageId: string;
  isReplaying: boolean;
  currentStageIndex: number;
  playbackSpeed: number; // 0.5, 1, 1.5, 2
  autoPlay: boolean;
  startTime: number;
}

/**
 * UI Component Props Types
 */

export interface TimelineProps {
  timeline: ExecutionTimeline;
  displayMode: DisplayMode;
  onStageClick?: (stageId: string) => void;
  compact?: boolean;
}

export interface ReasoningViewProps {
  reasoning: ReasoningTrace;
  displayMode: DisplayMode;
  onStepClick?: (stepNumber: number) => void;
  expandedSteps?: Set<number>;
}

export interface SourcesPanelProps {
  sources: SourcesPanel;
  displayMode: DisplayMode;
  onSourceClick?: (sourceId: string) => void;
  highlightedSources?: Set<string>;
}

export interface DebugPanelProps {
  metrics: DebugMetrics;
  logs: DebugPanel["logs"];
  onClearLogs?: () => void;
  onExportMetrics?: () => void;
}

export interface LiveIndicatorProps {
  indicator: LiveIndicator;
  displayMode: DisplayMode;
}

export interface MessageProps {
  message: EnhancedChatMessage;
  displayMode: DisplayMode;
  onExpand?: (messageId: string) => void;
  onReplay?: (messageId: string) => void;
  expanded?: boolean;
}

/**
 * UI Events
 */

export interface UIEvent {
  type: "mode_changed" | "message_expanded" | "replay_started" | "debug_toggled";
  timestamp: number;
  data: Record<string, any>;
}

/**
 * UI Configuration
 */

export interface UIConfig {
  enableProMode: boolean;
  enableDebugPanel: boolean;
  enableReasoningView: boolean;
  enableSourcesPanel: boolean;
  enableLiveIndicators: boolean;
  enableMessageReplay: boolean;
  defaultDisplayMode: DisplayMode;
  maxVisibleMessages: number;
  messageCompactThreshold: number; // characters
  animationDuration: number; // ms
  theme: "light" | "dark" | "auto";
}
