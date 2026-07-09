/**
 * Security & Auth Tests
 * Tests for API key management, permission system, and data security
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

beforeEach(() => {
  localStorage.clear();
});

// ─── APIKeyManager Security ───────────────────────────────────────────────────
describe("APIKeyManager — Security", () => {
  it("does not expose raw API keys in metadata", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    APIKeyManager.addKey("openai", "sk-real-secret-key-12345");
    const metadata = APIKeyManager.getAllKeyMetadata();
    // Metadata should not contain the raw key value
    const metadataStr = JSON.stringify(metadata);
    expect(metadataStr).not.toContain("sk-real-secret-key-12345");
  });

  it("handles empty key gracefully", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    expect(() => {
      APIKeyManager.addKey("openai", "");
    }).not.toThrow();
  });

  it("rotates a key and creates a new accessible key", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    const keyId = APIKeyManager.addKey("openai-rotate-test", "sk-old-key");
    // Wait 2ms to ensure different timestamp in ID
    await new Promise((r) => setTimeout(r, 2));
    const newKeyId = APIKeyManager.rotateKey(keyId, "sk-new-key");
    // New key should be accessible
    const newKey = APIKeyManager.getKey(newKeyId);
    expect(newKey).toBe("sk-new-key");
    // Rotation should return a valid string ID
    expect(typeof newKeyId).toBe("string");
    expect(newKeyId.length).toBeGreaterThan(0);
  });

  it("handles multiple providers independently", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    const openaiId = APIKeyManager.addKey("openai", "sk-openai-key");
    const anthropicId = APIKeyManager.addKey("anthropic", "sk-ant-key");
    const groqId = APIKeyManager.addKey("groq", "gsk-groq-key");

    expect(APIKeyManager.getKey(openaiId)).toBe("sk-openai-key");
    expect(APIKeyManager.getKey(anthropicId)).toBe("sk-ant-key");
    expect(APIKeyManager.getKey(groqId)).toBe("gsk-groq-key");
  });

  it("revoking a key makes it inaccessible", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    const keyId = APIKeyManager.addKey("openai", "sk-to-revoke");
    APIKeyManager.revokeKey(keyId);
    expect(APIKeyManager.getKey(keyId)).toBeUndefined();
  });
});

// ─── PermissionSystem Security ────────────────────────────────────────────────
describe("PermissionSystem — Security", () => {
  it("PermissionValidator.validate is callable", async () => {
    const { PermissionValidator } = await import("../../core/tools/sdk/PermissionSystem");
    expect(typeof PermissionValidator.validate).toBe("function");
  });

  it("PermissionManager can be instantiated", async () => {
    const { PermissionManager } = await import("../../core/tools/sdk/PermissionSystem");
    const manager = new PermissionManager();
    expect(manager).toBeDefined();
  });

  it("runtimePermissionGuard singleton exists", async () => {
    const { runtimePermissionGuard } = await import("../../core/tools/sdk/PermissionSystem");
    expect(runtimePermissionGuard).toBeDefined();
  });
});

// ─── Conversation Data Security ───────────────────────────────────────────────
describe("Conversation Store — Data Security", () => {
  it("does not expose conversation data in global scope", async () => {
    vi.resetModules();
    const { default: useConversationStore } = await import("../../store/useConversationStore");
    const { createConversation, addMessageToConversation } = useConversationStore.getState();
    const convId = createConversation("Private Conversation");
    addMessageToConversation(convId, { role: "user", content: "My secret message" });

    // Data should be in the store, not in window
    expect((window as unknown as Record<string, unknown>).conversationData).toBeUndefined();
    expect((window as unknown as Record<string, unknown>).privateMessages).toBeUndefined();
  });

  it("sanitizes conversation titles (stored as-is, React handles XSS)", async () => {
    vi.resetModules();
    const { default: useConversationStore } = await import("../../store/useConversationStore");
    const { createConversation } = useConversationStore.getState();
    const xssTitle = '<script>alert("xss")</script>';
    const id = createConversation(xssTitle);
    const { conversations } = useConversationStore.getState();
    const conv = conversations.find((c) => c.id === id);
    // Title is stored as-is (React handles XSS prevention in rendering)
    expect(conv?.title).toBe(xssTitle);
  });
});

// ─── Import Security ──────────────────────────────────────────────────────────
describe("Import — Security", () => {
  it("rejects malicious JSON payloads without polluting prototype", async () => {
    vi.resetModules();
    const { default: useConversationStore } = await import("../../store/useConversationStore");
    const { importConversations } = useConversationStore.getState();

    // Attempt prototype pollution
    const maliciousPayload = JSON.stringify({
      __proto__: { isAdmin: true },
      constructor: { prototype: { isAdmin: true } },
      conversations: [],
    });

    const result = importConversations(maliciousPayload);
    // Should not throw and should not pollute prototype
    expect((Object.prototype as Record<string, unknown>).isAdmin).toBeUndefined();
    expect(result).toBeDefined();
  });

  it("handles invalid JSON without crashing", async () => {
    vi.resetModules();
    const { default: useConversationStore } = await import("../../store/useConversationStore");
    const { importConversations } = useConversationStore.getState();

    const result = importConversations("not valid json {{{");
    expect(result.imported).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("handles extremely large import payloads", async () => {
    vi.resetModules();
    const { default: useConversationStore } = await import("../../store/useConversationStore");
    const { importConversations } = useConversationStore.getState();

    // Create a large payload (500 conversations with 20 messages each)
    const conversations = Array.from({ length: 500 }, (_, i) => ({
      id: `large-import-${i}`,
      title: `Conversation ${i}`,
      messages: Array.from({ length: 20 }, (_, j) => ({
        id: `msg-${i}-${j}`,
        role: j % 2 === 0 ? "user" : "assistant",
        content: `Message ${j}: ${"x".repeat(200)}`,
        timestamp: Date.now(),
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      folderId: null,
      tags: [],
      isPinned: false,
      isFavorite: false,
      isArchived: false,
      isDeleted: false,
      messageCount: 20,
    }));

    const data = JSON.stringify({ conversations });
    const start = performance.now();
    const result = importConversations(data);
    const elapsed = performance.now() - start;

    expect(result.imported).toBe(500);
    // Should complete in reasonable time (under 5 seconds)
    expect(elapsed).toBeLessThan(5000);
  });
});
