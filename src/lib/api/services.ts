/**
 * API Services — Omni One Frontend
 *
 * Typed service wrappers for every backend endpoint.
 * All calls route through the unified ApiClient.
 */

import apiClient, { type RequestOptions } from "./client";
import type {
  User,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
  Conversation,
  Message,
  CreateConversationRequest,
  UpdateConversationRequest,
  Project,
  CreateProjectRequest,
  UploadedFile,
  Memory,
  Notification,
  UserSettings,
  ApiKey,
  Agent,
  PaginatedResponse,
} from "./types";

// ─── Auth Service ─────────────────────────────────────────────────────────────

export const authApi = {
  login: (data: LoginRequest, opts?: RequestOptions) =>
    apiClient.post<AuthTokens>("/auth/login", data, { ...opts, skipAuth: true }),

  register: (data: RegisterRequest, opts?: RequestOptions) =>
    apiClient.post<AuthTokens>("/auth/register", data, { ...opts, skipAuth: true }),

  logout: (opts?: RequestOptions) =>
    apiClient.post<{ message: string }>("/auth/logout", undefined, opts),

  me: (opts?: RequestOptions) =>
    apiClient.get<{ user: User }>("/auth/me", opts),

  refreshSession: (opts?: RequestOptions) =>
    apiClient.post<AuthTokens>("/auth/refresh", undefined, opts),
};

// ─── Conversations Service ────────────────────────────────────────────────────

export const conversationsApi = {
  list: (opts?: RequestOptions) =>
    apiClient.get<Conversation[]>("/conversations", opts),

  get: (id: string, opts?: RequestOptions) =>
    apiClient.get<Conversation>(`/conversations/${id}`, opts),

  getWithMessages: (id: string, opts?: RequestOptions) =>
    apiClient.get<Conversation>(`/conversations/${id}?includeMessages=true`, opts),

  create: (data: CreateConversationRequest, opts?: RequestOptions) =>
    apiClient.post<Conversation>("/conversations", data, opts),

  update: (id: string, data: UpdateConversationRequest, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, data, opts),

  delete: (id: string, opts?: RequestOptions) =>
    apiClient.delete<{ message: string }>(`/conversations/${id}`, opts),

  // Message operations
  getMessages: (conversationId: string, opts?: RequestOptions) =>
    apiClient.get<Message[]>(`/conversations/${conversationId}/messages`, opts),

  addMessage: (
    conversationId: string,
    data: { role: string; content: string; model?: string; metadata?: Record<string, unknown> },
    opts?: RequestOptions
  ) => apiClient.post<Message>(`/conversations/${conversationId}/messages`, data, opts),

  updateMessage: (
    conversationId: string,
    messageId: string,
    data: { content: string },
    opts?: RequestOptions
  ) =>
    apiClient.patch<Message>(
      `/conversations/${conversationId}/messages/${messageId}`,
      data,
      opts
    ),

  deleteMessage: (
    conversationId: string,
    messageId: string,
    opts?: RequestOptions
  ) =>
    apiClient.delete<{ message: string }>(
      `/conversations/${conversationId}/messages/${messageId}`,
      opts
    ),

  // Bulk operations
  pin: (id: string, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, { isPinned: true }, opts),

  unpin: (id: string, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, { isPinned: false }, opts),

  favorite: (id: string, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, { isFavorite: true }, opts),

  unfavorite: (id: string, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, { isFavorite: false }, opts),

  archive: (id: string, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, { isArchived: true }, opts),

  unarchive: (id: string, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, { isArchived: false }, opts),

  softDelete: (id: string, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, { isDeleted: true }, opts),

  restore: (id: string, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, { isDeleted: false }, opts),

  rename: (id: string, title: string, opts?: RequestOptions) =>
    apiClient.patch<Conversation>(`/conversations/${id}`, { title }, opts),
};

// ─── Chat / Streaming Service ─────────────────────────────────────────────────

export const chatApi = {
  /** Non-streaming chat completion */
  complete: (
    data: {
      messages: Array<{ role: string; content: string }>;
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      conversationId?: string;
    },
    opts?: RequestOptions
  ) =>
    apiClient.post<{ message: string; model: string; tokens: number }>(
      "/chat",
      { ...data, stream: false },
      opts
    ),

  /** Streaming chat completion — returns AbortController for cancellation */
  stream: (
    data: {
      messages: Array<{ role: string; content: string }>;
      model?: string;
      maxTokens?: number;
      temperature?: number;
      systemPrompt?: string;
      conversationId?: string;
    },
    callbacks: {
      onChunk: (text: string) => void;
      onDone?: () => void;
      onError?: (err: Error) => void;
    },
    opts?: RequestOptions
  ) =>
    apiClient.streamPost("/chat/stream", { ...data, stream: true }, {
      ...opts,
      ...callbacks,
    }),
};

// ─── Projects Service ─────────────────────────────────────────────────────────

export const projectsApi = {
  list: (opts?: RequestOptions) =>
    apiClient.get<Project[]>("/projects", opts),

  get: (id: string, opts?: RequestOptions) =>
    apiClient.get<Project>(`/projects/${id}`, opts),

  create: (data: CreateProjectRequest, opts?: RequestOptions) =>
    apiClient.post<Project>("/projects", data, opts),

  update: (
    id: string,
    data: Partial<CreateProjectRequest>,
    opts?: RequestOptions
  ) => apiClient.patch<Project>(`/projects/${id}`, data, opts),

  delete: (id: string, opts?: RequestOptions) =>
    apiClient.delete<{ message: string }>(`/projects/${id}`, opts),
};

// ─── Files Service ────────────────────────────────────────────────────────────

export const filesApi = {
  list: (projectId?: string, opts?: RequestOptions) => {
    const query = projectId ? `?projectId=${projectId}` : "";
    return apiClient.get<UploadedFile[]>(`/files${query}`, opts);
  },

  get: (id: string, opts?: RequestOptions) =>
    apiClient.get<UploadedFile>(`/files/${id}`, opts),

  upload: (
    file: File,
    projectId?: string,
    opts?: RequestOptions & { onProgress?: (percent: number) => void }
  ) => {
    const formData = new FormData();
    formData.append("file", file);
    if (projectId) formData.append("projectId", projectId);
    return apiClient.upload<UploadedFile>("/files/upload", formData, opts ?? {});
  },

  getDownloadUrl: (id: string, opts?: RequestOptions) =>
    apiClient.get<{ url: string }>(`/files/${id}/url`, opts),

  delete: (id: string, opts?: RequestOptions) =>
    apiClient.delete<{ message: string }>(`/files/${id}`, opts),
};

// ─── Memory Service ───────────────────────────────────────────────────────────

export const memoryApi = {
  list: (opts?: RequestOptions) =>
    apiClient.get<PaginatedResponse<Memory>>("/memory", opts),

  create: (content: string, metadata?: Record<string, unknown>, opts?: RequestOptions) =>
    apiClient.post<Memory>("/memory", { content, metadata }, opts),

  update: (id: string, content: string, opts?: RequestOptions) =>
    apiClient.patch<Memory>(`/memory/${id}`, { content }, opts),

  delete: (id: string, opts?: RequestOptions) =>
    apiClient.delete<{ message: string }>(`/memory/${id}`, opts),

  search: (query: string, opts?: RequestOptions) =>
    apiClient.post<Memory[]>("/memory/search", { query }, opts),
};

// ─── Notifications Service ────────────────────────────────────────────────────

export const notificationsApi = {
  list: (opts?: RequestOptions) =>
    apiClient.get<Notification[]>("/notifications", opts),

  markRead: (id: string, opts?: RequestOptions) =>
    apiClient.patch<Notification>(`/notifications/${id}/read`, {}, opts),

  markAllRead: (opts?: RequestOptions) =>
    apiClient.post<{ updated: number }>("/notifications/read-all", {}, opts),

  delete: (id: string, opts?: RequestOptions) =>
    apiClient.delete<{ message: string }>(`/notifications/${id}`, opts),
};

// ─── Settings Service ─────────────────────────────────────────────────────────

export const settingsApi = {
  get: (opts?: RequestOptions) =>
    apiClient.get<UserSettings>("/users/settings", opts),

  update: (data: Partial<UserSettings>, opts?: RequestOptions) =>
    apiClient.patch<UserSettings>("/users/settings", data, opts),
};

// ─── API Keys Service ─────────────────────────────────────────────────────────

export const apiKeysApi = {
  list: (opts?: RequestOptions) =>
    apiClient.get<ApiKey[]>("/users/api-keys", opts),

  create: (
    data: { name: string; scopes: string[]; expiresAt?: string },
    opts?: RequestOptions
  ) => apiClient.post<ApiKey & { key: string }>("/users/api-keys", data, opts),

  delete: (id: string, opts?: RequestOptions) =>
    apiClient.delete<{ message: string }>(`/users/api-keys/${id}`, opts),
};

// ─── Agents Service ───────────────────────────────────────────────────────────

export const agentsApi = {
  list: (opts?: RequestOptions) =>
    apiClient.get<Agent[]>("/agents", opts),

  get: (id: string, opts?: RequestOptions) =>
    apiClient.get<Agent>(`/agents/${id}`, opts),

  execute: (
    id: string,
    data: { input: string; projectId?: string },
    opts?: RequestOptions
  ) => apiClient.post<{ taskId: string; result?: unknown }>(`/agents/${id}/execute`, data, opts),
};

// ─── Health Service ───────────────────────────────────────────────────────────

export const healthApi = {
  check: (opts?: RequestOptions) =>
    apiClient.get<{ status: string; version: string }>("/health", {
      ...opts,
      skipAuth: true,
      retries: 1,
    }),
};
