/**
 * Conversation Library Types
 * Full conversation management: Folders, Tags, Favorites, Pin, Archive, Recycle Bin, Import/Export
 */
import { Message } from "./index";

export interface ConversationTag {
  id: string;
  name: string;
  color: string; // hex color
}

export interface ConversationFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  // Organization
  folderId: string | null;
  tags: string[]; // tag IDs
  // Status flags
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isDeleted: boolean; // soft delete (recycle bin)
  deletedAt?: number;
  // Metadata
  messageCount: number;
  summary?: string;
  model?: string;
}

export interface ConversationLibraryState {
  conversations: Conversation[];
  folders: ConversationFolder[];
  tags: ConversationTag[];
  activeConversationId: string | null;
  searchQuery: string;
  activeFilter: ConversationFilter;
  activeFolderId: string | null;
  activeTagId: string | null;

  // Conversation CRUD
  createConversation: (title?: string, folderId?: string | null) => string;
  deleteConversation: (id: string) => void; // soft delete
  restoreConversation: (id: string) => void;
  permanentlyDeleteConversation: (id: string) => void;
  emptyRecycleBin: () => void;
  updateConversationTitle: (id: string, title: string) => void;
  setActiveConversation: (id: string | null) => void;

  // Message management
  addMessageToConversation: (conversationId: string, message: Omit<Message, "id" | "timestamp">) => string;
  updateLastMessageInConversation: (conversationId: string, content: string, metadata?: Record<string, any>) => void;
  clearConversationMessages: (conversationId: string) => void;

  // Organization
  pinConversation: (id: string, pinned: boolean) => void;
  favoriteConversation: (id: string, favorited: boolean) => void;
  archiveConversation: (id: string, archived: boolean) => void;
  moveToFolder: (conversationId: string, folderId: string | null) => void;
  addTagToConversation: (conversationId: string, tagId: string) => void;
  removeTagFromConversation: (conversationId: string, tagId: string) => void;

  // Folder CRUD
  createFolder: (name: string, color?: string, icon?: string) => string;
  deleteFolder: (id: string) => void;
  updateFolder: (id: string, updates: Partial<Pick<ConversationFolder, "name" | "color" | "icon">>) => void;

  // Tag CRUD
  createTag: (name: string, color?: string) => string;
  deleteTag: (id: string) => void;
  updateTag: (id: string, updates: Partial<Pick<ConversationTag, "name" | "color">>) => void;

  // Search & Filter
  setSearchQuery: (query: string) => void;
  setActiveFilter: (filter: ConversationFilter) => void;
  setActiveFolderId: (folderId: string | null) => void;
  setActiveTagId: (tagId: string | null) => void;

  // Import / Export
  exportConversation: (id: string, format: "json" | "md" | "txt") => void;
  exportAll: (format: "json") => void;
  importConversations: (data: string) => { imported: number; errors: string[] };

  // Computed getters
  getFilteredConversations: () => Conversation[];
  getActiveConversation: () => Conversation | null;
  getConversationById: (id: string) => Conversation | undefined;
}

export type ConversationFilter =
  | "all"
  | "pinned"
  | "favorites"
  | "archived"
  | "deleted"
  | "today"
  | "week"
  | "folder"
  | "tag";
