/**
 * Server Entry Point — Omni One Backend
 *
 * Starts the Fastify server and handles graceful shutdown.
 */

import { buildApp } from "./app.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: config.port, host: config.host });
    logger.info(
      {
        port: config.port,
        host: config.host,
        env: config.nodeEnv,
        docs: `http://${config.host === "0.0.0.0" ? "localhost" : config.host}:${config.port}/docs`,
      },
      `Omni One Backend running`
    );
  } catch (err) {
    logger.fatal({ err }, "Failed to start server");
    process.exit(1);
  }

  // ── Graceful Shutdown ───────────────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutdown signal received, closing server...");
    try {
      await app.close();
      logger.info("Server closed gracefully");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled promise rejection");
    process.exit(1);
  });

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "Uncaught exception");
    process.exit(1);
  });
}

void start();
