/**
 * AbstractToolSDK
 * Base class for all tools in the Omni One system.
 * Provides default lifecycle management, validation, streaming, and error handling.
 * Every concrete tool MUST extend this class.
 */

import {
  IToolSDK,
  ToolMetadataSDK,
  ToolStatus,
  ToolExecutionResult,
  StreamCallback,
  StreamChunk,
  HealthCheckResult,
} from "./IToolSDK";
import { Logger } from "../../system/Logger";

export abstract class AbstractToolSDK implements IToolSDK {
  private _status: ToolStatus = "idle";
  private _activeExecutions: Map<string, AbortController> = new Map();
  private _initialized = false;

  constructor(public readonly metadata: ToolMetadataSDK) {}

  // ─── Status ────────────────────────────────────────────────────────────────

  get status(): ToolStatus {
    return this._status;
  }

  protected setStatus(status: ToolStatus): void {
    this._status = status;
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (this._initialized) return;
    this._status = "initializing";
    try {
      await this.onInitialize();
      this._initialized = true;
      this._status = "ready";
      Logger.info(`[ToolSDK] ${this.metadata.id} initialized`);
    } catch (err) {
      this._status = "error";
      Logger.error(`[ToolSDK] ${this.metadata.id} initialization failed`, { err });
      throw err;
    }
  }

  /** Override to add custom initialization logic */
  protected async onInitialize(): Promise<void> {}

  async cleanup(): Promise<void> {
    this._status = "disposed";
    // Cancel all active executions
    for (const [id, controller] of this._activeExecutions) {
      controller.abort();
      Logger.warn(`[ToolSDK] ${this.metadata.id} cancelled execution ${id} during cleanup`);
    }
    this._activeExecutions.clear();
    await this.onCleanup();
    Logger.info(`[ToolSDK] ${this.metadata.id} cleaned up`);
  }

  /** Override to add custom cleanup logic */
  protected async onCleanup(): Promise<void> {}

  // ─── Validation ────────────────────────────────────────────────────────────

  async validate(input: unknown): Promise<boolean> {
    if (input === null || input === undefined) {
      Logger.warn(`[ToolSDK] ${this.metadata.id} received null/undefined input`);
      return false;
    }
    return this.onValidate(input);
  }

  /** Override to add custom validation logic. Default: always valid. */
  protected async onValidate(_input: unknown): Promise<boolean> {
    return true;
  }

  // ─── Execute ───────────────────────────────────────────────────────────────

  async execute(input: unknown): Promise<ToolExecutionResult> {
    if (!this._initialized) await this.initialize();
    const executionId = `${this.metadata.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    this._activeExecutions.set(executionId, controller);
    const startTime = Date.now();
    this._status = "executing";

    try {
      const isValid = await this.validate(input);
      if (!isValid) {
        return this.buildResult(executionId, startTime, false, undefined, "Input validation failed");
      }

      const data = await this.onExecute(input, controller.signal);
      this._status = "ready";
      return this.buildResult(executionId, startTime, true, data);
    } catch (err) {
      this._status = "error";
      const message = err instanceof Error ? err.message : String(err);
      Logger.error(`[ToolSDK] ${this.metadata.id} execution error`, { executionId, message });
      return this.buildResult(executionId, startTime, false, undefined, message);
    } finally {
      this._activeExecutions.delete(executionId);
    }
  }

  /** Override to implement the tool's core execution logic */
  protected abstract onExecute(input: unknown, signal: AbortSignal): Promise<unknown>;

  // ─── Stream ────────────────────────────────────────────────────────────────

  async stream(input: unknown, callback: StreamCallback): Promise<ToolExecutionResult> {
    if (!this._initialized) await this.initialize();
    const executionId = `${this.metadata.id}-stream-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    this._activeExecutions.set(executionId, controller);
    const startTime = Date.now();
    this._status = "streaming";

    try {
      const isValid = await this.validate(input);
      if (!isValid) {
        return this.buildResult(executionId, startTime, false, undefined, "Input validation failed", true);
      }

      const data = await this.onStream(input, callback, controller.signal);
      this._status = "ready";
      return this.buildResult(executionId, startTime, true, data, undefined, true);
    } catch (err) {
      this._status = "error";
      const message = err instanceof Error ? err.message : String(err);
      Logger.error(`[ToolSDK] ${this.metadata.id} stream error`, { executionId, message });
      return this.buildResult(executionId, startTime, false, undefined, message, true);
    } finally {
      this._activeExecutions.delete(executionId);
    }
  }

  /**
   * Override to implement streaming logic.
   * Default implementation: execute and emit a single chunk.
   */
  protected async onStream(
    input: unknown,
    callback: StreamCallback,
    signal: AbortSignal
  ): Promise<unknown> {
    const data = await this.onExecute(input, signal);
    const chunk: StreamChunk = { index: 0, data, done: true };
    await callback(chunk);
    return data;
  }

  // ─── Cancel ────────────────────────────────────────────────────────────────

  async cancel(executionId: string): Promise<void> {
    const controller = this._activeExecutions.get(executionId);
    if (controller) {
      this._status = "cancelling";
      controller.abort();
      this._activeExecutions.delete(executionId);
      this._status = "ready";
      Logger.info(`[ToolSDK] ${this.metadata.id} cancelled execution ${executionId}`);
    }
  }

  // ─── Health Check ──────────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const result = await this.onHealthCheck();
      return result;
    } catch (err) {
      return {
        healthy: false,
        message: err instanceof Error ? err.message : "Health check threw an exception",
        timestamp: Date.now(),
      };
    }
  }

  /** Override to implement custom health check logic */
  protected async onHealthCheck(): Promise<HealthCheckResult> {
    return {
      healthy: this._status !== "error" && this._status !== "disposed",
      message: `Tool is ${this._status}`,
      timestamp: Date.now(),
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private buildResult(
    executionId: string,
    startTime: number,
    success: boolean,
    data?: unknown,
    error?: string,
    wasStreamed = false
  ): ToolExecutionResult {
    return {
      success,
      data,
      error,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
      executionId,
      wasStreamed,
    };
  }
}
