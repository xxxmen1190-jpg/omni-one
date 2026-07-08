import { create } from "zustand";
import { Message } from "../types";
import { AgentProgress } from "../types/agent";
import { DisplayMode, UIConfig } from "../types/ux";

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  abortController: AbortController | null;
  agentProgress: AgentProgress | null;
  displayMode: DisplayMode;
  uiConfig: UIConfig;
  setDisplayMode: (mode: DisplayMode) => void;
  updateUIConfig: (config: Partial<UIConfig>) => void;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => string;
  updateLastMessage: (content: string, metadata?: Record<string, any>) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  setAgentProgress: (progress: AgentProgress | null) => void;
  stopGenerating: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  abortController: null,
  agentProgress: null,
  displayMode: "simple",
  uiConfig: {
    enableProMode: true,
    enableDebugPanel: false,
    enableReasoningView: true,
    enableSourcesPanel: true,
    enableLiveIndicators: true,
    enableMessageReplay: true,
    enableWebSearch: true,
    enableAgents: true,
    enableMemory: true,
    maxDepth: 3,
    speedVsAccuracy: 0.5,
    defaultDisplayMode: "simple",
    maxVisibleMessages: 50,
    messageCompactThreshold: 500,
    animationDuration: 300,
    theme: "dark",
  },

  setDisplayMode: (mode) => set({ displayMode: mode }),
  
  updateUIConfig: (config) => set((state) => ({ 
    uiConfig: { ...state.uiConfig, ...config } 
  })),

  addMessage: (msg) => {
    const id = Math.random().toString(36).substring(7);
    const newMessage: Message = {
      ...msg,
      id,
      timestamp: Date.now(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
    return id;
  },

  updateLastMessage: (content, metadata) => {
    set((state) => {
      const newMessages = [...state.messages];
      if (newMessages.length > 0) {
        const lastIndex = newMessages.length - 1;
        newMessages[lastIndex].content = content;
        if (metadata) {
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            ...metadata
          };
        }
      }
      return { messages: newMessages };
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  
  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setAbortController: (controller) => set({ abortController: controller }),

  setAgentProgress: (progress) => set({ agentProgress: progress }),

  stopGenerating: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isStreaming: false, isLoading: false });
    }
  },

  clearMessages: () => set({ messages: [] }),
}));

export default useChatStore;
