/**
 * Chat Store — Omni One Frontend
 * Manages in-session chat state with real backend streaming integration.
 */
import { create } from "zustand";
import { chatApi, ApiError, type StreamChunk } from "../lib/api";
import useConversationStore from "./useConversationStore";

export type DisplayMode = "simple" | "pro" | "research" | "agent" | "debug" | "default" | "focus" | "split";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  isStreaming?: boolean;
  isError?: boolean;
  timestamp: number;
  workspaceType?: string;
  generatedImages?: string[];
}

export interface AgentProgress {
  agentName?: string;
  status?: string;
  message: string;
  currentStep?: string;
  progress: number;
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  displayMode: DisplayMode;
  agentProgress: AgentProgress | null;
  streamAbortController: AbortController | null;

  sendMessage: (content: string, options?: { model?: string; systemPrompt?: string }) => Promise<void>;
  stopGenerating: () => void;
  regenerateLastMessage: () => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  clearMessages: () => void;
  uiConfig: { enableWebSearch: boolean; enableCodeExecution: boolean; enableImageGen: boolean; enableAgents: boolean; enableMemory: boolean; maxDepth: number; speedVsAccuracy: number };
  updateUIConfig: (config: Partial<{ enableWebSearch: boolean; enableCodeExecution: boolean; enableImageGen: boolean; enableAgents: boolean; enableMemory: boolean; maxDepth: number; speedVsAccuracy: number }>) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setAgentProgress: (p: AgentProgress | null) => void;

  // Legacy compat helpers used by Chat.tsx
  addMessage: (msg: { role: string; content: string }) => string;
  updateLastMessage: (content: string, metadata?: Record<string, unknown>) => void;
  setLoading: (v: boolean) => void;
  setStreaming: (v: boolean) => void;
  setAbortController: (c: AbortController | null) => void;
}

let _seq = 0;
const genId = () => `msg-${Date.now()}-${++_seq}`;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  displayMode: "default",
  agentProgress: null,
  streamAbortController: null,

  sendMessage: async (content, options = {}) => {
    if (get().isLoading || !content.trim()) return;
    const convStore = useConversationStore.getState();
    const convId = convStore.activeConversationId;

    // Optimistic user message
    const userMsg: ChatMessage = { id: genId(), role: "user", content, timestamp: Date.now() };
    set((s) => ({ messages: [...s.messages, userMsg], isLoading: true }));

    // Persist user message
    if (convId) {
      try { await convStore.addMessage(convId, "USER", content, options.model); } catch { /* non-blocking */ }
    }

    // Assistant placeholder
    const asstMsg: ChatMessage = { id: genId(), role: "assistant", content: "", isStreaming: true, model: options.model, timestamp: Date.now() };
    set((s) => ({ messages: [...s.messages, asstMsg], isStreaming: true }));

    const history = get().messages
      .filter((m) => !m.isStreaming && !m.isError && m.id !== asstMsg.id)
      .map((m) => ({ role: m.role, content: m.content }));

    let fullResponse = "";

    const controller = chatApi.stream(
      { messages: history, model: options.model, systemPrompt: options.systemPrompt, conversationId: convId ?? undefined },
      {
        onChunk: (raw: string) => {
          try {
            const chunk = JSON.parse(raw) as StreamChunk;
            if (chunk.type === "delta" && chunk.content) {
              fullResponse += chunk.content;
              set((s) => {
                const msgs = [...s.messages];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullResponse, model: chunk.model ?? options.model };
                return { messages: msgs };
              });
            } else if (chunk.type === "error") {
              set((s) => {
                const msgs = [...s.messages];
                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: `Error: ${chunk.error ?? "Unknown error"}`, isStreaming: false, isError: true };
                return { messages: msgs, isLoading: false, isStreaming: false, streamAbortController: null };
              });
            }
          } catch {
            fullResponse += raw;
            set((s) => {
              const msgs = [...s.messages];
              msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: fullResponse };
              return { messages: msgs };
            });
          }
        },
        onDone: async () => {
          set((s) => {
            const msgs = [...s.messages];
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], isStreaming: false };
            return { messages: msgs, isLoading: false, isStreaming: false, streamAbortController: null };
          });
          if (convId && fullResponse) {
            try { await convStore.addMessage(convId, "ASSISTANT", fullResponse, options.model); } catch { /* non-blocking */ }
          }
        },
        onError: (err: Error) => {
          const msg = err instanceof ApiError ? err.message : "Connection error. Please try again.";
          set((s) => {
            const msgs = [...s.messages];
            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msg, isStreaming: false, isError: true };
            return { messages: msgs, isLoading: false, isStreaming: false, streamAbortController: null };
          });
        },
      }
    );
    set({ streamAbortController: controller });
  },

  stopGenerating: () => {
    get().streamAbortController?.abort();
    set((s) => ({
      streamAbortController: null, isLoading: false, isStreaming: false,
      messages: s.messages.map((m, i) => i === s.messages.length - 1 && m.isStreaming ? { ...m, isStreaming: false } : m),
    }));
  },

  regenerateLastMessage: async () => {
    const { messages } = get();
    const lastAsst = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAsst) return;
    set((s) => ({ messages: s.messages.filter((m) => m.id !== lastAsst.id) }));
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) await get().sendMessage(lastUser.content, { model: lastAsst.model });
  },

  editMessage: async (messageId, newContent) => {
    set((s) => ({ messages: s.messages.map((m) => m.id === messageId ? { ...m, content: newContent } : m) }));
    const convStore = useConversationStore.getState();
    const { activeConversationId, messages: convMsgs } = convStore;
    const localIdx = get().messages.findIndex((m) => m.id === messageId);
    if (activeConversationId && localIdx >= 0 && convMsgs[localIdx]) {
      try { await convStore.updateMessage(activeConversationId, convMsgs[localIdx].id, newContent); } catch { /* non-blocking */ }
    }
  },

  deleteMessage: async (messageId) => {
    const localIdx = get().messages.findIndex((m) => m.id === messageId);
    set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
    const convStore = useConversationStore.getState();
    const { activeConversationId, messages: convMsgs } = convStore;
    if (activeConversationId && localIdx >= 0 && convMsgs[localIdx]) {
      try { await convStore.deleteMessage(activeConversationId, convMsgs[localIdx].id); } catch { /* non-blocking */ }
    }
  },

  clearMessages: () => set({ messages: [] }),
  uiConfig: { enableWebSearch: false, enableCodeExecution: false, enableImageGen: false, enableAgents: false, enableMemory: false, maxDepth: 3, speedVsAccuracy: 0.5 },
  updateUIConfig: (config) => set((s) => ({ uiConfig: { ...s.uiConfig, ...config } })),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setAgentProgress: (p) => set({ agentProgress: p }),

  // Legacy compat
  addMessage: (msg) => {
    const id = genId();
    set((s) => ({ messages: [...s.messages, { ...msg, role: msg.role as "user" | "assistant" | "system", id, timestamp: Date.now() }] }));
    return id;
  },
  updateLastMessage: (content, metadata = {}) => {
    set((s) => {
      if (!s.messages.length) return s;
      const msgs = [...s.messages];
      msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content, ...metadata };
      return { messages: msgs };
    });
  },
  setLoading: (v) => set({ isLoading: v }),
  setStreaming: (v) => set({ isStreaming: v }),
  setAbortController: (c) => set({ streamAbortController: c }),
}));

export default useChatStore;
