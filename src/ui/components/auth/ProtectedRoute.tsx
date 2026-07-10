/**
 * ProtectedRoute — Omni One Frontend
 *
 * Wraps the app with authentication gating.
 * Handles: session restore on mount, loading state, redirect to auth screen.
 */

import React, { useEffect } from "react";
import useAuthStore from "../../../store/useAuthStore";
import AuthScreen from "./AuthScreen";

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

const AppLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-ink-950 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <svg className="w-8 h-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <p className="text-sm text-ink-400">Restoring session...</p>
    </div>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { status, restoreSession } = useAuthStore();

  // On mount: try to restore session from stored token
  useEffect(() => {
    if (status === "idle") {
      void restoreSession();
    }
  }, [status, restoreSession]);

  // Still checking
  if (status === "idle" || status === "loading") {
    return <AppLoadingScreen />;
  }

  // Not authenticated and not guest
  if (status === "unauthenticated") {
    return <AuthScreen />;
  }

  // Authenticated or guest
  return <>{children}</>;
};

export default ProtectedRoute;
