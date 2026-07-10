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

export default Skeleton;
