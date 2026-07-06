import { ProviderName } from "./index";

export interface ToolInputSchema {
  [key: string]: any;
}

export interface ToolOutputSchema {
  [key: string]: any;
}

export interface ITool {
  id: string;
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  outputSchema: ToolOutputSchema;
  supportedProviders: ProviderName[];

  execute(input: any): Promise<any>;
  validate(input: any): Promise<boolean>;
}

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  outputSchema: ToolOutputSchema;
  supportedProviders: ProviderName[];
}
