/**
 * Manus Provider — Omni One Backend
 *
 * REAL integration with Manus API v2.
 * Base URL : https://api.manus.ai
 * Auth     : x-manus-api-key header
 *
 * Verified response structure (2026-07-11):
 *   task.create  → { ok, task_id, task_url, task_title, ... }  (root-level, NOT data.task_id)
 *   task.listMessages → { ok, messages[], has_more, task_id }  (messages[] at root, NOT data.items)
 *
 * Endpoints used:
 *   POST /v2/task.create        — create a new autonomous task
 *   GET  /v2/task.listMessages  — poll for progress / results
 *   POST /v2/task.stop          — cancel a running task
 *   GET  /v2/task.list          — validate API key
 */
import { logger } from "../utils/logger.js";
import { AppError } from "../types/index.js";

const MANUS_API_BASE = "https://api.manus.ai";
const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 200; // ~10 minutes

export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsLongRunning: boolean;
  maxContextWindow: number;
}

class ManusProviderClass {
  private apiKey: string | null = null;
  private isInitialized = false;

  async initialize(apiKey: string): Promise<void> {
    this.apiKey = apiKey;
    this.isInitialized = true;
    logger.info("ManusProvider initialized with real API key");
  }

  /** Live ping to /v2/task.list — returns true only if the key is accepted */
  async validateApiKey(apiKey: string): Promise<boolean> {
    try {
      const res = await this._get("/v2/task.list?limit=1", apiKey);
      return res.ok === true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isInitialized || !this.apiKey) return false;
    return this.validateApiKey(this.apiKey);
  }

  async estimateLatency(): Promise<number> { return 1_500; }
  async estimateCost(tokens: number): Promise<number> { return tokens * 0.00002; }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsStreaming: false,   // Manus uses polling, not streaming
      supportsVision: true,
      supportsTools: true,
      supportsLongRunning: true,
      maxContextWindow: 128_000,
    };
  }

  /**
   * Execute a task via Manus API v2.
   *
   * Flow:
   *   1. POST /v2/task.create        → get task_id (at root level)
   *   2. GET  /v2/task.listMessages  → poll messages[] until agent_status=stopped|error
   *   3. POST /v2/task.stop          → only on timeout
   */
  async execute(params: {
    prompt: string;
    systemPrompt?: string;
    stream?: boolean;
    tools?: unknown[];
    apiKey?: string;
  }): Promise<{
    id: string;
    taskUrl: string;
    content: string;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    model: string;
    endpointsCalled: string[];
    durationMs: number;
  }> {
    const key = params.apiKey ?? this.apiKey;
    if (!key) throw new AppError("Manus Provider not initialized — no API key", 500, "INTERNAL_ERROR");

    const startMs = Date.now();
    const endpointsCalled: string[] = [];

    // ── 1. Create task ────────────────────────────────────────────────────────
    logger.info({ prompt: params.prompt.slice(0, 80) }, "[ManusProvider] POST /v2/task.create");
    const createBody = {
      message: { role: "user", content: params.prompt },
      hide_in_task_list: false,
      interactive_mode: false,
    };

    const createResp = await this._post("/v2/task.create", createBody, key);
    endpointsCalled.push("POST /v2/task.create");

    // NOTE: Manus API v2 returns task_id at ROOT level, not inside data{}
    const taskId: string | undefined = createResp.task_id ?? createResp.data?.task_id;
    const taskUrl: string = createResp.task_url ?? createResp.data?.task_url ?? `https://manus.im/app/${taskId}`;

    if (!createResp.ok || !taskId) {
      const errMsg = createResp.error?.message ?? JSON.stringify(createResp);
      logger.error({ createResp }, "[ManusProvider] task.create failed");
      throw new AppError(`Manus task.create failed: ${errMsg}`, 502, "PROVIDER_ERROR");
    }

    logger.info({ taskId, taskUrl }, "[ManusProvider] Task created");

    // ── 2. Poll until stopped / error ─────────────────────────────────────────
    let finalOutput = "";
    let pollAttempt = 0;
    let cursor: string | undefined;

    while (pollAttempt < MAX_POLL_ATTEMPTS) {
      await sleep(POLL_INTERVAL_MS);
      pollAttempt++;

      const qs = `task_id=${encodeURIComponent(taskId)}&order=asc&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
      const pollResp = await this._get(`/v2/task.listMessages?${qs}`, key);

      if (!endpointsCalled.includes("GET /v2/task.listMessages")) {
        endpointsCalled.push("GET /v2/task.listMessages");
      }

      if (!pollResp.ok) {
        logger.warn({ pollResp }, "[ManusProvider] Poll error response");
        continue;
      }

      // NOTE: Manus API v2 returns messages[] at ROOT level, not inside data{}
      const items: any[] = pollResp.messages ?? pollResp.data?.items ?? [];
      if (pollResp.next_cursor) cursor = pollResp.next_cursor;

      let taskDone = false;
      for (const item of items) {
        const itemType: string = item.type ?? "";

        // Collect assistant output
        if (itemType === "assistant_message") {
          const content = item.assistant_message?.content;
          if (content) finalOutput = content;
        }

        // Status updates
        if (itemType === "status_update") {
          const agentStatus: string = item.status_update?.agent_status ?? "";
          logger.info({ agentStatus, pollAttempt, brief: item.status_update?.brief }, "[ManusProvider] Status update");

          if (agentStatus === "stopped") {
            taskDone = true;
            logger.info({ taskId, pollAttempt }, "[ManusProvider] Task completed");
            break;
          }
          if (agentStatus === "error") {
            throw new AppError("Manus task ended with error status", 502, "PROVIDER_ERROR");
          }
        }
      }

      if (taskDone) {
        return {
          id: taskId,
          taskUrl,
          content: finalOutput || "Task completed. No text output returned.",
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: "manus-1.6",
          endpointsCalled,
          durationMs: Date.now() - startMs,
        };
      }
    }

    // ── 3. Timeout — stop the task ────────────────────────────────────────────
    logger.warn({ taskId }, "[ManusProvider] Poll timeout — stopping task");
    try {
      await this._post("/v2/task.stop", { task_id: taskId }, key);
      endpointsCalled.push("POST /v2/task.stop");
    } catch (e) {
      logger.warn({ e }, "[ManusProvider] Could not stop timed-out task");
    }

    return {
      id: taskId,
      taskUrl,
      content: finalOutput || "Task timed out.",
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: "manus-1.6",
      endpointsCalled,
      durationMs: Date.now() - startMs,
    };
  }

  // ── HTTP helpers ──────────────────────────────────────────────────────────────
  private async _post(path: string, body: unknown, apiKey: string): Promise<any> {
    const res = await fetch(`${MANUS_API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-manus-api-key": apiKey },
      body: JSON.stringify(body),
    });
    return res.json();
  }

  private async _get(path: string, apiKey: string): Promise<any> {
    const res = await fetch(`${MANUS_API_BASE}${path}`, {
      method: "GET",
      headers: { "x-manus-api-key": apiKey },
    });
    return res.json();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export const manusProvider = new ManusProviderClass();
