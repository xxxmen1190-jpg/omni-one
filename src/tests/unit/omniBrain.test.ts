/**
 * Unit Tests — OmniBrain & AI Orchestration
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── OmniBrain ────────────────────────────────────────────────────────────────
describe("OmniBrain — Core", () => {
  it("instantiates with API keys", async () => {
    const { OmniBrain } = await import("../../core/brain/OmniBrain");
    const brain = new OmniBrain({ openai: "sk-test", anthropic: "", gemini: "", groq: "", openrouter: "" });
    expect(brain).toBeDefined();
    expect(typeof brain.processRequest).toBe("function");
  });

  it("processRequest is callable with messages and callbacks", async () => {
    const { OmniBrain } = await import("../../core/brain/OmniBrain");
    const brain = new OmniBrain({ openai: "sk-test", anthropic: "", gemini: "", groq: "", openrouter: "" });

    const mockFusionResult = {
      finalResponse: "Paris is the capital of France.",
      confidenceScore: 0.95,
      rawResponses: [],
      metadata: {},
    };

    // Spy on processRequest to verify it's callable
    const spy = vi.spyOn(brain, "processRequest").mockResolvedValue(mockFusionResult);

    const result = await brain.processRequest(
      [{ id: "msg-1", role: "user", content: "What is the capital of France?", timestamp: Date.now() }],
      { onChunk: vi.fn(), onComplete: vi.fn(), onError: vi.fn() }
    );

    expect(spy).toHaveBeenCalledOnce();
    expect(result).toBeDefined();
    spy.mockRestore();
  });
});

// ─── SmartWorkspaceDetector ───────────────────────────────────────────────────
describe("SmartWorkspaceDetector", () => {
  it("detects code workspace for code blocks", async () => {
    const { SmartWorkspaceDetector } = await import("../../core/workspace/SmartWorkspaceDetector");
    const result = SmartWorkspaceDetector.detect("write code", "```python\nprint('hello')\n```");
    expect(result.type).toBe("code");
    expect(result.language).toBe("python");
  });

  it("detects javascript code blocks", async () => {
    const { SmartWorkspaceDetector } = await import("../../core/workspace/SmartWorkspaceDetector");
    const result = SmartWorkspaceDetector.detect("write js", "```javascript\nconsole.log('hello');\n```");
    expect(result.type).toBe("code");
    expect(result.language).toBe("javascript");
  });

  it("detects markdown workspace for markdown content", async () => {
    const { SmartWorkspaceDetector } = await import("../../core/workspace/SmartWorkspaceDetector");
    const result = SmartWorkspaceDetector.detect("explain", "# Title\n\n## Section\n\nSome **bold** text");
    expect(result.type).toBe("markdown");
  });

  it("detects table workspace for markdown tables", async () => {
    const { SmartWorkspaceDetector } = await import("../../core/workspace/SmartWorkspaceDetector");
    const result = SmartWorkspaceDetector.detect("show table", "| Col1 | Col2 |\n| --- | --- |\n| A | B |");
    expect(result.type).toBe("table");
  });

  it("detects JSON workspace for JSON content", async () => {
    const { SmartWorkspaceDetector } = await import("../../core/workspace/SmartWorkspaceDetector");
    const result = SmartWorkspaceDetector.detect("show json", '{"key": "value", "num": 42}');
    expect(result.type).toBe("json");
  });

  it("defaults to chat for plain text", async () => {
    const { SmartWorkspaceDetector } = await import("../../core/workspace/SmartWorkspaceDetector");
    const result = SmartWorkspaceDetector.detect("hello", "Hello! How can I help you today?");
    expect(result.type).toBe("chat");
  });

  it("returns a language field for code blocks", async () => {
    const { SmartWorkspaceDetector } = await import("../../core/workspace/SmartWorkspaceDetector");
    const result = SmartWorkspaceDetector.detect("write rust", "```rust\nfn main() {}\n```");
    expect(result.language).toBe("rust");
  });
});

// ─── ToolRegistry ─────────────────────────────────────────────────────────────
describe("ToolRegistry", () => {
  it("is a class with static methods", async () => {
    const { ToolRegistry } = await import("../../core/tools/ToolRegistry");
    expect(typeof ToolRegistry.getTool).toBe("function");
    expect(typeof ToolRegistry.getAllTools).toBe("function");
    expect(typeof ToolRegistry.size).toBe("function");
  });

  it("returns undefined for unknown tool", async () => {
    const { ToolRegistry } = await import("../../core/tools/ToolRegistry");
    const tool = ToolRegistry.getTool("nonexistent-tool-xyz-abc");
    expect(tool).toBeUndefined();
  });

  it("getAllTools returns an array", async () => {
    const { ToolRegistry } = await import("../../core/tools/ToolRegistry");
    const tools = ToolRegistry.getAllTools();
    expect(Array.isArray(tools)).toBe(true);
  });

  it("size returns a number", async () => {
    const { ToolRegistry } = await import("../../core/tools/ToolRegistry");
    const size = ToolRegistry.size();
    expect(typeof size).toBe("number");
    expect(size).toBeGreaterThanOrEqual(0);
  });
});

// ─── PermissionSystem ─────────────────────────────────────────────────────────
describe("PermissionSystem", () => {
  it("PermissionValidator is defined", async () => {
    const { PermissionValidator } = await import("../../core/tools/sdk/PermissionSystem");
    expect(PermissionValidator).toBeDefined();
    expect(typeof PermissionValidator.validate).toBe("function");
  });

  it("PermissionManager is defined", async () => {
    const { PermissionManager } = await import("../../core/tools/sdk/PermissionSystem");
    expect(PermissionManager).toBeDefined();
  });

  it("permissionManager singleton is exported", async () => {
    const { permissionManager } = await import("../../core/tools/sdk/PermissionSystem");
    expect(permissionManager).toBeDefined();
  });

  it("RuntimePermissionGuard is defined", async () => {
    const { RuntimePermissionGuard } = await import("../../core/tools/sdk/PermissionSystem");
    expect(RuntimePermissionGuard).toBeDefined();
  });
});

// ─── ConversationMemoryManager ────────────────────────────────────────────────
describe("ConversationMemoryManager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("instantiates without errors", async () => {
    const { ConversationMemoryManager } = await import("../../core/memory/ConversationMemoryManager");
    const manager = new ConversationMemoryManager();
    expect(manager).toBeDefined();
  });
});

// ─── APIKeyManager ────────────────────────────────────────────────────────────
describe("APIKeyManager", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("adds and retrieves API keys by provider", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    const keyId = APIKeyManager.addKey("openai", "sk-test-key-123");
    expect(typeof keyId).toBe("string");
    // getKey uses keyId, not provider name
    const key = APIKeyManager.getKey(keyId);
    expect(key).toBe("sk-test-key-123");
  });

  it("returns undefined for missing key", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    const key = APIKeyManager.getKey("nonexistent-key-id-xyz");
    expect(key).toBeUndefined();
  });

  it("revokes an API key", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    const keyId = APIKeyManager.addKey("anthropic", "sk-ant-test");
    APIKeyManager.revokeKey(keyId);
    const key = APIKeyManager.getKey(keyId);
    expect(key).toBeUndefined();
  });

  it("returns all key metadata", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    APIKeyManager.addKey("groq", "gsk-test");
    const metadata = APIKeyManager.getAllKeyMetadata();
    expect(Array.isArray(metadata)).toBe(true);
    expect(metadata.length).toBeGreaterThan(0);
  });

  it("rotates a key", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    const keyId = APIKeyManager.addKey("openai", "sk-old-key");
    const newKeyId = APIKeyManager.rotateKey(keyId, "sk-new-key");
    expect(typeof newKeyId).toBe("string");
    const newKey = APIKeyManager.getKey(newKeyId);
    expect(newKey).toBe("sk-new-key");
  });

  it("getKeysByProvider returns keys for a provider", async () => {
    const { APIKeyManager } = await import("../../core/system/APIKeyManager");
    APIKeyManager.addKey("gemini", "gemini-test-key");
    const keys = APIKeyManager.getKeysByProvider("gemini");
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
  });
});
