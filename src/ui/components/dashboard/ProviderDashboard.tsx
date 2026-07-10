import React, { useState, useEffect } from "react";
import { Metrics, ProviderStats } from "../../../core/system/Metrics";
import { ProviderHealth } from "../../../core/system/ProviderHealth";
import { ProviderName } from "../../../types";

export const ProviderDashboard: React.FC = () => {
  const [providerStats, setProviderStats] = useState<Record<ProviderName, ProviderStats>>({} as any);
  const providers: ProviderName[] = ["openai", "anthropic", "gemini", "groq", "openrouter"];

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const loadStats = () => {
    const allStats = Metrics.getAllStats();
    setProviderStats(allStats);
  };

  return (
    <div className="provider-dashboard p-6 bg-ink-50 rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Provider Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {providers.map((provider) => {
          const stats = providerStats[provider];
          const health = ProviderHealth.getStatus(provider);

          return (
            <div key={provider} className="bg-white rounded-lg shadow p-4">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold capitalize">{provider}</h3>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    health === "healthy"
                      ? "bg-green-100 text-green-800"
                      : health === "degraded"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {health.toUpperCase()}
                </span>
              </div>

              {stats ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-ink-600">Requests</span>
                    <span className="font-medium">{stats.requests}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Success Rate</span>
                    <span className="font-medium">{(stats.successRate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Avg Latency</span>
                    <span className="font-medium">{stats.avgLatency.toFixed(0)}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Successes</span>
                    <span className="font-medium">{stats.successes}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-600">Failures</span>
                    <span className="font-medium text-red-600">{stats.failures}</span>
                  </div>
                  {stats.tokens && (
                    <div className="flex justify-between">
                      <span className="text-ink-600">Tokens Used</span>
                      <span className="font-medium">{stats.tokens}</span>
                    </div>
                  )}
                  {stats.cost && (
                    <div className="flex justify-between">
                      <span className="text-ink-600">Estimated Cost</span>
                      <span className="font-medium">${stats.cost.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-ink-500 text-sm">No data available</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
