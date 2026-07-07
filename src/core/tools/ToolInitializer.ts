import { ToolRegistry } from "./ToolRegistry";

// Browser Tools
import {
  BrowserNavigationTool,
  BrowserClickTool,
  BrowserInputTool,
  BrowserScrollTool,
  WebScrapingTool,
} from "./BrowserTools";

// File Tools
import {
  FileReadTool,
  FileWriteTool,
  FileListTool,
  FileDeleteTool,
  FileCopyTool,
  FileSearchTool,
} from "./FileTools";

// HTTP Tools
import {
  HTTPRequestTool,
  JSONParserTool,
  RESTAPITool,
  GraphQLTool,
  APIAuthenticationTool,
} from "./HTTPTools";

// Media Tools
import {
  ImageRecognitionTool,
  ImageGenerationTool,
  OCRTool,
  VideoAnalysisTool,
  ImageProcessingTool,
  AudioProcessingTool,
} from "./MediaTools";

// Dev Tools
import {
  GitHubRepositoryTool,
  GitHubIssuesTool,
  CodeExecutionTool,
  DatabaseQueryTool,
  EmailTool,
  CalendarTool,
} from "./DevTools";

// Existing Tools
import {
  CodeAnalysisTool,
  CodeGenerationTool,
} from "./CodeTools";

import {
  DocumentProcessingTool,
  DataProcessingTool,
  TextProcessingTool,
  SchedulingTool,
} from "./ProductivityTools";

/**
 * Initialize and register all available tools in the registry
 */
export function initializeToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  // Browser Tools
  registry.register(new BrowserNavigationTool());
  registry.register(new BrowserClickTool());
  registry.register(new BrowserInputTool());
  registry.register(new BrowserScrollTool());
  registry.register(new WebScrapingTool());

  // File Tools
  registry.register(new FileReadTool());
  registry.register(new FileWriteTool());
  registry.register(new FileListTool());
  registry.register(new FileDeleteTool());
  registry.register(new FileCopyTool());
  registry.register(new FileSearchTool());

  // HTTP Tools
  registry.register(new HTTPRequestTool());
  registry.register(new JSONParserTool());
  registry.register(new RESTAPITool());
  registry.register(new GraphQLTool());
  registry.register(new APIAuthenticationTool());

  // Media Tools
  registry.register(new ImageRecognitionTool());
  registry.register(new ImageGenerationTool());
  registry.register(new OCRTool());
  registry.register(new VideoAnalysisTool());
  registry.register(new ImageProcessingTool());
  registry.register(new AudioProcessingTool());

  // Dev Tools
  registry.register(new GitHubRepositoryTool());
  registry.register(new GitHubIssuesTool());
  registry.register(new CodeExecutionTool());
  registry.register(new DatabaseQueryTool());
  registry.register(new EmailTool());
  registry.register(new CalendarTool());

  // Code Tools
  registry.register(new CodeAnalysisTool());
  registry.register(new CodeGenerationTool());

  // Productivity Tools
  registry.register(new DocumentProcessingTool());
  registry.register(new DataProcessingTool());
  registry.register(new TextProcessingTool());
  registry.register(new SchedulingTool());

  return registry;
}

/**
 * Get a list of all available tool IDs
 */
export function getAvailableToolIds(): string[] {
  const registry = initializeToolRegistry();
  return registry.getAllMetadata().map((tool) => tool.id);
}

/**
 * Get tool metadata for all tools
 */
export function getAllToolMetadata() {
  const registry = initializeToolRegistry();
  return registry.getAllMetadata();
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string) {
  const registry = initializeToolRegistry();
  const allTools = registry.getAllMetadata();

  const categoryMap: { [key: string]: string[] } = {
    browser: [
      "browser-navigation",
      "browser-click",
      "browser-input",
      "browser-scroll",
      "web-scraping",
    ],
    files: [
      "file-read",
      "file-write",
      "file-list",
      "file-delete",
      "file-copy",
      "file-search",
    ],
    http: [
      "http-request",
      "json-parser",
      "rest-api",
      "graphql-query",
      "api-auth",
    ],
    media: [
      "image-recognition",
      "image-generation",
      "ocr",
      "video-analysis",
      "image-processing",
      "audio-processing",
    ],
    development: [
      "github-repository",
      "github-issues",
      "code-execution",
      "database-query",
      "email",
      "calendar",
    ],
    code: [
      "code-execution",
      "code-analysis",
      "code-generation",
    ],
    productivity: [
      "document-processing",
      "data-processing",
      "text-processing",
      "scheduling",
    ],
  };

  const toolIds = categoryMap[category.toLowerCase()] || [];
  return allTools.filter((tool) => toolIds.includes(tool.id));
}
