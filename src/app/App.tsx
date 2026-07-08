import React, { useState } from "react";
import Chat from "../ui/components/Chat";
import ModeSelector from "../ui/components/ModeSelector";
import ControlPanel from "../ui/components/ControlPanel";

const App: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-900/20">O</div>
            <h1 className="text-xl font-bold tracking-tight">Omni One <span className="text-xs text-blue-500 font-mono ml-1">v1.0</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <ModeSelector />
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
              ⚙️
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 flex gap-6 h-[calc(100vh-64px)]">
        <div className="flex-1 flex flex-col min-w-0">
          <Chat />
        </div>
        
        {showSettings && (
          <aside className="w-80 flex-shrink-0 animate-in slide-in-from-right-4 duration-300">
            <ControlPanel />
          </aside>
        )}
      </main>
    </div>
  );
};

export default App;
