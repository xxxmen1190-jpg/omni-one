import { create } from "zustand";
import { Message } from "../types";

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  abortController: AbortController | null;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => string;
  updateLastMessage: (content: string) => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  stopGenerating: () => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isStreaming: false,
  abortController: null,

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

  updateLastMessage: (content) => {
    set((state) => {
      const newMessages = [...state.messages];
      if (newMessages.length > 0) {
        newMessages[newMessages.length - 1].content = content;
      }
      return { messages: newMessages };
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),
  
  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setAbortController: (controller) => set({ abortController: controller }),

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
