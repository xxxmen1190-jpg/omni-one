import { ProviderName } from "../../../types";

export type ToolCapability = 
  | "read_file" 
  | "write_file" 
  | "browse_web" 
  | "search_web" 
  | "generate_image" 
  | "send_email" 
  | "access_calendar" 
  | "github_repo_read" 
  | "github_repo_write" 
  | "database_query" 
  | "ocr" 
  | "speech_to_text" 
  | "text_to_speech" 
  | "video_processing";

export interface ToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description: string;
  required: boolean;
  enum?: string[];
  properties?: { [key: string]: ToolParameter };
  items?: ToolParameter;
}

export interface ITool {
  id: string;
  name: string;
  description: string;
  version: string;
  capabilities: ToolCapability[];
  parameters: ToolParameter[];
  supportedProviders?: ProviderName[];
  execute(params: Record<string, any>, signal?: AbortSignal): Promise<ToolResult>;
  timeoutMs?: number;
  validate?(params: Record<string, any>): boolean;
  getPermissions?(): ToolPermission[];
}

export interface ToolResult {
  success: boolean;
  output: any;
  error?: string;
  metadata?: Record<string, any>;
}

export type ToolPermission = 
  | "read_files" 
  | "write_files" 
  | "access_internet" 
  | "access_github" 
  | "send_emails" 
  | "access_calendar" 
  | "use_microphone" 
  | "open_browser" 
  | "database_access";

export interface PermissionGrant {
  toolId: string;
  permission: ToolPermission;
  grantedAt: number;
  expiresAt?: number;
  allowOnce: boolean;
}

export interface ToolExecutionLog {
  toolId: string;
  toolName: string;
  timestamp: number;
  duration: number;
  success: boolean;
  error?: string;
  input: Record<string, any>;
  output: any;
  metrics?: Record<string, any>;
}
