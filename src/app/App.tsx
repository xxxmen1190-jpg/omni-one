/**
 * App — Root Component
 * Integrates Conversation Library (useConversationStore) with Chat and Sidebar.
 * Active conversation messages are synced to/from the conversation store.
 */
import React, { useState, useEffect, useCallback } from "react";
import Sidebar from "../ui/components/Sidebar";
import Chat from "../ui/components/Chat";
import { useChatStore } from "../store/useChatStore";
import useConversationStore from "../store/useConversationStore";

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Chat store — in-memory messages for the current session
  const { messages, clearMessages } = useChatStore();

  // Conversation library store
  const {
    activeConversationId,
    createConversation,
    setActiveConversation,
    getActiveConversation,
    updateLastMessageInConversation,
    addMessageToConversation,
    clearConversationMessages,
  } = useConversationStore();

  // ── When a conversation is selected in the sidebar, load its messages ──────
  useEffect(() => {
    const activeConv = getActiveConversation();
    if (activeConv) {
      // Replace in-memory messages with the stored conversation messages
      clearMessages();
      // We need to populate the chat store with the stored messages.
      // We do this by directly setting messages via the store's internal setter.
      // Since useChatStore doesn't expose a setMessages action, we use a workaround:
      // We'll add each message individually using addMessage.
      // But first, clear so we don't duplicate.
      const { addMessage } = useChatStore.getState();
      for (const msg of activeConv.messages) {
        addMessage({ role: msg.role, content: msg.content });
      }
    }
  }, [activeConversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync new messages to the active conversation ───────────────────────────
  useEffect(() => {
    if (!activeConversationId || messages.length === 0) return;
    const activeConv = getActiveConversation();
    if (!activeConv) return;

    // Only sync if the message counts differ (new messages added)
    if (messages.length > activeConv.messages.length) {
      const newMessages = messages.slice(activeConv.messages.length);
      for (const msg of newMessages) {
        addMessageToConversation(activeConversationId, {
          role: msg.role,
          content: msg.content,
        });
      }
    } else if (messages.length === activeConv.messages.length && messages.length > 0) {
      // Last message may have been updated (streaming)
      const lastMsg = messages[messages.length - 1];
      const lastStored = activeConv.messages[activeConv.messages.length - 1];
      if (lastMsg.content !== lastStored.content) {
        updateLastMessageInConversation(activeConversationId, lastMsg.content);
      }
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── New Chat ───────────────────────────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    // Create a new conversation in the library
    const newId = createConversation("New Conversation");
    setActiveConversation(newId);
    clearMessages();
  }, [createConversation, setActiveConversation, clearMessages]);

  // ── On first load: if no active conversation, create one ──────────────────
  useEffect(() => {
    if (!activeConversationId) {
      const newId = createConversation("New Conversation");
      setActiveConversation(newId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-950 text-ink-100">
      <Sidebar
        open={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        onNewChat={handleNewChat}
      />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Chat
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
      </main>
    </div>
  );
};

export default App;
