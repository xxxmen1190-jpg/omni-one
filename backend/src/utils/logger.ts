/**
 * Centralized Logger — Omni One Backend
 *
 * All application logging MUST go through this module.
 * console.log / console.error / console.warn are forbidden in application code.
 */

import pino from "pino";
import { config } from "../config/index.js";

const transport =
  config.logging.pretty && config.nodeEnv !== "production"
    ? pino.transport({
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
          messageFormat: "{msg}",
        },
      })
    : undefined;

export const logger = pino(
  {
    level: config.logging.level,
    base: {
      env: config.nodeEnv,
      version: config.appVersion,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      err: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers['x-api-key']",
        "*.apiKey",
        "*.api_key",
        "*.password",
        "*.secret",
        "*.token",
      ],
      censor: "[REDACTED]",
    },
  },
  transport
);

/**
 * Create a child logger with a specific context (e.g., per-request logger).
 */
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}
