import { SkillName, Message, StreamCallbacks } from "../types";
import { SkillRegistry } from "./skillRegistry";
import { EventBus } from "../system/EventBus";
import { Logger } from "../system/Logger";
import { UniversalToolExecutor } from "../tools/executor/UniversalToolExecutor";

export class SkillStreamingExecutor {
  static async *executeWithStreaming(
    skillName: SkillName,
    messages: Message[],
    signal?: AbortSignal
  ): AsyncGenerator<string> {
    const skill = SkillRegistry.getSkill(skillName);
    if (!skill) {
      yield `❌ Skill not found: ${skillName}\n`;
      return;
    }

    Logger.info(`Starting streaming execution for skill ${skillName}`);
    EventBus.emit("skill:start", { skillName });
    yield `🎯 Executing skill: ${skill.name}...\n`;

    try {
      // Execute skill with tool executor context
      const context = {
        executor: UniversalToolExecutor,
        signal,
        callbacks: {
          onChunk: (chunk: string) => {
            // Chunks will be yielded by the skill
          },
          onComplete: (fullText: string) => {
            // Completion will be handled after skill execution
          },
          onError: (error: Error) => {
            Logger.error(`Skill ${skillName} error`, { error: error.message });
          },
        },
      };

      const result = await skill.execute(messages, context);

      EventBus.emit("skill:complete", { skillName, result });
      yield `✅ Skill execution completed.\n`;
      yield JSON.stringify(result, null, 2);
    } catch (error: any) {
      EventBus.emit("skill:error", { skillName, error: error.message });
      Logger.error(`Streaming execution failed for skill ${skillName}`, { error: error.message });
      yield `❌ Error: ${error.message}\n`;
    }
  }
}
