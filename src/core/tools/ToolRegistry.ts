import { ITool, ToolCapability } from "./types";
import { Logger } from "../system/Logger";
import { PluginManager } from "../system/PluginSystem";

// Accept any object that has at minimum id, name, version
type AnyTool = { id: string; name: string; version?: string; [key: string]: any };

export class ToolRegistry {
  private static tools = new Map<string, AnyTool>();

  static async registerTool(tool: AnyTool): Promise<void> {
    if (this.tools.has(tool.id)) {
      Logger.warn(`Tool ${tool.id} already registered. Overwriting.`);
    }
    this.tools.set(tool.id, tool);
    Logger.info(`Tool registered: ${tool.name} (${tool.id})`);

    // Register tool as a plugin
    await PluginManager.register("tool", {
      id: `tool-${tool.id}`,
      name: tool.name,
      version: tool.version || "1.0.0",
      initialize: async () => {},
      shutdown: async () => {},
    });
  }

  static getTool(toolId: string): ITool | undefined {
    return this.tools.get(toolId) as ITool | undefined;
  }

  static getToolsByCapability(capability: ToolCapability): ITool[] {
    return Array.from(this.tools.values()).filter(tool =>
      Array.isArray(tool.capabilities) && tool.capabilities.includes(capability)
    ) as ITool[];
  }

  static getAllTools(): ITool[] {
    return Array.from(this.tools.values()) as ITool[];
  }

  static get(toolId: string): ITool | undefined {
    return this.getTool(toolId);
  }

  static size(): number {
    return this.tools.size;
  }
}
