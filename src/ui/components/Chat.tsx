import React, { useState, useRef, useEffect, useCallback } from "react";
import useChatStore from "../../store/useChatStore";
import { AIOrchestrator } from "../../core/ai/orchestrator";
import { SkillRegistry } from "../../core/skills/skillRegistry";
import { AgentManager } from "../../core/ai/AgentManager";
import MessageComponent from "./Message";
import { EnhancedChatMessage } from "../../types/ux";
import { ChatAttachments, AttachedFile, DropZoneWrapper, useClipboardPaste } from "./ChatAttachments";
import { VoiceButton } from "./VoiceButton";
import { Phase14Integration } from "../../core/brain/Phase14Integration";
import { SmartWorkspaceDetector } from "../../core/workspace/SmartWorkspaceDetector";
import { DocumentGenerator, ExportFormat } from "../../core/export/DocumentGenerator";

const API_KEYS = {
  openai: import.meta.env.VITE_OPENAI_API_KEY ?? "",
  anthropic: import.meta.env.VITE_ANTHROPIC_API_KEY ?? "",
  gemini: import.meta.env.VITE_GEMINI_API_KEY ?? "",
  groq: import.meta.env.VITE_GROQ_API_KEY ?? "",
  openrouter: import.meta.env.VITE_OPENROUTER_API_KEY ?? "",
};

interface ChatProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
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

const Chat: React.FC<ChatProps> = ({ sidebarOpen, onToggleSidebar }) => {
  const {
    messages, addMessage, updateLastMessage,
    isLoading, setLoading,
    isStreaming, setStreaming,
    setAbortController, stopGenerating,
    agentProgress, setAgentProgress,
    displayMode, setDisplayMode,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [showExportMenu, setShowExportMenu] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const orchestratorRef = useRef<AIOrchestrator | null>(null);

  useEffect(() => {
    SkillRegistry.initialize(API_KEYS);
    orchestratorRef.current = new AIOrchestrator(API_KEYS);
    const unsubscribe = AgentManager.onProgress((progress) => setAgentProgress(progress));
    return () => { if (typeof unsubscribe === "function") unsubscribe(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

    const { FileIntelligence } = await import("../../core/files/FileIntelligence");
    const processed = await Promise.all(
      files.map(async (file, i) => {
        try {
          const parsed = await FileIntelligence.parseFile(file);
          return { ...newAttachments[i], parsed, status: "ready" as const };
        } catch (err) {
          return { ...newAttachments[i], status: "error" as const, error: err instanceof Error ? err.message : "Parse failed" };
        }
      })
    );
    setAttachments((prev) => {
      const existingIds = new Set(newAttachments.map((a) => a.id));
      return [...prev.filter((a) => !existingIds.has(a.id)), ...processed];
    });
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  useClipboardPaste(
    useCallback((files: File[]) => { handleFilesAdded(files); }, [handleFilesAdded]),
    !isLoading
  );

  const handleVoiceTranscription = useCallback((text: string) => {
    setInput((prev) => (prev ? `${prev} ${text}` : text));
    textareaRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const hasContent = input.trim() || attachments.length > 0;
    if (!hasContent || isLoading || !orchestratorRef.current) return;

    const userContent = input.trim();
    const currentAttachments = [...attachments];
    setInput("");
    setAttachments([]);

    const attachmentNames = currentAttachments.map((a) => a.file.name).join(", ");
    const displayContent = userContent
      ? attachmentNames ? `${userContent}\n\n📎 *${attachmentNames}*` : userContent
      : `📎 *${attachmentNames}*`;

    addMessage({ role: "user", content: displayContent });
    setLoading(true);
    const controller = new AbortController();
    setAbortController(controller);
    addMessage({ role: "assistant", content: "" });
    setStreaming(true);

    try {
      const attachedFiles = currentAttachments.filter((a) => a.status === "ready").map((a) => a.file);

      // Check for image generation
      const isImageGen = /generate image|create image|draw|dalle|image of|picture of|illustrate/i.test(userContent);
      if (isImageGen) {
        try {
          const { ImageGenerationSystem } = await import("../../core/imageGen/ImageGenerationSystem");
          const result = await ImageGenerationSystem.generate({ prompt: userContent });
          const imageUrls = result.images.map((img) => img.url ? img.url : `data:image/png;base64,${img.base64}`);
          const imageMarkdown = imageUrls.map((url, i) => `![Generated Image ${i + 1}](${url})`).join("\n\n");
          const responseText = `Here ${imageUrls.length === 1 ? "is" : "are"} the generated image${imageUrls.length > 1 ? "s" : ""}:\n\n${imageMarkdown}`;
          updateLastMessage(responseText, { workspaceType: "image", generatedImages: imageUrls });
          setStreaming(false); setLoading(false); setAbortController(null);
          return;
        } catch { /* fall through to LLM */ }
      }

      // Build enhanced prompt with file context
      let enhancedPrompt = userContent || "Please analyze these files.";
      if (attachedFiles.length > 0) {
        const parsedFiles = currentAttachments.filter((a) => a.parsed).map((a) => a.parsed!);
        enhancedPrompt = Phase14Integration.buildEnhancedPrompt(
          { userMessage: enhancedPrompt, attachedFiles },
          parsedFiles,
          { hasFiles: true, hasImages: false, hasVoice: false, fileTypes: parsedFiles.map((f) => f.type), detectedIntent: "file_analysis", requiresVision: false, requiresImageGen: false, requiresVoice: false }
        );
      }

      const historyMessages = messages.map((m) => ({ id: m.id, role: m.role, content: m.content, timestamp: m.timestamp }));

      await orchestratorRef.current.execute(
        [...historyMessages, { id: "temp", role: "user" as const, content: enhancedPrompt, timestamp: Date.now() }],
        {
          onChunk: (chunk: string) => {
            const currentMessages = useChatStore.getState().messages;
            const lastMsg = currentMessages[currentMessages.length - 1];
            updateLastMessage(lastMsg.content + chunk);
          },
          onComplete: (fullText: string, metadata?: Record<string, any>) => {
            const detection = SmartWorkspaceDetector.detect(userContent, fullText);
            updateLastMessage(fullText, { ...metadata, workspaceType: detection.type, workspaceLanguage: detection.language });
            if (metadata?.selectedMode) setDisplayMode(metadata.selectedMode);
            setStreaming(false); setLoading(false); setAbortController(null);
          },
          onError: (err: Error) => {
            updateLastMessage("Error: " + err.message);
            setStreaming(false); setLoading(false); setAbortController(null);
          },
        },
        controller.signal
      );
    } catch {
      setLoading(false); setStreaming(false);
    }
  }, [input, attachments, isLoading, messages, addMessage, updateLastMessage, setLoading, setStreaming, setAbortController, setDisplayMode]);

  const handleExport = useCallback(async (content: string, format: ExportFormat, title?: string) => {
    setIsExporting(true);
    try {
      await DocumentGenerator.download({ content, format, title, filename: `omni-${Date.now()}` });
    } catch (err) { console.error("Export failed:", err); }
    finally { setIsExporting(false); setShowExportMenu(null); }
  }, []);

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !isLoading;

  return (
    <DropZoneWrapper onFilesAdded={handleFilesAdded} disabled={isLoading}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-ink-800/80 bg-ink-900/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button onClick={onToggleSidebar} className="p-1.5 rounded-lg hover:bg-ink-800 text-ink-400 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-ink-200">Chat</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-800 text-ink-500 uppercase tracking-wider">{displayMode}</span>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 scrollbar-thin">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-20 animate-in fade-in duration-700">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center font-bold text-2xl text-white shadow-xl shadow-blue-900/30 mb-5 animate-in scale-in duration-500">O</div>
                <h2 className="text-2xl font-bold text-ink-100 mb-2">Welcome to Omni One</h2>
                <p className="text-ink-400 max-w-md">Your AI orchestrator. Ask anything, attach files, use voice, generate images, and more.</p>
                <div className="mt-6 flex flex-wrap gap-2 justify-center">
                  {["📎 Attach any file","🎙️ Voice input","🖼️ Generate images","📊 Analyze data","💻 Write code","📄 Export to PDF"].map((hint) => (
                    <span key={hint} className="text-xs px-3 py-1.5 rounded-full bg-ink-800 text-ink-400 border border-ink-700">{hint}</span>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className="group relative">
                <MessageComponent message={{ ...m, displayMode } as EnhancedChatMessage} />
                {m.role === "assistant" && m.content && (
                  <div className="absolute -right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="relative">
                      <button
                        onClick={() => setShowExportMenu(showExportMenu === m.id ? null : m.id)}
                        disabled={isExporting}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-ink-500 hover:text-ink-200 bg-ink-800 hover:bg-ink-700 border border-ink-700 rounded-lg transition-colors"
                        title="Export response"
                      >
                        <span>↓</span><span>Export</span>
                      </button>
                      {showExportMenu === m.id && (
                        <div className="absolute right-0 top-full mt-1 z-50 bg-ink-800 border border-ink-700 rounded-lg shadow-xl min-w-[140px]">
                          {EXPORT_FORMATS.map(({ format, label, icon }) => (
                            <button key={format} onClick={() => handleExport(m.content, format, `Omni One — ${m.content.slice(0, 50)}`)}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-ink-300 hover:bg-ink-700 hover:text-white transition-colors first:rounded-t-lg last:rounded-b-lg">
                              <span>{icon}</span><span>{label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="px-4 md:px-8 pb-5 pt-2">
          <div className="max-w-3xl mx-auto">
            {agentProgress && (
              <div className="mb-3 bg-ink-800/60 border border-ink-700 p-3 rounded-xl animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-bold text-blue-400">{agentProgress.agentName}</span>
                  <span className="text-xs text-ink-500 uppercase tracking-wider">{agentProgress.status}</span>
                </div>
                <div className="w-full bg-ink-700 rounded-full h-1.5 mb-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-1.5 rounded-full transition-all duration-300" style={{ width: `${agentProgress.progress}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-ink-400">
                  <span className="truncate max-w-[80%]">{agentProgress.currentStep || agentProgress.message}</span>
                  <span className="font-mono">{agentProgress.progress}%</span>
                </div>
              </div>
            )}

            <div className="relative bg-ink-800/60 border border-ink-700 rounded-2xl focus-within:border-blue-500/50 focus-within:shadow-lg focus-within:shadow-blue-900/10 transition-all">
              {attachments.length > 0 && (
                <div className="px-4 pt-3">
                  <ChatAttachments attachments={attachments} onAttachmentsChange={setAttachments} onRemove={handleRemoveAttachment} disabled={isLoading} />
                </div>
              )}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={attachments.length > 0 ? "Ask about the attached files..." : "Ask anything... (Shift+Enter for new line)"}
                rows={1}
                disabled={isLoading}
                className="w-full bg-transparent border-none rounded-2xl px-5 py-4 pr-28 focus:outline-none resize-none text-ink-100 placeholder-ink-500 disabled:opacity-50 scrollbar-thin"
              />
              <div className="flex items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-1">
                  <button onClick={() => fileInputRef.current?.click()} disabled={isLoading}
                    className="flex items-center justify-center w-9 h-9 rounded-lg text-ink-400 hover:text-white hover:bg-ink-700 transition-colors disabled:opacity-50" title="Attach file">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <VoiceButton onTranscription={handleVoiceTranscription} disabled={isLoading} />
                  {attachments.length > 0 && (
                    <span className="text-xs text-ink-500 ml-1">{attachments.length} file{attachments.length > 1 ? "s" : ""}</span>
                  )}
                </div>
                <div>
                  {isStreaming ? (
                    <button onClick={stopGenerating} className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/20">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                    </button>
                  ) : (
                    <button onClick={handleSend} disabled={!canSend} className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-900/20">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {isLoading && !isStreaming && !agentProgress && (
              <div className="mt-3 flex items-center gap-2 px-1">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                </div>
                <span className="text-[10px] text-ink-500 font-medium uppercase tracking-widest">Thinking...</span>
              </div>
            )}
            <p className="mt-3 text-center text-[10px] text-ink-600">Omni One can make mistakes. Verify important information.</p>
          </div>
        </div>

        <input ref={fileInputRef} type="file" multiple className="hidden"
          accept=".pdf,.docx,.txt,.csv,.xlsx,.xls,.json,.md,.markdown,.png,.jpg,.jpeg,.gif,.webp,.svg,.zip"
          onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length > 0) handleFilesAdded(files); e.target.value = ""; }} />

        {showExportMenu && <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(null)} />}
      </div>
    </DropZoneWrapper>
  );
};

export default Chat;
