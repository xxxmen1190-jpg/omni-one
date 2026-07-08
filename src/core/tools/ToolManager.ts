import { ToolRegistry } from "./ToolRegistry";

export interface ToolExecutionResult {
  toolId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
  timestamp: number;
}

export interface ToolExecutionContext {
  toolId: string;
  input: any;
  timeout?: number;
  retries?: number;
}

export class ToolManager {
  // ToolRegistry is a static class - accept it as typeof ToolRegistry
  private executionHistory: ToolExecutionResult[] = [];
  private maxHistorySize: number = 1000;

  constructor(_registry: typeof ToolRegistry) {
    // ToolRegistry is static, no instance needed
  }

  async execute(context: ToolExecutionContext): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const tool = ToolRegistry.get(context.toolId);

    if (!tool) {
      return {
        toolId: context.toolId,
        success: false,
        error: `Tool with id ${context.toolId} not found`,
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }

    try {
      // Validate input
      const isValid = tool.validate ? await tool.validate(context.input) : true;
      if (!isValid) {
        return {
          toolId: context.toolId,
          success: false,
          error: "Invalid input for tool",
          executionTime: Date.now() - startTime,
          timestamp: Date.now(),
        };
      }

      // Execute tool with retries
      const retries = context.retries || 1;
      let lastError: any;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const result = await this.executeWithTimeout(
            tool,
            context.input,
            context.timeout || 30000
          );

          const executionResult: ToolExecutionResult = {
            toolId: context.toolId,
            success: true,
            result,
            executionTime: Date.now() - startTime,
            timestamp: Date.now(),
          };

          this.addToHistory(executionResult);
          return executionResult;
        } catch (error) {
          lastError = error;
          if (attempt < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          }
        }
      }

      return {
        toolId: context.toolId,
        success: false,
        error: lastError?.message || "Tool execution failed",
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        toolId: context.toolId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
        timestamp: Date.now(),
      };
    }
  }

  private async executeWithTimeout(
    tool: { execute: (input: any) => Promise<any> },
    input: any,
    timeout: number
  ): Promise<any> {
    return Promise.race([
      tool.execute(input),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Tool execution timeout after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
  }

  private addToHistory(result: ToolExecutionResult): void {
    this.executionHistory.push(result);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  getExecutionHistory(): ToolExecutionResult[] {
    return [...this.executionHistory];
  }

  getExecutionHistoryForTool(toolId: string): ToolExecutionResult[] {
    return this.executionHistory.filter((result) => result.toolId === toolId);
  }

  clearExecutionHistory(): void {
    this.executionHistory = [];
  }

  getRegistry(): typeof ToolRegistry {
    return ToolRegistry;
  }
}
