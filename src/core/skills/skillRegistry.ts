import { Skill, SkillName, ProviderName, Message } from "../../types";
import { OpenAIProvider } from "../providers/openai";
import { AnthropicProvider } from "../providers/anthropic";
import { GeminiProvider } from "../providers/gemini";
import { GroqProvider } from "../providers/groq";
import { OpenRouterProvider } from "../providers/openrouter";
import { IAIProvider } from "../providers/baseProvider";

export class SkillRegistry {
  private static skills = new Map<SkillName, Skill>();
  private static providers: Map<ProviderName, IAIProvider> = new Map();

  static initialize(apiKeys: Record<string, string>) {

    if (apiKeys.openai) this.providers.set("openai", new OpenAIProvider(apiKeys.openai));
    if (apiKeys.anthropic) this.providers.set("anthropic", new AnthropicProvider(apiKeys.anthropic));
    if (apiKeys.gemini) this.providers.set("gemini", new GeminiProvider(apiKeys.gemini));
    if (apiKeys.groq) this.providers.set("groq", new GroqProvider(apiKeys.groq));
    if (apiKeys.openrouter) this.providers.set("openrouter", new OpenRouterProvider(apiKeys.openrouter));

    // Register core skills
    this.registerSkill({
      name: "chat",
      description: "Handles general conversational requests.",
      execute: async (messages: Message[], config: { provider: ProviderName, callbacks: any, signal?: AbortSignal }) => {
        const provider = this.providers.get(config.provider);
        if (!provider) throw new Error(`Provider ${config.provider} not found for chat skill.`);
        return provider.generateStream({ messages, signal: config.signal }, config.callbacks);
      },
      supportedProviders: ["openai", "anthropic", "gemini", "groq", "openrouter"],
    });

    this.registerSkill({
      name: "code",
      description: "Generates or debugs code snippets.",
      execute: async (messages: Message[], config: { provider: ProviderName, callbacks: any, signal?: AbortSignal }) => {
        const provider = this.providers.get(config.provider);
        if (!provider) throw new Error(`Provider ${config.provider} not found for code skill.`);
        return provider.generateStream({ messages, signal: config.signal }, config.callbacks);
      },
      supportedProviders: ["openai", "anthropic", "gemini", "groq"],
    });

    this.registerSkill({
      name: "reasoning",
      description: "Performs complex reasoning and analysis.",
      execute: async (messages: Message[], config: { provider: ProviderName, callbacks: any, signal?: AbortSignal }) => {
        const provider = this.providers.get(config.provider);
        if (!provider) throw new Error(`Provider ${config.provider} not found for reasoning skill.`);
        return provider.generateStream({ messages, signal: config.signal }, config.callbacks);
      },
      supportedProviders: ["openai", "anthropic", "gemini"],
    });

    this.registerSkill({
      name: "search",
      description: "Performs web searches or retrieves information.",
      execute: async (messages: Message[], config: { provider: ProviderName, callbacks: any, signal?: AbortSignal }) => {
        const provider = this.providers.get(config.provider);
        if (!provider) throw new Error(`Provider ${config.provider} not found for search skill.`);
        return provider.generateStream({ messages, signal: config.signal }, config.callbacks);
      },
      supportedProviders: ["groq", "openrouter"],
    });

    this.registerSkill({
      name: "image",
      description: "Generates or processes images.",
      execute: async (messages: Message[], config: { provider: ProviderName, callbacks: any, signal?: AbortSignal }) => {
        const provider = this.providers.get(config.provider);
        if (!provider) throw new Error(`Provider ${config.provider} not found for image skill.`);
        return provider.generateStream({ messages, signal: config.signal }, config.callbacks);
      },
      supportedProviders: ["openai", "gemini"],
    });

    // Add more skills as needed
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
