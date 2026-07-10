/**
 * Auth Store — Omni One Frontend
 *
 * Manages authentication state with real backend integration.
 * Handles: login, register, logout, guest mode, session restore, auto-login.
 */

import { create } from "zustand";
import {
  authApi,
  setSessionToken,
  clearSessionToken,
  getSessionToken,
  type User,
  type LoginRequest,
  type RegisterRequest,
  ApiError,
} from "../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthStatus =
  | "idle"        // Not yet checked
  | "loading"     // Checking session / logging in
  | "authenticated"
  | "guest"
  | "unauthenticated";

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
  isGuest: boolean;

  // Actions
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  enterGuestMode: () => void;
  exitGuestMode: () => void;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

// ─── Guest User ───────────────────────────────────────────────────────────────

const GUEST_USER: User = {
  id: "guest",
  email: "guest@omni-one.local",
  displayName: "Guest",
  role: "USER",
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "idle",
  error: null,
  isGuest: false,

  // ── Login ──────────────────────────────────────────────────────────────────
  login: async (data: LoginRequest) => {
    set({ status: "loading", error: null });
    try {
      const result = await authApi.login(data);
      setSessionToken(result.token);
      set({
        user: result.user,
        status: "authenticated",
        isGuest: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Login failed. Please try again.";
      set({ status: "unauthenticated", error: message });
      throw err;
    }
  },

  // ── Register ───────────────────────────────────────────────────────────────
  register: async (data: RegisterRequest) => {
    set({ status: "loading", error: null });
    try {
      const result = await authApi.register(data);
      setSessionToken(result.token);
      set({
        user: result.user,
        status: "authenticated",
        isGuest: false,
        error: null,
      });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Registration failed. Please try again.";
      set({ status: "unauthenticated", error: message });
      throw err;
    }
  },

  // ── Logout ─────────────────────────────────────────────────────────────────
  logout: async () => {
    const { isGuest } = get();
    set({ status: "loading", error: null });
    try {
      if (!isGuest) {
        await authApi.logout();
      }
    } catch {
      // Ignore logout errors — clear session regardless
    } finally {
      clearSessionToken();
      set({
        user: null,
        status: "unauthenticated",
        isGuest: false,
        error: null,
      });
    }
  },

  // ── Guest Mode ─────────────────────────────────────────────────────────────
  enterGuestMode: () => {
    clearSessionToken();
    set({
      user: GUEST_USER,
      status: "guest",
      isGuest: true,
      error: null,
    });
  },

  exitGuestMode: () => {
    set({
      user: null,
      status: "unauthenticated",
      isGuest: false,
      error: null,
    });
  },

  // ── Session Restore ────────────────────────────────────────────────────────
  restoreSession: async () => {
    const token = getSessionToken();
    if (!token) {
      set({ status: "unauthenticated" });
      return;
    }

    set({ status: "loading", error: null });
    try {
      const result = await authApi.me({ retries: 1 });
      set({
        user: result.user,
        status: "authenticated",
        isGuest: false,
        error: null,
      });
    } catch (err) {
      // Token is invalid or expired
      clearSessionToken();
      set({
        user: null,
        status: "unauthenticated",
        error: null,
      });
    }
  },

  // ── Clear Error ────────────────────────────────────────────────────────────
  clearError: () => set({ error: null }),
}));

export default useAuthStore;
