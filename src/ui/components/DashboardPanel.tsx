/**
 * Dashboard Panel
 * Accessible from the Chat header — exposes all system dashboards:
 * API Keys, Providers, Tools, Runtime Monitoring, Permissions
 */
import React, { useState, Suspense } from "react";

// Lazy-load all dashboards
const APIKeyManagementDashboard = React.lazy(() =>
  import("./dashboard/APIKeyManagementDashboard").then((m) => ({ default: m.APIKeyManagementDashboard }))
);
const ProviderDashboard = React.lazy(() =>
  import("./dashboard/ProviderDashboard").then((m) => ({ default: m.ProviderDashboard }))
);
const ToolsManagementDashboard = React.lazy(() =>
  import("./dashboard/ToolsManagementDashboard").then((m) => ({ default: m.ToolsManagementDashboard }))
);
const RuntimeMonitoringDashboard = React.lazy(() =>
  import("./dashboard/RuntimeMonitoringDashboard").then((m) => ({ default: m.RuntimeMonitoringDashboard }))
);
const PermissionCenter = React.lazy(() =>
  import("./dashboard/PermissionCenter").then((m) => ({ default: m.PermissionCenter }))
);

type DashboardTab = "apikeys" | "providers" | "tools" | "runtime" | "permissions";

const TABS: Array<{ id: DashboardTab; label: string; icon: string }> = [
  { id: "apikeys", label: "API Keys", icon: "🔑" },
  { id: "providers", label: "Providers", icon: "🤖" },
  { id: "tools", label: "Tools", icon: "🔧" },
  { id: "runtime", label: "Runtime", icon: "📊" },
  { id: "permissions", label: "Permissions", icon: "🛡️" },
];

interface DashboardPanelProps {
  onClose: () => void;
}

const DashboardPanel: React.FC<DashboardPanelProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>("apikeys");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-5xl h-[85vh] bg-ink-900 border border-ink-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-800">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-ink-100">System Dashboards</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-ink-800 text-ink-500 uppercase tracking-wider">Admin</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-ink-800 text-ink-400 hover:text-ink-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 py-2 border-b border-ink-800 bg-ink-900/60">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white"
                  : "text-ink-400 hover:text-ink-200 hover:bg-ink-800"
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.3s]" />
              </div>
            </div>
          }>
            {activeTab === "apikeys" && <APIKeyManagementDashboard />}
            {activeTab === "providers" && <ProviderDashboard />}
            {activeTab === "tools" && <ToolsManagementDashboard />}
            {activeTab === "runtime" && <RuntimeMonitoringDashboard />}
            {activeTab === "permissions" && <PermissionCenter />}
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default DashboardPanel;
