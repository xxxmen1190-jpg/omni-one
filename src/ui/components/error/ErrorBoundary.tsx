/**
 * ErrorBoundary — Omni One Frontend
 *
 * Unified React Error Boundary for the entire app.
 * Catches runtime errors and shows a graceful fallback UI.
 */

import React from "react";
import { ErrorTracker } from "../../../core/system/ErrorTracker";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

// ─── Fallback UI ──────────────────────────────────────────────────────────────

const DefaultFallback: React.FC<{
  error: Error | null;
  errorId?: string | null;
  onReset: () => void;
}> = ({ error, errorId, onReset }) => (
  <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-ink-900 border border-red-800/50 rounded-2xl p-8 text-center">
      <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-ink-100 mb-2">Something went wrong</h2>
      <p className="text-sm text-ink-400 mb-4">
        An unexpected error occurred. Your conversations and data are safe.
      </p>
      {errorId && (
        <div className="mb-4 px-3 py-1.5 bg-ink-950 border border-ink-800 rounded-lg">
          <p className="text-[10px] text-ink-500 font-mono">Error ID: {errorId}</p>
        </div>
      )}
      <div className="flex gap-3 justify-center">
        <button
          onClick={onReset}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-ink-800 hover:bg-ink-700 text-ink-200 text-sm font-medium rounded-lg transition-colors"
        >
          Reload Page
        </button>
      </div>
      {import.meta.env.DEV && error && (
        <details className="mt-4 text-left">
          <summary className="text-xs text-ink-500 cursor-pointer hover:text-ink-300">
            Error details (dev only)
          </summary>
          <pre className="mt-2 text-xs text-red-400 bg-ink-950 p-3 rounded overflow-auto max-h-40">
            {error.stack}
          </pre>
        </details>
      )}
    </div>
  </div>
);

// ─── Error Boundary Class ─────────────────────────────────────────────────────

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    const tracked = ErrorTracker.track(error, {
      operation: "ReactRenderError",
      extra: { componentStack: info.componentStack?.slice(0, 500) },
    });
    this.setState({ errorInfo: info, errorId: tracked.id });
    this.props.onError?.(error, info);
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <DefaultFallback error={this.state.error} errorId={this.state.errorId} onReset={this.handleReset} />
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
