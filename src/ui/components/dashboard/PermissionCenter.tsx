import React, { useState, useEffect } from "react";
import { PermissionManager } from "../../core/system/PermissionManager";
import { ToolPermission, PermissionGrant } from "../../core/tools/types";
import { AuditLog } from "../../core/system/AuditLog";

export const PermissionCenter: React.FC = () => {
  const [grants, setGrants] = useState<PermissionGrant[]>([]);
  const [auditEntries, setAuditEntries] = useState<any[]>([]);
  const [selectedTool, setSelectedTool] = useState<string>("");

  useEffect(() => {
    loadGrants();
    loadAuditLog();
  }, []);

  const loadGrants = () => {
    if (selectedTool) {
      const toolGrants = PermissionManager.getGrantsForTool(selectedTool);
      setGrants(toolGrants);
    }
  };

  const loadAuditLog = () => {
    const entries = AuditLog.getRecentEntries(50);
    setAuditEntries(entries);
  };

  const handleRevokePermission = (toolId: string, permission: ToolPermission) => {
    PermissionManager.revokePermission(toolId, permission);
    loadGrants();
    loadAuditLog();
  };

  return (
    <div className="permission-center p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold mb-6">Permission Center</h2>

      {/* Permission Grants */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Active Permissions</h3>
        <div className="bg-white rounded-lg shadow p-4">
          {grants.length === 0 ? (
            <p className="text-gray-500">No active permissions</p>
          ) : (
            <div className="space-y-2">
              {grants.map((grant) => (
                <div key={`${grant.toolId}-${grant.permission}`} className="flex justify-between items-center p-3 bg-gray-100 rounded">
                  <div>
                    <p className="font-medium">{grant.toolId}</p>
                    <p className="text-sm text-gray-600">{grant.permission}</p>
                    {grant.expiresAt && (
                      <p className="text-xs text-gray-500">
                        Expires: {new Date(grant.expiresAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRevokePermission(grant.toolId, grant.permission)}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Audit Log */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Audit Log</h3>
        <div className="bg-white rounded-lg shadow p-4 max-h-96 overflow-y-auto">
          {auditEntries.length === 0 ? (
            <p className="text-gray-500">No audit entries</p>
          ) : (
            <div className="space-y-2">
              {auditEntries.map((entry) => (
                <div key={entry.id} className="text-sm p-2 border-b border-gray-200">
                  <p className="font-medium">
                    {entry.action} - {entry.result.toUpperCase()}
                  </p>
                  <p className="text-gray-600">
                    {entry.actor} on {entry.resource}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(entry.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
