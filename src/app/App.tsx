/**
 * App — Root Component — Omni One Frontend
 *
 * Phase 16.4: Full production integration.
 * - ProtectedRoute gates the app behind real auth
 * - Loads conversations from backend on mount
 * - OfflineBanner for network status
 * - ErrorBoundary for graceful error handling
 */
import React, { useEffect, useCallback } from "react";
import Sidebar from "../ui/components/Sidebar";
import Chat from "../ui/components/Chat";
import { useChatStore } from "../store/useChatStore";
import useConversationStore from "../store/useConversationStore";
import useAuthStore from "../store/useAuthStore";
import ProtectedRoute from "../ui/components/auth/ProtectedRoute";
import { ErrorBoundary } from "../ui/components/error/ErrorBoundary";
import OfflineBanner from "../ui/components/error/OfflineBanner";

// ─── Inner App (rendered after auth) ─────────────────────────────────────────

const AppInner: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  const { clearMessages } = useChatStore();
  const {
    activeConversationId,
    conversations,
    loadConversations,
    createConversation,
    setActiveConversation,
    isLoading: convLoading,
  } = useConversationStore();

  const { status: authStatus } = useAuthStore();

  // ── Load conversations on mount (authenticated users only) ─────────────────
  useEffect(() => {
    if (authStatus === "authenticated") {
      void loadConversations();
    }
  }, [authStatus, loadConversations]);

  // ── On first load: if no active conversation, start fresh ─────────────────
  useEffect(() => {
    if (authStatus === "authenticated" && !convLoading && conversations.length === 0 && !activeConversationId) {
      // Don't auto-create — let user start a conversation
    }
  }, [authStatus, convLoading, conversations.length, activeConversationId]);

  // ── New Chat ───────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(async () => {
    clearMessages();
    if (authStatus === "authenticated") {
      try {
        const conv = await createConversation("New Conversation");
        await setActiveConversation(conv.id);
      } catch {
        // Guest mode or error — just clear messages
        await setActiveConversation(null);
      }
    } else {
      // Guest mode
      await setActiveConversation(null);
      clearMessages();
    }
  }, [authStatus, clearMessages, createConversation, setActiveConversation]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-950 text-ink-100">
      <OfflineBanner />
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        onNewChat={() => void handleNewChat()}
      />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Chat
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
      </main>
    </div>
  );
};

// ─── Root App ─────────────────────────────────────────────────────────────────

const App: React.FC = () => (
  <ErrorBoundary>
    <ProtectedRoute>
      <ErrorBoundary>
        <AppInner />
      </ErrorBoundary>
    </ProtectedRoute>
  </ErrorBoundary>
);

export default App;
