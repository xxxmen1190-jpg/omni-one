/**
 * OfflineBanner — Omni One Frontend
 *
 * Detects network connectivity and shows a reconnect banner.
 * Automatically hides when connection is restored.
 */

import React, { useState, useEffect, useCallback } from "react";

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return isOnline;
}

// ─── Banner Component ─────────────────────────────────────────────────────────

const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  const [wasOffline, setWasOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-center py-2 px-4 text-sm font-medium transition-all duration-300 ${
        !isOnline
          ? "bg-red-900/90 text-red-100 border-b border-red-700"
          : "bg-emerald-900/90 text-emerald-100 border-b border-emerald-700"
      }`}
    >
      {!isOnline ? (
        <>
          <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m-3.536-3.536a4 4 0 010-5.656M9.172 9.172a4 4 0 000 5.656m-3.536 3.536a9 9 0 010-12.728" />
          </svg>
          You are offline. Messages will be sent when connection is restored.
        </>
      ) : (
        <>
          <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Connection restored.
        </>
      )}
    </div>
  );
};

export default OfflineBanner;
