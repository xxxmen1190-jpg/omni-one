/**
 * Message Component
 * Renders user and assistant messages.
 * For assistant messages: uses SmartWorkspace to auto-detect and render
 * the appropriate workspace (Code, Table, Markdown, Image, JSON, etc.)
 * Falls back to plain markdown rendering for simple text responses.
 */
import React, { Suspense, useState, useCallback } from "react";
import { EnhancedChatMessage } from "../../types/ux";
import TransparencyPanel from "./TransparencyPanel";
import { DocumentGenerator, ExportFormat } from "../../core/export/DocumentGenerator";

// Lazy-load SmartWorkspace to avoid blocking initial render
const SmartWorkspace = React.lazy(() =>
  import("./workspace/SmartWorkspace").then((m) => ({ default: m.SmartWorkspace }))
);

interface MessageProps {
  message: EnhancedChatMessage;
}

// ─── Simple Markdown renderer (no external deps) ──────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <div key={i} className="my-3 rounded-xl overflow-hidden border border-ink-700">
          {lang && (
            <div className="px-3 py-1.5 bg-ink-800 text-[10px] font-mono text-ink-400 uppercase tracking-wider border-b border-ink-700">
              {lang}
            </div>
          )}
          <pre className="bg-ink-900 p-4 overflow-x-auto text-xs font-mono text-ink-200 leading-relaxed">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      i++;
      continue;
    }
    // Headings
    if (line.startsWith("### ")) {
      elements.push(<h3 key={i} className="text-base font-semibold text-ink-100 mt-4 mb-1">{inlineMarkdown(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.startsWith("## ")) {
      elements.push(<h2 key={i} className="text-lg font-bold text-ink-100 mt-5 mb-2">{inlineMarkdown(line.slice(3))}</h2>);
      i++; continue;
    }
    if (line.startsWith("# ")) {
      elements.push(<h1 key={i} className="text-xl font-bold text-ink-100 mt-5 mb-2">{inlineMarkdown(line.slice(2))}</h1>);
      i++; continue;
    }
    // Horizontal rule
    if (line.match(/^[-*_]{3,}$/)) {
      elements.push(<hr key={i} className="border-ink-700 my-3" />);
      i++; continue;
    }
    // Unordered list
    if (line.match(/^[-*+] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={i} className="list-disc list-inside space-y-1 my-2 text-ink-200 text-sm">
          {items.map((item, j) => <li key={j}>{inlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }
    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={i} className="list-decimal list-inside space-y-1 my-2 text-ink-200 text-sm">
          {items.map((item, j) => <li key={j}>{inlineMarkdown(item)}</li>)}
        </ol>
      );
      continue;
    }
    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote key={i} className="border-l-2 border-blue-500 pl-3 my-2 text-ink-400 italic text-sm">
          {inlineMarkdown(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }
    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
      i++; continue;
    }
    // Paragraph
    elements.push(
      <p key={i} className="text-sm text-ink-200 leading-relaxed my-1">
        {inlineMarkdown(line)}
      </p>
    );
    i++;
  }
  return <>{elements}</>;
}

function inlineMarkdown(text: string): React.ReactNode {
  // Bold, italic, inline code, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;
  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (boldMatch) {
      if (boldMatch[1]) parts.push(<span key={key++}>{boldMatch[1]}</span>);
      parts.push(<strong key={key++} className="font-semibold text-ink-100">{boldMatch[2]}</strong>);
      remaining = boldMatch[3];
      continue;
    }
    // Italic *text*
    const italicMatch = remaining.match(/^(.*?)\*(.+?)\*(.*)/s);
    if (italicMatch) {
      if (italicMatch[1]) parts.push(<span key={key++}>{italicMatch[1]}</span>);
      parts.push(<em key={key++} className="italic text-ink-300">{italicMatch[2]}</em>);
      remaining = italicMatch[3];
      continue;
    }
    // Inline code `code`
    const codeMatch = remaining.match(/^(.*?)`(.+?)`(.*)/s);
    if (codeMatch) {
      if (codeMatch[1]) parts.push(<span key={key++}>{codeMatch[1]}</span>);
      parts.push(<code key={key++} className="px-1 py-0.5 rounded bg-ink-800 font-mono text-[11px] text-blue-300">{codeMatch[2]}</code>);
      remaining = codeMatch[3];
      continue;
    }
    // Link [text](url)
    const linkMatch = remaining.match(/^(.*?)\[(.+?)\]\((.+?)\)(.*)/s);
    if (linkMatch) {
      if (linkMatch[1]) parts.push(<span key={key++}>{linkMatch[1]}</span>);
      parts.push(
        <a key={key++} href={linkMatch[3]} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors">
          {linkMatch[2]}
        </a>
      );
      remaining = linkMatch[4];
      continue;
    }
    // No more patterns
    parts.push(<span key={key++}>{remaining}</span>);
    break;
  }
  return <>{parts}</>;
}

// ─── Export Formats ───────────────────────────────────────────────────────────
const EXPORT_FORMATS: Array<{ format: ExportFormat; label: string }> = [
  { format: "pdf", label: "PDF" },
  { format: "docx", label: "Word" },
  { format: "md", label: "Markdown" },
  { format: "txt", label: "Text" },
  { format: "json", label: "JSON" },
  { format: "html", label: "HTML" },
];

// ─── Needs workspace? ─────────────────────────────────────────────────────────
function needsWorkspace(msg: EnhancedChatMessage): boolean {
  if (msg.workspaceType && msg.workspaceType !== "chat") return true;
  if (msg.generatedImages && msg.generatedImages.length > 0) return true;
  // Check content for code blocks, tables, JSON
  const c = msg.content;
  if (c.includes("```") || c.includes("| --- |") || c.startsWith("{") || c.startsWith("[")) return true;
  return false;
}

// ─── Copy to clipboard ───────────────────────────────────────────────────────
function useCopy(text: string) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return { copied, copy };
}

// ─── Message Component ────────────────────────────────────────────────────────
const MessageComponent: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === "user";
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { copied, copy } = useCopy(message.content);

  const handleExport = useCallback(async (format: ExportFormat) => {
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      await DocumentGenerator.download({
        content: message.content,
        format,
        title: `Omni One — ${message.content.slice(0, 50)}`,
        filename: `omni-${message.id}`,
      });
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [message]);

  if (isUser) {
    return (
      <div className="flex flex-col items-end space-y-1">
        <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-none bg-blue-600 text-white shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <span className="text-[10px] text-ink-600 px-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    );
  }

  // Assistant message
  const showWorkspace = needsWorkspace(message);

  return (
    <div className="flex flex-col items-start space-y-1 group">
      <div className="w-full max-w-[95%]">
        {/* Workspace or plain text */}
        {showWorkspace ? (
          <Suspense fallback={
            <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-ink-800 border border-ink-700 text-sm text-ink-400 animate-pulse">
              Rendering...
            </div>
          }>
            <SmartWorkspace
              userMessage=""
              content={message.content}
              imageUrls={message.generatedImages}
              className="rounded-2xl rounded-tl-none border border-ink-700"
            />
          </Suspense>
        ) : (
          <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-ink-800/80 border border-ink-700/60 shadow-sm">
            {renderMarkdown(message.content)}
          </div>
        )}

        {/* Transparency panel */}
        {(message.reasoningTrace || message.executionTimeline || message.sourcesPanel || message.debugMetrics) && (
          <div className="mt-2">
            <TransparencyPanel message={message} />
          </div>
        )}

        {/* Action bar */}
        {message.content && (
          <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Copy */}
            <button
              onClick={copy}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-ink-500 hover:text-ink-200 hover:bg-ink-800 transition-colors"
              title="Copy"
            >
              {copied ? (
                <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {copied ? "Copied!" : "Copy"}
            </button>

            {/* Export */}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={isExporting}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-ink-500 hover:text-ink-200 hover:bg-ink-800 transition-colors disabled:opacity-50"
                title="Export"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {isExporting ? "Exporting..." : "Export"}
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute left-0 top-full mt-1 z-50 bg-ink-800 border border-ink-700 rounded-xl shadow-2xl py-1 min-w-[120px]">
                    {EXPORT_FORMATS.map(({ format, label }) => (
                      <button
                        key={format}
                        onClick={() => handleExport(format)}
                        className="w-full flex items-center px-3 py-2 text-xs text-ink-300 hover:bg-ink-700 hover:text-white transition-colors"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Timestamp */}
            <span className="text-[10px] text-ink-600 ml-auto">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageComponent;
