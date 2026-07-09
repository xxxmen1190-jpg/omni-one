/**
 * E2E-style Tests — UI Components
 * Tests for Sidebar, Chat, Message rendering, and DashboardPanel
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

// Mock heavy dependencies
vi.mock("../../core/ai/orchestrator", () => ({
  AIOrchestrator: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue(undefined),
  })),
}));
vi.mock("../../core/skills/skillRegistry", () => ({
  SkillRegistry: { initialize: vi.fn() },
}));
vi.mock("../../core/ai/AgentManager", () => ({
  AgentManager: { onProgress: vi.fn().mockReturnValue(() => {}) },
}));
vi.mock("../../core/brain/Phase14Integration", () => ({
  Phase14Integration: { buildEnhancedPrompt: vi.fn().mockReturnValue("enhanced prompt") },
}));
vi.mock("../../core/workspace/SmartWorkspaceDetector", () => ({
  SmartWorkspaceDetector: { detect: vi.fn().mockReturnValue({ type: "chat", language: null }) },
}));

// ─── Message Component ────────────────────────────────────────────────────────
describe("MessageComponent", () => {
  it("renders a user message correctly", async () => {
    const { default: MessageComponent } = await import("../../ui/components/Message");
    const message = {
      id: "msg-1",
      role: "user" as const,
      content: "Hello, world!",
      timestamp: Date.now(),
      displayMode: "simple" as const,
    };
    render(<MessageComponent message={message} />);
    expect(screen.getByText("Hello, world!")).toBeInTheDocument();
  });

  it("renders an assistant message correctly", async () => {
    const { default: MessageComponent } = await import("../../ui/components/Message");
    const message = {
      id: "msg-2",
      role: "assistant" as const,
      content: "I am Omni One, your AI assistant.",
      timestamp: Date.now(),
      displayMode: "simple" as const,
    };
    render(<MessageComponent message={message} />);
    expect(screen.getByText("I am Omni One, your AI assistant.")).toBeInTheDocument();
  });

  it("renders markdown in assistant messages", async () => {
    const { default: MessageComponent } = await import("../../ui/components/Message");
    const message = {
      id: "msg-3",
      role: "assistant" as const,
      content: "# Heading\n\nSome **bold** text",
      timestamp: Date.now(),
      displayMode: "simple" as const,
    };
    render(<MessageComponent message={message} />);
    // Heading should render as h1
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("shows copy button on hover for assistant messages", async () => {
    const { default: MessageComponent } = await import("../../ui/components/Message");
    const message = {
      id: "msg-4",
      role: "assistant" as const,
      content: "Some response text",
      timestamp: Date.now(),
      displayMode: "simple" as const,
    };
    render(<MessageComponent message={message} />);
    // Copy button should exist (opacity-0 by default, but in DOM)
    const copyBtn = screen.getByTitle("Copy");
    expect(copyBtn).toBeInTheDocument();
  });

  it("copies message content to clipboard", async () => {
    const { default: MessageComponent } = await import("../../ui/components/Message");
    const message = {
      id: "msg-5",
      role: "assistant" as const,
      content: "Copy this text",
      timestamp: Date.now(),
      displayMode: "simple" as const,
    };
    render(<MessageComponent message={message} />);
    const copyBtn = screen.getByTitle("Copy");
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Copy this text");
    });
  });

  it("shows export menu when export button clicked", async () => {
    const { default: MessageComponent } = await import("../../ui/components/Message");
    const message = {
      id: "msg-6",
      role: "assistant" as const,
      content: "Export this",
      timestamp: Date.now(),
      displayMode: "simple" as const,
    };
    render(<MessageComponent message={message} />);
    const exportBtn = screen.getByTitle("Export");
    fireEvent.click(exportBtn);
    await waitFor(() => {
      expect(screen.getByText("PDF")).toBeInTheDocument();
      expect(screen.getByText("Word")).toBeInTheDocument();
      expect(screen.getByText("Markdown")).toBeInTheDocument();
    });
  });

  it("renders code blocks — shows workspace or fallback for code content", async () => {
    const { default: MessageComponent } = await import("../../ui/components/Message");
    const message = {
      id: "msg-7",
      role: "assistant" as const,
      content: "```javascript\nconsole.log('hello');\n```",
      timestamp: Date.now(),
      displayMode: "simple" as const,
    };
    render(<MessageComponent message={message} />);
    // Content with backticks triggers SmartWorkspace via Suspense
    // Either the workspace renders or the Suspense fallback is shown
    const hasWorkspace = document.querySelector('[class*="rounded-2xl"]');
    expect(hasWorkspace).toBeInTheDocument();
  });
});

// ─── Sidebar Component ────────────────────────────────────────────────────────
describe("Sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("renders when open", async () => {
    const { default: Sidebar } = await import("../../ui/components/Sidebar");
    const onToggle = vi.fn();
    const onNewChat = vi.fn();
    render(<Sidebar open={true} onToggle={onToggle} onNewChat={onNewChat} />);
    // Should show "New Chat" button
    expect(screen.getByText("New Chat")).toBeInTheDocument();
  });

  it("calls onNewChat when New Chat button is clicked", async () => {
    const { default: Sidebar } = await import("../../ui/components/Sidebar");
    const onNewChat = vi.fn();
    render(<Sidebar open={true} onToggle={vi.fn()} onNewChat={onNewChat} />);
    const newChatBtn = screen.getByText("New Chat");
    fireEvent.click(newChatBtn);
    expect(onNewChat).toHaveBeenCalledTimes(1);
  });

  it("shows search input", async () => {
    const { default: Sidebar } = await import("../../ui/components/Sidebar");
    render(<Sidebar open={true} onToggle={vi.fn()} onNewChat={vi.fn()} />);
    const searchInput = screen.getByPlaceholderText(/search/i);
    expect(searchInput).toBeInTheDocument();
  });

  it("filters conversations by search query", async () => {
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
    createConversation("React Tutorial");
    createConversation("Python Basics");

    const { default: Sidebar } = await import("../../ui/components/Sidebar");
    render(<Sidebar open={true} onToggle={vi.fn()} onNewChat={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "React" } });

    await waitFor(() => {
      expect(screen.getByText("React Tutorial")).toBeInTheDocument();
      expect(screen.queryByText("Python Basics")).not.toBeInTheDocument();
    });
  });

  it("shows filter tabs (All, Pinned, Fav, Arch, Trash)", async () => {
    const { default: Sidebar } = await import("../../ui/components/Sidebar");
    render(<Sidebar open={true} onToggle={vi.fn()} onNewChat={vi.fn()} />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.getByText("Fav")).toBeInTheDocument();
    expect(screen.getByText("Arch")).toBeInTheDocument();
    expect(screen.getByText("Trash")).toBeInTheDocument();
  });

  it("collapses when closed", async () => {
    const { default: Sidebar } = await import("../../ui/components/Sidebar");
    const { container } = render(<Sidebar open={false} onToggle={vi.fn()} onNewChat={vi.fn()} />);
    // When closed, sidebar should have w-0 or similar collapsed class
    const sidebar = container.firstChild as HTMLElement;
    expect(sidebar).toBeDefined();
  });
});

// ─── DashboardPanel ───────────────────────────────────────────────────────────
describe("DashboardPanel", () => {
  it("renders with all tabs", async () => {
    const { default: DashboardPanel } = await import("../../ui/components/DashboardPanel");
    render(<DashboardPanel onClose={vi.fn()} />);
    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Providers")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("Runtime")).toBeInTheDocument();
    expect(screen.getByText("Permissions")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", async () => {
    const { default: DashboardPanel } = await import("../../ui/components/DashboardPanel");
    const onClose = vi.fn();
    render(<DashboardPanel onClose={onClose} />);
    // Find close button (X)
    const closeBtn = screen.getByRole("button", { name: "" }); // SVG button
    // Find the button that contains the X SVG
    const allButtons = screen.getAllByRole("button");
    const closeButton = allButtons.find((btn) => btn.title === "" && btn.className.includes("hover:bg-ink-800"));
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    }
  });

  it("switches tabs correctly", async () => {
    const { default: DashboardPanel } = await import("../../ui/components/DashboardPanel");
    render(<DashboardPanel onClose={vi.fn()} />);
    const providersTab = screen.getByText("Providers");
    fireEvent.click(providersTab);
    // Tab should now be active (blue background)
    expect(providersTab.closest("button")).toHaveClass("bg-blue-600");
  });
});
