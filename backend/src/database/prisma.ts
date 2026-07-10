/**
 * Prisma Client Utility — Omni One Backend
 *
 * Centralized Prisma client with logging and lifecycle management.
 */

import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { logger } from "../utils/logger.js";
import { config } from "../config/index.js";

const pool = new pg.Pool({ connectionString: config.database.url });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: config.nodeEnv === "development" ? ["query", "error", "warn"] : ["error"],
});

// ─── Logging Integration ──────────────────────────────────────────────────────

if (config.nodeEnv === "development") {
  // @ts-ignore - Prisma types for events are complex
  prisma.$on("query", (e: any) => {
    logger.debug({ query: e.query, params: e.params, duration: e.duration }, "Prisma Query");
  });
}

export { prisma };

/**
 * Test database connection.
 */
export async function testDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error({ err }, "Database connection failed");
    return false;
  }
}
