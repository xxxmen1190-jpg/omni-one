import { ToolManager, ToolExecutionResult } from "./ToolManager";

export interface PipelineStep {
  toolId: string;
  input: any;
  timeout?: number;
  retries?: number;
  mapOutput?: (output: any) => any;
}

export interface PipelineResult {
  success: boolean;
  steps: ToolExecutionResult[];
  finalOutput?: any;
  error?: string;
  executionTime: number;
}

export class ToolPipeline {
  private toolManager: ToolManager;
  private steps: PipelineStep[] = [];

  constructor(toolManager: ToolManager) {
    this.toolManager = toolManager;
  }

  addStep(step: PipelineStep): ToolPipeline {
    this.steps.push(step);
    return this;
  }

  addSteps(steps: PipelineStep[]): ToolPipeline {
    this.steps.push(...steps);
    return this;
  }

  clearSteps(): void {
    this.steps = [];
  }

  async execute(): Promise<PipelineResult> {
    const startTime = Date.now();
    const results: ToolExecutionResult[] = [];
    let previousOutput: any = null;

    try {
      for (const step of this.steps) {
        // Prepare input - use previous output if available
        let input = step.input;
        if (previousOutput !== null && typeof step.input === "string") {
          // If input is a string like "${output}", replace with previous output
          if (step.input.includes("${output}")) {
            input = step.input.replace("${output}", JSON.stringify(previousOutput));
            try {
              input = JSON.parse(input);
            } catch {
              // Keep as string if not valid JSON
            }
          }
        }

        // Execute tool
        const result = await this.toolManager.execute({
          toolId: step.toolId,
          input,
          timeout: step.timeout,
          retries: step.retries,
        });

        results.push(result);

        if (!result.success) {
          return {
            success: false,
            steps: results,
            error: result.error,
            executionTime: Date.now() - startTime,
          };
        }

        // Map output if provided
        previousOutput = step.mapOutput
          ? step.mapOutput(result.result)
          : result.result;
      }

      return {
        success: true,
        steps: results,
        finalOutput: previousOutput,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        steps: results,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      };
    }
  }

  getSteps(): PipelineStep[] {
    return [...this.steps];
  }

  getStepCount(): number {
    return this.steps.length;
  }
}
