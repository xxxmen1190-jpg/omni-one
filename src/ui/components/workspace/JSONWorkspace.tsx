import React, { useState, useMemo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface JSONWorkspaceProps {
  content: string;
}

const JSONWorkspace: React.FC<JSONWorkspaceProps> = ({ content }) => {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<"formatted" | "raw">("formatted");

  const { json, error, formatted } = useMemo(() => {
    // Extract JSON from code blocks or raw content
    const jsonMatch = content.match(/```json\n?([\s\S]*?)```/) ||
      content.match(/```\n?([\s\S]*?)```/);
    const rawJson = jsonMatch ? jsonMatch[1] : content;

    try {
      const parsed = JSON.parse(rawJson.trim());
      return {
        json: parsed,
        error: null,
        formatted: JSON.stringify(parsed, null, 2),
      };
    } catch (e) {
      return {
        json: null,
        error: e instanceof Error ? e.message : "Invalid JSON",
        formatted: rawJson,
      };
    }
  }, [content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-b-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/50 border-b border-gray-700/50">
        <div className="flex gap-1">
          <button
            onClick={() => setView("formatted")}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              view === "formatted" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Formatted
          </button>
          <button
            onClick={() => setView("raw")}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              view === "raw" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Raw
          </button>
        </div>

        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-red-400">⚠ {error}</span>
          )}
          {json && (
            <span className="text-xs text-gray-500">
              {Array.isArray(json) ? `${json.length} items` : `${Object.keys(json).length} keys`}
            </span>
          )}
          <button
            onClick={handleCopy}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* JSON content */}
      <SyntaxHighlighter
        language="json"
        style={vscDarkPlus}
        customStyle={{ margin: 0, fontSize: "13px", maxHeight: "500px", borderRadius: "0 0 8px 8px" }}
        showLineNumbers
      >
        {view === "formatted" ? formatted : content}
      </SyntaxHighlighter>
    </div>
  );
};

export default JSONWorkspace;
