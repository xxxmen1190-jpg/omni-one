import { Message, StreamCallbacks, ProviderRequest } from "../../types";

export interface IAIProvider {
  name: string;
  generateStream(request: ProviderRequest, callbacks: StreamCallbacks): Promise<void>;
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

  protected async fetchSSE(url: string, options: RequestInit, onChunk: (chunk: string) => void) {
    const response = await fetch(url, options);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${error}`);
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
  }
}
