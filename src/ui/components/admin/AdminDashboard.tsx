/**
 * AdminDashboard — Omni One Frontend
 * 
 * Central management interface for administrators.
 */

import React, { useState, useEffect } from "react";
import { DashboardSkeleton } from "../loading/Skeletons";

interface SystemStats {
  system: {
    memoryPercent: number;
    activeRequests: number;
    uptimeMs: number;
    errorRate: number;
  };
  ai: {
    totalRequests: number;
    estimatedCostUSD: number;
    successRate: number;
  };
  activity: {
    uniqueUsers: number;
    recentLogins: number;
  };
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/metrics");
        const data = await res.json();
        setStats(data.data);
      } catch (err) {
        console.error("Failed to fetch admin stats", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <DashboardSkeleton />;
  if (!stats) return <div className="p-6 text-red-400">Failed to load system metrics.</div>;

  return (
    <div className="p-6 space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink-100">Admin Command Center</h1>
          <p className="text-sm text-ink-500">Real-time system health and beta performance</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-green-500/10 text-green-400 text-xs font-medium rounded-full border border-green-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            System Operational
          </span>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Memory Usage" 
          value={`${stats.system.memoryPercent}%`} 
          trend={stats.system.memoryPercent > 80 ? "High" : "Normal"}
          color={stats.system.memoryPercent > 80 ? "red" : "blue"}
        />
        <StatCard 
          title="Active Requests" 
          value={stats.system.activeRequests.toString()} 
          trend="Real-time"
          color="indigo"
        />
        <StatCard 
          title="AI Cost (Last 60m)" 
          value={`$${stats.ai.estimatedCostUSD.toFixed(4)}`} 
          trend={`${stats.ai.totalRequests} reqs`}
          color="emerald"
        />
        <StatCard 
          title="Success Rate" 
          value={`${(stats.ai.successRate * 100).toFixed(1)}%`} 
          trend={stats.system.errorRate > 0.05 ? "Alert" : "Stable"}
          color={stats.ai.successRate < 0.95 ? "red" : "green"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Users */}
        <div className="lg:col-span-2 bg-ink-900 border border-ink-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-300 mb-4">Beta User Activity</h3>
          <div className="flex items-center gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-ink-100">{stats.activity.uniqueUsers}</p>
              <p className="text-[10px] text-ink-500 uppercase tracking-wider">Unique Users (1h)</p>
            </div>
            <div className="h-12 w-px bg-ink-800" />
            <div className="text-center">
              <p className="text-3xl font-bold text-ink-100">{stats.activity.recentLogins}</p>
              <p className="text-[10px] text-ink-500 uppercase tracking-wider">Recent Logins</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-ink-900 border border-ink-800 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-ink-300 mb-4">Admin Actions</h3>
          <div className="space-y-2">
            <button className="w-full py-2 px-3 bg-ink-800 hover:bg-ink-700 text-ink-200 text-xs font-medium rounded-xl border border-ink-700 transition-colors text-left flex items-center justify-between">
              Generate Invite Code
              <svg className="w-4 h-4 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button className="w-full py-2 px-3 bg-ink-800 hover:bg-ink-700 text-ink-200 text-xs font-medium rounded-xl border border-ink-700 transition-colors text-left flex items-center justify-between">
              Manage Feature Flags
              <svg className="w-4 h-4 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; trend: string; color: string }> = ({ title, value, trend, color }) => {
  const colors: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    green: "text-green-400 bg-green-500/10 border-green-500/20",
    red: "text-red-400 bg-red-500/10 border-red-500/20",
  };

  return (
    <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5 space-y-1">
      <p className="text-[10px] text-ink-500 uppercase font-semibold tracking-wider">{title}</p>
      <div className="flex items-baseline justify-between">
        <h4 className="text-2xl font-bold text-ink-100">{value}</h4>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-md border ${colors[color] || colors.blue}`}>
          {trend}
        </span>
      </div>
    </div>
  );
};
