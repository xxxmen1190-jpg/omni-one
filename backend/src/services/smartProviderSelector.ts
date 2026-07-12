/**
 * Smart Provider Selector — Omni One Backend
 *
 * Phase 20.6 — Unified AI Gateway
 *
 * Intelligent routing engine that selects the best provider based on:
 *   - Task type (research, coding, automation, creative, analysis)
 *   - Complexity level (simple / medium / complex)
 *   - Required capabilities (vision, reasoning, long-running)
 *   - Provider availability (env vars)
 *
 * Provider priority:
 *   1. Manus        — complex, long-running, autonomous tasks (research, build project, automation)
 *   2. Claude       — reasoning, analysis, explanation
 *   3. OpenAI       — general, vision, code
 *   4. Gemini       — multimodal, fast
 *   5. Groq         — speed-critical tasks
 *   6. Mistral      — European / privacy-sensitive workloads
 *   7. DeepSeek     — code-heavy tasks (cost-efficient)
 *   8. OpenRouter   — universal fallback
 */
import { logger } from "../utils/logger.js";
import { AppError } from "../types/index.js";

export interface ProviderDecision {
  provider: "manus" | "claude" | "openai" | "gemini" | "groq" | "mistral" | "deepseek" | "openrouter";
  model: string;
  reason: string;
  confidence: number; // 0–1
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
   * Analyse the user's request to determine task characteristics.
   * Used by OmniBrain as the first step of the decision pipeline.
   */
  analyzeTask(userMessage: string): TaskAnalysis {
    const msg = userMessage.toLowerCase();

    // ── Task type detection ───────────────────────────────────────────────────
    const isResearch = /research|investigate|analyze|study|compare|find information|search|market analysis|competitors/i.test(msg);
    const isCoding = /code|write|build|create.*app|develop|implement|function|script|debug|landing page|website|react|vue|angular|next\.?js/i.test(msg);
    const isAutomation = /automate|workflow|process|schedule|integrate|connect|api|pipeline|trigger/i.test(msg);
    const isCreative = /write.*story|poem|song|creative|design|art|image|generate.*image/i.test(msg);

    let type: TaskAnalysis["type"] = "general";
    if (isResearch) type = "research";
    else if (isCoding) type = "coding";
    else if (isAutomation) type = "automation";
    else if (isCreative) type = "creative";

    // ── Complexity detection ──────────────────────────────────────────────────
    const isComplex = /complex|advanced|sophisticated|multi-step|comprehensive|detailed|thorough|full|entire|complete/i.test(msg);
    const isSimple = /simple|quick|brief|short|fast|easy|small/i.test(msg);
    let complexity: TaskAnalysis["complexity"] = "medium";
    if (isComplex) complexity = "complex";
    else if (isSimple) complexity = "simple";

    // ── Manus requirement detection ───────────────────────────────────────────
    // Manus is selected for tasks that require autonomous, long-running execution
    const requiresManus =
      /build.*project|create.*application|autonomous|research.*AI|competitors|market analysis|landing page|website|full.*project|long-running|multi-step|agent|deep research|build.*app|create.*react|create.*vue|create.*next/i.test(msg);

    const requiresVision = /image|screenshot|visual|diagram|chart|photo|picture|see|look at/i.test(msg);
    const requiresReasoning = /think|reason|explain|why|how|analyze|compare|evaluate|pros.*cons|trade-off/i.test(msg);

    // ── Duration estimate ─────────────────────────────────────────────────────
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
   * Select the best available provider based on task analysis.
   * Returns a ProviderDecision with primary provider + ordered fallback chain.
   */
  selectProvider(analysis: TaskAnalysis, availableProviders: Record<string, boolean>): ProviderDecision {
    logger.info({ analysis, availableProviders }, "[SmartSelector] Selecting provider");

    // ── Priority 1: Manus — autonomous, long-running tasks ───────────────────
    if (analysis.requiresManus && availableProviders.manus) {
      return {
        provider: "manus",
        model: "manus-1.6",
        reason: `Task requires autonomous execution (${analysis.type}, ${analysis.complexity} complexity). Manus handles multi-step research, project building, and automation.`,
        confidence: 0.95,
        fallbackProviders: ["claude", "openai", "gemini"],
      };
    }

    // ── Priority 2: Claude — reasoning, analysis, research ───────────────────
    if (
      (analysis.requiresReasoning || analysis.type === "analysis" || analysis.type === "research") &&
      availableProviders.claude
    ) {
      return {
        provider: "claude",
        model: "claude-3-5-sonnet-20241022",
        reason: "Claude 3.5 Sonnet excels at deep reasoning, analysis, and research tasks.",
        confidence: 0.9,
        fallbackProviders: ["openai", "manus", "gemini"],
      };
    }

    // ── Priority 3: OpenAI — general, vision, coding ──────────────────────────
    if (availableProviders.openai) {
      const reason = analysis.requiresVision
        ? "GPT-4o supports vision and image understanding."
        : analysis.type === "coding"
          ? "GPT-4o is highly capable for code generation and debugging."
          : "GPT-4o for general-purpose tasks.";
      return {
        provider: "openai",
        model: "gpt-4o",
        reason,
        confidence: 0.85,
        fallbackProviders: ["claude", "gemini", "groq"],
      };
    }

    // ── Priority 4: Gemini — multimodal, fast ────────────────────────────────
    if (availableProviders.gemini) {
      return {
        provider: "gemini",
        model: "gemini-2.0-flash",
        reason: "Gemini 2.0 Flash for multimodal and fast inference.",
        confidence: 0.8,
        fallbackProviders: ["openai", "claude", "groq"],
      };
    }

    // ── Priority 5: Groq — speed ─────────────────────────────────────────────
    if (availableProviders.groq) {
      return {
        provider: "groq",
        model: "mixtral-8x7b-32768",
        reason: "Groq for ultra-fast inference on simple tasks.",
        confidence: 0.7,
        fallbackProviders: ["openai", "claude"],
      };
    }

    // ── Priority 6: Mistral ───────────────────────────────────────────────────
    if (availableProviders.mistral) {
      return {
        provider: "mistral",
        model: "mistral-large-latest",
        reason: "Mistral Large for European/privacy-sensitive workloads.",
        confidence: 0.65,
        fallbackProviders: ["openrouter"],
      };
    }

    // ── Priority 7: DeepSeek — code-heavy, cost-efficient ────────────────────
    if (availableProviders.deepseek) {
      return {
        provider: "deepseek",
        model: "deepseek-chat",
        reason: "DeepSeek for code-heavy tasks with cost efficiency.",
        confidence: 0.65,
        fallbackProviders: ["openrouter"],
      };
    }

    // ── Priority 8: OpenRouter — universal fallback ───────────────────────────
    if (availableProviders.openrouter) {
      return {
        provider: "openrouter",
        model: "auto",
        reason: "OpenRouter universal fallback — auto-selects best available model.",
        confidence: 0.5,
        fallbackProviders: [],
      };
    }

    throw new AppError("No AI provider available. Please configure at least one provider API key.", 503, "SERVICE_UNAVAILABLE");
  }

  /**
   * Get provider availability from environment variables.
   * A provider is available if its API key env var is set and non-empty.
   */
  getAvailableProviders(): Record<string, boolean> {
    return {
      manus: !!process.env.MANUS_API_KEY,
      claude: !!process.env.ANTHROPIC_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      gemini: !!process.env.GEMINI_API_KEY,
      groq: !!process.env.GROQ_API_KEY,
      mistral: !!process.env.MISTRAL_API_KEY,
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      openrouter: !!process.env.OPENROUTER_API_KEY,
    };
  }
}

export const smartProviderSelector = new SmartProviderSelectorClass();
