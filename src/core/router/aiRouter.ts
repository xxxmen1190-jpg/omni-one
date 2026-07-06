import { Intent, IntentType, ProviderName } from "../../types";

export class AIRouter {
  private static KEYWORDS: Record<IntentType, string[]> = {
    chat: ["hello", "hi", "how are you", "tell me", "מה קורה", "שלום"],
    code: ["function", "code", "debug", "python", "javascript", "react", "קוד", "פונקציה"],
    reasoning: ["why", "explain", "logic", "think", "analyze", "למה", "הסבר", "ניתוח"],
    search: ["find", "search", "who is", "latest", "חפש", "מי זה"],
    image: ["draw", "generate image", "create picture", "photo", "צייר", "תמונה"],
  };

  private static PROVIDER_MAP: Record<IntentType, ProviderName> = {
    chat: "openai",
    code: "anthropic",
    reasoning: "openai",
    search: "groq",
    image: "openai",
  };

  static analyzeIntent(input: string): Intent {
    const lowerInput = input.toLowerCase();
    let detectedType: IntentType = "chat";
    let maxMatches = 0;

    for (const [type, keywords] of Object.entries(this.KEYWORDS)) {
      const matches = keywords.filter(k => lowerInput.includes(k)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedType = type as IntentType;
      }
    }

    // Heuristics for reasoning/code
    if (lowerInput.length > 200 && detectedType === "chat") {
      detectedType = "reasoning";
    }

    return {
      type: detectedType,
      confidence: maxMatches > 0 ? 0.8 : 0.5,
    };
  }

  static selectProvider(intent: Intent): ProviderName {
    return this.PROVIDER_MAP[intent.type] || "openai";
  }
}
