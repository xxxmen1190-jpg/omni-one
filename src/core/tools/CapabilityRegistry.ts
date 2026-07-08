import { ToolCapability, ITool } from "./types";
import { ToolRegistry } from "./ToolRegistry";
import { Logger } from "../system/Logger";

export class CapabilityRegistry {
  private static capabilityIndex = new Map<ToolCapability, Set<string>>(); // capability -> toolIds

  static indexTool(tool: ITool): void {
    for (const capability of tool.capabilities) {
      if (!this.capabilityIndex.has(capability)) {
        this.capabilityIndex.set(capability, new Set());
      }
      this.capabilityIndex.get(capability)!.add(tool.id);
    }
    Logger.debug(`Tool ${tool.id} indexed with capabilities: ${tool.capabilities.join(", ")}`);
  }

  static getToolsForCapability(capability: ToolCapability): ITool[] {
    const toolIds = this.capabilityIndex.get(capability) || new Set();
    return Array.from(toolIds).map(id => ToolRegistry.getTool(id)).filter(t => t !== undefined) as ITool[];
  }

  static findBestToolForCapability(capability: ToolCapability): ITool | undefined {
    const tools = this.getToolsForCapability(capability);
    if (tools.length === 0) return undefined;
    // Return the first available tool (can be enhanced with scoring)
    return tools[0];
  }

  static getAllCapabilities(): ToolCapability[] {
    return Array.from(this.capabilityIndex.keys());
  }

  static getCapabilityStats(): Record<ToolCapability, number> {
    const stats: any = {};
    for (const [capability, toolIds] of this.capabilityIndex.entries()) {
      stats[capability] = toolIds.size;
    }
    return stats;
  }
}
