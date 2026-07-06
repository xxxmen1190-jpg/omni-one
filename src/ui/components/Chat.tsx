import React, { useState, useRef, useEffect } from "react";
import useChatStore from "../../store/useChatStore";
import { AIOrchestrator } from "../../core/ai/orchestrator";

const Chat: React.FC = () => {
  const { 
    messages, 
    addMessage, 
    updateLastMessage, 
    isLoading, 
    setLoading, 
    isStreaming, 
    setStreaming, 
    setAbortController, 
    stopGenerating 
  } = useChatStore();
  
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Orchestrator with env keys or placeholders
  const orchestrator = new AIOrchestrator({
    openai: (import.meta as any).env.VITE_OPENAI_API_KEY || "",
    anthropic: (import.meta as any).env.VITE_ANTHROPIC_API_KEY || "",
    gemini: (import.meta as any).env.VITE_GEMINI_API_KEY || "",
    groq: (import.meta as any).env.VITE_GROQ_API_KEY || "",
    openrouter: (import.meta as any).env.VITE_OPENROUTER_API_KEY || "",
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userContent = input;
    setInput("");
    
    addMessage({ role: "user", content: userContent });
    setLoading(true);

    const controller = new AbortController();
    setAbortController(controller);

    addMessage({ role: "assistant", content: "" });
    setStreaming(true);

    try {
      await orchestrator.execute(
        [...messages, { id: "temp", role: "user", content: userContent, timestamp: Date.now() }],
        {
          onChunk: (chunk) => {
            const currentMessages = useChatStore.getState().messages;
            const lastMsg = currentMessages[currentMessages.length - 1];
            updateLastMessage(lastMsg.content + chunk);
          },
          onComplete: () => {
            setStreaming(false);
            setLoading(false);
            setAbortController(null);
          },
          onError: (err) => {
            console.error(err);
            updateLastMessage("Error: " + err.message);
            setStreaming(false);
            setLoading(false);
            setAbortController(null);
          }
        },
        controller.signal
      );
    } catch (err) {
      setLoading(false);
      setStreaming(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4 bg-gray-900 text-white">
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                m.role === "user" ? "bg-blue-600" : "bg-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content || (isStreaming && m.role === "assistant" ? "..." : "")}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your message..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {isStreaming ? (
            <button
              onClick={stopGenerating}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
            >
              Send
            </button>
          )}
        </div>
        {isLoading && !isStreaming && (
          <div className="absolute -top-6 left-0 text-xs text-gray-400">
            AI is thinking...
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;
