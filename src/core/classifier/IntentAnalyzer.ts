import { Intent, IntentType, Message } from "../../types";

export class IntentAnalyzer {
  private static KEYWORDS: Record<IntentType, string[]> = {
    chat: ["hello", "hi", "how are you", "tell me", "מה קורה", "שלום", "talk", "speak"],
    code: ["function", "code", "debug", "python", "javascript", "react", "קוד", "פונקציה", "implement", "develop"],
    reasoning: ["why", "explain", "logic", "think", "analyze", "למה", "הסבר", "ניתוח", "reason", "understand"],
    search: ["find", "search", "who is", "latest", "חפש", "מי זה", "look up", "browse"],
    image: ["draw", "generate image", "create picture", "photo", "צייר", "תמונה", "visualize", "render"],
    summarize: ["summarize", "סיכום", "תמצת", "digest", "overview"],
    translate: ["translate", "תרגם", "convert language", "language"],
    vision: ["describe image", "analyze visual", "what is in this picture"],
    ocr: ["extract text", "read text from image", "ocr"],
    voice: ["transcribe audio", "convert speech to text", "voice command"],
    browser: ["open website", "navigate to", "go to url"],
    documents: ["read document", "analyze pdf", "extract from file"],
  };

  static analyze(input: string): Intent {
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

    // Heuristics for reasoning/code/summarize based on length
    if (lowerInput.length > 200) {
      if (detectedType === "chat" || detectedType === "reasoning") {
        detectedType = "reasoning";
      } else if (detectedType === "code") {
        detectedType = "code";
      } else if (detectedType === "summarize") {
        detectedType = "summarize";
      }
    }

    return {
      type: detectedType,
      confidence: maxMatches > 0 ? 0.8 : 0.5,
    };
  }
}
