/**
 * Phase 14.7 — Smart Workspace Detector
 * Automatically detects the best workspace type based on user request and AI response.
 * No user selection needed — fully automatic.
 */

export type WorkspaceType =
  | "code"
  | "image"
  | "document"
  | "table"
  | "chart"
  | "markdown"
  | "json"
  | "chat";

export interface WorkspaceDetectionResult {
  type: WorkspaceType;
  confidence: number;
  reason: string;
  language?: string; // for code workspace
}

export class SmartWorkspaceDetector {
  /**
   * Detect workspace type from user message and/or AI response.
   */
  static detect(
    userMessage: string,
    aiResponse?: string
  ): WorkspaceDetectionResult {
    const combined = `${userMessage} ${aiResponse || ""}`.toLowerCase();

    // Code detection
    const codeScore = this.scoreCode(combined, aiResponse);
    if (codeScore.score > 0.7) {
      return {
        type: "code",
        confidence: codeScore.score,
        reason: "Code content detected",
        language: codeScore.language,
      };
    }

    // Image detection
    if (this.isImageRequest(combined)) {
      return {
        type: "image",
        confidence: 0.9,
        reason: "Image generation/display requested",
      };
    }

    // Table/data detection
    if (this.isTableRequest(combined, aiResponse)) {
      return {
        type: "table",
        confidence: 0.85,
        reason: "Tabular data detected",
      };
    }

    // Chart detection
    if (this.isChartRequest(combined)) {
      return {
        type: "chart",
        confidence: 0.85,
        reason: "Chart/visualization requested",
      };
    }

    // JSON detection
    if (this.isJSONResponse(aiResponse)) {
      return {
        type: "json",
        confidence: 0.8,
        reason: "JSON data detected",
      };
    }

    // Document detection
    if (this.isDocumentRequest(combined)) {
      return {
        type: "document",
        confidence: 0.8,
        reason: "Document/PDF content detected",
      };
    }

    // Markdown detection
    if (this.isMarkdownResponse(aiResponse)) {
      return {
        type: "markdown",
        confidence: 0.75,
        reason: "Rich markdown content detected",
      };
    }

    // Default: chat
    return {
      type: "chat",
      confidence: 1.0,
      reason: "Standard chat response",
    };
  }

  private static scoreCode(
    combined: string,
    aiResponse?: string
  ): { score: number; language?: string } {
    // Check for code blocks in response
    if (aiResponse) {
      const codeBlockMatch = aiResponse.match(/```(\w+)?/);
      if (codeBlockMatch) {
        const language = codeBlockMatch[1] || "text";
        return { score: 0.95, language };
      }
    }

    // Check for code-related keywords in user message
    const codeKeywords = [
      "write code",
      "create function",
      "implement",
      "script",
      "program",
      "algorithm",
      "class",
      "component",
      "api",
      "debug",
      "fix bug",
      "refactor",
      "typescript",
      "javascript",
      "python",
      "react",
      "html",
      "css",
      "sql",
      "bash",
      "shell",
      "dockerfile",
      "yaml",
      "json schema",
      "regex",
      "function",
      "method",
      "variable",
      "loop",
      "array",
      "object",
      "interface",
      "type",
      "enum",
      "class",
      "extends",
      "import",
      "export",
    ];

    const matchCount = codeKeywords.filter((kw) => combined.includes(kw)).length;
    if (matchCount >= 3) return { score: 0.85 };
    if (matchCount >= 1) return { score: 0.6 };

    return { score: 0 };
  }

  private static isImageRequest(combined: string): boolean {
    const imageKeywords = [
      "generate image",
      "create image",
      "draw",
      "illustrate",
      "dalle",
      "stable diffusion",
      "midjourney",
      "image of",
      "picture of",
      "photo of",
      "artwork",
      "logo",
      "icon",
      "design",
      "visual",
      "render",
      "paint",
    ];
    return imageKeywords.some((kw) => combined.includes(kw));
  }

  private static isTableRequest(combined: string, aiResponse?: string): boolean {
    // Check for markdown tables in response
    if (aiResponse && aiResponse.includes("|") && aiResponse.includes("---")) {
      return true;
    }

    const tableKeywords = [
      "table",
      "spreadsheet",
      "csv",
      "excel",
      "compare",
      "comparison",
      "list of",
      "rows",
      "columns",
      "data",
      "statistics",
      "metrics",
      "results",
      "summary table",
    ];
    return tableKeywords.some((kw) => combined.includes(kw));
  }

  private static isChartRequest(combined: string): boolean {
    const chartKeywords = [
      "chart",
      "graph",
      "plot",
      "visualization",
      "bar chart",
      "pie chart",
      "line graph",
      "histogram",
      "scatter",
      "trend",
      "analytics",
      "dashboard",
    ];
    return chartKeywords.some((kw) => combined.includes(kw));
  }

  private static isJSONResponse(aiResponse?: string): boolean {
    if (!aiResponse) return false;
    const trimmed = aiResponse.trim();
    return (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
      (trimmed.includes("```json") && trimmed.includes("```"))
    );
  }

  private static isDocumentRequest(combined: string): boolean {
    const docKeywords = [
      "pdf",
      "document",
      "report",
      "essay",
      "article",
      "write a",
      "draft",
      "letter",
      "proposal",
      "resume",
      "cv",
      "contract",
      "specification",
      "documentation",
    ];
    return docKeywords.some((kw) => combined.includes(kw));
  }

  private static isMarkdownResponse(aiResponse?: string): boolean {
    if (!aiResponse) return false;
    const markdownIndicators = [
      aiResponse.includes("##"),
      aiResponse.includes("**"),
      aiResponse.includes("- "),
      aiResponse.includes("1. "),
      aiResponse.includes("```"),
      aiResponse.includes("> "),
    ];
    return markdownIndicators.filter(Boolean).length >= 2;
  }
}
