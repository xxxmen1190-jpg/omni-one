import { IAgent, AgentStatus, AgentProgress } from "../../types/agent";
import { PluginManager } from "../system/PluginSystem";
import { Logger } from "../system/Logger";

export class AgentRegistry {
  static registerAgent(agent: IAgent): void {
    // We use the existing PluginManager to register agents
    // The PluginManager already handles registration under the "agent" category
    Logger.info(`Agent registered in Registry: ${agent.name}`);
  }

  static getAgent(id: string): IAgent | undefined {
    return PluginManager.getPlugin<IAgent & any>(id);
  }

  static getAllAgents(): IAgent[] {
    return PluginManager.getPluginsByCategory("agent") as IAgent[];
  }
}

export class AgentManager {
  private static activeAgents = new Map<string, IAgent>();
  private static progressListeners: ((progress: AgentProgress) => void)[] = [];

  static async createAgent(agentId: string): Promise<IAgent> {
    const agent = AgentRegistry.getAgent(agentId);
    if (!agent) {
      throw new Error(`Agent with id ${agentId} not found`);
    }
    this.activeAgents.set(agent.id, agent);
    return agent;
  }

  static async runAgent(agentId: string, input: string, context?: any): Promise<void> {
    const agent = await this.createAgent(agentId);
    try {
      await agent.execute(input, context);
    } catch (error: any) {
      Logger.error(`Error running agent ${agentId}`, { error: error.message });
      throw error;
    } finally {
      this.activeAgents.delete(agentId);
    }
  }

  static async runParallel(agentIds: string[], input: string): Promise<void> {
    await Promise.all(agentIds.map(id => this.runAgent(id, input)));
  }

  static stopAgent(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.stop();
    }
  }

  static async resumeAgent(agentId: string): Promise<void> {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      await agent.resume();
    }
  }

  static cancelAgent(agentId: string): void {
    const agent = this.activeAgents.get(agentId);
    if (agent) {
      agent.stop();
      this.activeAgents.delete(agentId);
    }
  }

  static onProgress(callback: (progress: AgentProgress) => void): () => void {
    this.progressListeners.push(callback);
    // Return an unsubscribe function to prevent memory leaks
    return () => {
      const idx = this.progressListeners.indexOf(callback);
      if (idx !== -1) {
        this.progressListeners.splice(idx, 1);
      }
    };
  }

  static notifyProgress(progress: AgentProgress): void {
    this.progressListeners.forEach(listener => listener(progress));
  }
}
