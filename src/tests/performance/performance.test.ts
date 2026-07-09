/**
 * Performance & Memory Tests
 * Tests for large conversation handling, memory usage, and streaming performance
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";

// ─── Conversation Store Performance ──────────────────────────────────────────
describe("Conversation Store — Performance", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
  });

  it("handles 1000 conversations without significant slowdown", async () => {
    const { default: useConversationStore } = await import("../../store/useConversationStore");
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

    const { createConversation } = useConversationStore.getState();
    const start = performance.now();

    for (let i = 0; i < 1000; i++) {
      createConversation(`Conversation ${i}`);
    }

    const elapsed = performance.now() - start;
    expect(useConversationStore.getState().conversations).toHaveLength(1000);
    // Should complete in under 2 seconds
    expect(elapsed).toBeLessThan(2000);
  });

  it("searches through 500 conversations quickly", async () => {
    const { default: useConversationStore } = await import("../../store/useConversationStore");
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

    const { createConversation, setSearchQuery } = useConversationStore.getState();

    for (let i = 0; i < 500; i++) {
      createConversation(i % 10 === 0 ? `Special conversation ${i}` : `Regular chat ${i}`);
    }

    const start = performance.now();
    setSearchQuery("Special");
    const results = useConversationStore.getState().getFilteredConversations();
    const elapsed = performance.now() - start;

    expect(results.length).toBe(50); // 500/10 = 50 special conversations
    // Search should complete in under 100ms
    expect(elapsed).toBeLessThan(100);
  });

  it("handles conversations with many messages", async () => {
    const { default: useConversationStore } = await import("../../store/useConversationStore");
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

    const { createConversation, addMessageToConversation } = useConversationStore.getState();
    const convId = createConversation("Long Conversation");

    const start = performance.now();
    for (let i = 0; i < 200; i++) {
      addMessageToConversation(convId, {
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i}: ${"Lorem ipsum ".repeat(20)}`,
      });
    }
    const elapsed = performance.now() - start;

    const { conversations } = useConversationStore.getState();
    expect(conversations[0].messages).toHaveLength(200);
    // Should complete in under 1 second
    expect(elapsed).toBeLessThan(1000);
  });
});

// ─── SmartWorkspaceDetector Performance ──────────────────────────────────────
describe("SmartWorkspaceDetector — Performance", () => {
  it("detects workspace type for 1000 messages quickly", async () => {
    const { SmartWorkspaceDetector } = await import("../../core/workspace/SmartWorkspaceDetector");

    const testCases = [
      { user: "write code", content: "```python\nprint('hello')\n```" },
      { user: "explain", content: "# Title\n\nSome **bold** text here" },
      { user: "show table", content: "| Col1 | Col2 |\n| --- | --- |\n| A | B |" },
      { user: "json", content: '{"key": "value"}' },
      { user: "hello", content: "Hello! How can I help?" },
    ];

    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      const tc = testCases[i % testCases.length];
      SmartWorkspaceDetector.detect(tc.user, tc.content);
    }
    const elapsed = performance.now() - start;

    // 1000 detections should complete in under 500ms
    expect(elapsed).toBeLessThan(500);
  });
});

// ─── Memory Leak Detection ────────────────────────────────────────────────────
describe("Memory — No Leaks", () => {
  it("conversation store does not grow unboundedly", async () => {
    const { default: useConversationStore } = await import("../../store/useConversationStore");
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

    const { createConversation, permanentlyDeleteConversation } = useConversationStore.getState();

    // Create and delete 100 conversations
    for (let i = 0; i < 100; i++) {
      const id = createConversation(`Conv ${i}`);
      permanentlyDeleteConversation(id);
    }

    const { conversations } = useConversationStore.getState();
    expect(conversations).toHaveLength(0);
  });

  it("recycle bin does not accumulate indefinitely", async () => {
    const { default: useConversationStore } = await import("../../store/useConversationStore");
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

    const { createConversation, deleteConversation, emptyRecycleBin } = useConversationStore.getState();

    for (let i = 0; i < 50; i++) {
      const id = createConversation(`Deleted ${i}`);
      deleteConversation(id);
    }

    emptyRecycleBin();
    const { conversations } = useConversationStore.getState();
    expect(conversations).toHaveLength(0);
  });
});

// ─── Streaming Simulation ─────────────────────────────────────────────────────
describe("Streaming — Message Updates", () => {
  it("handles rapid message updates (simulated streaming)", async () => {
    const { default: useConversationStore } = await import("../../store/useConversationStore");
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

    const { createConversation, addMessageToConversation, updateLastMessageInConversation } = useConversationStore.getState();
    const convId = createConversation("Streaming Test");
    addMessageToConversation(convId, { role: "assistant", content: "" });

    const start = performance.now();
    let accumulated = "";

    // Simulate 100 streaming chunks
    for (let i = 0; i < 100; i++) {
      accumulated += `chunk${i} `;
      updateLastMessageInConversation(convId, accumulated);
    }

    const elapsed = performance.now() - start;
    const { conversations } = useConversationStore.getState();
    expect(conversations[0].messages[0].content).toBe(accumulated);
    // 100 updates should be fast
    expect(elapsed).toBeLessThan(500);
  });
});

// ─── Import/Export Performance ────────────────────────────────────────────────
describe("Import/Export — Performance", () => {
  it("imports 100 conversations quickly", async () => {
    const { default: useConversationStore } = await import("../../store/useConversationStore");
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

    const { importConversations } = useConversationStore.getState();

    const conversations = Array.from({ length: 100 }, (_, i) => ({
      id: `import-${i}`,
      title: `Imported Conversation ${i}`,
      messages: Array.from({ length: 10 }, (_, j) => ({
        id: `msg-${i}-${j}`,
        role: j % 2 === 0 ? "user" : "assistant",
        content: `Message ${j} in conversation ${i}`,
        timestamp: Date.now() - j * 1000,
      })),
      createdAt: Date.now() - i * 3600000,
      updatedAt: Date.now() - i * 1800000,
      folderId: null,
      tags: [],
      isPinned: false,
      isFavorite: false,
      isArchived: false,
      isDeleted: false,
      messageCount: 10,
    }));

    const data = JSON.stringify({ conversations });
    const start = performance.now();
    const result = importConversations(data);
    const elapsed = performance.now() - start;

    expect(result.imported).toBe(100);
    expect(result.errors).toHaveLength(0);
    // Import should complete in under 1 second
    expect(elapsed).toBeLessThan(1000);
  });
});
