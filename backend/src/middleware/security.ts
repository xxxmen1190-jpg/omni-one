/**
 * Security Hardening Middleware — Omni One Backend
 *
 * Additional security measures beyond Helmet and basic rate limiting:
 * - Per-route rate limiting for sensitive endpoints
 * - Input sanitization helpers
 * - File upload security validation
 * - Request size enforcement
 * - Suspicious pattern detection
 */

import type { FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "../types/index.js";
import { logger } from "../utils/logger.js";

// ─── Allowed MIME Types (canonical list) ─────────────────────────────────────

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "text/markdown",
  "application/json",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/zip",
]);

// Dangerous MIME types that must never be accepted
const BLOCKED_MIME_TYPES = new Set([
  "application/x-executable",
  "application/x-msdownload",
  "application/x-sh",
  "application/x-bat",
  "text/x-script",
  "application/x-php",
  "application/javascript",
  "text/javascript",
]);

// Dangerous file extensions
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".sh", ".ps1", ".php", ".js", ".mjs",
  ".py", ".rb", ".pl", ".cgi", ".asp", ".aspx", ".jsp",
]);

// ─── File Upload Security Validator ──────────────────────────────────────────

export function validateFileUpload(
  filename: string,
  mimetype: string,
  size: number,
  maxSizeBytes = 50 * 1024 * 1024 // 50 MB default
): void {
  // Check file size
  if (size > maxSizeBytes) {
    throw new AppError(
      `File too large. Maximum size is ${Math.round(maxSizeBytes / 1024 / 1024)}MB.`,
      400,
      "UPLOAD_TOO_LARGE"
    );
  }

  // Check MIME type against blocklist
  if (BLOCKED_MIME_TYPES.has(mimetype.toLowerCase())) {
    logger.warn({ filename, mimetype }, "Blocked dangerous MIME type upload attempt");
    throw new AppError(`File type ${mimetype} is not allowed.`, 400, "INVALID_FILE_TYPE");
  }

  // Check MIME type against allowlist
  if (!ALLOWED_MIME_TYPES.has(mimetype.toLowerCase())) {
    throw new AppError(`File type ${mimetype} is not supported.`, 400, "INVALID_FILE_TYPE");
  }

  // Check file extension
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  if (BLOCKED_EXTENSIONS.has(ext)) {
    logger.warn({ filename, ext }, "Blocked dangerous file extension upload attempt");
    throw new AppError(`File extension ${ext} is not allowed.`, 400, "INVALID_FILE_TYPE");
  }

  // Detect MIME type / extension mismatch (basic check)
  const mimeExtMap: Record<string, string[]> = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
    "application/pdf": [".pdf"],
    "text/plain": [".txt", ".md", ".markdown"],
    "text/csv": [".csv"],
    "application/json": [".json"],
  };
  const expectedExts = mimeExtMap[mimetype.toLowerCase()];
  if (expectedExts && !expectedExts.includes(ext)) {
    logger.warn({ filename, mimetype, ext }, "MIME type / extension mismatch");
    // Log but don't block — some systems send wrong MIME types for valid files
  }
}

// ─── Input Sanitization ───────────────────────────────────────────────────────

/**
 * Strip null bytes and control characters from a string.
 * Prevents null byte injection and log injection attacks.
 */
export function sanitizeString(input: string, maxLength = 10000): string {
  return input
    .replace(/\0/g, "") // null bytes
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // control chars (except \t \n \r)
    .slice(0, maxLength);
}

/**
 * Validate and sanitize an email address.
 */
export function sanitizeEmail(email: string): string {
  const sanitized = email.trim().toLowerCase().slice(0, 254);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitized)) {
    throw new AppError("Invalid email address format.", 400, "VALIDATION_ERROR");
  }
  return sanitized;
}

// ─── Suspicious Request Detection ────────────────────────────────────────────

const SUSPICIOUS_PATTERNS = [
  /(<script|javascript:|on\w+=)/i, // XSS
  /(union\s+select|drop\s+table|insert\s+into)/i, // SQL injection
  /(\.\.\/)/, // Path traversal
  /(eval\(|exec\(|system\()/i, // Code injection
];

export function detectSuspiciousInput(input: string): boolean {
  return SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Middleware: Scan request body for suspicious patterns.
 * Logs and rejects requests with obvious injection attempts.
 */
export async function suspiciousRequestGuard(
  request: FastifyRequest,
  _reply: FastifyReply
): Promise<void> {
  const body = request.body;
  if (!body || typeof body !== "object") return;

  const bodyStr = JSON.stringify(body);
  if (detectSuspiciousInput(bodyStr)) {
    logger.warn(
      {
        ip: request.ip,
        path: request.url,
        method: request.method,
        bodyPreview: bodyStr.slice(0, 200),
      },
      "Suspicious request pattern detected"
    );
    throw new AppError(
      "Request contains invalid characters or patterns.",
      400,
      "VALIDATION_ERROR"
    );
  }
}

// ─── Auth-Specific Rate Limit Config ─────────────────────────────────────────

/**
 * Stricter rate limit options for authentication endpoints.
 * Use with @fastify/rate-limit per-route config.
 */
export const authRateLimitConfig = {
  max: 10,
  timeWindow: 60 * 1000, // 10 requests per minute per IP
  keyGenerator: (request: FastifyRequest) =>
    (request.headers["x-forwarded-for"] as string | undefined) ??
    request.ip ??
    "unknown",
  errorResponseBuilder: (_request: FastifyRequest, context: { ttl: number }) => ({
    success: false,
    requestId: "rate-limited",
    timestamp: new Date().toISOString(),
    error: {
      code: "RATE_LIMITED",
      message: `Too many authentication attempts. Please wait ${Math.ceil(context.ttl / 1000)} seconds.`,
      statusCode: 429,
    },
  }),
};

/**
 * Rate limit options for file upload endpoints.
 */
export const uploadRateLimitConfig = {
  max: 20,
  timeWindow: 60 * 1000, // 20 uploads per minute
  keyGenerator: (request: FastifyRequest) =>
    (request.headers["x-forwarded-for"] as string | undefined) ??
    request.ip ??
    "unknown",
};

// ─── Session Security Checks ──────────────────────────────────────────────────

/**
 * Validate that a session token has the expected format.
 * Prevents obviously malformed tokens from hitting the database.
 */
export function isValidTokenFormat(token: string): boolean {
  // Session tokens are 80-char hex strings (40 random bytes)
  return /^[a-f0-9]{80}$/.test(token);
}
