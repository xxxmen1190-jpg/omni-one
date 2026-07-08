import { Message, ProviderName, TaskType } from "./index";

export type AgentStatus = "idle" | "planning" | "executing" | "waiting" | "completed" | "failed" | "stopped";

export interface AgentStep {
  id: string;
  title: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface AgentPlan {
  id: string;
  goal: string;
  steps: AgentStep[];
  currentStepIndex: number;
}

export interface AgentMemory {
  working: Record<string, any>;
  shortTerm: Message[];
  results: any[];
}

export interface AgentCapabilities {
  canPlan: boolean;
  canSearch: boolean;
  canCode: boolean;
  canBrowse: boolean;
  canGenerateImages: boolean;
  [key: string]: boolean;
}

export interface IAgent {
  id: string;
  name: string;
  description: string;
  capabilities: AgentCapabilities;
  supportedTools: string[];
  supportedProviders: ProviderName[];
  
  execute(input: string, context?: any): Promise<void>;
  validate(input: string): Promise<boolean>;
  plan(input: string): Promise<AgentPlan>;
  stop(): Promise<void>;
  resume(): Promise<void>;
  getStatus(): AgentStatus;
  getPlan(): AgentPlan | undefined;
}

export interface AgentProgress {
  agentId: string;
  agentName: string;
  status: AgentStatus;
  currentStep?: string;
  progress: number; // 0 to 100
  message: string;
  timestamp: number;
}
