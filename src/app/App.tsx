import React, { useState, useEffect } from "react";
import Sidebar from "../ui/components/Sidebar";
import Chat from "../ui/components/Chat";
import { useChatStore } from "../store/useChatStore";

const App: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { clearMessages } = useChatStore();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-950 text-ink-100">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} onNewChat={clearMessages} />
      <main className="flex-1 flex flex-col min-w-0 relative">
        <Chat sidebarOpen={sidebarOpen} onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      </main>
    </div>
  );
};

export default App;
