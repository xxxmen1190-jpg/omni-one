/**
 * API Types — Omni One Frontend
 * Shared type definitions for all API communication.
 */

// ─── Base Response ────────────────────────────────────────────────────────────

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  requestId: string;
  timestamp: string;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  requestId: string;
  timestamp: string;
  error: {
    code: string;
    message: string;
    statusCode: number;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  role: "USER" | "ADMIN" | "SUPER_ADMIN";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName?: string;
}

// ─── Conversations ────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  conversationId: string;
  role: "USER" | "ASSISTANT" | "SYSTEM" | "TOOL";
  content: string;
  tokens?: number;
  model?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  model?: string;
  systemPrompt?: string;
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  folderId?: string | null;
  tags?: string[];
  projectId?: string;
  messages?: Message[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateConversationRequest {
  title?: string;
  model?: string;
  systemPrompt?: string;
  projectId?: string;
}

export interface UpdateConversationRequest {
  title?: string;
  model?: string;
  systemPrompt?: string;
  isPinned?: boolean;
  isFavorite?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
}

export interface SendMessageRequest {
  conversationId: string;
  content: string;
  model?: string;
  stream?: boolean;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description?: string;
  userId: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

// ─── Files ────────────────────────────────────────────────────────────────────

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  key: string;
  provider: string;
  projectId?: string;
  metadata?: Record<string, unknown>;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export interface Memory {
  id: string;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  read: boolean;
  createdAt: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface UserSettings {
  theme?: "dark" | "light" | "system";
  language?: string;
  defaultModel?: string;
  streamingEnabled?: boolean;
  notificationsEnabled?: boolean;
  [key: string]: unknown;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

// ─── Agents ───────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  type: string;
  config?: Record<string, unknown>;
  status: "IDLE" | "RUNNING" | "MAINTENANCE" | "DEPRECATED";
  createdAt: string;
  updatedAt: string;
}

// ─── Streaming ────────────────────────────────────────────────────────────────

export interface StreamChunk {
  type: "delta" | "done" | "error" | "metadata";
  content?: string;
  messageId?: string;
  model?: string;
  tokens?: number;
  error?: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Error ────────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}
