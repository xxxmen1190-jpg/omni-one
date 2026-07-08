import { ITool, ToolInputSchema, ToolOutputSchema } from "../../types/tool";
import { ProviderName } from "../../types";

export abstract class BaseTool implements ITool {
  id: string;
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  outputSchema: ToolOutputSchema;
  supportedProviders: ProviderName[];

  constructor(
    id: string,
    name: string,
    description: string,
    inputSchema: ToolInputSchema,
    outputSchema: ToolOutputSchema,
    supportedProviders: ProviderName[] = []
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.supportedProviders = supportedProviders;
  }

  abstract execute(input: any): Promise<any>;

  async validate(input: any): Promise<boolean> {
    // Basic validation - check if input has required fields
    if (!input || typeof input !== "object") {
      return false;
    }

    // Check if all required fields are present
    const requiredFields = this.inputSchema.required || [];
    for (const field of requiredFields) {
      if (!(field in input)) {
        return false;
      }
    }

    return true;
  }
}
