import { Message, StreamCallbacks } from "../../types";
import { OmniBrain } from "../brain/OmniBrain";

export class AIOrchestrator {
  private omniBrain: OmniBrain;

  constructor(apiKeys: Record<string, string>) {
    this.omniBrain = new OmniBrain(apiKeys);
  }

  async execute(
    messages: Message[],
    callbacks: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<void> {
    await this.omniBrain.processRequest(messages, callbacks, signal);
  }
}
