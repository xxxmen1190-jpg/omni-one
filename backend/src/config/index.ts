/**
 * Configuration Layer — Omni One Backend
 *
 * Loads and validates all environment variables at startup.
 * The application will refuse to start if required variables are missing or invalid.
 */

import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import type { AppConfig, NodeEnv } from "../types/index.js";

// ─── Load .env file manually (no dotenv side-effects at module level) ─────────

function loadEnvFile(): void {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

// ─── Env Schema ───────────────────────────────────────────────────────────────

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "testing"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default("0.0.0.0"),

  APP_NAME: z.string().default("omni-one-backend"),
  APP_VERSION: z.string().default("1.0.0"),
  BUILD_NUMBER: z.string().default("local"),

  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60000),

  // AI providers — optional at startup; checked at request time
  OPENAI_API_KEY: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().default(""),
  GEMINI_API_KEY: z.string().default(""),
  GROQ_API_KEY: z.string().default(""),
  OPENROUTER_API_KEY: z.string().default(""),

  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  LOG_PRETTY: z.string().transform((v) => v === "true").default("true"),

  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_PATH: z.string().default("./storage"),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
});

// ─── Parse & Validate ─────────────────────────────────────────────────────────

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`[Config] Environment validation failed:\n${issues}`);
}

const env = parsed.data;

// ─── Build Config Object ──────────────────────────────────────────────────────

export const config: AppConfig = {
  nodeEnv: env.NODE_ENV as NodeEnv,
  port: env.PORT,
  host: env.HOST,
  appName: env.APP_NAME,
  appVersion: env.APP_VERSION,
  buildNumber: env.BUILD_NUMBER,
  cors: {
    origins: env.CORS_ORIGINS.split(",").map((o) => o.trim()),
  },
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  },
  ai: {
    openaiApiKey: env.OPENAI_API_KEY,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    groqApiKey: env.GROQ_API_KEY,
    openrouterApiKey: env.OPENROUTER_API_KEY,
  },
  logging: {
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
  },
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
  },
  storage: {
    provider: env.STORAGE_PROVIDER as "local" | "s3",
    path: env.STORAGE_PATH,
    s3: {
      region: env.S3_REGION,
      bucket: env.S3_BUCKET,
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      endpoint: env.S3_ENDPOINT,
    },
  },
};

export const isDevelopment = config.nodeEnv === "development";
export const isProduction = config.nodeEnv === "production";
export const isTesting = config.nodeEnv === "testing";
