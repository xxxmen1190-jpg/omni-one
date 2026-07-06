import { ToolRegistry } from "../tools/ToolRegistry";
import { PipelineStep } from "../tools/ToolPipeline";
import { Intent } from "../../types";

export interface ExecutionPlan {
  id: string;
  goal: string;
  steps: PipelineStep[];
  estimatedTime: number;
  confidence: number;
  reasoning: string;
}

export class OmniPlanner {
  private toolRegistry: ToolRegistry;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
  }

  async plan(intent: Intent, goal: string): Promise<ExecutionPlan> {
    const planId = this.generatePlanId();
    const steps: PipelineStep[] = [];

    // Analyze intent and create execution plan
    switch (intent.type) {
      case "search":
        steps.push({
          toolId: "http-request",
          input: {
            url: "https://api.example.com/search",
            method: "GET",
          },
        });
        break;

      case "code":
        steps.push({
          toolId: "code-generation",
          input: {
            description: goal,
            language: "typescript",
          },
        });
        steps.push({
          toolId: "code-analysis",
          input: {
            code: "${output}",
            language: "typescript",
            analysisType: "quality",
          },
        });
        break;

      case "image":
        steps.push({
          toolId: "image-generation",
          input: {
            prompt: goal,
            size: "1024x1024",
          },
        });
        break;

      case "vision":
        steps.push({
          toolId: "image-recognition",
          input: {
            imageUrl: intent.payload?.imageUrl || "",
            detectionType: "all",
          },
        });
        break;

      case "summarize":
        steps.push({
          toolId: "text-processing",
          input: {
            text: intent.payload?.text || goal,
            operation: "summarize",
          },
        });
        break;

      case "translate":
        steps.push({
          toolId: "text-processing",
          input: {
            text: intent.payload?.text || goal,
            operation: "translate",
            language: intent.payload?.targetLanguage || "en",
          },
        });
        break;

      case "documents":
        steps.push({
          toolId: "document-processing",
          input: {
            documentUrl: intent.payload?.documentUrl || "",
            extractionType: "all",
          },
        });
        break;

      case "browser":
        steps.push({
          toolId: "browser-navigation",
          input: {
            url: intent.payload?.url || goal,
          },
        });
        break;

      default:
        // Generic chat/reasoning
        steps.push({
          toolId: "http-request",
          input: {
            url: "https://api.example.com/chat",
            method: "POST",
            body: { query: goal },
          },
        });
    }

    const estimatedTime = steps.length * 1000; // Rough estimate

    return {
      id: planId,
      goal,
      steps,
      estimatedTime,
      confidence: intent.confidence,
      reasoning: `Plan created for ${intent.type} intent with confidence ${intent.confidence}`,
    };
  }

  async optimizePlan(plan: ExecutionPlan): Promise<ExecutionPlan> {
    // Optimize the plan by removing redundant steps or reordering
    const optimizedSteps = this.deduplicateSteps(plan.steps);

    return {
      ...plan,
      steps: optimizedSteps,
      reasoning: `Optimized plan: reduced from ${plan.steps.length} to ${optimizedSteps.length} steps`,
    };
  }

  private deduplicateSteps(steps: PipelineStep[]): PipelineStep[] {
    const seen = new Set<string>();
    return steps.filter((step) => {
      const key = `${step.toolId}-${JSON.stringify(step.input)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private generatePlanId(): string {
    return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  validatePlan(plan: ExecutionPlan): boolean {
    // Validate that all tools in the plan exist
    for (const step of plan.steps) {
      if (!this.toolRegistry.has(step.toolId)) {
        console.warn(`Tool ${step.toolId} not found in registry`);
        return false;
      }
    }
    return true;
  }
}
