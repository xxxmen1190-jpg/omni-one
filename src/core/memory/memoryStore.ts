import { Message } from "../../types";

const CONVERSATION_KEY = "omni_one_conversation_history";

export const memoryStore = {
  save: (key: string, value: any) => {
    localStorage.setItem(key, JSON.stringify(value));
  },
  load: (key: string) => {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  },

  getConversationContext: (currentMessages: Message[]): string => {
    const history = memoryStore.load(CONVERSATION_KEY) || [];
    // Combine historical messages with current messages to form context
    const contextMessages = [...history, ...currentMessages];
    return contextMessages.map(m => `${m.role}: ${m.content}`).join("\n");
  },

  addMessage: (message: Message) => {
    const history = memoryStore.load(CONVERSATION_KEY) || [];
    history.push(message);
    // Keep history to a reasonable length, e.g., last 10 messages
    if (history.length > 10) {
      history.shift();
    }
    memoryStore.save(CONVERSATION_KEY, history);
  },

  clearConversation: () => {
    localStorage.removeItem(CONVERSATION_KEY);
  }
};
