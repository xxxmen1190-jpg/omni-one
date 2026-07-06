import { Intent, TaskClassification, TaskType } from "../../types";

export class TaskClassifier {
  static classify(intent: Intent): TaskClassification {
    // For now, a simple mapping from intent to task type.
    // In a more complex system, this could involve more sophisticated logic,
    // e.g., using another LLM call to refine the task based on intent and context.
    const taskType: TaskType = intent.type;

    // Placeholder for more advanced parameter extraction
    const parameters: Record<string, any> = {};

    return {
      taskType,
      confidence: intent.confidence, // Inherit confidence from intent for now
      parameters,
    };
  }
}
