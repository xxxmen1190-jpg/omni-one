import React, { useState, useRef, useEffect } from "react";
import useChatStore from "../../store/useChatStore";
import { AIOrchestrator } from "../../core/ai/orchestrator";
import { SkillRegistry } from "../../core/skills/skillRegistry";
import { AgentManager } from "../../core/ai/AgentManager";
import { OmniBrain } from "../../core/brain/OmniBrain";
import MessageComponent from "./Message";
import { EnhancedChatMessage } from "../../types/ux";

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
    stopGenerating,
    agentProgress,
    setAgentProgress,
    displayMode
  } = useChatStore();
  
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize SkillRegistry, OmniBrain, and Orchestrator with env keys
  useEffect(() => {
    SkillRegistry.initialize({
      openai: (import.meta as any).env.VITE_OPENAI_API_KEY || "",
      anthropic: (import.meta as any).env.VITE_ANTHROPIC_API_KEY || "",
      gemini: (import.meta as any).env.VITE_GEMINI_API_KEY || "",
      groq: (import.meta as any).env.VITE_GROQ_API_KEY || "",
      openrouter: (import.meta as any).env.VITE_OPENROUTER_API_KEY || "",
    });

    const omniBrain = new OmniBrain({
      openai: (import.meta as any).env.VITE_OPENAI_API_KEY || "",
      anthropic: (import.meta as any).env.VITE_ANTHROPIC_API_KEY || "",
      gemini: (import.meta as any).env.VITE_GEMINI_API_KEY || "",
      groq: (import.meta as any).env.VITE_GROQ_API_KEY || "",
      openrouter: (import.meta as any).env.VITE_OPENROUTER_API_KEY || "",
    });
    omniBrain.initializeCognitiveLayer();

    AgentManager.onProgress((progress) => {
      setAgentProgress(progress);
    });
  }, []);

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
          onComplete: (fullText, metadata) => {
            const currentMessages = useChatStore.getState().messages;
            updateLastMessage(fullText, metadata);
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
    <div className="flex flex-col h-full bg-gray-900/30 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
      <div className="flex-1 overflow-y-auto space-y-6 p-6 scrollbar-thin scrollbar-thumb-gray-700">
        {messages.map((m) => (
          <MessageComponent 
            key={m.id} 
            message={{
              ...m,
              displayMode: displayMode
            } as EnhancedChatMessage} 
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-gray-900/80 border-t border-gray-800 backdrop-blur-sm">
        <div className="relative">
          {agentProgress && (
            <div className="absolute -top-24 left-0 right-0 bg-gray-800 border border-gray-700 p-3 rounded-xl shadow-xl animate-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-blue-400">{agentProgress.agentName}</span>
                <span className="text-xs text-gray-400">{agentProgress.status}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5 mb-2">
                <div 
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${agentProgress.progress}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-300">
                <span className="truncate max-w-[80%]">{agentProgress.currentStep || agentProgress.message}</span>
                <span>{agentProgress.progress}%</span>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={displayMode === "research" ? "What do you want to research?" : "Ask anything..."}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              disabled={isLoading}
            />
            {isStreaming ? (
              <button
                onClick={stopGenerating}
                className="bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white px-5 py-3 rounded-xl transition-all border border-red-900/30 font-bold"
              >
                Stop
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-900/20 font-bold"
              >
                Send
              </button>
            )}
          </div>
          
          {isLoading && !isStreaming && !agentProgress && (
            <div className="mt-2 flex items-center gap-2 px-1">
              <div className="flex gap-1">
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
              <span className="text-[10px] text-gray-500 font-medium uppercase tracking-widest">
                Thinking...
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Chat;
