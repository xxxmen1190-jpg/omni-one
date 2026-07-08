import { ToolCapability, ITool } from "./types";
import { ToolRegistry } from "./ToolRegistry";
import { CapabilityRegistry } from "./CapabilityRegistry";
import { Metrics } from "../system/Metrics";
import { ProviderHealth } from "../system/ProviderHealth";
import { Logger } from "../system/Logger";

export interface ToolSelectionCriteria {
  capability: ToolCapability;
  preferredTools?: string[];
  excludeTools?: string[];
  prioritizeSpeed?: boolean;
  prioritizeReliability?: boolean;
}

export class ToolDiscovery {
  static discoverToolsForCapability(capability: ToolCapability): ITool[] {
    return CapabilityRegistry.getToolsForCapability(capability);
  }

  static selectBestTool(criteria: ToolSelectionCriteria): ITool | undefined {
    let candidates = this.discoverToolsForCapability(criteria.capability);

    // Filter by preferred/excluded tools
    if (criteria.preferredTools) {
      const preferred = candidates.filter(t => criteria.preferredTools!.includes(t.id));
      if (preferred.length > 0) candidates = preferred;
    }
    if (criteria.excludeTools) {
      candidates = candidates.filter(t => !criteria.excludeTools!.includes(t.id));
    }

    if (candidates.length === 0) {
      Logger.warn(`No tools found for capability: ${criteria.capability}`);
      return undefined;
    }

    // Score tools based on metrics and reliability
    const scored = candidates.map(tool => {
      const stats = Metrics.getToolStats(tool.id);
      let score = 1.0;

      if (stats) {
        score *= stats.successRate; // Success rate
        if (criteria.prioritizeSpeed) {
          score *= 1 / (1 + stats.avgDuration / 1000); // Prefer faster tools
        }
        if (criteria.prioritizeReliability) {
          score *= stats.successRate * 2; // Double weight for reliability
        }
      }

      return { tool, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const selected = scored[0].tool;
    Logger.info(`Selected tool for capability ${criteria.capability}: ${selected.name}`, { score: scored[0].score });
    return selected;
  }

  static discoverAllAvailableTools(): ITool[] {
    return ToolRegistry.getAllTools();
  }

  static getCapabilityMap(): Record<ToolCapability, ITool[]> {
    const map: any = {};
    for (const capability of CapabilityRegistry.getAllCapabilities()) {
      map[capability] = this.discoverToolsForCapability(capability);
    }
    return map;
  }
}
