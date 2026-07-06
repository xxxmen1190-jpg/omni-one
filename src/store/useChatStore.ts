import { create } from "zustand";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatState = {
  messages: Message[];
  addMessage: (m: Message) => void;
};

const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (m) =>
    set((state) => ({ messages: [...state.messages, m] }))
}));

export default useChatStore;
