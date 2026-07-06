import { ToolRegistry } from "./ToolRegistry";
import { ToolManager } from "./ToolManager";
import { ToolPipeline } from "./ToolPipeline";
import { OmniPlanner } from "../planning/OmniPlanner";
import { OmniMemory } from "../memory/OmniMemory";
import { Intent } from "../../types";

export interface ToolIntegrationConfig {
  enableMemory: boolean;
  enablePlanning: boolean;
  enablePipeline: boolean;
  maxExecutionTime: number;
}

export class ToolIntegration {
  private toolRegistry: ToolRegistry;
  private toolManager: ToolManager;
  private toolPipeline: ToolPipeline;
  private planner: OmniPlanner;
  private memory: OmniMemory;
  private config: ToolIntegrationConfig;

  constructor(config: Partial<ToolIntegrationConfig> = {}) {
    this.toolRegistry = new ToolRegistry();
    this.toolManager = new ToolManager(this.toolRegistry);
    this.toolPipeline = new ToolPipeline(this.toolManager);
    this.planner = new OmniPlanner(this.toolRegistry);
    this.memory = new OmniMemory();

    this.config = {
      enableMemory: config.enableMemory !== false,
      enablePlanning: config.enablePlanning !== false,
      enablePipeline: config.enablePipeline !== false,
      maxExecutionTime: config.maxExecutionTime || 60000,
    };
  }

  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  getToolManager(): ToolManager {
    return this.toolManager;
  }

  getToolPipeline(): ToolPipeline {
    return this.toolPipeline;
  }

  getPlanner(): OmniPlanner {
    return this.planner;
  }

  getMemory(): OmniMemory {
    return this.memory;
  }

  async executeIntent(intent: Intent, goal: string): Promise<any> {
    // Store intent in memory
    if (this.config.enableMemory) {
      this.memory.addMemoryEntry("interaction", { intent, goal }, 0.7, [
        intent.type,
      ]);
    }

    // Create execution plan
    let plan;
    if (this.config.enablePlanning) {
      plan = await this.planner.plan(intent, goal);
      plan = await this.planner.optimizePlan(plan);

      if (!this.planner.validatePlan(plan)) {
        throw new Error("Invalid execution plan");
      }

      if (this.config.enableMemory) {
        this.memory.addMemoryEntry("context", { plan }, 0.8, ["planning"]);
      }
    }

    // Execute pipeline
    if (this.config.enablePipeline && plan) {
      this.toolPipeline.clearSteps();
      this.toolPipeline.addSteps(plan.steps);

      const result = await this.toolPipeline.execute();

      if (this.config.enableMemory) {
        this.memory.addMemoryEntry(
          "result",
          { success: result.success, output: result.finalOutput },
          result.success ? 0.9 : 0.5,
          ["execution"]
        );
      }

      return result;
    }

    return null;
  }

  registerDefaultTools(): void {
    // This will be called to register all default tools
    // Implementation depends on tool initialization
  }

  getMemoryContext(): any {
    return {
      workingMemory: Array.from(this.memory["workingMemory"].entries()),
      recentMemory: this.memory.getRecentMemory(5),
      stats: this.memory.getMemoryStats(),
    };
  }
}
