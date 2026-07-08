/**
 * ToolValidator — Phase 12.9 Step 3
 * Automatically validates every registered tool through its full lifecycle:
 * initialize → healthCheck → validate → execute → cleanup
 *
 * Generates a structured validation report.
 */

import { ToolSDKRegistry } from "./ToolSDKRegistry";
import { IToolSDK, ToolExecutionContext, ApiKeyRequirement } from "./IToolSDK";
import { Logger } from "../../system/Logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToolValidationStatus =
  | "PASS"
  | "FAIL"
  | "SKIP"
  | "WARN";

export interface ToolStepResult {
  step: "initialize" | "healthCheck" | "validate" | "execute" | "cleanup";
  status: ToolValidationStatus;
  durationMs: number;
  error?: string;
  detail?: unknown;
}

export interface ToolValidationResult {
  toolId: string;
  toolName: string;
  category: string;
  overallStatus: ToolValidationStatus;
  steps: ToolStepResult[];
  totalDurationMs: number;
  capabilities: string[];
  requiredApiKeys: string[];
  missingApiKeys: string[];
  notes: string[];
}

export interface ValidationReport {
  generatedAt: string;
  totalTools: number;
  passed: number;
  failed: number;
  warned: number;
  skipped: number;
  results: ToolValidationResult[];
  summary: string;
}

// ─── Validator ────────────────────────────────────────────────────────────────

export class ToolValidator {
  private registry: typeof ToolSDKRegistry;

  constructor() {
    this.registry = ToolSDKRegistry;
  }

  /**
   * Validate all registered tools and return a full report.
   */
  async validateAll(options: { timeout?: number; parallel?: boolean } = {}): Promise<ValidationReport> {
    const { timeout = 15000, parallel = false } = options;
    const tools = this.registry.getAll();

    Logger.info(`ToolValidator: validating ${tools.length} tools`, { parallel });

    let results: ToolValidationResult[];
    if (parallel) {
      results = await Promise.all(tools.map((t: IToolSDK) => this.validateTool(t, timeout)));
    } else {
      results = [];
      for (const tool of tools) {
        results.push(await this.validateTool(tool as IToolSDK, timeout));
      }
    }

    const passed = results.filter((r) => r.overallStatus === "PASS").length;
    const failed = results.filter((r) => r.overallStatus === "FAIL").length;
    const warned = results.filter((r) => r.overallStatus === "WARN").length;
    const skipped = results.filter((r) => r.overallStatus === "SKIP").length;

    const report: ValidationReport = {
      generatedAt: new Date().toISOString(),
      totalTools: tools.length,
      passed,
      failed,
      warned,
      skipped,
      results,
      summary: `${passed}/${tools.length} tools passed validation. ${failed} failed, ${warned} warned, ${skipped} skipped.`,
    };

    Logger.info("ToolValidator: validation complete", { passed, failed, warned, skipped });
    return report;
  }

  /**
   * Validate a single tool through its full lifecycle.
   */
  async validateTool(tool: IToolSDK, timeout = 15000): Promise<ToolValidationResult> {
    const startTotal = Date.now();
    const steps: ToolStepResult[] = [];
    const notes: string[] = [];

    // Check for missing API keys
    const requiredKeys = tool.metadata.requiredApiKeys ?? [];
    const missingKeys = requiredKeys.filter((k) => !this.getEnv(typeof k === "string" ? k : k.envVar));
    if (missingKeys.length > 0) {
      notes.push(`Missing API keys: ${missingKeys.map((k: any) => typeof k === "string" ? k : k.envVar).join(", ")} — some steps may be skipped`);
    }

    // ── Step 1: initialize ────────────────────────────────────────────────────
    steps.push(await this.runStep("initialize", timeout, async () => {
      await tool.initialize();
      return { initialized: true };
    }));

    // ── Step 2: healthCheck ───────────────────────────────────────────────────
    steps.push(await this.runStep("healthCheck", timeout, async () => {
      const health = await tool.healthCheck();
      if (!health.healthy) notes.push(`Health check unhealthy: ${health.message ?? "no message"}`);
      return health;
    }));

    // ── Step 3: validate ──────────────────────────────────────────────────────
    const sampleInput = this.getSampleInput(tool.metadata.id);
    steps.push(await this.runStep("validate", timeout, async () => {
      const result = await tool.validate(sampleInput);
      return result;
    }));

    // ── Step 4: execute ───────────────────────────────────────────────────────
    if (missingKeys.length > 0 && this.isApiKeyRequired(tool)) {
      steps.push({
        step: "execute",
        status: "SKIP",
        durationMs: 0,
        detail: `Skipped: missing API keys ${missingKeys.join(", ")}`,
      });
      notes.push("Execute step skipped due to missing API keys");
    } else {
      const ctx = this.buildContext(tool);
      steps.push(await this.runStep("execute", timeout, async () => {
        const result = await tool.execute(sampleInput);
        return result;
      }));
    }

    // ── Step 5: cleanup ───────────────────────────────────────────────────────
    steps.push(await this.runStep("cleanup", timeout, async () => {
      await tool.cleanup();
      return { cleaned: true };
    }));

    // ── Determine overall status ──────────────────────────────────────────────
    const hasFail = steps.some((s) => s.status === "FAIL");
    const hasWarn = steps.some((s) => s.status === "WARN");
    const allSkipped = steps.every((s) => s.status === "SKIP");
    const overallStatus: ToolValidationStatus = hasFail
      ? "FAIL"
      : allSkipped
      ? "SKIP"
      : hasWarn
      ? "WARN"
      : "PASS";

    return {
      toolId: tool.metadata.id,
      toolName: tool.metadata.name,
      category: tool.metadata.category,
      overallStatus,
      steps,
      totalDurationMs: Date.now() - startTotal,
      capabilities: (tool.metadata.capabilities ?? []) as any,
      requiredApiKeys: requiredKeys as any,
      missingApiKeys: missingKeys as any,
      notes,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async runStep(
    step: ToolStepResult["step"],
    timeout: number,
    fn: () => Promise<unknown>
  ): Promise<ToolStepResult> {
    const start = Date.now();
    try {
      const detail = await Promise.race([
        fn(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)),
      ]);
      return { step, status: "PASS", durationMs: Date.now() - start, detail };
    } catch (err) {
      return {
        step,
        status: "FAIL",
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private getSampleInput(toolId: string): Record<string, unknown> {
    const samples: Record<string, Record<string, unknown>> = {
      // Browser
      "browser-open-url": { url: "https://example.com" },
      "browser-read-page": { url: "https://example.com" },
      "browser-extract-text": { url: "https://example.com" },
      "browser-extract-links": { url: "https://example.com" },
      "browser-screenshot": { url: "https://example.com" },
      // Files
      "files-read-txt": { path: "/tmp/test.txt", content: "hello" },
      "files-read-json": { path: "/tmp/test.json" },
      "files-read-csv": { path: "/tmp/test.csv" },
      "files-read-markdown": { path: "/tmp/test.md" },
      // HTTP
      "http-rest": { url: "https://httpbin.org/get", method: "GET" },
      "http-graphql": { endpoint: "https://countries.trevorblades.com/", query: "{ continents { code name } }" },
      // GitHub
      "github-read-repo": { owner: "octocat", repo: "Hello-World" },
      "github-read-file": { owner: "octocat", repo: "Hello-World", path: "README" },
      // Wikipedia (via WebSearch)
      "web-search": { query: "TypeScript programming language", limit: 3 },
      // Default
    };
    return samples[toolId] ?? { test: true, query: "test" };
  }

  private buildContext(tool: IToolSDK): ToolExecutionContext {
    return {
      executionId: `validation-${Date.now()}`,
      toolId: tool.metadata.id,
      input: {},
      timeout: 10000,
    } as ToolExecutionContext;
  }

  private collectApiKeys(keys: ApiKeyRequirement[] | string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const k of keys) {
      const envVar = typeof k === "string" ? k : k.envVar;
      const val = this.getEnv(envVar);
      if (val) result[envVar] = val;
    }
    return result;
  }

  private isApiKeyRequired(tool: IToolSDK): boolean {
    return (tool.metadata.requiredApiKeys?.length ?? 0) > 0;
  }

  private getEnv(key: string): string | undefined {
    return typeof process !== "undefined" ? process.env[key] : undefined;
  }
}

// ─── Report Formatter ─────────────────────────────────────────────────────────

export function formatValidationReport(report: ValidationReport): string {
  const lines: string[] = [
    `# Tool Validation Report`,
    ``,
    `**Generated:** ${report.generatedAt}`,
    `**Total Tools:** ${report.totalTools}`,
    `**Passed:** ${report.passed} | **Failed:** ${report.failed} | **Warned:** ${report.warned} | **Skipped:** ${report.skipped}`,
    ``,
    `> ${report.summary}`,
    ``,
    `---`,
    ``,
    `## Results`,
    ``,
  ];

  for (const r of report.results) {
    const icon = r.overallStatus === "PASS" ? "✅" : r.overallStatus === "FAIL" ? "❌" : r.overallStatus === "WARN" ? "⚠️" : "⏭️";
    lines.push(`### ${icon} \`${r.toolId}\` — ${r.toolName}`);
    lines.push(`**Category:** ${r.category} | **Duration:** ${r.totalDurationMs}ms | **Status:** ${r.overallStatus}`);
    if (r.missingApiKeys.length > 0) {
      lines.push(`**Missing API Keys:** ${r.missingApiKeys.join(", ")}`);
    }
    lines.push(``);
    lines.push(`| Step | Status | Duration |${r.steps.some((s) => s.error) ? " Error |" : ""}`);
    lines.push(`|------|--------|----------|${r.steps.some((s) => s.error) ? "-------|" : ""}`);
    for (const step of r.steps) {
      const stepIcon = step.status === "PASS" ? "✅" : step.status === "FAIL" ? "❌" : step.status === "WARN" ? "⚠️" : "⏭️";
      const errorCol = r.steps.some((s) => s.error) ? ` ${step.error ?? ""} |` : "";
      lines.push(`| ${step.step} | ${stepIcon} ${step.status} | ${step.durationMs}ms |${errorCol}`);
    }
    if (r.notes.length > 0) {
      lines.push(``);
      for (const note of r.notes) lines.push(`> 📝 ${note}`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

export const createToolValidator = (): ToolValidator => new ToolValidator();
