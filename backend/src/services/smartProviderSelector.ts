/**
 * Smart Provider Selector — Omni One Backend
 *
 * Intelligent routing engine that selects the best provider based on:
 *   - Task type (research, coding, automation, etc.)
 *   - Complexity level
 *   - Required capabilities
 *   - Provider availability
 *
 * Priority order:
 *   1. Manus (for complex, long-running, autonomous tasks)
 *   2. Claude 3.5 Sonnet (for reasoning, analysis)
 *   3. GPT-4o (for general tasks, vision)
 *   4. Gemini 2.0 (for multimodal)
 *   5. Groq (for speed)
 */
import { logger } from "../utils/logger.js";
import { AppError } from "../types/index.js";

export interface ProviderDecision {
  provider: "manus" | "claude" | "openai" | "gemini" | "groq" | "openrouter";
  model: string;
  reason: string;
  confidence: number; // 0-1
  fallbackProviders: string[];
}

export interface TaskAnalysis {
  type: "research" | "coding" | "analysis" | "automation" | "general" | "creative";
  complexity: "simple" | "medium" | "complex";
  requiresManus: boolean;
  requiresVision: boolean;
  requiresReasoning: boolean;
  estimatedDuration: "quick" | "medium" | "long";
}

class SmartProviderSelectorClass {
  /**
   * Analyze the user's request to determine task characteristics
   */
  analyzeTask(userMessage: string): TaskAnalysis {
    const msg = userMessage.toLowerCase();

    // Detect task type
    const isResearch = /research|investigate|analyze|study|compare|find information|search/i.test(msg);
    const isCoding = /code|write|build|create.*app|develop|implement|function|script|debug/i.test(msg);
    const isAutomation = /automate|workflow|process|schedule|integrate|connect|api/i.test(msg);
    const isCreative = /write.*story|poem|song|creative|design|art|image/i.test(msg);

    let type: TaskAnalysis["type"] = "general";
    if (isResearch) type = "research";
    else if (isCoding) type = "coding";
    else if (isAutomation) type = "automation";
    else if (isCreative) type = "creative";

    // Detect complexity
    const isComplex = /complex|advanced|sophisticated|multi-step|comprehensive|detailed|thorough/i.test(msg);
    const isSimple = /simple|quick|brief|short|fast|easy/i.test(msg);
    let complexity: TaskAnalysis["complexity"] = "medium";
    if (isComplex) complexity = "complex";
    else if (isSimple) complexity = "simple";

    // Detect requirements
    const requiresManus =
      /build.*project|create.*application|autonomous|research.*AI|competitors|market analysis|landing page|website|full.*project|long-running|multi-step|agent/i.test(
        msg
      );
    const requiresVision = /image|screenshot|visual|diagram|chart|photo|picture/i.test(msg);
    const requiresReasoning = /think|reason|explain|why|how|analyze|compare|evaluate/i.test(msg);

    // Estimate duration
    let estimatedDuration: TaskAnalysis["estimatedDuration"] = "quick";
    if (requiresManus || complexity === "complex") estimatedDuration = "long";
    else if (complexity === "medium") estimatedDuration = "medium";

    return {
      type,
      complexity,
      requiresManus,
      requiresVision,
      requiresReasoning,
      estimatedDuration,
    };
  }

  /**
   * Select the best provider based on task analysis and availability
   */
  selectProvider(analysis: TaskAnalysis, availableProviders: Record<string, boolean>): ProviderDecision {
    logger.info({ analysis, availableProviders }, "[SmartSelector] Analyzing task for provider selection");

    // ── Priority 1: Manus for complex, long-running tasks ────────────────────
    if (analysis.requiresManus && availableProviders.manus) {
      return {
        provider: "manus",
        model: "manus-1.6",
        reason: `Task requires autonomous execution (${analysis.type}, ${analysis.complexity} complexity)`,
        confidence: 0.95,
        fallbackProviders: ["claude", "openai", "gemini"],
      };
    }

    // ── Priority 2: Claude for reasoning & analysis ─────────────────────────
    if (
      (analysis.requiresReasoning || analysis.type === "analysis" || analysis.type === "research") &&
      availableProviders.claude
    ) {
      return {
        provider: "claude",
        model: "claude-3-5-sonnet-20241022",
        reason: "Claude excels at reasoning and deep analysis",
        confidence: 0.9,
        fallbackProviders: ["openai", "manus", "gemini"],
      };
    }

    // ── Priority 3: GPT-4o for general & vision tasks ──────────────────────
    if (availableProviders.openai) {
      const reason = analysis.requiresVision ? "GPT-4o supports vision" : "GPT-4o for general tasks";
      return {
        provider: "openai",
        model: "gpt-4o",
        reason,
        confidence: 0.85,
        fallbackProviders: ["claude", "gemini", "groq"],
      };
    }

    // ── Priority 4: Gemini for multimodal ────────────────────────────────────
    if (availableProviders.gemini) {
      return {
        provider: "gemini",
        model: "gemini-2.0-flash",
        reason: "Gemini for multimodal capabilities",
        confidence: 0.8,
        fallbackProviders: ["openai", "claude"],
      };
    }

    // ── Priority 5: Groq for speed ──────────────────────────────────────────
    if (availableProviders.groq) {
      return {
        provider: "groq",
        model: "mixtral-8x7b-32768",
        reason: "Groq for fast inference",
        confidence: 0.7,
        fallbackProviders: ["openai", "claude"],
      };
    }

    // ── Fallback: OpenRouter ────────────────────────────────────────────────
    if (availableProviders.openrouter) {
      return {
        provider: "openrouter",
        model: "auto",
        reason: "OpenRouter fallback",
        confidence: 0.5,
        fallbackProviders: [],
      };
    }

    throw new AppError("No AI provider available", 503, "SERVICE_UNAVAILABLE");
  }

  /**
   * Get provider availability from environment
   */
  getAvailableProviders(): Record<string, boolean> {
    return {
      manus: !!process.env.MANUS_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
    };
  }
}

export const smartProviderSelector = new SmartProviderSelectorClass();
