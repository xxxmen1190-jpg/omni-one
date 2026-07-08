import { BaseAgent } from "./BaseAgent";
import { AgentPlan } from "../../types/agent";
import { PlanningEngine, ExecutionEngine } from "./AgentEngines";
import { Logger } from "../system/Logger";

export class GeneralAgent extends BaseAgent {
  id = "general-agent";
  name = "General Assistant";
  description = "A versatile agent for general tasks.";
  version = "1.0.0";

  async execute(input: string, context?: any): Promise<void> {
    this.updateStatus("planning");
    this.currentPlan = await this.plan(input);
    
    this.updateStatus("executing");
    const apiKeys = context?.apiKeys || {};
    await ExecutionEngine.executePlan(this.id, this.name, this.currentPlan, apiKeys);
    
    this.updateStatus("completed");
  }

  async plan(input: string): Promise<AgentPlan> {
    // In a real scenario, we might pass specific instructions to the PlanningEngine
    return PlanningEngine.generatePlan(input, this.name, {});
  }
}

export class ResearchAgent extends BaseAgent {
  id = "research-agent";
  name = "Research Specialist";
  description = "Expert in gathering and analyzing information.";
  version = "1.0.0";
  
  capabilities = {
    ...this.capabilities,
    canSearch: true
  };

  async execute(input: string, context?: any): Promise<void> {
    this.updateStatus("planning");
    this.currentPlan = await this.plan(input);
    
    this.updateStatus("executing");
    const apiKeys = context?.apiKeys || {};
    await ExecutionEngine.executePlan(this.id, this.name, this.currentPlan, apiKeys);
    
    this.updateStatus("completed");
  }

  async plan(input: string): Promise<AgentPlan> {
    const plan = await PlanningEngine.generatePlan(input, this.name, {});
    // Customize research steps
    plan.steps = [
      { id: "r1", title: "Query Formulation", description: "Creating search queries.", status: "pending" },
      { id: "r2", title: "Web Search", description: "Gathering sources.", status: "pending" },
      { id: "r3", title: "Source Analysis", description: "Extracting key facts.", status: "pending" },
      { id: "r4", title: "Synthesis", description: "Writing research report.", status: "pending" }
    ];
    return plan;
  }
}

export class CodingAgent extends BaseAgent {
  id = "coding-agent";
  name = "Software Engineer";
  description = "Expert in writing and debugging code.";
  version = "1.0.0";
  
  capabilities = {
    ...this.capabilities,
    canCode: true
  };

  async execute(input: string, context?: any): Promise<void> {
    this.updateStatus("planning");
    this.currentPlan = await this.plan(input);
    
    this.updateStatus("executing");
    const apiKeys = context?.apiKeys || {};
    await ExecutionEngine.executePlan(this.id, this.name, this.currentPlan, apiKeys);
    
    this.updateStatus("completed");
  }

  async plan(input: string): Promise<AgentPlan> {
    const plan = await PlanningEngine.generatePlan(input, this.name, {});
    plan.steps = [
      { id: "c1", title: "Architecture Design", description: "Planning the code structure.", status: "pending" },
      { id: "c2", title: "Implementation", description: "Writing the code.", status: "pending" },
      { id: "c3", title: "Unit Testing", description: "Verifying functionality.", status: "pending" },
      { id: "c4", title: "Refactoring", description: "Optimizing code quality.", status: "pending" }
    ];
    return plan;
  }
}
