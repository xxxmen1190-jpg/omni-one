import React from "react";

interface SidebarProps {
  open: boolean;
  onToggle: () => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onToggle, onNewChat }) => {
  return (
    <aside
      className={`${
        open ? "w-72" : "w-0"
      } transition-all duration-300 ease-in-out flex-shrink-0 border-r border-ink-800 bg-ink-900/80 backdrop-blur-xl overflow-hidden`}
    >
      <div className="w-72 h-full flex flex-col">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/30">
              O
            </div>
            <span className="font-bold tracking-tight">Omni One</span>
          </div>
        </div>

        <div className="px-3">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-ink-700 hover:bg-ink-800 transition-colors text-sm font-medium text-ink-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Chat
          </button>
        </div>

        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-2 text-[10px] font-semibold text-ink-500 uppercase tracking-widest mb-2">Recent</p>
          {[].map((_, i) => (
            <div key={i} className="px-3 py-2 rounded-lg hover:bg-ink-800 cursor-pointer text-sm text-ink-400 transition-colors truncate">
              New conversation
            </div>
          ))}
          <p className="px-2 text-[10px] text-ink-600 py-4">No conversations yet.</p>
        </div>

        <div className="p-3 border-t border-ink-800">
          <button
            onClick={onToggle}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-ink-800 text-ink-400 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            Collapse
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
