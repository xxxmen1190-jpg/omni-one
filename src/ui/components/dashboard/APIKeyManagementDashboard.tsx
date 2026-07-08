import React, { useState, useEffect } from "react";
import { APIKeyManager, APIKeyEntry } from "../../core/system/APIKeyManager";

export const APIKeyManagementDashboard: React.FC = () => {
  const [keys, setKeys] = useState<APIKeyEntry[]>([]);
  const [provider, setProvider] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [showForm, setShowForm] = useState<boolean>(false);

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = () => {
    const allKeys = APIKeyManager.getAllKeyMetadata();
    setKeys(allKeys);
  };

  const handleAddKey = () => {
    if (!provider || !apiKey) {
      alert("Please fill in all fields");
      return;
    }
    APIKeyManager.addKey(provider, apiKey);
    setProvider("");
    setApiKey("");
    setShowForm(false);
    loadKeys();
  };

  const handleRotateKey = (keyId: string) => {
    const newKey = prompt("Enter new API key:");
    if (newKey) {
      APIKeyManager.rotateKey(keyId, newKey);
      loadKeys();
    }
  };

  const handleRevokeKey = (keyId: string) => {
    if (confirm("Are you sure you want to revoke this key?")) {
      APIKeyManager.revokeKey(keyId);
      loadKeys();
    }
  };

  const providers = ["openai", "anthropic", "gemini", "groq", "openrouter", "github", "search"];

  return (
    <div className="api-key-management p-6 bg-gray-50 rounded-lg">
      <h2 className="text-2xl font-bold mb-6">API Key Management</h2>

      {/* Add Key Form */}
      <div className="mb-6">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add New Key
          </button>
        ) : (
          <div className="bg-white rounded-lg shadow p-4 max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add API Key</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                >
                  <option value="">Select Provider</option>
                  {providers.map((p) => (
                    <option key={p} value={p}>
                      {p.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddKey}
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Add
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keys List */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Stored Keys</h3>
        {keys.length === 0 ? (
          <p className="text-gray-500">No API keys stored</p>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div key={key.id} className="p-3 border border-gray-200 rounded">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{key.provider.toUpperCase()}</p>
                    <p className="text-sm text-gray-600">Key: {key.keyPrefix}****</p>
                    <p className="text-xs text-gray-500">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                    {key.lastUsed && (
                      <p className="text-xs text-gray-500">
                        Last used: {new Date(key.lastUsed).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRotateKey(key.id)}
                      className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                    >
                      Rotate
                    </button>
                    <button
                      onClick={() => handleRevokeKey(key.id)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
                <div className="text-xs">
                  <span className={`px-2 py-1 rounded ${key.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    {key.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
