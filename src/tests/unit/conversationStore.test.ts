/**
 * Unit Tests — Conversation Library Store
 * Tests all CRUD operations, filtering, search, import/export
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act } from "@testing-library/react";

// We need to reset the store between tests
// Import the store factory function approach
let useConversationStore: typeof import("../../store/useConversationStore").default;

beforeEach(async () => {
  // Clear localStorage before each test
  localStorage.clear();
  // Re-import the store to get a fresh instance
  vi.resetModules();
  const mod = await import("../../store/useConversationStore");
  useConversationStore = mod.default;
  // Reset store state
  act(() => {
    useConversationStore.setState({
      conversations: [],
      folders: [],
      tags: [],
      activeConversationId: null,
      searchQuery: "",
      activeFilter: "all",
      activeFolderId: null,
      activeTagId: null,
    });
  });
});

// ─── Conversation CRUD ────────────────────────────────────────────────────────
describe("Conversation CRUD", () => {
  it("creates a conversation with default title", () => {
    const { createConversation, conversations } = useConversationStore.getState();
    const id = createConversation();
    const state = useConversationStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].id).toBe(id);
    expect(state.conversations[0].title).toBe("New Conversation");
    expect(state.activeConversationId).toBe(id);
  });

  it("creates a conversation with custom title", () => {
    const { createConversation } = useConversationStore.getState();
    createConversation("My Chat", null);
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].title).toBe("My Chat");
  });

  it("soft-deletes a conversation (moves to recycle bin)", () => {
    const { createConversation, deleteConversation } = useConversationStore.getState();
    const id = createConversation("To Delete");
    deleteConversation(id);
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].isDeleted).toBe(true);
    expect(conversations[0].deletedAt).toBeDefined();
  });

  it("restores a deleted conversation", () => {
    const { createConversation, deleteConversation, restoreConversation } = useConversationStore.getState();
    const id = createConversation("To Restore");
    deleteConversation(id);
    restoreConversation(id);
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].isDeleted).toBe(false);
    expect(conversations[0].deletedAt).toBeUndefined();
  });

  it("permanently deletes a conversation", () => {
    const { createConversation, permanentlyDeleteConversation } = useConversationStore.getState();
    const id = createConversation("Permanent Delete");
    permanentlyDeleteConversation(id);
    const { conversations } = useConversationStore.getState();
    expect(conversations).toHaveLength(0);
  });

  it("empties the recycle bin", () => {
    const { createConversation, deleteConversation, emptyRecycleBin } = useConversationStore.getState();
    const id1 = createConversation("Del 1");
    const id2 = createConversation("Del 2");
    deleteConversation(id1);
    deleteConversation(id2);
    emptyRecycleBin();
    const { conversations } = useConversationStore.getState();
    expect(conversations).toHaveLength(0);
  });

  it("updates conversation title", () => {
    const { createConversation, updateConversationTitle } = useConversationStore.getState();
    const id = createConversation("Old Title");
    updateConversationTitle(id, "New Title");
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].title).toBe("New Title");
  });

  it("sets active conversation", () => {
    const { createConversation, setActiveConversation } = useConversationStore.getState();
    const id1 = createConversation("Conv 1");
    const id2 = createConversation("Conv 2");
    setActiveConversation(id1);
    expect(useConversationStore.getState().activeConversationId).toBe(id1);
    setActiveConversation(id2);
    expect(useConversationStore.getState().activeConversationId).toBe(id2);
  });
});

// ─── Message Management ───────────────────────────────────────────────────────
describe("Message Management", () => {
  it("adds a message to a conversation", () => {
    const { createConversation, addMessageToConversation } = useConversationStore.getState();
    const convId = createConversation("Test Conv");
    addMessageToConversation(convId, { role: "user", content: "Hello!" });
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].messages).toHaveLength(1);
    expect(conversations[0].messages[0].content).toBe("Hello!");
    expect(conversations[0].messageCount).toBe(1);
  });

  it("auto-generates title from first user message", () => {
    const { createConversation, addMessageToConversation } = useConversationStore.getState();
    const convId = createConversation();
    addMessageToConversation(convId, { role: "user", content: "What is the meaning of life?" });
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].title).toBe("What is the meaning of life?");
  });

  it("truncates long titles to 60 chars", () => {
    const { createConversation, addMessageToConversation } = useConversationStore.getState();
    const convId = createConversation();
    const longMsg = "A".repeat(80);
    addMessageToConversation(convId, { role: "user", content: longMsg });
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].title.length).toBeLessThanOrEqual(60);
    expect(conversations[0].title.endsWith("...")).toBe(true);
  });

  it("updates last message content", () => {
    const { createConversation, addMessageToConversation, updateLastMessageInConversation } = useConversationStore.getState();
    const convId = createConversation("Test");
    addMessageToConversation(convId, { role: "assistant", content: "Partial..." });
    updateLastMessageInConversation(convId, "Full response!");
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].messages[0].content).toBe("Full response!");
  });

  it("clears conversation messages", () => {
    const { createConversation, addMessageToConversation, clearConversationMessages } = useConversationStore.getState();
    const convId = createConversation("Test");
    addMessageToConversation(convId, { role: "user", content: "Hi" });
    addMessageToConversation(convId, { role: "assistant", content: "Hello" });
    clearConversationMessages(convId);
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].messages).toHaveLength(0);
    expect(conversations[0].messageCount).toBe(0);
  });
});

// ─── Organization ─────────────────────────────────────────────────────────────
describe("Organization — Pin, Favorite, Archive", () => {
  it("pins and unpins a conversation", () => {
    const { createConversation, pinConversation } = useConversationStore.getState();
    const id = createConversation("Pinned");
    pinConversation(id, true);
    expect(useConversationStore.getState().conversations[0].isPinned).toBe(true);
    pinConversation(id, false);
    expect(useConversationStore.getState().conversations[0].isPinned).toBe(false);
  });

  it("favorites and unfavorites a conversation", () => {
    const { createConversation, favoriteConversation } = useConversationStore.getState();
    const id = createConversation("Fav");
    favoriteConversation(id, true);
    expect(useConversationStore.getState().conversations[0].isFavorite).toBe(true);
    favoriteConversation(id, false);
    expect(useConversationStore.getState().conversations[0].isFavorite).toBe(false);
  });

  it("archives and unarchives a conversation", () => {
    const { createConversation, archiveConversation } = useConversationStore.getState();
    const id = createConversation("Arch");
    archiveConversation(id, true);
    expect(useConversationStore.getState().conversations[0].isArchived).toBe(true);
    archiveConversation(id, false);
    expect(useConversationStore.getState().conversations[0].isArchived).toBe(false);
  });

  it("moves conversation to folder", () => {
    const { createConversation, createFolder, moveToFolder } = useConversationStore.getState();
    const convId = createConversation("Conv");
    const folderId = createFolder("Work");
    moveToFolder(convId, folderId);
    expect(useConversationStore.getState().conversations[0].folderId).toBe(folderId);
  });

  it("adds and removes tags from conversation", () => {
    const { createConversation, createTag, addTagToConversation, removeTagFromConversation } = useConversationStore.getState();
    const convId = createConversation("Tagged");
    const tagId = createTag("important");
    addTagToConversation(convId, tagId);
    expect(useConversationStore.getState().conversations[0].tags).toContain(tagId);
    removeTagFromConversation(convId, tagId);
    expect(useConversationStore.getState().conversations[0].tags).not.toContain(tagId);
  });
});

// ─── Folder CRUD ──────────────────────────────────────────────────────────────
describe("Folder CRUD", () => {
  it("creates a folder", () => {
    const { createFolder } = useConversationStore.getState();
    const id = createFolder("Work", "#3b82f6", "💼");
    const { folders } = useConversationStore.getState();
    expect(folders).toHaveLength(1);
    expect(folders[0].id).toBe(id);
    expect(folders[0].name).toBe("Work");
    expect(folders[0].color).toBe("#3b82f6");
    expect(folders[0].icon).toBe("💼");
  });

  it("deletes a folder and unassigns conversations", () => {
    const { createFolder, createConversation, moveToFolder, deleteFolder } = useConversationStore.getState();
    const folderId = createFolder("To Delete");
    const convId = createConversation("Conv in folder");
    moveToFolder(convId, folderId);
    deleteFolder(folderId);
    const state = useConversationStore.getState();
    expect(state.folders).toHaveLength(0);
    expect(state.conversations[0].folderId).toBeNull();
  });

  it("updates a folder", () => {
    const { createFolder, updateFolder } = useConversationStore.getState();
    const id = createFolder("Old Name");
    updateFolder(id, { name: "New Name", color: "#ef4444" });
    const { folders } = useConversationStore.getState();
    expect(folders[0].name).toBe("New Name");
    expect(folders[0].color).toBe("#ef4444");
  });
});

// ─── Tag CRUD ─────────────────────────────────────────────────────────────────
describe("Tag CRUD", () => {
  it("creates a tag", () => {
    const { createTag } = useConversationStore.getState();
    const id = createTag("urgent", "#ef4444");
    const { tags } = useConversationStore.getState();
    expect(tags).toHaveLength(1);
    expect(tags[0].id).toBe(id);
    expect(tags[0].name).toBe("urgent");
    expect(tags[0].color).toBe("#ef4444");
  });

  it("deletes a tag and removes from conversations", () => {
    const { createTag, createConversation, addTagToConversation, deleteTag } = useConversationStore.getState();
    const tagId = createTag("to-delete");
    const convId = createConversation("Tagged Conv");
    addTagToConversation(convId, tagId);
    deleteTag(tagId);
    const state = useConversationStore.getState();
    expect(state.tags).toHaveLength(0);
    expect(state.conversations[0].tags).not.toContain(tagId);
  });

  it("updates a tag", () => {
    const { createTag, updateTag } = useConversationStore.getState();
    const id = createTag("old-name");
    updateTag(id, { name: "new-name", color: "#10b981" });
    const { tags } = useConversationStore.getState();
    expect(tags[0].name).toBe("new-name");
    expect(tags[0].color).toBe("#10b981");
  });
});

// ─── Search & Filter ──────────────────────────────────────────────────────────
describe("Search & Filter", () => {
  it("filters by search query on title", () => {
    const { createConversation, setSearchQuery, getFilteredConversations } = useConversationStore.getState();
    createConversation("React hooks tutorial");
    createConversation("Python basics");
    setSearchQuery("react");
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("React hooks tutorial");
  });

  it("filters by search query on message content", () => {
    const { createConversation, addMessageToConversation, setSearchQuery } = useConversationStore.getState();
    const id1 = createConversation("Conv 1");
    const id2 = createConversation("Conv 2");
    addMessageToConversation(id1, { role: "user", content: "Tell me about quantum computing" });
    addMessageToConversation(id2, { role: "user", content: "What is machine learning?" });
    setSearchQuery("quantum");
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(id1);
  });

  it("filters pinned conversations", () => {
    const { createConversation, pinConversation, setActiveFilter, getFilteredConversations } = useConversationStore.getState();
    const id1 = createConversation("Pinned Conv");
    createConversation("Normal Conv");
    pinConversation(id1, true);
    setActiveFilter("pinned");
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(id1);
  });

  it("filters favorite conversations", () => {
    const { createConversation, favoriteConversation, setActiveFilter, getFilteredConversations } = useConversationStore.getState();
    const id1 = createConversation("Fav Conv");
    createConversation("Normal Conv");
    favoriteConversation(id1, true);
    setActiveFilter("favorites");
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(id1);
  });

  it("filters archived conversations", () => {
    const { createConversation, archiveConversation, setActiveFilter } = useConversationStore.getState();
    const id1 = createConversation("Archived");
    createConversation("Normal");
    archiveConversation(id1, true);
    setActiveFilter("archived");
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(id1);
  });

  it("filters deleted conversations (recycle bin)", () => {
    const { createConversation, deleteConversation, setActiveFilter } = useConversationStore.getState();
    const id1 = createConversation("Deleted");
    createConversation("Normal");
    deleteConversation(id1);
    setActiveFilter("deleted");
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(id1);
  });

  it("excludes archived from default 'all' filter", () => {
    const { createConversation, archiveConversation, setActiveFilter } = useConversationStore.getState();
    const id1 = createConversation("Archived");
    createConversation("Normal");
    archiveConversation(id1, true);
    setActiveFilter("all");
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Normal");
  });

  it("sorts pinned conversations first", () => {
    const { createConversation, pinConversation, setActiveFilter } = useConversationStore.getState();
    createConversation("Normal");
    const id2 = createConversation("Pinned");
    pinConversation(id2, true);
    setActiveFilter("all");
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results[0].id).toBe(id2);
  });

  it("filters by folder", () => {
    const { createConversation, createFolder, moveToFolder, setActiveFolderId } = useConversationStore.getState();
    const folderId = createFolder("Work");
    const id1 = createConversation("Work Conv");
    createConversation("Personal Conv");
    moveToFolder(id1, folderId);
    setActiveFolderId(folderId);
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(id1);
  });

  it("filters by tag", () => {
    const { createConversation, createTag, addTagToConversation, setActiveTagId } = useConversationStore.getState();
    const tagId = createTag("important");
    const id1 = createConversation("Important Conv");
    createConversation("Normal Conv");
    addTagToConversation(id1, tagId);
    setActiveTagId(tagId);
    const results = useConversationStore.getState().getFilteredConversations();
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(id1);
  });
});

// ─── Import / Export ──────────────────────────────────────────────────────────
describe("Import / Export", () => {
  it("imports conversations from JSON", () => {
    const { importConversations } = useConversationStore.getState();
    const data = JSON.stringify({
      conversations: [
        {
          id: "import-1",
          title: "Imported Conv",
          messages: [{ id: "m1", role: "user", content: "Hello", timestamp: Date.now() }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          folderId: null,
          tags: [],
          isPinned: false,
          isFavorite: false,
          isArchived: false,
          isDeleted: false,
          messageCount: 1,
        },
      ],
    });
    const result = importConversations(data);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
    const { conversations } = useConversationStore.getState();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].title).toBe("Imported Conv");
  });

  it("handles invalid JSON gracefully", () => {
    const { importConversations } = useConversationStore.getState();
    const result = importConversations("not valid json");
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("skips invalid conversations during import", () => {
    const { importConversations } = useConversationStore.getState();
    const data = JSON.stringify({
      conversations: [
        { id: "valid-1", title: "Valid", messages: [], createdAt: Date.now(), updatedAt: Date.now(), folderId: null, tags: [], isPinned: false, isFavorite: false, isArchived: false, isDeleted: false, messageCount: 0 },
        { title: "Missing id" }, // invalid
      ],
    });
    const result = importConversations(data);
    expect(result.imported).toBe(1);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("exports a conversation as JSON (triggers download)", () => {
    const { createConversation, exportConversation } = useConversationStore.getState();
    const id = createConversation("Export Test");
    // Mock document.createElement and appendChild
    const mockAnchor = { href: "", download: "", click: vi.fn() };
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(mockAnchor as unknown as HTMLElement);
    const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => mockAnchor as unknown as Node);
    const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => mockAnchor as unknown as Node);
    exportConversation(id, "json");
    expect(mockAnchor.click).toHaveBeenCalled();
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});

// ─── Getters ──────────────────────────────────────────────────────────────────
describe("Getters", () => {
  it("getActiveConversation returns null when no active", () => {
    const { getActiveConversation } = useConversationStore.getState();
    expect(getActiveConversation()).toBeNull();
  });

  it("getActiveConversation returns the active conversation", () => {
    const { createConversation, getActiveConversation } = useConversationStore.getState();
    const id = createConversation("Active");
    const active = useConversationStore.getState().getActiveConversation();
    expect(active).not.toBeNull();
    expect(active!.id).toBe(id);
  });

  it("getConversationById returns the correct conversation", () => {
    const { createConversation, getConversationById } = useConversationStore.getState();
    const id = createConversation("Find Me");
    const found = useConversationStore.getState().getConversationById(id);
    expect(found).toBeDefined();
    expect(found!.title).toBe("Find Me");
  });

  it("getConversationById returns undefined for unknown id", () => {
    const { getConversationById } = useConversationStore.getState();
    expect(getConversationById("nonexistent")).toBeUndefined();
  });
});
