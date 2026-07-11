/**
 * WorkflowBuilder — Omni One Frontend
 * 
 * Visual node-based editor for creating AI workflows.
 */

import React, { useState } from "react";

interface Node {
  id: string;
  type: string;
  label: string;
  position: { x: number; y: number };
}

export const WorkflowBuilder: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([
    { id: "1", type: "trigger", label: "On Message Received", position: { x: 50, y: 50 } },
    { id: "2", type: "action", label: "Search Knowledge Base", position: { x: 250, y: 50 } },
    { id: "3", type: "action", label: "Summarize Results", position: { x: 450, y: 50 } },
  ]);

  return (
    <div className="h-full w-full bg-ink-950 overflow-hidden flex flex-col animate-in fade-in duration-700">
      <header className="p-4 border-b border-ink-800 bg-ink-900 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-ink-100">Workflow Builder</h2>
          <p className="text-[10px] text-ink-500 uppercase tracking-widest font-bold">Node Editor v2.0</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-1.5 bg-ink-800 hover:bg-ink-700 text-ink-300 text-xs font-bold rounded-xl border border-ink-700 transition-all">
            Import JSON
          </button>
          <button className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all">
            Save Workflow
          </button>
        </div>
      </header>

      <main className="flex-1 relative p-8 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px]">
        {/* Simplified Visual Node Editor */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-ink-800 text-8xl font-black opacity-10 select-none">OMNI CANVAS</div>
        </div>

        <div className="relative z-10 space-y-4">
          {nodes.map((node) => (
            <div
              key={node.id}
              className="absolute bg-ink-900 border-2 border-ink-800 p-4 rounded-2xl w-48 shadow-2xl cursor-move hover:border-blue-500/50 transition-colors"
              style={{ left: node.position.x, top: node.position.y }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`w-2 h-2 rounded-full ${node.type === "trigger" ? "bg-green-500" : "bg-blue-500"}`} />
                <span className="text-[10px] uppercase font-black text-ink-500 tracking-tighter">{node.type}</span>
              </div>
              <p className="text-sm font-bold text-ink-100">{node.label}</p>
              
              {/* Connector points */}
              <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full border-2 border-ink-900" />
              <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-ink-700 rounded-full border-2 border-ink-900" />
            </div>
          ))}
          
          {/* SVG Connections (Simulated) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <path d="M 242 86 L 250 86" stroke="#3b82f6" strokeWidth="2" fill="none" />
            <path d="M 442 86 L 450 86" stroke="#3b82f6" strokeWidth="2" fill="none" />
          </svg>
        </div>
      </main>

      <aside className="absolute right-6 top-24 w-64 bg-ink-900 border border-ink-800 rounded-2xl p-4 shadow-2xl">
        <h3 className="text-xs font-black text-ink-500 uppercase mb-4 tracking-widest">Available Nodes</h3>
        <div className="space-y-2">
          {["Trigger", "Condition", "Loop", "Search", "Summarize", "Email", "Memory", "Export"].map((type) => (
            <div key={type} className="p-3 bg-ink-800 rounded-xl border border-ink-700 flex items-center justify-between group cursor-pointer hover:bg-ink-700 transition-all">
              <span className="text-xs font-bold text-ink-200">{type}</span>
              <span className="text-ink-500 group-hover:text-blue-400 transition-colors">+</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};
