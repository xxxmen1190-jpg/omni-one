import { BaseAIProvider } from "./baseProvider";
import { ProviderRequest, StreamCallbacks } from "../../types";

export class OpenAIProvider extends BaseAIProvider {
  name = "openai";
  private model: string;

  constructor(apiKey: string, model: string = "gpt-4o") {
    super(apiKey, "https://api.openai.com/v1/chat/completions");
    this.model = model;
  }

  async generateStream(request: ProviderRequest, callbacks: StreamCallbacks): Promise<void> {
    try {
      const response = await fetch(this.baseUrl!, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages.map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
        signal: request.signal,
      });

      if (!response.ok) throw new Error(`OpenAI Error: ${response.statusText}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(line => line.trim() !== "");

        for (const line of lines) {
          const message = line.replace(/^data: /, "");
          if (message === "[DONE]") break;

          try {
            const parsed = JSON.parse(message);
            const content = parsed.choices[0]?.delta?.content || "";
            if (content) {
              fullText += content;
              callbacks.onChunk(content);
            }
          } catch (e) {
            // Skip parse errors for non-json lines
          }
        }
      }
      callbacks.onComplete(fullText);
    } catch (error: any) {
      callbacks.onError(error);
    }
  }
}
