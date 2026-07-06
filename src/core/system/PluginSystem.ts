import { Logger } from "./Logger";

export interface IPlugin {
  id: string;
  name: string;
  version: string;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
}

export type PluginCategory = 
  | "provider" 
  | "agent" 
  | "skill" 
  | "tool" 
  | "memory" 
  | "integration" 
  | "workflow";

export class PluginManager {
  private static plugins = new Map<string, { plugin: IPlugin; category: PluginCategory }>();

  static async register(category: PluginCategory, plugin: IPlugin): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      Logger.warn(`Plugin ${plugin.id} already registered. Overwriting.`);
    }

    try {
      await plugin.initialize();
      this.plugins.set(plugin.id, { plugin, category });
      Logger.info(`Plugin registered: ${plugin.name} (${category})`);
    } catch (error: any) {
      Logger.error(`Failed to initialize plugin ${plugin.name}`, { error: error.message });
      throw error;
    }
  }

  static getPlugin<T extends IPlugin>(id: string): T | undefined {
    return this.plugins.get(id)?.plugin as T;
  }

  static getPluginsByCategory(category: PluginCategory): IPlugin[] {
    return Array.from(this.plugins.values())
      .filter(p => p.category === category)
      .map(p => p.plugin);
  }

  static async shutdownAll(): Promise<void> {
    for (const { plugin } of this.plugins.values()) {
      await plugin.shutdown();
    }
    this.plugins.clear();
    Logger.info("All plugins shut down.");
  }
}
