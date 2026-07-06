import { Message, StreamCallbacks, ProviderRequest, ProviderName } from "../../types";

export interface IAIProvider {
  name: ProviderName;
  generateStream(request: ProviderRequest, callbacks: StreamCallbacks): Promise<void>;
  retryConfig?: {
    maxRetries: number;
    initialDelay: number;
  };
  timeoutMs?: number;
}

export abstract class BaseAIProvider implements IAIProvider {
  abstract name: string;
  protected apiKey: string;
  protected baseUrl?: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  abstract generateStream(request: ProviderRequest, callbacks: StreamCallbacks): Promise<void>;

  protected async fetchSSE(
    url: string,
    options: RequestInit,
    onChunk: (chunk: string) => void,
    signal?: AbortSignal
  ) {
    const timeout = (options as any).timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Create a combined signal
    const signals = [controller.signal];
    if (signal) signals.push(signal);
    
    // Polyfill for AbortSignal.any if not available
    const combinedSignal = (AbortSignal as any).any 
      ? (AbortSignal as any).any(signals)
      : this.anySignal(signals);

    try {
      const response = await fetch(url, { ...options, signal: combinedSignal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader available");

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        if (controller.signal.aborted) throw new Error("Request timed out");
        throw new Error("Request cancelled");
      }
      throw error;
    }
  }

  private anySignal(signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        return signal;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return controller.signal;
  }
}
