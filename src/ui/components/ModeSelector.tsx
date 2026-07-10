import React from "react";
import useChatStore from "../../store/useChatStore";
import type { DisplayMode } from "../../store/useChatStore";

const ModeSelector: React.FC = () => {
  const { displayMode, setDisplayMode } = useChatStore();

  const modes: { id: DisplayMode; label: string; icon: string; description: string }[] = [
    { 
      id: "simple", 
      label: "Simple", 
      icon: "✨", 
      description: "Clean, direct answers" 
    },
    { 
      id: "pro", 
      label: "Pro", 
      icon: "🧠", 
      description: "Full reasoning & transparency" 
    },
    { 
      id: "research", 
      label: "Research", 
      icon: "🔍", 
      description: "Web + Deep Research" 
    },
    { 
      id: "agent", 
      label: "Agent", 
      icon: "🤖", 
      description: "Complex multi-step tasks" 
    }
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-4 p-2 bg-ink-800/50 rounded-xl border border-ink-700/50">
      {modes.map((mode) => (
        <button
          key={mode.id}
          onClick={() => setDisplayMode(mode.id)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 group ${
            displayMode === mode.id
              ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
              : "bg-ink-800 text-ink-400 hover:bg-ink-700 hover:text-ink-200"
          }`}
          title={mode.description}
        >
          <span className="text-lg">{mode.icon}</span>
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold leading-tight">{mode.label}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ModeSelector;
