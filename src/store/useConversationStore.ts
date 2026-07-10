/**
 * Conversation Store — Omni One Frontend
 *
 * Server-backed conversation management.
 * All data lives in the backend; this store is a synchronized cache.
 * sessionStorage is used only for the active conversation ID (UX continuity).
 */

import { create } from "zustand";
import {
  conversationsApi,
  type Conversation,
  type Message,
  type CreateConversationRequest,
  type UpdateConversationRequest,
  ApiError,
} from "../lib/api";

// ── Legacy types for Sidebar compatibility ─────────────────────────────────
export interface ConversationFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

export type ConversationFilter =
  | "all"
  | "pinned"
  | "favorites"
  | "archived"
  | "deleted"
  | "today"
  | "week";

export interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isLoading: boolean;
  isLoadingMessages: boolean;
  isSyncing: boolean;
  error: string | null;
  searchQuery: string;
  activeFilter: ConversationFilter;

  loadConversations: () => Promise<void>;
  createConversation: (title?: string, opts?: CreateConversationRequest) => Promise<Conversation>;
  setActiveConversation: (id: string | null) => Promise<void>;
  updateConversation: (id: string, data: UpdateConversationRequest) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  pinConversation: (id: string, pinned: boolean) => Promise<void>;
  favoriteConversation: (id: string, fav: boolean) => Promise<void>;
  archiveConversation: (id: string, archived: boolean) => Promise<void>;
  softDeleteConversation: (id: string) => Promise<void>;
  restoreConversation: (id: string) => Promise<void>;

  loadMessages: (conversationId: string) => Promise<void>;
  addMessage: (conversationId: string, role: string, content: string, model?: string) => Promise<Message>;
  updateMessage: (conversationId: string, messageId: string, content: string) => Promise<void>;
  deleteMessage: (conversationId: string, messageId: string) => Promise<void>;

  setSearchQuery: (q: string) => void;
  setActiveFilter: (f: ConversationFilter) => void;
  clearError: () => void;
  getActiveConversation: () => Conversation | null;
  getFilteredConversations: () => Conversation[];
  // ── Legacy Compatibility Stubs (Sidebar) ────────────────────────────────────
  folders: ConversationFolder[];
  tags: ConversationTag[];
  activeFolderId: string | null;
  activeTagId: string | null;
  setActiveFolderId: (id: string | null) => void;
  setActiveTagId: (id: string | null) => void;
  createFolder: (name: string) => void;
  deleteFolder: (id: string) => void;
  createTag: (name: string) => void;
  deleteTag: (id: string) => void;
  moveToFolder: (convId: string, folderId: string | null) => void;
  addTagToConversation: (convId: string, tagId: string) => void;
  removeTagFromConversation: (convId: string, tagId: string) => void;
  exportConversation: (convId: string, format: string) => void;
  exportAll: (format: string) => void;
  importConversations: (data: unknown) => { imported: number; skipped: number; errors?: string[] };
  emptyRecycleBin: () => Promise<void>;
  permanentlyDeleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => void;
}

const ACTIVE_CONV_KEY = "omni_active_conv";
const saveActiveConvId = (id: string | null) =>
  id ? sessionStorage.setItem(ACTIVE_CONV_KEY, id) : sessionStorage.removeItem(ACTIVE_CONV_KEY);
const loadActiveConvId = (): string | null => sessionStorage.getItem(ACTIVE_CONV_KEY);

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: loadActiveConvId(),
  messages: [],
  isLoading: false,
  isLoadingMessages: false,
  isSyncing: false,
  error: null,
  searchQuery: "",
  activeFilter: "all",

  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      const conversations = await conversationsApi.list();
      set({ conversations, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err instanceof ApiError ? err.message : "Failed to load conversations" });
    }
  },

  createConversation: async (title = "New Conversation", opts = {}) => {
    set({ isSyncing: true });
    try {
      const conv = await conversationsApi.create({ title, ...opts });
      set((s) => ({ conversations: [conv, ...s.conversations], isSyncing: false }));
      return conv;
    } catch (err) {
      set({ isSyncing: false, error: err instanceof ApiError ? err.message : "Failed to create conversation" });
      throw err;
    }
  },

  setActiveConversation: async (id: string | null) => {
    set({ activeConversationId: id, messages: [] });
    saveActiveConvId(id);
    if (id) await get().loadMessages(id);
  },

  updateConversation: async (id: string, data: UpdateConversationRequest) => {
    set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? { ...c, ...data } : c) }));
    try {
      const updated = await conversationsApi.update(id, data);
      set((s) => ({ conversations: s.conversations.map((c) => c.id === id ? updated : c) }));
    } catch (err) {
      await get().loadConversations();
      throw err;
    }
  },

  deleteConversation: async (id: string) => {
    set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }));
    try {
      await conversationsApi.delete(id);
      if (get().activeConversationId === id) {
        set({ activeConversationId: null, messages: [] });
        saveActiveConvId(null);
      }
    } catch (err) {
      await get().loadConversations();
      throw err;
    }
  },

  renameConversation: (id, title) => get().updateConversation(id, { title }),
  pinConversation: (id, isPinned) => get().updateConversation(id, { isPinned }),
  favoriteConversation: (id, isFavorite) => get().updateConversation(id, { isFavorite }),
  archiveConversation: (id, isArchived) => get().updateConversation(id, { isArchived }),
  softDeleteConversation: (id) => get().updateConversation(id, { isDeleted: true }),
  restoreConversation: (id) => get().updateConversation(id, { isDeleted: false }),

  loadMessages: async (conversationId: string) => {
    set({ isLoadingMessages: true });
    try {
      const messages = await conversationsApi.getMessages(conversationId);
      set({ messages, isLoadingMessages: false });
    } catch (err) {
      set({ isLoadingMessages: false, error: err instanceof ApiError ? err.message : "Failed to load messages" });
    }
  },

  addMessage: async (conversationId, role, content, model) => {
    const message = await conversationsApi.addMessage(conversationId, { role, content, model });
    set((s) => ({
      messages: [...s.messages, message],
      conversations: s.conversations.map((c) =>
        c.id === conversationId ? { ...c, updatedAt: message.createdAt } : c
      ),
    }));
    return message;
  },

  updateMessage: async (conversationId, messageId, content) => {
    set((s) => ({ messages: s.messages.map((m) => m.id === messageId ? { ...m, content } : m) }));
    try {
      await conversationsApi.updateMessage(conversationId, messageId, { content });
    } catch (err) {
      await get().loadMessages(conversationId);
      throw err;
    }
  },

  deleteMessage: async (conversationId, messageId) => {
    set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
    try {
      await conversationsApi.deleteMessage(conversationId, messageId);
    } catch (err) {
      await get().loadMessages(conversationId);
      throw err;
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
  setActiveFilter: (f) => set({ activeFilter: f }),
  clearError: () => set({ error: null }),

  getActiveConversation: () => {
    const { conversations, activeConversationId } = get();
    if (!activeConversationId) return null;
    return conversations.find((c) => c.id === activeConversationId) ?? null;
  },

  // ── Legacy Compatibility Stubs ───────────────────────────────────────────────
  folders: [],
  tags: [],
  activeFolderId: null,
  activeTagId: null,
  setActiveFolderId: (id) => set({ activeFolderId: id }),
  setActiveTagId: (id) => set({ activeTagId: id }),
  createFolder: (_name) => { /* Phase 17: server-side folders */ },
  deleteFolder: (_id) => { /* Phase 17 */ },
  createTag: (_name) => { /* Phase 17 */ },
  deleteTag: (_id) => { /* Phase 17 */ },
  moveToFolder: (_convId, _folderId) => { /* Phase 17 */ },
  addTagToConversation: (_convId, _tagId) => { /* Phase 17 */ },
  removeTagFromConversation: (_convId, _tagId) => { /* Phase 17 */ },
  exportConversation: (convId, _format) => {
    const conv = get().conversations.find((c) => c.id === convId);
    if (!conv) return;
    const blob = new Blob([JSON.stringify(conv, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${conv.title}.json`; a.click();
    URL.revokeObjectURL(url);
  },
  exportAll: (_format) => {
    const { conversations } = get();
    const blob = new Blob([JSON.stringify(conversations, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "conversations.json"; a.click();
    URL.revokeObjectURL(url);
  },
  importConversations: (_data) => ({ imported: 0, skipped: 0, errors: [] }),
  emptyRecycleBin: async () => {
    const deleted = get().conversations.filter((c) => c.isDeleted);
    for (const c of deleted) {
      await get().deleteConversation(c.id);
    }
  },
  permanentlyDeleteConversation: async (id) => {
    await get().deleteConversation(id);
  },
  updateConversationTitle: (id, title) => { void get().renameConversation(id, title); },
  getFilteredConversations: () => {
    const { conversations, searchQuery, activeFilter } = get();
    let result = conversations;
    if (activeFilter !== "deleted") result = result.filter((c) => !c.isDeleted);
    switch (activeFilter) {
      case "pinned": result = result.filter((c) => c.isPinned); break;
      case "favorites": result = result.filter((c) => c.isFavorite); break;
      case "archived": result = result.filter((c) => c.isArchived); break;
      case "deleted": result = result.filter((c) => c.isDeleted); break;
      case "today": {
        const t = new Date(); t.setHours(0, 0, 0, 0);
        result = result.filter((c) => !c.isArchived && new Date(c.updatedAt) >= t);
        break;
      }
      case "week": {
        const w = new Date(Date.now() - 7 * 86400000);
        result = result.filter((c) => !c.isArchived && new Date(c.updatedAt) >= w);
        break;
      }
      default: result = result.filter((c) => !c.isArchived);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(q));
    }
    return [...result].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  },
}));

export default useConversationStore;
