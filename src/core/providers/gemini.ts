import { BaseAIProvider } from "./baseProvider";
import { ProviderRequest, StreamCallbacks } from "../../types";

export class GeminiProvider extends BaseAIProvider {
  name = "gemini";
  private model: string;

  constructor(apiKey: string, model: string = "gemini-1.5-pro") {
    super(apiKey, "https://generativelanguage.googleapis.com/v1beta/models/");
    this.model = model;
  }

  async generateStream(request: ProviderRequest, callbacks: StreamCallbacks): Promise<void> {
    try {
      const url = `${this.baseUrl}${this.model}:streamGenerateContent?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: request.messages.map(m => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }]
          })),
        }),
        signal: request.signal,
      });

      if (!response.ok) throw new Error(`Gemini Error: ${response.statusText}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // Gemini returns a JSON array of candidates in chunks
        try {
          const cleanedChunk = chunk.replace(/^\[/, "").replace(/,$/, "").replace(/\]$/, "");
          if (!cleanedChunk) continue;
          
          const parsed = JSON.parse(cleanedChunk);
          const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (content) {
            fullText += content;
            callbacks.onChunk(content);
          }
        } catch (e) {}
      }
      callbacks.onComplete(fullText);
    } catch (error: any) {
      callbacks.onError(error);
    }
  }
}
