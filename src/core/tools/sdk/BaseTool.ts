import { ITool, ToolParameter, ToolCapability, ToolResult, ToolPermission } from "../types";
import { Logger } from "../../system/Logger";

export abstract class BaseTool implements ITool {
  abstract id: string;
  abstract name: string;
  abstract description: string;
  abstract version: string;
  abstract capabilities: ToolCapability[];
  abstract parameters: ToolParameter[];
  timeoutMs?: number;

  constructor(timeoutMs?: number) {
    this.timeoutMs = timeoutMs;
  }

  abstract execute(params: Record<string, any>, signal?: AbortSignal): Promise<ToolResult>;

  validate(params: Record<string, any>): boolean {
    for (const param of this.parameters) {
      if (param.required && params[param.name] === undefined) {
        Logger.warn(`Validation failed for tool ${this.name}: Missing required parameter ${param.name}`);
        return false;
      }
      // Basic type validation (can be extended)
      if (params[param.name] !== undefined) {
        if (param.type === "string" && typeof params[param.name] !== "string") return false;
        if (param.type === "number" && typeof params[param.name] !== "number") return false;
        if (param.type === "boolean" && typeof params[param.name] !== "boolean") return false;
        // Add more complex validation for object/array types if needed
      }
    }
    return true;
  }

  getPermissions(): ToolPermission[] {
    // Tools should override this to declare specific permissions
    return [];
  }
}
