/**
 * Manus Agent — Omni One Backend
 *
 * Specialized agent for deep research, autonomous execution,
 * and complex project analysis using Manus AI v2 API.
 */
import { logger } from "../utils/logger.js";
import { manusProvider } from "../providers/ManusProvider.js";
import { AppError } from "../types/index.js";

export interface ManusTaskResult {
  status: "COMPLETED" | "FAILED" | "IN_PROGRESS";
  taskId: string;
  taskUrl: string;
  output: string;
  steps?: string[];
  artifacts?: string[];
  cost: number;
  endpointsCalled: string[];
  durationMs: number;
}

class ManusAgentClass {
  /**
   * Execute an autonomous task using Manus API v2.
   * Makes REAL HTTP calls to https://api.manus.ai
   */
  async runAutonomousTask(
    userId: string,
    task: string,
    context: { apiKey?: string; tools?: unknown[] } = {}
  ): Promise<ManusTaskResult> {
    logger.info({ userId, task: task.slice(0, 80) }, "[ManusAgent] Starting autonomous task");

    try {
      const result = await manusProvider.execute({
        prompt: task,
        tools: context.tools ?? [],
        apiKey: context.apiKey,
      });

      return {
        status: "COMPLETED",
        taskId: result.id,
        taskUrl: result.taskUrl,
        output: result.content,
        steps: ["Task created via Manus API", "Polled task.listMessages", "Task completed"],
        cost: await manusProvider.estimateCost(result.usage.total_tokens),
        endpointsCalled: result.endpointsCalled,
        durationMs: result.durationMs,
      };
    } catch (error) {
      logger.error({ userId, error }, "[ManusAgent] Task failed");
      throw new AppError("Manus Agent failed to complete autonomous task", 500, "INTERNAL_ERROR");
    }
  }

  async analyzeProject(userId: string, projectId: string, apiKey?: string) {
    return this.runAutonomousTask(
      userId,
      `Analyze the entire project structure and documentation for project ID: ${projectId}`,
      { apiKey }
    );
  }

  async executeWebAutomation(userId: string, objective: string, apiKey?: string) {
    return this.runAutonomousTask(userId, `Perform the following web automation task: ${objective}`, { apiKey });
  }
}

export const manusAgent = new ManusAgentClass();
