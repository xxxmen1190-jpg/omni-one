/**
 * AuthScreen — Omni One Frontend
 *
 * Full-screen login / register / guest mode UI.
 * Handles: Login, Register, Guest Mode, form validation, error display.
 */

import React, { useState, useCallback } from "react";
import useAuthStore from "../../../store/useAuthStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type AuthMode = "login" | "register";

// ─── Icons ────────────────────────────────────────────────────────────────────

const OmniIcon = () => (
  <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
    <circle cx="20" cy="20" r="18" stroke="#6366f1" strokeWidth="2" />
    <circle cx="20" cy="20" r="10" stroke="#818cf8" strokeWidth="1.5" />
    <circle cx="20" cy="20" r="3" fill="#6366f1" />
    <line x1="20" y1="2" x2="20" y2="10" stroke="#6366f1" strokeWidth="1.5" />
    <line x1="20" y1="30" x2="20" y2="38" stroke="#6366f1" strokeWidth="1.5" />
    <line x1="2" y1="20" x2="10" y2="20" stroke="#6366f1" strokeWidth="1.5" />
    <line x1="30" y1="20" x2="38" y2="20" stroke="#6366f1" strokeWidth="1.5" />
  </svg>
);

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

// ─── Component ────────────────────────────────────────────────────────────────

const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { login, register, enterGuestMode, status, error, clearError } = useAuthStore();
  const isLoading = status === "loading";

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};
    if (!email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Invalid email address";
    if (!password) errors.password = "Password is required";
    else if (password.length < 8) errors.password = "Password must be at least 8 characters";
    if (mode === "register" && !displayName.trim()) errors.displayName = "Display name is required";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [email, password, displayName, mode]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      clearError();
      if (!validate()) return;
      try {
        if (mode === "login") {
          await login({ email, password });
        } else {
          await register({ email, password, displayName });
        }
      } catch {
        // Error is set in the store
      }
    },
    [mode, email, password, displayName, login, register, clearError, validate]
  );

  // ── Switch Mode ────────────────────────────────────────────────────────────
  const switchMode = useCallback(() => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setFieldErrors({});
    clearError();
  }, [clearError]);

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <OmniIcon />
          <h1 className="mt-3 text-2xl font-bold text-ink-50 tracking-tight">Omni One</h1>
          <p className="mt-1 text-sm text-ink-400">AI Orchestrator</p>
        </div>

        {/* Card */}
        <div className="bg-ink-900 border border-ink-800 rounded-2xl p-8 shadow-2xl">
          {/* Tab switcher */}
          <div className="flex rounded-lg bg-ink-950 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setFieldErrors({}); clearError(); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "login"
                  ? "bg-indigo-600 text-white"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setFieldErrors({}); clearError(); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "register"
                  ? "bg-indigo-600 text-white"
                  : "text-ink-400 hover:text-ink-200"
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Global error */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Display Name (register only) */}
            {mode === "register" && (
              <div>
                <label className="block text-xs font-medium text-ink-300 mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  disabled={isLoading}
                  className={`w-full px-3 py-2.5 bg-ink-950 border rounded-lg text-ink-100 text-sm placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    fieldErrors.displayName ? "border-red-500" : "border-ink-700"
                  }`}
                />
                {fieldErrors.displayName && (
                  <p className="mt-1 text-xs text-red-400">{fieldErrors.displayName}</p>
                )}
              </div>
            )}

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete={mode === "login" ? "email" : "email"}
                disabled={isLoading}
                className={`w-full px-3 py-2.5 bg-ink-950 border rounded-lg text-ink-100 text-sm placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                  fieldErrors.email ? "border-red-500" : "border-ink-700"
                }`}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-ink-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "register" ? "Min. 8 characters" : "Your password"}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  disabled={isLoading}
                  className={`w-full px-3 py-2.5 pr-10 bg-ink-950 border rounded-lg text-ink-100 text-sm placeholder-ink-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                    fieldErrors.password ? "border-red-500" : "border-ink-700"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-200 transition-colors"
                  tabIndex={-1}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-red-400">{fieldErrors.password}</p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === "login" ? "Signing in..." : "Creating account..."}
                </>
              ) : (
                mode === "login" ? "Sign In" : "Create Account"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-ink-800" />
            <span className="text-xs text-ink-500">or</span>
            <div className="flex-1 h-px bg-ink-800" />
          </div>

          {/* Guest Mode */}
          <button
            type="button"
            onClick={enterGuestMode}
            disabled={isLoading}
            className="w-full py-2.5 bg-ink-800 hover:bg-ink-700 disabled:opacity-50 text-ink-200 text-sm font-medium rounded-lg transition-colors"
          >
            Continue as Guest
          </button>

          {/* Switch mode link */}
          <p className="mt-5 text-center text-xs text-ink-500">
            {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={switchMode}
              className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
            >
              {mode === "login" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
