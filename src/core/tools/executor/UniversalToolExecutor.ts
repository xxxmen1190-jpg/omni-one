import { ITool, ToolExecutionLog, ToolResult } from "../types";
import { Logger } from "../../system/Logger";
import { Metrics } from "../../system/Metrics";
import { PermissionManager } from "../../system/PermissionManager";
import { ToolRegistry } from "../ToolRegistry";

export class UniversalToolExecutor {
  static async execute(
    toolId: string,
    params: Record<string, any>,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const tool = ToolRegistry.getTool(toolId);
    if (!tool) {
      Logger.error(`Tool ${toolId} not found.`);
      return { success: false, output: null, error: `Tool ${toolId} not found.` };
    }

    Logger.info(`Executing tool: ${tool.name}`, { toolId, params });

    // 1. Permission Validation
    const requiredPermissions = tool.getPermissions ? tool.getPermissions() : [];
    for (const perm of requiredPermissions) {
      if (!PermissionManager.checkPermission(toolId, perm)) {
        Logger.warn(`Permission denied for tool ${tool.name}`, { toolId, permission: perm });
        return { success: false, output: null, error: `Permission denied for ${perm}.` };
      }
    }

    const startTime = Date.now();
    let result: ToolResult = { success: false, output: null, error: "Execution not started" };
    let retryCount = 0;
    const maxRetries = 3;
    const initialDelay = 1000;

    while (retryCount <= maxRetries) {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), tool.timeoutMs || 60000);
      try {
        // 2. Timeout Handling
        const toolSignal = signal || new AbortController().signal;
        const combinedSignal = this.anySignal([toolSignal, timeoutController.signal]);

        result = await tool.execute(params, combinedSignal);
        clearTimeout(timeoutId);
        break; // Success, exit retry loop
      } catch (error: any) {
        clearTimeout(timeoutId);
        Logger.error(`Tool ${tool.name} execution failed`, { toolId, attempt: retryCount + 1, error: error.message });

        if (error.name === "AbortError" && timeoutController.signal.aborted) {
          result = { success: false, output: null, error: `Tool ${tool.name} timed out.` };
          break; // Do not retry on timeout
        }

        if (retryCount < maxRetries && this.isRetryableError(error)) {
          const delay = initialDelay * Math.pow(2, retryCount);
          Logger.warn(`Retrying tool ${tool.name} in ${delay}ms`, { toolId, attempt: retryCount + 1 });
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
        } else {
          result = { success: false, output: null, error: error.message };
          break; // Max retries reached or non-retryable error
        }
      }
    }

    const duration = Date.now() - startTime;

    // 3. Metrics Collection & Execution Logging
    const logEntry: ToolExecutionLog = {
      toolId: tool.id,
      toolName: tool.name,
      timestamp: Date.now(),
      duration,
      success: result.success,
      error: result.error,
      input: params,
      output: result.output,
      metrics: { retryCount },
    };
    Logger.info(`Tool execution finished: ${tool.name}`, logEntry);
    Metrics.recordToolExecution(tool.id, duration, result.success);

    return result;
  }

  private static isRetryableError(error: any): boolean {
    const msg = (error.message || "").toLowerCase();
    return msg.includes("network error") || msg.includes("service unavailable") || msg.includes("503");
  }

  private static anySignal(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    for (const sig of signals) {
      if (sig.aborted) {
        controller.abort();
        return controller.signal;
      }
      sig.addEventListener("abort", () => controller.abort(), { once: true });
    }
    return controller.signal;
  }
}
