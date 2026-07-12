/**
 * Chat Component — Omni One Frontend
 *
 * Phase 20.6 — Unified AI Gateway Integration
 *
 * All requests flow through:
 *   Frontend → Backend API (/unified-chat) → OmniBrain → SmartProviderSelector
 *   → Manus | Claude | OpenAI | Gemini | Groq | Mistral | DeepSeek
 *   → Response → Frontend
 *
 * Pro Mode: Shows provider selection metadata (provider, reason, confidence,
 *           execution time, task analysis, endpoints called).
 *
 * Fixes applied (Phase 20.6):
 *   - URL: /unified-chat (not /api/unified-chat — base already includes /api)
 *   - Response: apiClient.post<T> returns T directly (not {success, data})
 *   - Timeout: 600 000 ms for long-running Manus tasks
 *   - Manus API key forwarded via VITE_MANUS_API_KEY env var
 *   - Fallback info shown in Pro Mode when primary provider fails
 */

import React, { useState, useRef, useEffect, useCallback, Suspense } from "react";
const DashboardPanel = React.lazy(() => import("./DashboardPanel"));
import useChatStore from "../../store/useChatStore";
import MessageComponent from "./Message";
import { EnhancedChatMessage } from "../../types/ux";
import { ChatAttachments, AttachedFile, DropZoneWrapper, useClipboardPaste } from "./ChatAttachments";
import { VoiceButton } from "./VoiceButton";
import { SmartWorkspaceDetector } from "../../core/workspace/SmartWorkspaceDetector";
import { apiClient } from "../../lib/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaskAnalysis {
  type: string;
  complexity: string;
  requiresManus: boolean;
  estimatedDuration: string;
}

interface ProviderMetadata {
  provider: string;
  model: string;
  reason: string;
  confidence: number;
  durationMs: number;
  taskAnalysis?: TaskAnalysis;
  fallbackProviders?: string[];
  endpointsCalled?: string[];
}

/** Shape returned by POST /unified-chat (already unwrapped from ApiSuccessResponse by apiClient) */
interface UnifiedChatResponse {
  content: string;
  conversationId: string;
  provider: string;
  model: string;
  reason: string;
  confidence: number;
  durationMs: number;
  taskAnalysis?: TaskAnalysis;
  fallbackProviders?: string[];
  endpointsCalled?: string[];
}

interface ChatProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const Chat: React.FC<ChatProps> = ({ sidebarOpen, onToggleSidebar }) => {
  const {
    messages,
    addMessage,
    updateLastMessage,
    isLoading,
    setLoading,
    isStreaming,
    setStreaming,
    setAbortController,
    agentProgress,
    setAgentProgress,
    displayMode,
    setDisplayMode,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [showDashboard, setShowDashboard] = useState(false);
  const [proBrainMode, setProBrainMode] = useState(false);
  const [providerMetadata, setProviderMetadata] = useState<ProviderMetadata | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleFilesAdded = useCallback(async (files: File[]) => {
    const newAttachments: AttachedFile[] = files.map((file) => ({
      id: `attach-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      status: "parsing" as const,
      preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);

    // Mark as ready (file parsing happens server-side)
    setAttachments((prev) =>
      prev.map((a) =>
        newAttachments.some((na) => na.id === a.id) ? { ...a, status: "ready" as const } : a
      )
    );
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  useClipboardPaste(
    useCallback((files: File[]) => {
      handleFilesAdded(files);
    }, [handleFilesAdded]),
    !isLoading
  );

  const handleVoiceTranscription = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const hasContent = input.trim() || attachments.length > 0;
    if (!hasContent || isLoading) return;

    const userContent = input.trim();
    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);
    setProviderMetadata(null);

    const attachmentNames = currentAttachments.map((a) => a.file.name).join(", ");
    const displayContent = userContent
      ? attachmentNames
        ? `${userContent}\n\n📎 *${attachmentNames}*`
        : userContent
      : `📎 *${attachmentNames}*`;

    addMessage({ role: "user", content: displayContent });
    setLoading(true);
    const controller = new AbortController();
    setAbortController(controller);
    addMessage({ role: "assistant", content: "" });
    setStreaming(true);

    try {
      // ── Unified AI Gateway ─────────────────────────────────────────────────
      // Flow: Frontend → /unified-chat → OmniBrain → SmartProviderSelector
      //       → Manus | Claude | OpenAI | Gemini | Groq → Response
      //
      // NOTE: apiClient base is already http://host/api, so path is /unified-chat
      //       (not /api/unified-chat which would double the prefix).
      //
      // Timeout is 10 minutes to accommodate long-running Manus autonomous tasks.
      const data = await apiClient.post<UnifiedChatResponse>(
        "/unified-chat",
        {
          message: userContent || "Please analyze these files.",
          conversationId: `conv-${Date.now()}`,
          proBrainMode,
          // Forward Manus API key so backend can use it even if not set in server env
          manusApiKey: (import.meta.env.VITE_MANUS_API_KEY as string | undefined) || undefined,
        },
        {
          signal: controller.signal,
          timeoutMs: 600_000, // 10 minutes — Manus tasks can take several minutes
        }
      );

      // Store provider metadata for Pro Mode display
      if (proBrainMode) {
        setProviderMetadata({
          provider: data.provider,
          model: data.model,
          reason: data.reason,
          confidence: data.confidence,
          durationMs: data.durationMs,
          taskAnalysis: data.taskAnalysis,
          fallbackProviders: data.fallbackProviders,
          endpointsCalled: data.endpointsCalled,
        });
      }

      // Detect workspace type for smart rendering
      const detection = SmartWorkspaceDetector.detect(userContent, data.content);
      updateLastMessage(data.content, {
        workspaceType: detection.type,
        workspaceLanguage: detection.language,
        provider: data.provider,
        model: data.model,
      });

      setStreaming(false);
      setLoading(false);
      setAbortController(null);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      updateLastMessage(`⚠️ Error: ${errorMsg}`);
      setStreaming(false);
      setLoading(false);
      setAbortController(null);
    }
  }, [input, attachments, isLoading, addMessage, updateLastMessage, setLoading, setStreaming, setAbortController, proBrainMode]);

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isLoading;

  // ─── Provider badge colour ──────────────────────────────────────────────────
  const providerBadgeClass = (provider: string) => {
    const map: Record<string, string> = {
      manus: "bg-purple-900/40 border-purple-500/40 text-purple-300",
      claude: "bg-orange-900/40 border-orange-500/40 text-orange-300",
      openai: "bg-green-900/40 border-green-500/40 text-green-300",
      gemini: "bg-blue-900/40 border-blue-500/40 text-blue-300",
      groq: "bg-yellow-900/40 border-yellow-500/40 text-yellow-300",
      openrouter: "bg-pink-900/40 border-pink-500/40 text-pink-300",
    };
    return map[provider.toLowerCase()] ?? "bg-ink-800 border-ink-600 text-ink-300";
  };

  return (
    <DropZoneWrapper onFilesAdded={handleFilesAdded} disabled={isLoading}>
      <div className="flex flex-col h-full">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-ink-800/80 bg-ink-900/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={onToggleSidebar}
                aria-label="Open sidebar"
                className="p-1.5 rounded-lg hover:bg-ink-800 text-ink-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-200">Chat</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-800 text-ink-500 uppercase tracking-wider">{displayMode}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Pro Brain Mode Toggle */}
            <button
              onClick={() => setProBrainMode(!proBrainMode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                proBrainMode
                  ? "bg-blue-900/30 border-blue-500/50 text-blue-300"
                  : "text-ink-400 hover:text-ink-200 hover:bg-ink-800 border-ink-700/50"
              }`}
              title={proBrainMode ? "Pro Brain Mode: ON — showing provider metadata" : "Pro Brain Mode: OFF"}
              aria-label="Toggle Pro Brain Mode"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pro
            </button>
            <button
              onClick={() => setShowDashboard(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-ink-400 hover:text-ink-200 hover:bg-ink-800 border border-ink-700/50 transition-colors"
              title="System Dashboards"
              aria-label="Open system dashboards"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
              </svg>
              Dashboards
            </button>
          </div>
        </header>

        {showDashboard && (
          <Suspense fallback={null}>
            <DashboardPanel onClose={() => setShowDashboard(false)} />
          </Suspense>
        )}

        {/* ── Messages ───────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 scrollbar-thin">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 animate-in fade-in duration-700">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-blue-900/30 mb-5 animate-in scale-in duration-500">
                  O
                </div>
                <h2 className="text-2xl font-bold text-ink-100 mb-2">Welcome to Omni One</h2>
                <p className="text-ink-400 max-w-md">
                  Unified AI Gateway — every message is routed through OmniBrain to the best provider automatically.
                </p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {[
                    "🤖 Smart Provider Selection",
                    "🧠 Manus for Complex Tasks",
                    "⚡ Claude for Reasoning",
                    "🎯 GPT-4o for General",
                    "📊 Analyze Data",
                    "💻 Write Code",
                  ].map((hint) => (
                    <span key={hint} className="text-xs px-3 py-1.5 rounded-full bg-ink-800 text-ink-400 border border-ink-700">
                      {hint}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id}>
                <MessageComponent message={{ ...m, displayMode } as EnhancedChatMessage} />
              </div>
            ))}

            {/* ── Pro Mode: Provider Metadata Panel ──────────────────────────── */}
            {proBrainMode && providerMetadata && (
              <div className={`border rounded-xl p-4 mt-4 text-xs space-y-3 ${providerBadgeClass(providerMetadata.provider)}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">🧠 OmniBrain — Provider Selection</span>
                  <span className="font-mono opacity-70">{providerMetadata.durationMs.toLocaleString()} ms</span>
                </div>

                {/* Primary info grid */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div>
                    <span className="opacity-60">Provider</span>
                    <div className="font-semibold capitalize">{providerMetadata.provider}</div>
                  </div>
                  <div>
                    <span className="opacity-60">Model</span>
                    <div className="font-mono">{providerMetadata.model}</div>
                  </div>
                  <div>
                    <span className="opacity-60">Confidence</span>
                    <div className="font-semibold">{(providerMetadata.confidence * 100).toFixed(0)}%</div>
                  </div>
                  <div>
                    <span className="opacity-60">Execution Time</span>
                    <div className="font-mono">{providerMetadata.durationMs.toLocaleString()} ms</div>
                  </div>
                </div>

                {/* Reason */}
                <div className="p-2 rounded-lg bg-black/20">
                  <span className="opacity-60">Why this provider: </span>
                  <span>{providerMetadata.reason}</span>
                </div>

                {/* Task Analysis */}
                {providerMetadata.taskAnalysis && (
                  <div className="p-2 rounded-lg bg-black/20 space-y-1">
                    <div className="opacity-60 font-semibold">Task Analysis</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div><span className="opacity-60">Type: </span>{providerMetadata.taskAnalysis.type}</div>
                      <div><span className="opacity-60">Complexity: </span>{providerMetadata.taskAnalysis.complexity}</div>
                      <div><span className="opacity-60">Requires Manus: </span>{providerMetadata.taskAnalysis.requiresManus ? "Yes" : "No"}</div>
                      <div><span className="opacity-60">Est. Duration: </span>{providerMetadata.taskAnalysis.estimatedDuration}</div>
                    </div>
                  </div>
                )}

                {/* Fallback providers */}
                {providerMetadata.fallbackProviders && providerMetadata.fallbackProviders.length > 0 && (
                  <div>
                    <span className="opacity-60">Fallback chain: </span>
                    {providerMetadata.fallbackProviders.map((p) => (
                      <span key={p} className="inline-block mr-1 px-1.5 py-0.5 rounded bg-black/20 font-mono capitalize">{p}</span>
                    ))}
                  </div>
                )}

                {/* Manus endpoints */}
                {providerMetadata.endpointsCalled && providerMetadata.endpointsCalled.length > 0 && (
                  <div className="p-2 rounded-lg bg-black/20">
                    <div className="opacity-60 font-semibold mb-1">Manus Endpoints Called</div>
                    {providerMetadata.endpointsCalled.map((ep) => (
                      <div key={ep} className="font-mono text-[10px] opacity-80">{ep}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ── Input Area ─────────────────────────────────────────────────────── */}
        <div className="px-4 md:px-8 pb-5 pt-2">
          <div className="max-w-3xl mx-auto">
            {agentProgress && (
              <div className="mb-3 bg-ink-800/60 border border-ink-700 p-3 rounded-xl animate-in slide-in-from-bottom-2 duration-300">
                <div className="text-xs text-ink-300 font-mono">{agentProgress}</div>
              </div>
            )}

            <ChatAttachments attachments={attachments} onRemove={handleRemoveAttachment} />

            <div className="flex gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask anything... (Shift+Enter for new line)"
                className="flex-1 px-4 py-3 rounded-lg bg-ink-800 border border-ink-700 text-ink-100 placeholder-ink-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none max-h-32"
                disabled={isLoading}
              />
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 rounded-lg bg-ink-800 hover:bg-ink-700 text-ink-400 hover:text-ink-200 border border-ink-700 transition-colors disabled:opacity-50"
                  disabled={isLoading}
                  title="Attach file"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                <VoiceButton onTranscription={handleVoiceTranscription} disabled={isLoading} />
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="p-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white border border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Send message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9-7-9-7-9 7 9 7z" />
                  </svg>
                </button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" multiple hidden onChange={(e) => handleFilesAdded(Array.from(e.target.files || []))} />
          </div>
        </div>
      </div>
    </DropZoneWrapper>
  );
};

export default Chat;
