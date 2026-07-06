import { SkillName, ProviderName, Message, ProviderRequest, StreamCallbacks, ProviderResponse } from "../../types";
import { SkillRegistry } from "../skills/skillRegistry";
import { IAIProvider } from "../providers/baseProvider";

export class MultiModelRouter {
  static async routeAndExecute(
    skillName: SkillName,
    messages: Message[],
    apiKeys: Record<string, string>,
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<ProviderResponse[]> {
    const skill = SkillRegistry.getSkill(skillName);
    if (!skill) {
      throw new Error(`Skill '${skillName}' not found.`);
    }

    const supportedProviders = SkillRegistry.getSupportedProvidersForSkill(skillName);
    if (supportedProviders.length === 0) {
      throw new Error(`No providers configured for skill '${skillName}'.`);
    }

    // For now, a simple routing strategy: use all supported providers in parallel.
    // This can be made more sophisticated based on intent, user preferences, cost, etc.
    const providersToUse = supportedProviders;

    const executionPromises = providersToUse.map(async (providerName) => {
      const providerInstance = SkillRegistry['providers'].get(providerName); // Accessing static private property
      if (!providerInstance) {
        return { provider: providerName, content: '', confidence: 0, latency: 0, error: `Provider ${providerName} not initialized.` };
      }

      const startTime = Date.now();
      let content = '';
      let error: string | undefined;

      try {
        await providerInstance.generateStream(
          { messages, signal },
          {
            onChunk: (chunk) => { content += chunk; },
            onComplete: (fullText) => { content = fullText; },
            onError: (err) => { error = err.message; },
          }
        );
      } catch (err: any) {
        error = err.message;
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      return {
        provider: providerName,
        content,
        confidence: error ? 0 : 0.7, // Placeholder confidence
        latency,
        error,
      };
    });

    return Promise.all(executionPromises);
  }
}
