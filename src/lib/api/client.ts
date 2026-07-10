/**
 * ApiClient — Omni One Frontend
 *
 * Unified HTTP client for all backend communication.
 * Features: retries, timeout, request cancellation, automatic token handling,
 * typed responses, and SSE streaming support.
 */

import { ApiError, type ApiSuccessResponse } from "./types";

// ─── Configuration ────────────────────────────────────────────────────────────

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3000/api";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 3;
const RETRY_DELAY_MS = 500;
const RETRY_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// ─── Token Storage ────────────────────────────────────────────────────────────

let _sessionToken: string | null = null;

export function setSessionToken(token: string | null): void {
  _sessionToken = token;
  if (token) {
    // Persist across page reloads (only the token, not sensitive data)
    sessionStorage.setItem("omni_session_token", token);
  } else {
    sessionStorage.removeItem("omni_session_token");
  }
}

export function getSessionToken(): string | null {
  if (_sessionToken) return _sessionToken;
  const stored = sessionStorage.getItem("omni_session_token");
  if (stored) {
    _sessionToken = stored;
    return stored;
  }
  return null;
}

export function clearSessionToken(): void {
  _sessionToken = null;
  sessionStorage.removeItem("omni_session_token");
}

// ─── Request Options ──────────────────────────────────────────────────────────

export interface RequestOptions {
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
  /** Timeout in milliseconds (default: 30s) */
  timeoutMs?: number;
  /** Number of retry attempts on transient errors (default: 3) */
  retries?: number;
  /** Skip auth header (for public endpoints) */
  skipAuth?: boolean;
  /** Custom headers */
  headers?: Record<string, string>;
}

// ─── Retry Helper ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryable(status: number): boolean {
  return RETRY_STATUS_CODES.has(status);
}

// ─── Core Fetch ───────────────────────────────────────────────────────────────

async function fetchWithRetry<T>(
  url: string,
  init: RequestInit,
  options: RequestOptions
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Merge abort signals: user-provided + timeout
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  const signals: AbortSignal[] = [timeoutController.signal];
  if (options.signal) signals.push(options.signal);

  // Combine signals (AbortSignal.any is available in modern browsers)
  const combinedSignal =
    typeof AbortSignal.any === "function"
      ? AbortSignal.any(signals)
      : timeoutController.signal;

  const requestInit: RequestInit = {
    ...init,
    signal: combinedSignal,
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, requestInit);
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to parse error body
        let errorBody: { error?: { code?: string; message?: string; statusCode?: number } } = {};
        try {
          errorBody = (await response.json()) as typeof errorBody;
        } catch {
          // ignore parse errors
        }

        const errCode = errorBody?.error?.code ?? "HTTP_ERROR";
        const errMsg = errorBody?.error?.message ?? `HTTP ${response.status}`;
        const errStatus = errorBody?.error?.statusCode ?? response.status;

        // Don't retry auth errors or client errors (except those in RETRY_STATUS_CODES)
        if (!isRetryable(response.status) || attempt === retries) {
          throw new ApiError(errCode, errMsg, errStatus, errorBody?.error);
        }

        lastError = new ApiError(errCode, errMsg, errStatus);
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      // Parse JSON response
      const data = (await response.json()) as ApiSuccessResponse<T>;
      return data.data;
    } catch (err) {
      clearTimeout(timeoutId);

      // Don't retry on abort/cancel
      if (err instanceof DOMException && err.name === "AbortError") {
        if (timeoutController.signal.aborted) {
          throw new ApiError("TIMEOUT", "Request timed out", 408);
        }
        throw new ApiError("CANCELLED", "Request was cancelled", 0);
      }

      if (err instanceof ApiError) {
        if (!isRetryable(err.statusCode) || attempt === retries) throw err;
        lastError = err;
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt === retries) {
          throw new ApiError("NETWORK_ERROR", lastError.message, 0);
        }
      }

      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
    }
  }

  throw lastError ?? new ApiError("UNKNOWN", "Unknown error", 0);
}

// ─── Build Headers ────────────────────────────────────────────────────────────

function buildHeaders(options: RequestOptions, extra?: Record<string, string>): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: "application/json",
    ...extra,
    ...options.headers,
  });

  if (!options.skipAuth) {
    const token = getSessionToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  return headers;
}

// ─── ApiClient ────────────────────────────────────────────────────────────────

export const apiClient = {
  // ── GET ────────────────────────────────────────────────────────────────────
  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return fetchWithRetry<T>(
      `${API_BASE_URL}${path}`,
      {
        method: "GET",
        headers: buildHeaders(options),
      },
      options
    );
  },

  // ── POST ───────────────────────────────────────────────────────────────────
  async post<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return fetchWithRetry<T>(
      `${API_BASE_URL}${path}`,
      {
        method: "POST",
        headers: buildHeaders(options),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      options
    );
  },

  // ── PUT ────────────────────────────────────────────────────────────────────
  async put<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return fetchWithRetry<T>(
      `${API_BASE_URL}${path}`,
      {
        method: "PUT",
        headers: buildHeaders(options),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      options
    );
  },

  // ── PATCH ──────────────────────────────────────────────────────────────────
  async patch<T>(path: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
    return fetchWithRetry<T>(
      `${API_BASE_URL}${path}`,
      {
        method: "PATCH",
        headers: buildHeaders(options),
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      options
    );
  },

  // ── DELETE ─────────────────────────────────────────────────────────────────
  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return fetchWithRetry<T>(
      `${API_BASE_URL}${path}`,
      {
        method: "DELETE",
        headers: buildHeaders(options),
      },
      options
    );
  },

  // ── UPLOAD (multipart/form-data) ───────────────────────────────────────────
  async upload<T>(
    path: string,
    formData: FormData,
    options: RequestOptions & {
      onProgress?: (percent: number) => void;
    } = {}
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${API_BASE_URL}${path}`;

      xhr.open("POST", url);

      // Auth header
      if (!options.skipAuth) {
        const token = getSessionToken();
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }

      // Custom headers (skip Content-Type — browser sets it with boundary)
      if (options.headers) {
        for (const [key, value] of Object.entries(options.headers)) {
          if (key.toLowerCase() !== "content-type") {
            xhr.setRequestHeader(key, value);
          }
        }
      }

      // Progress
      if (options.onProgress) {
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            options.onProgress!(Math.round((e.loaded / e.total) * 100));
          }
        });
      }

      // Timeout
      xhr.timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      xhr.ontimeout = () => reject(new ApiError("TIMEOUT", "Upload timed out", 408));

      // Abort signal
      if (options.signal) {
        options.signal.addEventListener("abort", () => {
          xhr.abort();
          reject(new ApiError("CANCELLED", "Upload cancelled", 0));
        });
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const parsed = JSON.parse(xhr.responseText) as ApiSuccessResponse<T>;
            resolve(parsed.data);
          } catch {
            reject(new ApiError("PARSE_ERROR", "Failed to parse response", 500));
          }
        } else {
          try {
            const err = JSON.parse(xhr.responseText) as {
              error?: { code?: string; message?: string; statusCode?: number };
            };
            reject(
              new ApiError(
                err.error?.code ?? "HTTP_ERROR",
                err.error?.message ?? `HTTP ${xhr.status}`,
                err.error?.statusCode ?? xhr.status
              )
            );
          } catch {
            reject(new ApiError("HTTP_ERROR", `HTTP ${xhr.status}`, xhr.status));
          }
        }
      };

      xhr.onerror = () => reject(new ApiError("NETWORK_ERROR", "Network error during upload", 0));

      xhr.send(formData);
    });
  },

  // ── SSE STREAM ────────────────────────────────────────────────────────────
  streamPost(
    path: string,
    body: unknown,
    options: RequestOptions & {
      onChunk: (chunk: string) => void;
      onDone?: () => void;
      onError?: (err: Error) => void;
    }
  ): AbortController {
    const controller = new AbortController();
    const url = `${API_BASE_URL}${path}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    };

    if (!options.skipAuth) {
      const token = getSessionToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }

    void (async () => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          let errBody: { error?: { code?: string; message?: string } } = {};
          try {
            errBody = (await response.json()) as typeof errBody;
          } catch { /* ignore */ }
          throw new ApiError(
            errBody.error?.code ?? "STREAM_ERROR",
            errBody.error?.message ?? `HTTP ${response.status}`,
            response.status
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6).trim();
              if (data === "[DONE]") {
                options.onDone?.();
                return;
              }
              options.onChunk(data);
            }
          }
        }

        options.onDone?.();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        options.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    })();

    return controller;
  },
};

export default apiClient;
