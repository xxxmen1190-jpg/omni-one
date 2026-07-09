/**
 * ToolInitializer — Phase 12+ Production Tool Registry
 *
 * Registers ALL native (production-ready) tools from Phase 12.2 native library.
 * Old mock-based tools (WebTools, CodeTools, VisionTools, etc.) are intentionally
 * NOT registered here — they are superseded by the native tool library.
 */
import { ToolRegistry } from "./ToolRegistry";
import { Logger } from "../system/Logger";

// Phase 12.2 Native Tool Library
import {
  BrowserOpenUrlTool,
  BrowserReadPageTool,
  BrowserExtractTextTool,
  BrowserExtractTablesTool,
  BrowserExtractLinksTool,
  BrowserScreenshotTool,
} from "./native/BrowserNativeTools";

import {
  FilesReadPDFTool,
  FilesReadDOCXTool,
  FilesReadTXTTool,
  FilesReadCSVTool,
  FilesReadExcelTool,
  FilesReadMarkdownTool,
  FilesReadJSONTool,
  ImagesOCRTool,
  ImagesMetadataTool,
  ImagesResizeTool,
  ImagesCropTool,
  ImagesFormatConversionTool,
} from "./native/FilesNativeTools";

import {
  AudioSpeechToTextTool,
  AudioTextToSpeechTool,
  VideoMetadataTool,
  VideoFrameExtractionTool,
} from "./native/AudioVideoNativeTools";

import {
  GitHubReadRepositoryTool,
  GitHubReadFileTool,
  GitHubCreateCommitTool,
  GitHubCreatePullRequestTool,
  GitHubIssuesTool,
  EmailSendTool,
  EmailReadTool,
  EmailSearchTool,
  CalendarCreateEventTool,
  CalendarUpdateEventTool,
  CalendarDeleteEventTool,
} from "./native/CollaborationNativeTools";

import {
  HTTPRESTTool,
  HTTPGraphQLTool,
  HTTPWebhookTool,
  DatabaseQueryTool,
  DatabaseSQLiteTool,
  DatabasePostgreSQLTool,
  DatabaseMySQLTool,
} from "./native/HTTPDatabaseNativeTools";

// ─── ToolInitializer ─────────────────────────────────────────────────────────
export class ToolInitializer {
  private static initialized = false;

  static async initialize(): Promise<void> {
    if (this.initialized) {
      Logger.debug("Tool Registry already initialized, skipping.");
      return;
    }

    Logger.info("Initializing Tool Registry with native production tools...");

    const tools = [
      // Browser
      new BrowserOpenUrlTool(),
      new BrowserReadPageTool(),
      new BrowserExtractTextTool(),
      new BrowserExtractTablesTool(),
      new BrowserExtractLinksTool(),
      new BrowserScreenshotTool(),
      // Files
      new FilesReadPDFTool(),
      new FilesReadDOCXTool(),
      new FilesReadTXTTool(),
      new FilesReadCSVTool(),
      new FilesReadExcelTool(),
      new FilesReadMarkdownTool(),
      new FilesReadJSONTool(),
      // Images
      new ImagesOCRTool(),
      new ImagesMetadataTool(),
      new ImagesResizeTool(),
      new ImagesCropTool(),
      new ImagesFormatConversionTool(),
      // Audio/Video
      new AudioSpeechToTextTool(),
      new AudioTextToSpeechTool(),
      new VideoMetadataTool(),
      new VideoFrameExtractionTool(),
      // Collaboration
      new GitHubReadRepositoryTool(),
      new GitHubReadFileTool(),
      new GitHubCreateCommitTool(),
      new GitHubCreatePullRequestTool(),
      new GitHubIssuesTool(),
      new EmailSendTool(),
      new EmailReadTool(),
      new EmailSearchTool(),
      new CalendarCreateEventTool(),
      new CalendarUpdateEventTool(),
      new CalendarDeleteEventTool(),
      // HTTP/Database
      new HTTPRESTTool(),
      new HTTPGraphQLTool(),
      new HTTPWebhookTool(),
      new DatabaseQueryTool(),
      new DatabaseSQLiteTool(),
      new DatabasePostgreSQLTool(),
      new DatabaseMySQLTool(),
    ];

    for (const tool of tools) {
      await ToolRegistry.registerTool(tool);
    }

    this.initialized = true;
    Logger.info(`Tool Registry initialized with ${ToolRegistry.size()} native tools.`);
  }

  static reset(): void {
    this.initialized = false;
  }
}

/**
 * Legacy function kept for backward compatibility with OmniBrain.
 * Delegates to ToolInitializer.initialize() asynchronously.
 */
export function initializeToolRegistry(): typeof ToolRegistry {
  ToolInitializer.initialize().catch((err) => {
    Logger.error("Failed to initialize tool registry", { error: err });
  });
  return ToolRegistry;
}
