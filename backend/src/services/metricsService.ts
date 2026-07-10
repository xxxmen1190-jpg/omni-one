/**
 * Metrics Service — Omni One Backend
 *
 * Centralized metrics collection for:
 * - User activity (registrations, logins, active sessions)
 * - AI request metrics (count, latency, model usage, token cost)
 * - Tool usage metrics
 * - File upload metrics
 * - System health indicators
 *
 * Uses an in-memory store with periodic summaries.
 * In production, flush to a time-series database (InfluxDB, Prometheus, etc.)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIRequestMetric {
  timestamp: number;
  userId?: string;
  model: string;
  provider: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
}

export interface UserActivityMetric {
  timestamp: number;
  userId: string;
  action: "register" | "login" | "logout" | "message" | "file_upload" | "tool_use";
  metadata?: Record<string, unknown>;
}

export interface SystemSnapshot {
  timestamp: number;
  uptimeMs: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryPercent: number;
  activeRequests: number;
  totalRequests: number;
  errorRate: number; // errors / total in last window
}

// ─── Cost Estimation ──────────────────────────────────────────────────────────

// Approximate cost per 1K tokens (USD) — update as pricing changes
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "claude-3-haiku-20240307": { input: 0.00025, output: 0.00125 },
  "claude-3-sonnet-20240229": { input: 0.003, output: 0.015 },
  "claude-3-opus-20240229": { input: 0.015, output: 0.075 },
  "gemini-1.5-flash": { input: 0.000075, output: 0.0003 },
  "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
  "llama3-70b-8192": { input: 0.00059, output: 0.00079 },
  default: { input: 0.002, output: 0.006 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = COST_PER_1K_TOKENS[model] ?? COST_PER_1K_TOKENS.default;
  return (promptTokens / 1000) * pricing.input + (completionTokens / 1000) * pricing.output;
}

// ─── Metrics Store ────────────────────────────────────────────────────────────

class MetricsServiceClass {
  private readonly MAX_AI_METRICS = 1000;
  private readonly MAX_ACTIVITY_METRICS = 2000;

  private aiMetrics: AIRequestMetric[] = [];
  private activityMetrics: UserActivityMetric[] = [];
  private totalRequests = 0;
  private totalErrors = 0;
  private activeRequests = 0;
  private readonly startTime = Date.now();

  // ── AI Request Tracking ────────────────────────────────────────────────────

  recordAIRequest(metric: Omit<AIRequestMetric, "timestamp">): void {
    const m: AIRequestMetric = { ...metric, timestamp: Date.now() };
    this.aiMetrics.push(m);
    if (this.aiMetrics.length > this.MAX_AI_METRICS) this.aiMetrics.shift();
    this.totalRequests++;
    if (!metric.success) this.totalErrors++;
  }

  // ── User Activity Tracking ─────────────────────────────────────────────────

  recordActivity(metric: Omit<UserActivityMetric, "timestamp">): void {
    const m: UserActivityMetric = { ...metric, timestamp: Date.now() };
    this.activityMetrics.push(m);
    if (this.activityMetrics.length > this.MAX_ACTIVITY_METRICS) this.activityMetrics.shift();
  }

  // ── Request Counter ────────────────────────────────────────────────────────

  incrementActiveRequests(): void { this.activeRequests++; }
  decrementActiveRequests(): void { this.activeRequests = Math.max(0, this.activeRequests - 1); }
  incrementTotalRequests(): void { this.totalRequests++; }
  incrementErrors(): void { this.totalErrors++; }

  // ── Aggregated Reports ─────────────────────────────────────────────────────

  /**
   * Get AI request summary for the last N minutes.
   */
  getAISummary(windowMinutes = 60): {
    totalRequests: number;
    successRate: number;
    avgLatencyMs: number;
    totalTokens: number;
    estimatedCostUSD: number;
    byModel: Record<string, { count: number; tokens: number; costUSD: number }>;
    byProvider: Record<string, number>;
    errorsByCode: Record<string, number>;
  } {
    const since = Date.now() - windowMinutes * 60 * 1000;
    const recent = this.aiMetrics.filter((m) => m.timestamp >= since);

    if (recent.length === 0) {
      return {
        totalRequests: 0,
        successRate: 1,
        avgLatencyMs: 0,
        totalTokens: 0,
        estimatedCostUSD: 0,
        byModel: {},
        byProvider: {},
        errorsByCode: {},
      };
    }

    const successful = recent.filter((m) => m.success);
    const totalTokens = recent.reduce((s, m) => s + m.totalTokens, 0);
    const totalLatency = successful.reduce((s, m) => s + m.latencyMs, 0);
    let totalCost = 0;

    const byModel: Record<string, { count: number; tokens: number; costUSD: number }> = {};
    const byProvider: Record<string, number> = {};
    const errorsByCode: Record<string, number> = {};

    for (const m of recent) {
      // By model
      if (!byModel[m.model]) byModel[m.model] = { count: 0, tokens: 0, costUSD: 0 };
      byModel[m.model].count++;
      byModel[m.model].tokens += m.totalTokens;
      const cost = estimateCost(m.model, m.promptTokens, m.completionTokens);
      byModel[m.model].costUSD += cost;
      totalCost += cost;

      // By provider
      byProvider[m.provider] = (byProvider[m.provider] ?? 0) + 1;

      // Errors
      if (!m.success && m.errorCode) {
        errorsByCode[m.errorCode] = (errorsByCode[m.errorCode] ?? 0) + 1;
      }
    }

    return {
      totalRequests: recent.length,
      successRate: recent.length > 0 ? successful.length / recent.length : 1,
      avgLatencyMs: successful.length > 0 ? Math.round(totalLatency / successful.length) : 0,
      totalTokens,
      estimatedCostUSD: Math.round(totalCost * 10000) / 10000,
      byModel,
      byProvider,
      errorsByCode,
    };
  }

  /**
   * Get user activity summary for the last N minutes.
   */
  getActivitySummary(windowMinutes = 60): {
    totalEvents: number;
    byAction: Record<string, number>;
    uniqueUsers: number;
    recentRegistrations: number;
    recentLogins: number;
  } {
    const since = Date.now() - windowMinutes * 60 * 1000;
    const recent = this.activityMetrics.filter((m) => m.timestamp >= since);

    const byAction: Record<string, number> = {};
    const uniqueUserIds = new Set<string>();

    for (const m of recent) {
      byAction[m.action] = (byAction[m.action] ?? 0) + 1;
      uniqueUserIds.add(m.userId);
    }

    return {
      totalEvents: recent.length,
      byAction,
      uniqueUsers: uniqueUserIds.size,
      recentRegistrations: byAction["register"] ?? 0,
      recentLogins: byAction["login"] ?? 0,
    };
  }

  /**
   * Get system health snapshot.
   */
  getSystemSnapshot(): SystemSnapshot {
    const mem = process.memoryUsage();
    const usedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const totalMB = Math.round(mem.heapTotal / 1024 / 1024);

    // Error rate over last 5 minutes
    const since5m = Date.now() - 5 * 60 * 1000;
    const recentAI = this.aiMetrics.filter((m) => m.timestamp >= since5m);
    const recentErrors = recentAI.filter((m) => !m.success).length;
    const errorRate = recentAI.length > 0 ? recentErrors / recentAI.length : 0;

    return {
      timestamp: Date.now(),
      uptimeMs: Date.now() - this.startTime,
      memoryUsedMB: usedMB,
      memoryTotalMB: totalMB,
      memoryPercent: Math.round((usedMB / totalMB) * 100),
      activeRequests: this.activeRequests,
      totalRequests: this.totalRequests,
      errorRate: Math.round(errorRate * 100) / 100,
    };
  }

  /**
   * Full dashboard payload for the /metrics endpoint.
   */
  getDashboard(): {
    system: SystemSnapshot;
    ai: ReturnType<MetricsServiceClass["getAISummary"]>;
    activity: ReturnType<MetricsServiceClass["getActivitySummary"]>;
    generatedAt: string;
  } {
    return {
      system: this.getSystemSnapshot(),
      ai: this.getAISummary(60),
      activity: this.getActivitySummary(60),
      generatedAt: new Date().toISOString(),
    };
  }
}

export const metricsService = new MetricsServiceClass();
