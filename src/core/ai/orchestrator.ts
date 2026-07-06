import { OpenAIProvider } from "../providers/openai";
import { AnthropicProvider } from "../providers/anthropic";
import { GeminiProvider } from "../providers/gemini";
import { GroqProvider } from "../providers/groq";
import { OpenRouterProvider } from "../providers/openrouter";
import { AIRouter } from "../router/aiRouter";
import { IAIProvider } from "../providers/baseProvider";
import { Message, ProviderName, StreamCallbacks } from "../../types";

export class AIOrchestrator {
  private providers: Map<ProviderName, IAIProvider>;

  constructor(apiKeys: Record<string, string>) {
    this.providers = new Map();
    
    if (apiKeys.openai) this.providers.set("openai", new OpenAIProvider(apiKeys.openai));
    if (apiKeys.anthropic) this.providers.set("anthropic", new AnthropicProvider(apiKeys.anthropic));
    if (apiKeys.gemini) this.providers.set("gemini", new GeminiProvider(apiKeys.gemini));
    if (apiKeys.groq) this.providers.set("groq", new GroqProvider(apiKeys.groq));
    if (apiKeys.openrouter) this.providers.set("openrouter", new OpenRouterProvider(apiKeys.openrouter));
  }

  async execute(
    messages: Message[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    const lastMessage = messages[messages.length - 1].content;
    const intent = AIRouter.analyzeIntent(lastMessage);
    let providerName = AIRouter.selectProvider(intent);

    let provider = this.providers.get(providerName);
    
    // Fallback logic
    if (!provider) {
      providerName = "openai";
      provider = this.providers.get(providerName);
    }

    if (!provider) {
      callbacks.onError(new Error("No available AI provider configured."));
      return;
    }

    const attemptRequest = async (currentProvider: IAIProvider, retries: number): Promise<void> => {
      try {
        await currentProvider.generateStream({ messages, signal }, {
          onChunk: callbacks.onChunk,
          onComplete: callbacks.onComplete,
          onError: async (err) => {
            if (retries > 0 && !signal?.aborted) {
              console.log(`Retrying with fallback provider...`);
              const fallback = this.providers.get("anthropic") || this.providers.get("openai");
              if (fallback && fallback !== currentProvider) {
                await attemptRequest(fallback, retries - 1);
              } else {
                callbacks.onError(err);
              }
            } else {
              callbacks.onError(err);
            }
          }
        });
      } catch (err: any) {
        if (retries > 0 && !signal?.aborted) {
          const fallback = this.providers.get("anthropic") || this.providers.get("openai");
          if (fallback) await attemptRequest(fallback, retries - 1);
        } else {
          callbacks.onError(err);
        }
      }
    };

    await attemptRequest(provider, 2);
  }
}
