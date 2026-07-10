/**
 * ErrorTracker — Omni One Frontend
 *
 * Centralized error tracking for the frontend.
 * Captures, categorizes, and reports errors with severity levels.
 * Integrates with the existing Logger system.
 */

import { Logger } from "./Logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ErrorCategory =
  | "network"
  | "auth"
  | "validation"
  | "ai_provider"
  | "timeout"
  | "memory"
  | "ui"
  | "unknown";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export interface TrackedError {
  id: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code?: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: number;
  recoverable: boolean;
}

// ─── User-Friendly Message Map ────────────────────────────────────────────────

const USER_MESSAGES: Record<string, string> = {
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  UNAUTHORIZED: "Your session has expired. Please sign in again.",
  FORBIDDEN: "You don't have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
  VALIDATION_ERROR: "Please check your input and try again.",
  SERVICE_UNAVAILABLE: "The AI service is temporarily unavailable. Please try again shortly.",
  PROVIDER_ERROR: "The AI provider returned an error. Try switching to a different model.",
  NETWORK_ERROR: "Network connection issue. Please check your internet connection.",
  TIMEOUT: "The request took too long. Try a simpler query or enable Speed mode.",
  INTERNAL_ERROR: "An unexpected error occurred. Our team has been notified.",
  UPLOAD_TOO_LARGE: "File is too large. Maximum allowed size is 50MB.",
  INVALID_FILE_TYPE: "This file type is not supported.",
  MEMORY_ERROR: "The system is under heavy load. Please try again in a moment.",
};

// ─── Error Classifier ─────────────────────────────────────────────────────────

function classifyError(error: unknown, code?: string): {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
} {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const c = (code ?? "").toUpperCase();

  if (c === "UNAUTHORIZED" || c === "FORBIDDEN" || msg.includes("401") || msg.includes("403")) {
    return { category: "auth", severity: "medium", recoverable: true };
  }
  if (c === "RATE_LIMITED" || msg.includes("429") || msg.includes("rate limit")) {
    return { category: "ai_provider", severity: "low", recoverable: true };
  }
  if (c === "VALIDATION_ERROR" || msg.includes("validation") || msg.includes("invalid")) {
    return { category: "validation", severity: "low", recoverable: true };
  }
  if (c === "SERVICE_UNAVAILABLE" || c === "PROVIDER_ERROR" || msg.includes("provider")) {
    return { category: "ai_provider", severity: "medium", recoverable: true };
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return { category: "timeout", severity: "medium", recoverable: true };
  }
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("econnrefused") || msg.includes("failed to fetch")) {
    return { category: "network", severity: "high", recoverable: true };
  }
  if (msg.includes("memory") || msg.includes("heap") || msg.includes("oom")) {
    return { category: "memory", severity: "critical", recoverable: false };
  }
  if (c === "INTERNAL_ERROR" || msg.includes("500")) {
    return { category: "unknown", severity: "high", recoverable: true };
  }
  return { category: "unknown", severity: "medium", recoverable: true };
}

// ─── ErrorTracker Class ───────────────────────────────────────────────────────

class ErrorTrackerClass {
  private readonly MAX_STORED = 200;
  private errors: TrackedError[] = [];
  private listeners: Array<(error: TrackedError) => void> = [];

  /**
   * Track an error. Returns a TrackedError with user-friendly message.
   */
  track(
    error: unknown,
    context?: {
      operation?: string;
      code?: string;
      extra?: Record<string, unknown>;
    }
  ): TrackedError {
    const code = context?.code;
    const { category, severity, recoverable } = classifyError(error, code);
    const rawMessage = error instanceof Error ? error.message : String(error);
    const userMessage =
      (code && USER_MESSAGES[code]) ??
      USER_MESSAGES[category.toUpperCase()] ??
      USER_MESSAGES.INTERNAL_ERROR;

    const tracked: TrackedError = {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category,
      severity,
      message: rawMessage,
      userMessage,
      code,
      stack: error instanceof Error ? error.stack : undefined,
      context: { operation: context?.operation, ...context?.extra },
      timestamp: Date.now(),
      recoverable,
    };

    // Store in ring buffer
    this.errors.push(tracked);
    if (this.errors.length > this.MAX_STORED) {
      this.errors.shift();
    }

    // Log
    if (severity === "critical" || severity === "high") {
      Logger.error(`[ErrorTracker] ${category}/${code ?? "?"}: ${rawMessage}`, {
        id: tracked.id,
        severity,
        context: tracked.context,
      });
    } else {
      Logger.warn(`[ErrorTracker] ${category}/${code ?? "?"}: ${rawMessage}`, {
        id: tracked.id,
        severity,
      });
    }

    // Notify listeners
    this.listeners.forEach((fn) => fn(tracked));

    return tracked;
  }

  /**
   * Subscribe to new errors.
   */
  subscribe(fn: (error: TrackedError) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  /**
   * Get all tracked errors.
   */
  getAll(): TrackedError[] {
    return [...this.errors];
  }

  /**
   * Get errors by severity.
   */
  getBySeverity(severity: ErrorSeverity): TrackedError[] {
    return this.errors.filter((e) => e.severity === severity);
  }

  /**
   * Get errors by category.
   */
  getByCategory(category: ErrorCategory): TrackedError[] {
    return this.errors.filter((e) => e.category === category);
  }

  /**
   * Get a summary report for monitoring.
   */
  getSummary(): Record<string, number> {
    const summary: Record<string, number> = {};
    for (const e of this.errors) {
      summary[e.category] = (summary[e.category] ?? 0) + 1;
      summary[`severity_${e.severity}`] = (summary[`severity_${e.severity}`] ?? 0) + 1;
    }
    summary.total = this.errors.length;
    return summary;
  }

  /**
   * Clear all tracked errors.
   */
  clear(): void {
    this.errors = [];
  }
}

export const ErrorTracker = new ErrorTrackerClass();

// ─── Global Unhandled Error Capture ──────────────────────────────────────────

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    ErrorTracker.track(event.reason, { operation: "unhandledRejection" });
  });

  window.addEventListener("error", (event) => {
    ErrorTracker.track(event.error ?? event.message, { operation: "globalError" });
  });
}
