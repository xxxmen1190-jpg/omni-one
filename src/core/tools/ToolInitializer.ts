import { ToolRegistry } from "./ToolRegistry";
import { BrowserTool } from "./implementations/BrowserTool";
import { FileTool } from "./implementations/FileTool";
import { SearchTool } from "./implementations/SearchTool";
import { Logger } from "../system/Logger";

export class ToolInitializer {
  static async initialize(): Promise<void> {
    Logger.info("Initializing Tool Registry...");

    const tools = [
      new BrowserTool(),
      new FileTool(),
      new SearchTool(),
      // More tools can be added here
    ];

    for (const tool of tools) {
      await ToolRegistry.registerTool(tool);
    }

    Logger.info(`Tool Registry initialized with ${tools.length} tools.`);
  }
}
