import { ITool, ToolCapability } from "./types";
import { Logger } from "../system/Logger";
import { PluginManager } from "../system/PluginSystem";

export class ToolRegistry {
  private static tools = new Map<string, ITool>();

  static async registerTool(tool: ITool): Promise<void> {
    if (this.tools.has(tool.id)) {
      Logger.warn(`Tool ${tool.id} already registered. Overwriting.`);
    }
    this.tools.set(tool.id, tool);
    Logger.info(`Tool registered: ${tool.name} (${tool.id})`);

    // Register tool as a plugin
    await PluginManager.register("tool", {
      id: `tool-${tool.id}`,
      name: tool.name,
      version: tool.version,
      initialize: async () => {},
      shutdown: async () => {},
    });
  }

  static getTool(toolId: string): ITool | undefined {
    return this.tools.get(toolId);
  }

  static getToolsByCapability(capability: ToolCapability): ITool[] {
    return Array.from(this.tools.values()).filter(tool => tool.capabilities.includes(capability));
  }

  static getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }
}
