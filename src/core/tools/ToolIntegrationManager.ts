import { ToolRegistry } from "./ToolRegistry";
import { CapabilityRegistry } from "./CapabilityRegistry";
import { ToolDiscovery } from "./ToolDiscovery";
import { ToolInitializer } from "./ToolInitializer";
import { UniversalToolExecutor } from "./executor/UniversalToolExecutor";
import { StreamingExecutor } from "./executor/StreamingExecutor";
import { Logger } from "../system/Logger";

export class ToolIntegrationManager {
  static async initialize(): Promise<void> {
    Logger.info("Initializing Tool Integration Manager...");
    
    // Initialize all tools
    await ToolInitializer.initialize();

    // Index tools by capability
    const allTools = ToolRegistry.getAllTools();
    for (const tool of allTools) {
      CapabilityRegistry.indexTool(tool);
    }

    Logger.info("Tool Integration Manager initialized successfully.");
  }

  static getToolExecutor() {
    return UniversalToolExecutor;
  }

  static getStreamingExecutor() {
    return StreamingExecutor;
  }

  static getToolDiscovery() {
    return ToolDiscovery;
  }

  static getToolRegistry() {
    return ToolRegistry;
  }

  static getCapabilityRegistry() {
    return CapabilityRegistry;
  }

  static getSystemStatus() {
    return {
      totalTools: ToolRegistry.getAllTools().length,
      capabilities: CapabilityRegistry.getAllCapabilities(),
      capabilityStats: CapabilityRegistry.getCapabilityStats(),
    };
  }
}
