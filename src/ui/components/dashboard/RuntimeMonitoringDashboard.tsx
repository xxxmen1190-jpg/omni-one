import React, { useState, useEffect } from "react";
import { Logger } from "../../../core/system/Logger";
import { Metrics } from "../../../core/system/Metrics";
import { ToolRegistry } from "../../../core/tools/ToolRegistry";
import { SkillRegistry } from "../../../core/skills/skillRegistry";
import { LogEntry } from "../../../types";

export const RuntimeMonitoringDashboard: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [systemStats, setSystemStats] = useState({
    totalTools: 0,
    totalSkills: 0,
    totalProviders: 0,
    uptime: 0,
  });

  useEffect(() => {
    loadSystemStats();
    loadLogs();
    const interval = setInterval(() => {
      loadLogs();
      loadSystemStats();
    }, 2000); // Refresh every 2 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemStats = () => {
    setSystemStats({
      totalTools: ToolRegistry.getAllTools().length,
      totalSkills: SkillRegistry.getSkill("chat") ? 5 : 0, // Simplified count
      totalProviders: SkillRegistry.getProviders().size,
      uptime: Math.floor((Date.now() - (window as any).startTime || Date.now()) / 1000),
    });
  };

  const loadLogs = () => {
    const recentLogs = Logger.getLogs().slice(-100);
    setLogs(recentLogs);
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case "error":
        return "text-red-600 bg-red-50";
      case "warn":
        return "text-yellow-600 bg-yellow-50";
      case "info":
        return "text-blue-600 bg-blue-50";
      case "debug":
        return "text-gray-600 bg-gray-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  return (
    <div className="runtime-monitoring p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Runtime Monitoring</h2>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Tools</p>
          <p className="text-3xl font-bold text-blue-600">{systemStats.totalTools}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Skills</p>
          <p className="text-3xl font-bold text-green-600">{systemStats.totalSkills}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Total Providers</p>
          <p className="text-3xl font-bold text-purple-600">{systemStats.totalProviders}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Uptime</p>
          <p className="text-lg font-bold text-orange-600">{formatUptime(systemStats.uptime)}</p>
        </div>
      </div>

      {/* Real-time Logs */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Real-time Logs</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-gray-500">No logs available</p>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className={`p-2 rounded ${getLogColor(log.level)}`}>
                <p>
                  <span className="text-xs">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  {" "}
                  <span className="font-bold">[{log.level.toUpperCase()}]</span>
                  {" "}
                  {log.message}
                </p>
                {log.context && (
                  <p className="text-xs opacity-75 mt-1">
                    {JSON.stringify(log.context).substring(0, 100)}...
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
