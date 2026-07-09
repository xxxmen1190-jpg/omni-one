import { ITool, ToolCapability } from "./types";
import { Logger } from "../system/Logger";
import { PluginManager } from "../system/PluginSystem";

// Accept both legacy tools (id/name at root) and SDK tools (metadata.id/metadata.name)
type AnyTool = {
  id?: string;
  name?: string;
  metadata?: { id: string; name: string; version?: string };
  version?: string;
  [key: string]: any;
};

function getToolId(tool: AnyTool): string {
  return tool.id ?? tool.metadata?.id ?? "unknown";
}

function getToolName(tool: AnyTool): string {
  return tool.name ?? tool.metadata?.name ?? "Unknown Tool";
}

function getToolVersion(tool: AnyTool): string {
  return tool.version ?? tool.metadata?.version ?? "1.0.0";
}

export class ToolRegistry {
  private static tools = new Map<string, AnyTool>();

  static async registerTool(tool: AnyTool): Promise<void> {
    const id = getToolId(tool);
    const name = getToolName(tool);
    const version = getToolVersion(tool);

    if (this.tools.has(id)) {
      Logger.warn(`Tool ${id} already registered. Overwriting.`);
    }
    this.tools.set(id, tool);
    Logger.info(`Tool registered: ${name} (${id})`);

    // Register tool as a plugin
    await PluginManager.register("tool", {
      id: `tool-${id}`,
      name,
      version,
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
