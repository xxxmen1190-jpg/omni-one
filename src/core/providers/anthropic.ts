import { BaseAIProvider } from "./baseProvider";
import type { ProviderName } from "../../types";
import { ProviderRequest, StreamCallbacks } from "../../types";

export class AnthropicProvider extends BaseAIProvider {
  name: ProviderName = "anthropic";
  private model: string;

  constructor(apiKey: string, model: string = "claude-3-5-sonnet-20240620") {
    super(apiKey, "https://api.anthropic.com/v1/messages");
    this.model = model;
  }

  async generateStream(request: ProviderRequest, callbacks: StreamCallbacks): Promise<void> {
    try {
      const response = await fetch(this.baseUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages.map(m => ({ role: m.role, content: m.content })),
          max_tokens: 4096,
          stream: true,
        }),
        signal: request.signal,
      });

      if (!response.ok) throw new Error(`Anthropic Error: ${response.statusText}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(line => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.substring(6));
              if (parsed.type === "content_block_delta") {
                const content = parsed.delta?.text || "";
                fullText += content;
                callbacks.onChunk(content);
              }
            } catch (e) {}
          }
        }
      }
      callbacks.onComplete(fullText);
    } catch (error: any) {
      callbacks.onError(error);
    }
  }
}
