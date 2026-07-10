import React from "react";
import useChatStore from "../../store/useChatStore";

const ControlPanel: React.FC = () => {
  const { uiConfig, updateUIConfig } = useChatStore();

  return (
    <div className="p-4 bg-ink-800 rounded-xl border border-ink-700 space-y-4">
      <h3 className="text-sm font-bold text-ink-400 uppercase tracking-wider">Control Panel</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={uiConfig.enableWebSearch}
              onChange={(e) => updateUIConfig({ enableWebSearch: e.target.checked })}
              className="rounded border-ink-600 bg-ink-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-ink-300">Web Search</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={uiConfig.enableAgents}
              onChange={(e) => updateUIConfig({ enableAgents: e.target.checked })}
              className="rounded border-ink-600 bg-ink-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-ink-300">Agents</span>
          </label>
          
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={uiConfig.enableMemory}
              onChange={(e) => updateUIConfig({ enableMemory: e.target.checked })}
              className="rounded border-ink-600 bg-ink-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-ink-300">Memory</span>
          </label>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-ink-400">
              <span>Max Depth</span>
              <span>{uiConfig.maxDepth}</span>
            </div>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={uiConfig.maxDepth}
              onChange={(e) => updateUIConfig({ maxDepth: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-ink-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-ink-400">
              <span>Speed</span>
              <span>Accuracy</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={uiConfig.speedVsAccuracy}
              onChange={(e) => updateUIConfig({ speedVsAccuracy: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-ink-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
