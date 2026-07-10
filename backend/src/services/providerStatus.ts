/**
 * Provider Status Service — Omni One Backend
 *
 * Checks which AI providers are configured and available.
 * Does not make live API calls — checks key presence only.
 * Live connectivity checks can be added in Phase 16.2.
 */

import { config } from "../config/index.js";
import type { AIProviderStatus, ProviderStatus } from "../types/index.js";

function keyStatus(key: string): ProviderStatus {
  if (!key || key.trim() === "") return "unconfigured";
  // Key is present — treat as available (live ping in Phase 16.2)
  return "available";
}

export function getProviderStatus(): AIProviderStatus {
  return {
    openai: keyStatus(config.ai.openaiApiKey),
    anthropic: keyStatus(config.ai.anthropicApiKey),
    gemini: keyStatus(config.ai.geminiApiKey),
    groq: keyStatus(config.ai.groqApiKey),
    openrouter: keyStatus(config.ai.openrouterApiKey),
  };
}

export function hasAnyProvider(): boolean {
  const status = getProviderStatus();
  return Object.values(status).some((s) => s === "available");
}
