import { ITool, ToolMetadata } from "../../types/tool";

export class ToolRegistry {
  private tools: Map<string, ITool> = new Map();
  private metadata: Map<string, ToolMetadata> = new Map();

  register(tool: ITool): void {
    if (this.tools.has(tool.id)) {
      throw new Error(`Tool with id ${tool.id} is already registered`);
    }
    this.tools.set(tool.id, tool);
    this.metadata.set(tool.id, {
      id: tool.id,
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      supportedProviders: tool.supportedProviders,
    });
  }

  unregister(toolId: string): void {
    if (!this.tools.has(toolId)) {
      throw new Error(`Tool with id ${toolId} is not registered`);
    }
    this.tools.delete(toolId);
    this.metadata.delete(toolId);
  }

  get(toolId: string): ITool | undefined {
    return this.tools.get(toolId);
  }

  getMetadata(toolId: string): ToolMetadata | undefined {
    return this.metadata.get(toolId);
  }

  getAllTools(): ITool[] {
    return Array.from(this.tools.values());
  }

  getAllMetadata(): ToolMetadata[] {
    return Array.from(this.metadata.values());
  }

  getToolsByName(name: string): ITool[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  getToolsByProvider(provider: string): ITool[] {
    return Array.from(this.tools.values()).filter((tool) =>
      tool.supportedProviders.includes(provider as any)
    );
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  size(): number {
    return this.tools.size;
  }
}
