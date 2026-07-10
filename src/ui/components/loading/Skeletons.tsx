/**
 * Skeleton Loading Components — Omni One Frontend
 *
 * Skeleton placeholders for conversations, messages, and general content.
 */

import React from "react";

// ─── Base Skeleton ────────────────────────────────────────────────────────────

const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div className={`animate-pulse bg-ink-800/60 rounded ${className}`} />
);

// ─── Conversation List Skeleton ───────────────────────────────────────────────

export const ConversationListSkeleton: React.FC<{ count?: number }> = ({
  count = 5,
}) => (
  <div className="space-y-1 p-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
        <Skeleton className="w-4 h-4 flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className={`h-3.5 ${i % 3 === 0 ? "w-3/4" : i % 3 === 1 ? "w-1/2" : "w-2/3"}`} />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      </div>
    ))}
  </div>
);

// ─── Message Skeleton ─────────────────────────────────────────────────────────

export const MessageSkeleton: React.FC<{ role?: "user" | "assistant" }> = ({
  role = "assistant",
}) => (
  <div className={`flex gap-3 ${role === "user" ? "flex-row-reverse" : ""}`}>
    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
    <div className={`space-y-2 max-w-[70%] ${role === "user" ? "items-end" : ""}`}>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-40" />
    </div>
  </div>
);

// ─── Chat Loading Skeleton ────────────────────────────────────────────────────

export const ChatLoadingSkeleton: React.FC = () => (
  <div className="flex flex-col gap-6 p-6">
    <MessageSkeleton role="user" />
    <MessageSkeleton role="assistant" />
    <MessageSkeleton role="user" />
    <MessageSkeleton role="assistant" />
  </div>
);

// ─── Generic Content Skeleton ─────────────────────────────────────────────────

export const ContentSkeleton: React.FC<{ lines?: number }> = ({ lines = 3 }) => (
  <div className="space-y-2 p-4">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        className={`h-4 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
      />
    ))}
  </div>
);

// ─── Spinner ──────────────────────────────────────────────────────────────────

export const Spinner: React.FC<{ size?: "sm" | "md" | "lg"; className?: string }> = ({
  size = "md",
  className = "",
}) => {
  const sizes = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-8 h-8" };
  return (
    <svg
      className={`animate-spin text-indigo-500 ${sizes[size]} ${className}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
};

// ─── Empty States ─────────────────────────────────────────────────────────────

export const EmptyConversations: React.FC<{ onNew?: () => void }> = ({ onNew }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center" role="status" aria-label="No conversations">
    <div className="w-12 h-12 rounded-2xl bg-ink-800 flex items-center justify-center mb-4">
      <svg className="w-6 h-6 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    </div>
    <p className="text-sm font-medium text-ink-300 mb-1">No conversations yet</p>
    <p className="text-xs text-ink-500 mb-4">Start a new conversation to get going.</p>
    {onNew && (
      <button
        onClick={onNew}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
      >
        New Conversation
      </button>
    )}
  </div>
);

export const EmptyChat: React.FC<{ userName?: string }> = ({ userName }) => (
  <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center" role="status" aria-label="Start chatting">
    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center mb-6">
      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-ink-100 mb-2">
      {userName ? `Welcome, ${userName}` : "Welcome to Omni One"}
    </h3>
    <p className="text-sm text-ink-400 max-w-sm leading-relaxed">
      Ask anything — research, code, analysis, writing, or use AI tools to get things done.
    </p>
    <div className="mt-6 grid grid-cols-2 gap-2 w-full max-w-xs">
      {["Summarize a document", "Write some code", "Research a topic", "Analyze data"].map((prompt) => (
        <div key={prompt} className="px-3 py-2 bg-ink-800/60 border border-ink-700 rounded-xl text-xs text-ink-400 text-center cursor-default select-none">
          {prompt}
        </div>
      ))}
    </div>
  </div>
);

export const EmptyFiles: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center" role="status" aria-label="No files">
    <div className="w-12 h-12 rounded-2xl bg-ink-800 flex items-center justify-center mb-4">
      <svg className="w-6 h-6 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    </div>
    <p className="text-sm font-medium text-ink-300 mb-1">No files uploaded</p>
    <p className="text-xs text-ink-500">Attach files to your conversations for analysis.</p>
  </div>
);

export const FullPageLoader: React.FC<{ message?: string }> = ({ message = "Loading..." }) => (
  <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center gap-4" role="status" aria-label={message}>
    <Spinner size="lg" />
    <p className="text-sm text-ink-400">{message}</p>
  </div>
);

export default Skeleton;
