import {
  SourcesPanel,
  SourceReference,
  DisplayMode,
} from "../../types/ux";
import { ChatResponse } from "../../types/integration";
import { Logger } from "../system/Logger";

/**
 * Sources Panel Builder - Creates sources panel from chat response
 */

export class SourcesPanelBuilder {
  constructor() {
    Logger.info("SourcesPanelBuilder initialized");
  }

  /**
   * Build sources panel from chat response
   */
  buildPanel(chatResponse: ChatResponse): SourcesPanel {
    const panel: SourcesPanel = {
      documents: [],
      memories: [],
      tools: [],
      agents: [],
      entities: [],
      totalSources: 0,
    };

    // Extract documents from RAG results
    if (chatResponse.executionContext.metadata.ragResults) {
      const ragResults = chatResponse.executionContext.metadata.ragResults;

      if (ragResults.context?.chunks) {
        for (const chunk of ragResults.context.chunks) {
          panel.documents.push({
            id: chunk.id,
            type: "document",
            title: `Document: ${chunk.documentId}`,
            content: chunk.content.substring(0, 200),
            relevance: chunk.metadata?.confidence || 0.8,
            confidence: chunk.metadata?.confidence || 0.8,
            metadata: {
              documentId: chunk.documentId,
              chunkIndex: chunk.metadata?.chunkIndex,
            },
          });
        }
      }

      if (ragResults.context?.entities) {
        for (const entity of ragResults.context.entities) {
          panel.entities.push({
            id: entity.id,
            type: "entity",
            title: entity.name,
            content: entity.description,
            relevance: entity.importance / 100,
            confidence: 0.85,
            metadata: {
              type: entity.type,
              importance: entity.importance,
            },
          });
        }
      }

      if (ragResults.memories) {
        for (const memory of ragResults.memories) {
          panel.memories.push({
            id: memory.id,
            type: "memory",
            title: `Memory: ${memory.type}`,
            content: memory.content.substring(0, 200),
            relevance: memory.importance / 100,
            confidence: 0.8,
            metadata: {
              memoryType: memory.type,
              importance: memory.importance,
            },
          });
        }
      }
    }

    // Extract tools from metadata
    if (chatResponse.metadata.toolsUsed && chatResponse.metadata.toolsUsed.length > 0) {
      for (const toolId of chatResponse.metadata.toolsUsed) {
        panel.tools.push({
          id: toolId,
          type: "tool",
          title: `Tool: ${toolId}`,
          relevance: 0.9,
          confidence: 0.85,
          metadata: {
            toolId,
          },
        });
      }
    }

    // Extract agents from metadata
    if (chatResponse.metadata.agentsUsed && chatResponse.metadata.agentsUsed.length > 0) {
      for (const agentId of chatResponse.metadata.agentsUsed) {
        panel.agents.push({
          id: agentId,
          type: "agent",
          title: `Agent: ${agentId}`,
          relevance: 0.85,
          confidence: 0.8,
          metadata: {
            agentId,
          },
        });
      }
    }

    // Calculate total sources
    panel.totalSources =
      panel.documents.length +
      panel.memories.length +
      panel.tools.length +
      panel.agents.length +
      panel.entities.length;

    Logger.info("Sources panel built", {
      documents: panel.documents.length,
      memories: panel.memories.length,
      tools: panel.tools.length,
      agents: panel.agents.length,
      entities: panel.entities.length,
    });

    return panel;
  }

  /**
   * Filter sources by type
   */
  filterByType(panel: SourcesPanel, type: string): SourceReference[] {
    switch (type) {
      case "document":
        return panel.documents;
      case "memory":
        return panel.memories;
      case "tool":
        return panel.tools;
      case "agent":
        return panel.agents;
      case "entity":
        return panel.entities;
      default:
        return [];
    }
  }

  /**
   * Sort sources by relevance
   */
  sortByRelevance(sources: SourceReference[]): SourceReference[] {
    return [...sources].sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Sort sources by confidence
   */
  sortByConfidence(sources: SourceReference[]): SourceReference[] {
    return [...sources].sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get top sources
   */
  getTopSources(panel: SourcesPanel, limit: number = 5): SourceReference[] {
    const allSources = [
      ...panel.documents,
      ...panel.memories,
      ...panel.tools,
      ...panel.agents,
      ...panel.entities,
    ];

    return this.sortByRelevance(allSources).slice(0, limit);
  }

  /**
   * Get sources by confidence threshold
   */
  getHighConfidenceSources(panel: SourcesPanel, threshold: number = 0.7): SourceReference[] {
    const allSources = [
      ...panel.documents,
      ...panel.memories,
      ...panel.tools,
      ...panel.agents,
      ...panel.entities,
    ];

    return allSources.filter((s) => s.confidence >= threshold);
  }

  /**
   * Highlight source in response
   */
  highlightSourceInResponse(response: string, sourceId: string): string {
    // This would be implemented in the UI layer
    return response;
  }

  /**
   * Get sources summary
   */
  getSummary(panel: SourcesPanel): string {
    const parts: string[] = [];

    if (panel.documents.length > 0) {
      parts.push(`${panel.documents.length} document(s)`);
    }

    if (panel.memories.length > 0) {
      parts.push(`${panel.memories.length} memory(ies)`);
    }

    if (panel.tools.length > 0) {
      parts.push(`${panel.tools.length} tool(s)`);
    }

    if (panel.agents.length > 0) {
      parts.push(`${panel.agents.length} agent(s)`);
    }

    if (panel.entities.length > 0) {
      parts.push(`${panel.entities.length} entit(ies)`);
    }

    return parts.join(" • ");
  }

  /**
   * Export sources as JSON
   */
  exportAsJSON(panel: SourcesPanel): string {
    return JSON.stringify(panel, null, 2);
  }

  /**
   * Export sources as markdown
   */
  exportAsMarkdown(panel: SourcesPanel): string {
    const lines: string[] = ["# Sources\n"];

    if (panel.documents.length > 0) {
      lines.push("## Documents\n");
      for (const doc of panel.documents) {
        lines.push(`- **${doc.title}** (Relevance: ${(doc.relevance * 100).toFixed(0)}%)`);
        if (doc.content) {
          lines.push(`  > ${doc.content}`);
        }
      }
      lines.push("");
    }

    if (panel.memories.length > 0) {
      lines.push("## Memories\n");
      for (const mem of panel.memories) {
        lines.push(`- **${mem.title}** (Confidence: ${(mem.confidence * 100).toFixed(0)}%)`);
        if (mem.content) {
          lines.push(`  > ${mem.content}`);
        }
      }
      lines.push("");
    }

    if (panel.tools.length > 0) {
      lines.push("## Tools Used\n");
      for (const tool of panel.tools) {
        lines.push(`- ${tool.title}`);
      }
      lines.push("");
    }

    if (panel.agents.length > 0) {
      lines.push("## Agents Used\n");
      for (const agent of panel.agents) {
        lines.push(`- ${agent.title}`);
      }
      lines.push("");
    }

    if (panel.entities.length > 0) {
      lines.push("## Entities Referenced\n");
      for (const entity of panel.entities) {
        lines.push(`- **${entity.title}**`);
        if (entity.content) {
          lines.push(`  > ${entity.content}`);
        }
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Get statistics
   */
  getStatistics(panel: SourcesPanel): Record<string, any> {
    const allSources = [
      ...panel.documents,
      ...panel.memories,
      ...panel.tools,
      ...panel.agents,
      ...panel.entities,
    ];

    const avgRelevance =
      allSources.length > 0
        ? allSources.reduce((sum, s) => sum + s.relevance, 0) / allSources.length
        : 0;

    const avgConfidence =
      allSources.length > 0
        ? allSources.reduce((sum, s) => sum + s.confidence, 0) / allSources.length
        : 0;

    return {
      totalSources: panel.totalSources,
      documentCount: panel.documents.length,
      memoryCount: panel.memories.length,
      toolCount: panel.tools.length,
      agentCount: panel.agents.length,
      entityCount: panel.entities.length,
      averageRelevance: avgRelevance,
      averageConfidence: avgConfidence,
      highConfidenceSources: allSources.filter((s) => s.confidence >= 0.8).length,
    };
  }
}

export const createSourcesPanelBuilder = (): SourcesPanelBuilder => {
  return new SourcesPanelBuilder();
};
