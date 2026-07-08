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
  abstract name: ProviderName;
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
    const timeout = 30000; // Default timeout; callers should set via AbortSignal
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Create a combined signal
    const signals = [controller.signal];
    if (signal) signals.push(signal);
    
    // Use AbortSignal.any if available (modern browsers), otherwise fall back to manual implementation
    const AbortSignalAny = AbortSignal as unknown as { any?: (...s: AbortSignal[]) => AbortSignal };
    const combinedSignal = typeof AbortSignalAny.any === "function"
      ? AbortSignalAny.any!(...signals)
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
