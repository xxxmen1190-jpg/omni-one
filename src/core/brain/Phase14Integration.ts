/**
 * Phase 14.10 — Production Integration
 * Connects all Phase 14 systems to OmniBrain execution flow.
 *
 * Execution Flow:
 * User → Smart Mode Selection → File Detection → Vision Detection →
 * Voice Detection → Knowledge Retrieval → Planning → Tool Selection →
 * Execution → Fusion → Workspace Selection → Final Response
 */

import { Logger } from "../system/Logger";
import { FileIntelligence, ParsedFile } from "../files/FileIntelligence";
import { VisionSystem } from "../vision/VisionSystem";
import { ImageGenerationSystem } from "../imageGen/ImageGenerationSystem";
import { SmartWorkspaceDetector, WorkspaceType } from "../workspace/SmartWorkspaceDetector";
import { DocumentGenerator, ExportFormat } from "../export/DocumentGenerator";

export interface Phase14Request {
  userMessage: string;
  attachedFiles?: File[];
  imageBase64?: string;
  audioBlob?: Blob;
  conversationHistory?: Array<{ role: string; content: string }>;
}

export interface Phase14Response {
  text: string;
  workspaceType: WorkspaceType;
  workspaceLanguage?: string;
  generatedImages?: string[];
  parsedFiles?: ParsedFile[];
  exportFormats?: ExportFormat[];
  metadata?: Record<string, any>;
}

export interface IntegrationContext {
  hasFiles: boolean;
  hasImages: boolean;
  hasVoice: boolean;
  fileTypes: string[];
  detectedIntent: string;
  requiresVision: boolean;
  requiresImageGen: boolean;
  requiresVoice: boolean;
}

export class Phase14Integration {
  /**
   * Main entry point: process a Phase 14 request through the full pipeline.
   */
  static async process(
    request: Phase14Request,
    onStream?: (chunk: string) => void
  ): Promise<Phase14Response> {
    Logger.info("[Phase14] Processing request through full pipeline");

    // Step 1: Analyze context
    const context = await this.analyzeContext(request);
    Logger.info("[Phase14] Context analyzed", context);

    // Step 2: Parse attached files
    const parsedFiles: ParsedFile[] = [];
    if (context.hasFiles && request.attachedFiles) {
      for (const file of request.attachedFiles) {
        try {
          const parsed = await FileIntelligence.parseFile(file);
          parsedFiles.push(parsed);
        } catch (err) {
          Logger.warn("[Phase14] Failed to parse file", { file: file.name, err });
        }
      }
    }

    // Step 3: Build enhanced prompt with file context
    const enhancedPrompt = this.buildEnhancedPrompt(request, parsedFiles, context);

    // Step 4: Handle vision requests
    let visionResult: string | null = null;
    if (context.requiresVision && request.imageBase64) {
      try {
        const visionOp = this.detectVisionOperation(request.userMessage);
        const result = await VisionSystem.analyze({
          operation: visionOp,
          imageBase64: request.imageBase64,
          question: request.userMessage,
        });
        visionResult = result.result;
        Logger.info("[Phase14] Vision analysis complete", { provider: result.provider });
      } catch (err) {
        Logger.warn("[Phase14] Vision analysis failed", { err });
      }
    }

    // Step 5: Handle image generation requests
    const generatedImages: string[] = [];
    if (context.requiresImageGen) {
      try {
        const imagePrompt = this.extractImagePrompt(request.userMessage);
        const result = await ImageGenerationSystem.generate({ prompt: imagePrompt });
        for (const img of result.images) {
          if (img.url) generatedImages.push(img.url);
          else if (img.base64) generatedImages.push(`data:image/png;base64,${img.base64}`);
        }
        Logger.info("[Phase14] Image generation complete", { count: generatedImages.length });
      } catch (err) {
        Logger.warn("[Phase14] Image generation failed", { err });
      }
    }

    // Step 6: Build final response text
    let responseText = "";

    if (visionResult) {
      responseText = visionResult;
    } else if (generatedImages.length > 0) {
      responseText = `Here ${generatedImages.length === 1 ? "is" : "are"} the generated image${generatedImages.length > 1 ? "s" : ""}:\n\n`;
      generatedImages.forEach((url, i) => {
        responseText += `![Generated Image ${i + 1}](${url})\n\n`;
      });
    } else if (parsedFiles.length > 0 && !onStream) {
      // Return file summary if no streaming
      responseText = parsedFiles
        .map((f) => FileIntelligence.generateSummary(f))
        .join("\n\n---\n\n");
    }

    // Step 7: Detect workspace type
    const workspaceDetection = SmartWorkspaceDetector.detect(
      request.userMessage,
      responseText
    );

    return {
      text: responseText,
      workspaceType: workspaceDetection.type,
      workspaceLanguage: workspaceDetection.language,
      generatedImages: generatedImages.length > 0 ? generatedImages : undefined,
      parsedFiles: parsedFiles.length > 0 ? parsedFiles : undefined,
      exportFormats: this.getRelevantExportFormats(workspaceDetection.type),
      metadata: {
        context,
        workspaceConfidence: workspaceDetection.confidence,
        workspaceReason: workspaceDetection.reason,
      },
    };
  }

  /**
   * Build an enhanced prompt that includes file context for the LLM.
   */
  static buildEnhancedPrompt(
    request: Phase14Request,
    parsedFiles: ParsedFile[],
    context: IntegrationContext
  ): string {
    let prompt = request.userMessage;

    if (parsedFiles.length > 0) {
      prompt += "\n\n---\n**Attached Files:**\n";
      for (const file of parsedFiles) {
        const maxContent = 4000;
        const content =
          file.content.length > maxContent
            ? file.content.slice(0, maxContent) + "\n...[truncated]"
            : file.content;
        prompt += `\n**${file.name}** (${file.type.toUpperCase()}):\n${content}\n`;
      }
    }

    return prompt;
  }

  /**
   * Analyze the request to determine what systems are needed.
   */
  private static async analyzeContext(request: Phase14Request): Promise<IntegrationContext> {
    const msg = request.userMessage.toLowerCase();
    const fileTypes = (request.attachedFiles || []).map((f) =>
      FileIntelligence.detectType(f)
    );

    const requiresVision =
      !!request.imageBase64 ||
      msg.includes("analyze image") ||
      msg.includes("ocr") ||
      msg.includes("read image") ||
      msg.includes("what's in this image") ||
      msg.includes("describe image") ||
      msg.includes("detect text") ||
      msg.includes("detect objects") ||
      (fileTypes.includes("image") && msg.includes("analyze"));

    const requiresImageGen =
      msg.includes("generate image") ||
      msg.includes("create image") ||
      msg.includes("draw") ||
      msg.includes("dalle") ||
      msg.includes("image of") ||
      msg.includes("picture of") ||
      msg.includes("illustrate") ||
      msg.includes("create a visual");

    const requiresVoice = !!request.audioBlob;

    const detectedIntent = requiresImageGen
      ? "image_generation"
      : requiresVision
      ? "vision_analysis"
      : requiresVoice
      ? "voice_input"
      : (request.attachedFiles?.length || 0) > 0
      ? "file_analysis"
      : "chat";

    return {
      hasFiles: (request.attachedFiles?.length || 0) > 0,
      hasImages: !!request.imageBase64 || fileTypes.includes("image"),
      hasVoice: requiresVoice,
      fileTypes: fileTypes as string[],
      detectedIntent,
      requiresVision,
      requiresImageGen,
      requiresVoice,
    };
  }

  private static detectVisionOperation(
    message: string
  ): "analyze" | "ocr" | "describe" | "detect_objects" | "detect_text" | "compare" | "qa" {
    const msg = message.toLowerCase();
    if (msg.includes("ocr") || msg.includes("extract text") || msg.includes("read text"))
      return "ocr";
    if (msg.includes("describe")) return "describe";
    if (msg.includes("detect object") || msg.includes("find object")) return "detect_objects";
    if (msg.includes("detect text") || msg.includes("find text")) return "detect_text";
    if (msg.includes("compare")) return "compare";
    if (msg.includes("?") || msg.includes("what") || msg.includes("how")) return "qa";
    return "analyze";
  }

  private static extractImagePrompt(message: string): string {
    // Remove common prefixes
    return message
      .replace(/^(generate|create|draw|make|produce|render)\s+(an?\s+)?(image|picture|photo|illustration|artwork|visual)\s+(of\s+)?/i, "")
      .trim() || message;
  }

  private static getRelevantExportFormats(workspaceType: WorkspaceType): ExportFormat[] {
    switch (workspaceType) {
      case "code":
        return ["txt", "md", "html", "json"];
      case "table":
        return ["csv", "xlsx", "json", "html", "pdf"];
      case "document":
      case "markdown":
        return ["pdf", "docx", "md", "html", "txt"];
      case "json":
        return ["json", "txt", "csv"];
      case "image":
        return ["html", "md"];
      default:
        return ["pdf", "docx", "md", "txt", "json", "csv", "html"];
    }
  }
}
