/**
 * ManusSettings — Omni One Frontend
 * 
 * Configuration interface for Manus AI provider.
 */

import React, { useState, useEffect } from "react";

export const ManusSettings: React.FC = () => {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"IDLE" | "TESTING" | "CONNECTED" | "ERROR">("IDLE");
  const [metrics, setMetrics] = useState({ latency: 0, cost: 0 });

  const handleTestConnection = async () => {
    setStatus("TESTING");
    // Simulate API call
    setTimeout(() => {
      if (apiKey.length > 10) {
        setStatus("CONNECTED");
        setMetrics({ latency: 1240, cost: 0.042 });
      } else {
        setStatus("ERROR");
      }
    }, 1500);
  };

  return (
    <div className="bg-ink-900 border border-ink-800 rounded-2xl p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black">M</div>
          <div>
            <h3 className="text-lg font-bold text-ink-100">Manus AI</h3>
            <p className="text-xs text-ink-500">Autonomous General AI Orchestrator</p>
          </div>
        </div>
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
          status === "CONNECTED" ? "bg-green-500/10 text-green-400 border-green-500/20" :
          status === "ERROR" ? "bg-red-500/10 text-red-400 border-red-500/20" :
          "bg-ink-800 text-ink-500 border-ink-700"
        }`}>
          {status}
        </div>
      </header>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] uppercase font-black text-ink-500 tracking-widest">API Key</label>
          <div className="relative">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="manus_..."
              className="w-full bg-ink-950 border border-ink-800 rounded-xl px-4 py-2.5 text-sm text-ink-100 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-ink-950 p-3 rounded-xl border border-ink-800">
            <p className="text-[10px] text-ink-500 uppercase mb-1">Avg Latency</p>
            <p className="text-lg font-bold text-ink-200">{metrics.latency}ms</p>
          </div>
          <div className="bg-ink-950 p-3 rounded-xl border border-ink-800">
            <p className="text-[10px] text-ink-500 uppercase mb-1">Total Cost (24h)</p>
            <p className="text-lg font-bold text-ink-200">${metrics.cost.toFixed(3)}</p>
          </div>
        </div>

        <div className="pt-2">
          <h4 className="text-[10px] uppercase font-black text-ink-500 tracking-widest mb-2">Capabilities</h4>
          <div className="flex flex-wrap gap-2">
            {["Deep Research", "Autonomous Execution", "Code Generation", "Web Automation", "Long-running Tasks"].map(cap => (
              <span key={cap} className="px-2 py-1 bg-blue-500/10 text-blue-400 text-[10px] font-bold rounded-lg border border-blue-500/20">
                {cap}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={handleTestConnection}
          disabled={status === "TESTING"}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-ink-800 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-600/20"
        >
          {status === "TESTING" ? "Connecting..." : "Test Connection"}
        </button>
      </div>
    </div>
  );
};
