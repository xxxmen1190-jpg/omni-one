/**
 * Conversation Library Store
 * Full conversation management with localStorage persistence via zustand/middleware persist.
 * Supports: Folders, Tags, Favorites, Pin, Archive, Recycle Bin, Import/Export, Search, Filter.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  Conversation,
  ConversationFolder,
  ConversationTag,
  ConversationLibraryState,
  ConversationFilter,
} from "../types/conversation";
import { Message } from "../types";

// ─── Default tag colors ───────────────────────────────────────────────────────
const TAG_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16", "#ec4899", "#6366f1",
];

// ─── Default folder colors ────────────────────────────────────────────────────
const FOLDER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#f97316", "#84cc16",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function generateTitle(messages: Message[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return "New Conversation";
  const text = firstUserMsg.content.replace(/📎 \*[^*]+\*/g, "").trim();
  return text.length > 60 ? text.slice(0, 57) + "..." : text || "New Conversation";
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function conversationToMarkdown(conv: Conversation): string {
  const lines: string[] = [
    `# ${conv.title}`,
    ``,
    `**Created:** ${new Date(conv.createdAt).toLocaleString()}`,
    `**Updated:** ${new Date(conv.updatedAt).toLocaleString()}`,
    `**Messages:** ${conv.messageCount}`,
    ``,
    `---`,
    ``,
  ];
  for (const msg of conv.messages) {
    const role = msg.role === "user" ? "**You**" : "**Omni One**";
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    lines.push(`### ${role} — ${time}`);
    lines.push(``);
    lines.push(msg.content);
    lines.push(``);
    lines.push(`---`);
    lines.push(``);
  }
  return lines.join("\n");
}

function conversationToText(conv: Conversation): string {
  const lines: string[] = [
    `Conversation: ${conv.title}`,
    `Created: ${new Date(conv.createdAt).toLocaleString()}`,
    ``,
    `${"=".repeat(60)}`,
    ``,
  ];
  for (const msg of conv.messages) {
    const role = msg.role === "user" ? "You" : "Omni One";
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    lines.push(`[${time}] ${role}:`);
    lines.push(msg.content);
    lines.push(``);
  }
  return lines.join("\n");
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const useConversationStore = create<ConversationLibraryState>()(
  persist(
    (set, get) => ({
      conversations: [],
      folders: [],
      tags: [],
      activeConversationId: null,
      searchQuery: "",
      activeFilter: "all" as ConversationFilter,
      activeFolderId: null,
      activeTagId: null,

      // ─── Conversation CRUD ─────────────────────────────────────────────────
      createConversation: (title?: string, folderId?: string | null) => {
        const id = generateId();
        const now = Date.now();
        const conv: Conversation = {
          id,
          title: title ?? "New Conversation",
          messages: [],
          createdAt: now,
          updatedAt: now,
          folderId: folderId ?? null,
          tags: [],
          isPinned: false,
          isFavorite: false,
          isArchived: false,
          isDeleted: false,
          messageCount: 0,
        };
        set((state) => ({
          conversations: [conv, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      deleteConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isDeleted: true, deletedAt: Date.now() } : c
          ),
          activeConversationId:
            state.activeConversationId === id ? null : state.activeConversationId,
        }));
      },

      restoreConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isDeleted: false, deletedAt: undefined } : c
          ),
        }));
      },

      permanentlyDeleteConversation: (id) => {
        set((state) => ({
          conversations: state.conversations.filter((c) => c.id !== id),
          activeConversationId:
            state.activeConversationId === id ? null : state.activeConversationId,
        }));
      },

      emptyRecycleBin: () => {
        set((state) => ({
          conversations: state.conversations.filter((c) => !c.isDeleted),
        }));
      },

      updateConversationTitle: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: Date.now() } : c
          ),
        }));
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id });
      },

      // ─── Message management ────────────────────────────────────────────────
      addMessageToConversation: (conversationId, message) => {
        const msgId = generateId();
        const newMessage: Message = {
          ...message,
          id: msgId,
          timestamp: Date.now(),
        };
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const updatedMessages = [...c.messages, newMessage];
            const updatedTitle =
              c.messages.length === 0 && message.role === "user"
                ? generateTitle([newMessage])
                : c.title;
            return {
              ...c,
              messages: updatedMessages,
              messageCount: updatedMessages.length,
              title: updatedTitle,
              updatedAt: Date.now(),
            };
          }),
        }));
        return msgId;
      },

      updateLastMessageInConversation: (conversationId, content, metadata) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            const msgs = [...c.messages];
            if (msgs.length === 0) return c;
            const lastIdx = msgs.length - 1;
            msgs[lastIdx] = {
              ...msgs[lastIdx],
              content,
              ...(metadata ?? {}),
            };
            return { ...c, messages: msgs, updatedAt: Date.now() };
          }),
        }));
      },

      clearConversationMessages: (conversationId) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [], messageCount: 0, updatedAt: Date.now() }
              : c
          ),
        }));
      },

      // ─── Organization ──────────────────────────────────────────────────────
      pinConversation: (id, pinned) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isPinned: pinned, updatedAt: Date.now() } : c
          ),
        }));
      },

      favoriteConversation: (id, favorited) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isFavorite: favorited, updatedAt: Date.now() } : c
          ),
        }));
      },

      archiveConversation: (id, archived) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, isArchived: archived, updatedAt: Date.now() } : c
          ),
          activeConversationId:
            archived && state.activeConversationId === id
              ? null
              : state.activeConversationId,
        }));
      },

      moveToFolder: (conversationId, folderId) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, folderId, updatedAt: Date.now() }
              : c
          ),
        }));
      },

      addTagToConversation: (conversationId, tagId) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId && !c.tags.includes(tagId)
              ? { ...c, tags: [...c.tags, tagId], updatedAt: Date.now() }
              : c
          ),
        }));
      },

      removeTagFromConversation: (conversationId, tagId) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, tags: c.tags.filter((t) => t !== tagId), updatedAt: Date.now() }
              : c
          ),
        }));
      },

      // ─── Folder CRUD ───────────────────────────────────────────────────────
      createFolder: (name, color?, icon?) => {
        const id = generateId();
        const folder: ConversationFolder = {
          id,
          name,
          color: color ?? FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)],
          icon: icon ?? "📁",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({ folders: [...state.folders, folder] }));
        return id;
      },

      deleteFolder: (id) => {
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
          conversations: state.conversations.map((c) =>
            c.folderId === id ? { ...c, folderId: null } : c
          ),
        }));
      },

      updateFolder: (id, updates) => {
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, ...updates, updatedAt: Date.now() } : f
          ),
        }));
      },

      // ─── Tag CRUD ──────────────────────────────────────────────────────────
      createTag: (name, color?) => {
        const id = generateId();
        const tag: ConversationTag = {
          id,
          name,
          color: color ?? TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
        };
        set((state) => ({ tags: [...state.tags, tag] }));
        return id;
      },

      deleteTag: (id) => {
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
          conversations: state.conversations.map((c) => ({
            ...c,
            tags: c.tags.filter((t) => t !== id),
          })),
        }));
      },

      updateTag: (id, updates) => {
        set((state) => ({
          tags: state.tags.map((t) => (t.id === id ? { ...t, ...updates } : t)),
        }));
      },

      // ─── Search & Filter ───────────────────────────────────────────────────
      setSearchQuery: (query) => set({ searchQuery: query }),
      setActiveFilter: (filter) => set({ activeFilter: filter }),
      setActiveFolderId: (folderId) =>
        set({ activeFolderId: folderId, activeFilter: folderId ? "folder" : "all" }),
      setActiveTagId: (tagId) =>
        set({ activeTagId: tagId, activeFilter: tagId ? "tag" : "all" }),

      // ─── Import / Export ───────────────────────────────────────────────────
      exportConversation: (id, format) => {
        const conv = get().conversations.find((c) => c.id === id);
        if (!conv) return;
        const safeName = conv.title.replace(/[^a-z0-9]/gi, "_").toLowerCase().slice(0, 50);
        if (format === "json") {
          downloadFile(JSON.stringify(conv, null, 2), `${safeName}.json`, "application/json");
        } else if (format === "md") {
          downloadFile(conversationToMarkdown(conv), `${safeName}.md`, "text/markdown");
        } else {
          downloadFile(conversationToText(conv), `${safeName}.txt`, "text/plain");
        }
      },

      exportAll: (format) => {
        const { conversations, folders, tags } = get();
        const data = { conversations, folders, tags, exportedAt: Date.now(), version: "1.0" };
        downloadFile(JSON.stringify(data, null, 2), `omni-one-export-${Date.now()}.json`, "application/json");
      },

      importConversations: (data) => {
        const errors: string[] = [];
        let imported = 0;
        try {
          const parsed = JSON.parse(data);
          const convs: Conversation[] = Array.isArray(parsed)
            ? parsed
            : parsed.conversations ?? [];
          const newConvs: Conversation[] = [];
          for (const c of convs) {
            if (!c.id || !c.title || !Array.isArray(c.messages)) {
              errors.push(`Invalid conversation: missing id, title, or messages`);
              continue;
            }
            // Assign new ID to avoid conflicts
            newConvs.push({
              ...c,
              id: generateId(),
              isDeleted: false,
              isArchived: false,
            });
            imported++;
          }
          // Import folders and tags if present
          const newFolders: ConversationFolder[] = parsed.folders ?? [];
          const newTags: ConversationTag[] = parsed.tags ?? [];
          set((state) => ({
            conversations: [...newConvs, ...state.conversations],
            folders: [
              ...newFolders.filter((f) => !state.folders.find((sf) => sf.id === f.id)),
              ...state.folders,
            ],
            tags: [
              ...newTags.filter((t) => !state.tags.find((st) => st.id === t.id)),
              ...state.tags,
            ],
          }));
        } catch (e) {
          errors.push(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
        }
        return { imported, errors };
      },

      // ─── Computed getters ──────────────────────────────────────────────────
      getFilteredConversations: () => {
        const { conversations, searchQuery, activeFilter, activeFolderId, activeTagId } = get();
        let result = conversations;

        // Always exclude deleted unless viewing recycle bin
        if (activeFilter !== "deleted") {
          result = result.filter((c) => !c.isDeleted);
        }

        // Apply filter
        switch (activeFilter) {
          case "pinned":
            result = result.filter((c) => c.isPinned);
            break;
          case "favorites":
            result = result.filter((c) => c.isFavorite);
            break;
          case "archived":
            result = result.filter((c) => c.isArchived);
            break;
          case "deleted":
            result = result.filter((c) => c.isDeleted);
            break;
          case "today": {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            result = result.filter(
              (c) => !c.isArchived && c.updatedAt >= todayStart.getTime()
            );
            break;
          }
          case "week": {
            const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
            result = result.filter((c) => !c.isArchived && c.updatedAt >= weekStart);
            break;
          }
          case "folder":
            result = result.filter(
              (c) => !c.isArchived && c.folderId === activeFolderId
            );
            break;
          case "tag":
            result = result.filter(
              (c) => !c.isArchived && activeTagId && c.tags.includes(activeTagId)
            );
            break;
          default:
            result = result.filter((c) => !c.isArchived);
        }

        // Apply search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          result = result.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.messages.some((m) => m.content.toLowerCase().includes(q))
          );
        }

        // Sort: pinned first, then by updatedAt desc
        result = [...result].sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return b.updatedAt - a.updatedAt;
        });

        return result;
      },

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get();
        if (!activeConversationId) return null;
        return conversations.find((c) => c.id === activeConversationId) ?? null;
      },

      getConversationById: (id) => {
        return get().conversations.find((c) => c.id === id);
      },
    }),
    {
      name: "omni-one-conversation-library",
      version: 1,
    }
  )
);

export default useConversationStore;
