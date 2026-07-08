import React, { useState, useEffect } from "react";
import { ToolRegistry } from "../../core/tools/ToolRegistry";
import { ToolDiscovery } from "../../core/tools/ToolDiscovery";
import { Metrics } from "../../core/system/Metrics";
import { ITool } from "../../core/tools/types";

export const ToolsManagementDashboard: React.FC = () => {
  const [tools, setTools] = useState<ITool[]>([]);
  const [selectedTool, setSelectedTool] = useState<ITool | null>(null);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = () => {
    const allTools = ToolRegistry.getAllTools();
    setTools(allTools);
  };

  const handleTestTool = async (tool: ITool) => {
    // Simple test execution
    try {
      const result = await tool.execute({ test: true });
      alert(`Tool test result: ${JSON.stringify(result)}`);
    } catch (error: any) {
      alert(`Tool test failed: ${error.message}`);
    }
  };

  return (
    <div className="tools-management p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Tools Management</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tools List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">Installed Tools</h3>
            {tools.length === 0 ? (
              <p className="text-gray-500">No tools installed</p>
            ) : (
              <div className="space-y-2">
                {tools.map((tool) => (
                  <div
                    key={tool.id}
                    onClick={() => setSelectedTool(tool)}
                    className={`p-3 rounded cursor-pointer transition ${
                      selectedTool?.id === tool.id
                        ? "bg-blue-100 border-2 border-blue-500"
                        : "bg-gray-100 hover:bg-gray-200"
                    }`}
                  >
                    <p className="font-medium">{tool.name}</p>
                    <p className="text-sm text-gray-600">{tool.description}</p>
                    <p className="text-xs text-gray-500">v{tool.version}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tool Details */}
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-lg font-semibold mb-4">Tool Details</h3>
          {selectedTool ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-medium">{selectedTool.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">ID</p>
                <p className="font-mono text-sm">{selectedTool.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Capabilities</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedTool.capabilities.map((cap) => (
                    <span key={cap} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tool Metrics */}
              {(() => {
                const stats = Metrics.getToolStats(selectedTool.id);
                return stats ? (
                  <div>
                    <p className="text-sm text-gray-600">Metrics</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>Executions: {stats.executions}</p>
                      <p>Success Rate: {(stats.successRate * 100).toFixed(1)}%</p>
                      <p>Avg Duration: {stats.avgDuration.toFixed(0)}ms</p>
                    </div>
                  </div>
                ) : null;
              })()}

              <button
                onClick={() => handleTestTool(selectedTool)}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
              >
                Test Tool
              </button>
            </div>
          ) : (
            <p className="text-gray-500">Select a tool to view details</p>
          )}
        </div>
      </div>
    </div>
  );
};
