import { ToolRegistry } from "./ToolRegistry";
import { BrowserNavigationTool, HTTPRequestTool, WebScrapingTool } from "./WebTools";
import { CodeExecutionTool, CodeAnalysisTool, CodeGenerationTool } from "./CodeTools";
import {
  ImageRecognitionTool,
  ImageGenerationTool,
  OCRTool,
  VideoAnalysisTool,
} from "./VisionTools";
import {
  DocumentProcessingTool,
  DataProcessingTool,
  TextProcessingTool,
  EmailTool,
  SchedulingTool,
} from "./ProductivityTools";
import {
  BrowserNavigationTool as BrowserNavigationToolEnhanced,
  BrowserClickTool,
  BrowserInputTool,
  BrowserScrollTool,
  WebScrapingTool as WebScrapingToolEnhanced,
} from "./BrowserTools";
import {
  FileReadTool,
  FileWriteTool,
  FileListTool,
  FileDeleteTool,
  FileCopyTool,
  FileSearchTool,
} from "./FileTools";
import {
  HTTPRequestTool as HTTPRequestToolEnhanced,
  JSONParserTool,
  RESTAPITool,
  GraphQLTool,
  APIAuthenticationTool,
} from "./HTTPTools";
import {
  ImageRecognitionTool as ImageRecognitionToolEnhanced,
  ImageGenerationTool as ImageGenerationToolEnhanced,
  OCRTool as OCRToolEnhanced,
  VideoAnalysisTool as VideoAnalysisToolEnhanced,
  ImageProcessingTool,
  AudioProcessingTool,
} from "./MediaTools";
import {
  GitHubRepositoryTool,
  GitHubIssuesTool,
  CodeExecutionTool as CodeExecutionToolEnhanced,
  DatabaseQueryTool,
  EmailTool as EmailToolEnhanced,
  CalendarTool,
} from "./DevTools";
import { Logger } from "../system/Logger";

export class ToolInitializer {
  static async initialize(): Promise<void> {
    Logger.info("Initializing Tool Registry...");

    const tools = [
      new BrowserNavigationTool(),
      new HTTPRequestTool(),
      new WebScrapingTool(),
    ];

    for (const tool of tools) {
      await ToolRegistry.registerTool(tool);
    }

    Logger.info(`Tool Registry initialized with ${tools.length} tools.`);
  }
}

export function initializeToolRegistry(): ToolRegistry {
  Logger.info("Initializing Tool Registry...");

  const tools = [
    new BrowserNavigationTool(),
    new HTTPRequestTool(),
    new WebScrapingTool(),
    new CodeExecutionTool(),
    new CodeAnalysisTool(),
    new CodeGenerationTool(),
    new ImageRecognitionTool(),
    new ImageGenerationTool(),
    new OCRTool(),
    new VideoAnalysisTool(),
    new DocumentProcessingTool(),
    new DataProcessingTool(),
    new TextProcessingTool(),
    new EmailTool(),
    new SchedulingTool(),
    new BrowserNavigationToolEnhanced(),
    new BrowserClickTool(),
    new BrowserInputTool(),
    new BrowserScrollTool(),
    new WebScrapingToolEnhanced(),
    new FileReadTool(),
    new FileWriteTool(),
    new FileListTool(),
    new FileDeleteTool(),
    new FileCopyTool(),
    new FileSearchTool(),
    new HTTPRequestToolEnhanced(),
    new JSONParserTool(),
    new RESTAPITool(),
    new GraphQLTool(),
    new APIAuthenticationTool(),
    new ImageRecognitionToolEnhanced(),
    new ImageGenerationToolEnhanced(),
    new OCRToolEnhanced(),
    new VideoAnalysisToolEnhanced(),
    new ImageProcessingTool(),
    new AudioProcessingTool(),
    new GitHubRepositoryTool(),
    new GitHubIssuesTool(),
    new CodeExecutionToolEnhanced(),
    new DatabaseQueryTool(),
    new EmailToolEnhanced(),
    new CalendarTool(),
  ];

  for (const tool of tools) {
    ToolRegistry.registerTool(tool);
  }

  Logger.info(`Tool Registry initialized with ${ToolRegistry.size()} tools.`);
  return ToolRegistry;
}
