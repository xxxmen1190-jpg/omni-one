/**
 * Phase 12.6 — Tool Result Fusion
 * When multiple tools return data for the same goal:
 *   1. Merge all results into a unified structure
 *   2. Deduplicate overlapping data
 *   3. Rank results by confidence and relevance
 *   4. Validate the merged output
 *   5. Return one unified, ranked answer
 */

import { ToolExecutionResult } from "./IToolSDK";
import { StepResult } from "./ToolPlanner";
import { Logger } from "../../system/Logger";

// ─── Fusion Types ─────────────────────────────────────────────────────────────

export interface FusedResult {
  /** Whether fusion succeeded */
  success: boolean;
  /** Merged, deduplicated, ranked data */
  data: FusedData;
  /** Confidence score 0–1 */
  confidence: number;
  /** Number of sources that contributed */
  sourcesUsed: number;
  /** Number of sources that failed */
  sourcesFailed: number;
  /** Deduplication stats */
  deduplication: DeduplicationStats;
  /** Validation result */
  validation: ValidationResult;
  /** Per-source breakdown */
  sources: SourceContribution[];
  /** Fusion timestamp */
  timestamp: number;
}

export interface FusedData {
  /** Primary answer / combined text */
  primary: string;
  /** Structured data merged from all sources */
  structured: Record<string, unknown>;
  /** Raw items from all sources (deduplicated) */
  items: FusedItem[];
  /** Metadata about the fusion */
  meta: Record<string, unknown>;
}

export interface FusedItem {
  /** Unique content hash for deduplication */
  hash: string;
  /** The actual data */
  data: unknown;
  /** Which tools contributed this item */
  sources: string[];
  /** Confidence score for this item */
  confidence: number;
  /** Rank (lower = higher priority) */
  rank: number;
}

export interface DeduplicationStats {
  totalItems: number;
  uniqueItems: number;
  duplicatesRemoved: number;
  deduplicationRate: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
  warnings: string[];
}

export interface SourceContribution {
  toolId: string;
  stepId: string;
  success: boolean;
  confidence: number;
  itemCount: number;
  error?: string;
}

// ─── Fusion Engine ────────────────────────────────────────────────────────────

export class ToolResultFusion {
  /**
   * Fuse results from multiple tool executions into a single unified answer.
   *
   * @param stepResults - Results from ToolExecutor.executePlan()
   * @param goal - The original goal (used for relevance ranking)
   */
  static fuse(stepResults: StepResult[], goal: string): FusedResult {
    Logger.info(`[ToolResultFusion] Fusing ${stepResults.length} results for goal: "${goal}"`);

    const sources: SourceContribution[] = [];
    const allItems: Array<{ toolId: string; stepId: string; data: unknown; confidence: number }> = [];
    let successCount = 0;
    let failCount = 0;
    let combinedText = "";

    // ── Step 1: Collect all data ─────────────────────────────────────────────
    for (const stepResult of stepResults) {
      if (!stepResult.success || !stepResult.result) {
        sources.push({
          toolId: stepResult.toolId,
          stepId: stepResult.stepId,
          success: false,
          confidence: 0,
          itemCount: 0,
          error: stepResult.error,
        });
        failCount++;
        continue;
      }

      successCount++;
      const toolData = stepResult.result.data;
      const items = ToolResultFusion.extractItems(toolData);
      const confidence = ToolResultFusion.computeConfidence(stepResult);

      sources.push({
        toolId: stepResult.toolId,
        stepId: stepResult.stepId,
        success: true,
        confidence,
        itemCount: items.length,
      });

      for (const item of items) {
        allItems.push({ toolId: stepResult.toolId, stepId: stepResult.stepId, data: item, confidence });
      }

      // Accumulate text
      const text = ToolResultFusion.extractText(toolData);
      if (text) combinedText += `[${stepResult.toolId}] ${text}\n\n`;
    }

    // ── Step 2: Deduplicate ──────────────────────────────────────────────────
    const { unique, stats } = ToolResultFusion.deduplicate(allItems);

    // ── Step 3: Rank ─────────────────────────────────────────────────────────
    const ranked = ToolResultFusion.rank(unique, goal);

    // ── Step 4: Merge structured data ────────────────────────────────────────
    const structured = ToolResultFusion.mergeStructured(stepResults);

    // ── Step 5: Validate ─────────────────────────────────────────────────────
    const validation = ToolResultFusion.validate(ranked, successCount, failCount);

    const overallConfidence = successCount > 0
      ? sources.filter((s) => s.success).reduce((sum, s) => sum + s.confidence, 0) / successCount
      : 0;

    const result: FusedResult = {
      success: successCount > 0,
      data: {
        primary: combinedText.trim() || "No results available",
        structured,
        items: ranked,
        meta: {
          goal,
          fusedAt: Date.now(),
          strategy: "weighted-merge",
        },
      },
      confidence: Math.round(overallConfidence * 100) / 100,
      sourcesUsed: successCount,
      sourcesFailed: failCount,
      deduplication: stats,
      validation,
      sources,
      timestamp: Date.now(),
    };

    Logger.info(`[ToolResultFusion] Fusion complete`, {
      confidence: result.confidence,
      sourcesUsed: successCount,
      uniqueItems: stats.uniqueItems,
    });

    return result;
  }

  // ─── Private Helpers ───────────────────────────────────────────────────────

  private static extractItems(data: unknown): unknown[] {
    if (data === null || data === undefined) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === "object") {
      const obj = data as Record<string, unknown>;
      // Look for common array fields
      for (const key of ["items", "results", "rows", "data", "list", "entries", "records"]) {
        if (Array.isArray(obj[key])) return obj[key] as unknown[];
      }
      return [data];
    }
    return [data];
  }

  private static extractText(data: unknown): string {
    if (typeof data === "string") return data;
    if (data === null || data === undefined) return "";
    if (typeof data === "object") {
      const obj = data as Record<string, unknown>;
      for (const key of ["text", "content", "body", "message", "response", "result", "output"]) {
        if (typeof obj[key] === "string") return obj[key] as string;
      }
      return JSON.stringify(data).slice(0, 500);
    }
    return String(data);
  }

  private static computeConfidence(stepResult: StepResult): number {
    if (!stepResult.success) return 0;
    // Base confidence from success
    let confidence = 0.8;
    // Reduce for retries
    if (stepResult.attempts > 1) confidence -= (stepResult.attempts - 1) * 0.1;
    // Reduce for slow execution
    if (stepResult.durationMs > 5000) confidence -= 0.1;
    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private static deduplicate(
    items: Array<{ toolId: string; stepId: string; data: unknown; confidence: number }>
  ): {
    unique: FusedItem[];
    stats: DeduplicationStats;
  } {
    const seen = new Map<string, FusedItem>();

    for (const item of items) {
      const hash = ToolResultFusion.hashData(item.data);
      if (seen.has(hash)) {
        // Merge sources
        const existing = seen.get(hash)!;
        if (!existing.sources.includes(item.toolId)) {
          existing.sources.push(item.toolId);
          // Boost confidence when multiple sources agree
          existing.confidence = Math.min(1.0, existing.confidence + 0.05);
        }
      } else {
        seen.set(hash, {
          hash,
          data: item.data,
          sources: [item.toolId],
          confidence: item.confidence,
          rank: 0,
        });
      }
    }

    const unique = Array.from(seen.values());
    const stats: DeduplicationStats = {
      totalItems: items.length,
      uniqueItems: unique.length,
      duplicatesRemoved: items.length - unique.length,
      deduplicationRate: items.length > 0 ? (items.length - unique.length) / items.length : 0,
    };

    return { unique, stats };
  }

  private static rank(items: FusedItem[], _goal: string): FusedItem[] {
    return items
      .map((item, i) => ({
        ...item,
        rank: i,
        // Boost items confirmed by multiple sources
        confidence: item.sources.length > 1
          ? Math.min(1.0, item.confidence + 0.1 * (item.sources.length - 1))
          : item.confidence,
      }))
      .sort((a, b) => {
        // Primary sort: confidence descending
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        // Secondary sort: multi-source items first
        return b.sources.length - a.sources.length;
      })
      .map((item, rank) => ({ ...item, rank }));
  }

  private static mergeStructured(stepResults: StepResult[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    for (const result of stepResults) {
      if (!result.success || !result.result?.data) continue;
      const data = result.result.data;
      if (typeof data === "object" && data !== null && !Array.isArray(data)) {
        const obj = data as Record<string, unknown>;
        for (const [key, value] of Object.entries(obj)) {
          if (!(key in merged)) {
            merged[key] = value;
          } else if (Array.isArray(merged[key]) && Array.isArray(value)) {
            merged[key] = [...(merged[key] as unknown[]), ...value];
          }
        }
      }
    }
    return merged;
  }

  private static validate(items: FusedItem[], successCount: number, failCount: number): ValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (successCount === 0) issues.push("All tool executions failed — no data available");
    if (failCount > successCount) warnings.push(`More tools failed (${failCount}) than succeeded (${successCount})`);
    if (items.length === 0) warnings.push("No items in fused result");
    if (items.some((i) => i.confidence < 0.3)) warnings.push("Some items have low confidence scores");

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  private static hashData(data: unknown): string {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    // Simple djb2 hash
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit int
    }
    return hash.toString(36);
  }
}
