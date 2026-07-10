/**
 * Phase 14.6 & 14.7 — Smart Workspace Component
 * Auto-detects and renders the correct workspace for any AI response.
 * Supports: Code, Image, Document, Table, Chart, Markdown, JSON, Chat.
 */

import React, { useState, useEffect, useCallback } from "react";
import { SmartWorkspaceDetector, WorkspaceType } from "../../../core/workspace/SmartWorkspaceDetector";
import { DocumentGenerator, ExportFormat } from "../../../core/export/DocumentGenerator";

// Lazy-loaded workspace sub-components
const CodeWorkspace = React.lazy(() => import("./CodeWorkspace"));
const TableWorkspace = React.lazy(() => import("./TableWorkspace"));
const MarkdownWorkspace = React.lazy(() => import("./MarkdownWorkspace"));
const ImageWorkspace = React.lazy(() => import("./ImageWorkspace"));
const JSONWorkspace = React.lazy(() => import("./JSONWorkspace"));

interface SmartWorkspaceProps {
  userMessage: string;
  content: string;
  imageUrls?: string[];
  onExport?: (format: ExportFormat) => void;
  className?: string;
}

const EXPORT_FORMATS: Array<{ format: ExportFormat; label: string; icon: string }> = [
  { format: "pdf", label: "PDF", icon: "📄" },
  { format: "docx", label: "Word", icon: "📝" },
  { format: "md", label: "Markdown", icon: "📋" },
  { format: "txt", label: "Text", icon: "📃" },
  { format: "json", label: "JSON", icon: "🔧" },
  { format: "csv", label: "CSV", icon: "📊" },
  { format: "html", label: "HTML", icon: "🌐" },
];

export const SmartWorkspace: React.FC<SmartWorkspaceProps> = ({
  userMessage,
  content,
  imageUrls,
  onExport,
  className = "",
}) => {
  const [detection, setDetection] = useState(() =>
    SmartWorkspaceDetector.detect(userMessage, content)
  );
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const newDetection = SmartWorkspaceDetector.detect(userMessage, content);
    setDetection(newDetection);
  }, [userMessage, content]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setIsExporting(true);
      setExportError(null);
      setShowExportMenu(false);
      try {
        await DocumentGenerator.download({
          content,
          format,
          title: userMessage.slice(0, 80),
          filename: `omni-${Date.now()}`,
        });
        onExport?.(format);
      } catch (err) {
        setExportError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setIsExporting(false);
      }
    },
    [content, userMessage, onExport]
  );

  const workspaceLabel: Record<WorkspaceType, string> = {
    code: "Code",
    image: "Image",
    document: "Document",
    table: "Table",
    chart: "Chart",
    markdown: "Preview",
    json: "JSON",
    chat: "",
  };

  const label = workspaceLabel[detection.type];

  return (
    <div className={`smart-workspace relative ${className}`}>
      {/* Workspace header bar */}
      {detection.type !== "chat" && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-ink-900/50 border-b border-ink-700/50 rounded-t-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-400 uppercase tracking-wide">
              {label} Workspace
            </span>
            <span className="text-xs text-ink-600">
              {detection.language ? `· ${detection.language}` : ""}
            </span>
          </div>

          {/* Export button */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isExporting}
              className="flex items-center gap-1 px-2 py-1 text-xs text-ink-400 hover:text-white hover:bg-ink-700 rounded transition-colors"
              title="Export"
            >
              {isExporting ? (
                <span className="animate-spin">⟳</span>
              ) : (
                <span>↓</span>
              )}
              <span>Export</span>
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-ink-800 border border-ink-700 rounded-lg shadow-xl min-w-[140px]">
                {EXPORT_FORMATS.map(({ format, label: fLabel, icon }) => (
                  <button
                    key={format}
                    onClick={() => handleExport(format)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-300 hover:bg-ink-700 hover:text-white transition-colors first:rounded-t-lg last:rounded-b-lg"
                  >
                    <span>{icon}</span>
                    <span>{fLabel}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Export error */}
      {exportError && (
        <div className="px-3 py-2 bg-red-900/30 border-b border-red-700/50 text-xs text-red-400">
          Export failed: {exportError}
        </div>
      )}

      {/* Workspace content */}
      <React.Suspense
        fallback={
          <div className="p-4 text-ink-500 text-sm animate-pulse">Loading workspace...</div>
        }
      >
        {renderWorkspace(detection.type, content, imageUrls, detection.language)}
      </React.Suspense>

      {/* Click outside to close export menu */}
      {showExportMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowExportMenu(false)}
        />
      )}
    </div>
  );
};

function renderWorkspace(
  type: WorkspaceType,
  content: string,
  imageUrls?: string[],
  language?: string
): React.ReactNode {
  switch (type) {
    case "code":
      return <CodeWorkspace content={content} language={language} />;
    case "table":
      return <TableWorkspace content={content} />;
    case "image":
      return <ImageWorkspace content={content} imageUrls={imageUrls} />;
    case "json":
      return <JSONWorkspace content={content} />;
    case "markdown":
    case "document":
      return <MarkdownWorkspace content={content} />;
    case "chart":
      return <TableWorkspace content={content} showChart />;
    case "chat":
    default:
      return <MarkdownWorkspace content={content} minimal />;
  }
}

export default SmartWorkspace;
