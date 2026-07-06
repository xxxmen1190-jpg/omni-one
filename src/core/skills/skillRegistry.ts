import { Skill, SkillName, ProviderName, Message } from "../../types";
import { GeneralAgent, ResearchAgent, CodingAgent } from "../ai/SpecificAgents";
import { OpenAIProvider } from "../providers/openai";
import { AnthropicProvider } from "../providers/anthropic";
import { GeminiProvider } from "../providers/gemini";
import { GroqProvider } from "../providers/groq";
import { OpenRouterProvider } from "../providers/openrouter";
import { IAIProvider } from "../providers/baseProvider";
import { PluginManager } from "../system/PluginSystem";

export class SkillRegistry {
  private static skills = new Map<SkillName, Skill>();
  private static providers: Map<ProviderName, IAIProvider> = new Map();

  static initialize(apiKeys: Record<string, string>) {
    const providerConfigs: { name: ProviderName; class: any }[] = [
      { name: "openai", class: OpenAIProvider },
      { name: "anthropic", class: AnthropicProvider },
      { name: "gemini", class: GeminiProvider },
      { name: "groq", class: GroqProvider },
      { name: "openrouter", class: OpenRouterProvider },
    ];

    providerConfigs.forEach(({ name, class: ProviderClass }) => {
      if (apiKeys[name]) {
        const instance = new ProviderClass(apiKeys[name]);
        this.providers.set(name, instance);
        
        PluginManager.register("provider", {
          id: `provider-${name}`,
          name: `${name.toUpperCase()} AI Provider`,
          version: "1.0.0",
          initialize: async () => {},
          shutdown: async () => {}
        });
      }
    });

    // Register core skills as plugins
    const coreSkills: Skill[] = [
      {
        name: "chat",
        description: "Handles general conversational requests.",
        execute: async () => {}, // Managed by MultiModelRouter
        supportedProviders: ["openai", "anthropic", "gemini", "groq", "openrouter"],
      },
      {
        name: "code",
        description: "Generates or debugs code snippets.",
        execute: async () => {},
        supportedProviders: ["openai", "anthropic", "gemini", "groq"],
      },
      {
        name: "reasoning",
        description: "Performs complex reasoning and analysis.",
        execute: async () => {},
        supportedProviders: ["openai", "anthropic", "gemini"],
      },
      {
        name: "search",
        description: "Performs web searches or retrieves information.",
        execute: async () => {},
        supportedProviders: ["groq", "openrouter"],
      },
      {
        name: "image",
        description: "Generates or processes images.",
        execute: async () => {},
        supportedProviders: ["openai", "gemini"],
      }
    ];

    coreSkills.forEach(skill => {
      this.registerSkill(skill);
      PluginManager.register("skill", {
        id: `skill-${skill.name}`,
        name: `${skill.name.toUpperCase()} Skill`,
        version: "1.0.0",
        initialize: async () => {},
        shutdown: async () => {}
      });
    });

    // Register Agents
    const agents = [
      new GeneralAgent(),
      new ResearchAgent(),
      new CodingAgent()
    ];

    agents.forEach(agent => {
      PluginManager.register("agent", agent);
    });
  }

  static registerSkill(skill: Skill) {
    this.skills.set(skill.name, skill);
  }

  static getSkill(name: SkillName): Skill | undefined {
    return this.skills.get(name);
  }

  static getProviders(): Map<ProviderName, IAIProvider> {
    return this.providers;
  }

  static getSupportedProvidersForSkill(skillName: SkillName): ProviderName[] {
    const skill = this.skills.get(skillName);
    return skill ? skill.supportedProviders : [];
  }
}
