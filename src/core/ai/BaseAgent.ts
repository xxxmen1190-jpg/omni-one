import { IAgent, AgentStatus, AgentPlan, AgentCapabilities, AgentMemory } from "../../types/agent";
import { Message, ProviderName } from "../../types";
import { Logger } from "../system/Logger";
import { IPlugin } from "../system/PluginSystem";

export abstract class BaseAgent implements IAgent, IPlugin {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract version: string;
  
  capabilities: AgentCapabilities = {
    canPlan: true,
    canSearch: false,
    canCode: false,
    canBrowse: false,
    canGenerateImages: false
  };

  supportedTools: string[] = [];
  supportedProviders: ProviderName[] = [];

  protected status: AgentStatus = "idle";
  protected currentPlan?: AgentPlan;
  protected memory: AgentMemory = {
    working: {},
    shortTerm: [],
    results: []
  };

  async initialize(): Promise<void> {
    Logger.info(`Agent ${this.name} initialized`);
  }

  async shutdown(): Promise<void> {
    Logger.info(`Agent ${this.name} shutting down`);
  }

  abstract execute(input: string, context?: any): Promise<void>;
  
  async validate(input: string): Promise<boolean> {
    return input.length > 0;
  }

  abstract plan(input: string): Promise<AgentPlan>;

  async stop(): Promise<void> {
    if (this.status === "executing" || this.status === "planning") {
      this.status = "stopped";
      Logger.info(`Agent ${this.name} stopped`);
    }
  }

  async resume(): Promise<void> {
    if (this.status === "stopped") {
      this.status = "executing";
      Logger.info(`Agent ${this.name} resumed`);
      // Resume logic would be implemented in subclasses or the execution engine
    }
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  getPlan(): AgentPlan | undefined {
    return this.currentPlan;
  }

  protected updateStatus(status: AgentStatus) {
    this.status = status;
    Logger.debug(`Agent ${this.name} status updated to ${status}`);
  }
}
