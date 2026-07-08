import React from "react";
import { EnhancedChatMessage } from "../../types/ux";

interface TransparencyPanelProps {
  message: EnhancedChatMessage;
}

const TransparencyPanel: React.FC<TransparencyPanelProps> = ({ message }) => {
  // In Simple Mode, hide all transparency panels - CRITICAL for clean UX
  if (message.displayMode === "simple") return null;

  const { reasoningTrace, executionTimeline, sourcesPanel, confidenceScore } = message;
  
  // Determine what to show based on mode
  const isProMode = message.displayMode === "pro";
  const isResearchMode = message.displayMode === "research";
  const isAgentMode = message.displayMode === "agent";

  return (
    <div className="mt-4 pt-4 border-t border-gray-700 space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
      {/* Smart Explanation Layer - Always show in Pro/Research/Agent modes */}
      <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
            <span>🧠</span> {isResearchMode ? "Research Strategy" : isAgentMode ? "Agent Plan" : "Strategy Rationale"}
          </h4>
          {confidenceScore && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Confidence</span>
              <div className="w-16 bg-gray-700 rounded-full h-1.5">
                <div 
                  className={`h-1.5 rounded-full transition-all ${confidenceScore > 0.8 ? 'bg-green-500' : confidenceScore > 0.5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${confidenceScore * 100}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono">{(confidenceScore * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
        <p className="text-sm text-blue-100 leading-relaxed italic">
          {reasoningTrace?.finalConclusion || "Analyzing the best path to provide an accurate and comprehensive answer."}
        </p>
      </div>

      {/* Decision Transparency Panel - Show in Pro and Agent modes */}
      {(isProMode || isAgentMode) && reasoningTrace && reasoningTrace.steps.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
            {isAgentMode ? "Agent Reasoning" : "Thinking Process"}
          </h4>
          <div className="space-y-2">
            {reasoningTrace.steps.map((step, idx) => (
              <div key={idx} className="bg-gray-800/40 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-colors">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-700 text-[10px] flex items-center justify-center text-gray-400 font-bold">
                    {step.step}
                  </span>
                  <div className="space-y-1 flex-1">
                    <div className="text-xs font-bold text-gray-300">{step.title}</div>
                    <div className="text-xs text-gray-400 leading-relaxed">{step.reasoning}</div>
                    {step.decision && (
                      <div className="mt-1 text-[10px] inline-flex items-center px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-800/30">
                        Decision: {step.decision}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Execution Timeline / Replay View - Show in all modes except Simple */}
      {executionTimeline && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Execution Flow</h4>
            <button className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-tighter transition-colors">
              ▶ Replay
            </button>
          </div>
          <div className="relative pl-4 border-l-2 border-gray-800 space-y-3">
            {executionTimeline.stages.map((stage, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-gray-900 border-2 border-gray-700"></div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-300 flex items-center gap-2">
                    <span>{stage.icon}</span> {stage.displayName}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">{stage.duration}ms</span>
                </div>
                {stage.details && <p className="text-[10px] text-gray-500 mt-0.5">{stage.details}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources Panel - Show in Research and Pro modes */}
      {(isProMode || isResearchMode) && sourcesPanel && sourcesPanel.totalSources > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Knowledge Sources</h4>
          <div className="flex flex-wrap gap-2">
            {sourcesPanel.documents.map((s, idx) => (
              <div key={idx} className="px-2 py-1 bg-gray-800 rounded border border-gray-700 text-[10px] text-gray-300 flex items-center gap-1.5 hover:border-gray-600 transition-colors cursor-pointer">
                <span className="text-blue-400">📄</span> {s.title}
              </div>
            ))}
            {sourcesPanel.memories.map((s, idx) => (
              <div key={idx} className="px-2 py-1 bg-purple-900/20 rounded border border-purple-800/30 text-[10px] text-purple-300 flex items-center gap-1.5 hover:border-purple-700/50 transition-colors cursor-pointer">
                <span className="text-purple-400">🧠</span> {s.title}
              </div>
            ))}
            {sourcesPanel.tools.map((s, idx) => (
              <div key={idx} className="px-2 py-1 bg-green-900/20 rounded border border-green-800/30 text-[10px] text-green-300 flex items-center gap-1.5 hover:border-green-700/50 transition-colors cursor-pointer">
                <span className="text-green-400">🛠️</span> {s.title}
              </div>
            ))}
            {sourcesPanel.agents.map((s, idx) => (
              <div key={idx} className="px-2 py-1 bg-orange-900/20 rounded border border-orange-800/30 text-[10px] text-orange-300 flex items-center gap-1.5 hover:border-orange-700/50 transition-colors cursor-pointer">
                <span className="text-orange-400">🤖</span> {s.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransparencyPanel;
